"""
Manejo Certo — Webhook FastAPI (Fase 1).

Recebe mensagens do WhatsApp Cloud API, entende com o extrator (POC) e responde
ao produtor com a confirmação. AINDA sem banco (Supabase vem na Fase 3) e sem
transcrição de áudio (Whisper vem na Fase 2).

Rodar local:
    uvicorn main:app --reload --port 8000

Expor para a Meta durante o desenvolvimento (a Meta precisa de HTTPS público):
    ngrok http 8000
E cadastrar a URL https://.../webhook no painel do WhatsApp, usando o mesmo
WHATSAPP_VERIFY_TOKEN do seu .env.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, Request, Response

import whatsapp
import repositorio
from poc_extrator import extrair
from transcricao import transcrever

load_dotenv()

app = FastAPI(title="Manejo Certo — Ingestão WhatsApp")


@app.get("/")
def health() -> dict:
    """Healthcheck simples (útil para uptime/monitoramento)."""
    return {"status": "ok", "servico": "manejo-certo-ingestao"}


# --------------------------------------------------------------------------- #
# 1. Verificação do webhook (handshake exigido pela Meta ao cadastrar a URL).
#    A Meta faz um GET com hub.challenge; devolvemos o challenge se o token bate.
# --------------------------------------------------------------------------- #
@app.get("/webhook")
def verificar_webhook(request: Request) -> Response:
    params = request.query_params
    modo = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge", "")

    esperado = os.getenv("WHATSAPP_VERIFY_TOKEN")
    if modo == "subscribe" and token and token == esperado:
        return Response(content=challenge, media_type="text/plain")

    return Response(content="Verificação falhou", status_code=403)


# --------------------------------------------------------------------------- #
# 2. Recebimento de mensagens.
#    Regra de ouro da Meta: responder 200 RÁPIDO. Por isso validamos, agendamos
#    o processamento pesado (LLM) em background e retornamos na hora.
# --------------------------------------------------------------------------- #
@app.post("/webhook")
async def receber_webhook(
    request: Request, background: BackgroundTasks
) -> Response:
    corpo = await request.body()

    if not whatsapp.verificar_assinatura(
        corpo, request.headers.get("X-Hub-Signature-256")
    ):
        return Response(content="Assinatura inválida", status_code=403)

    payload = await request.json()
    for msg in whatsapp.extrair_mensagens(payload):
        background.add_task(processar_mensagem, msg)

    # 200 imediato — a Meta reenvia se demorarmos.
    return Response(status_code=200)


def processar_mensagem(msg: whatsapp.MensagemRecebida) -> None:
    """Núcleo do fluxo: (áudio->texto) -> extrator -> confirmação de volta.

    Roda fora do ciclo request/response (BackgroundTasks), então pode chamar o
    Whisper e o LLM sem estourar o timeout do webhook.
    """
    texto, veio_de_audio = _obter_texto(msg)
    if texto is None:
        return  # _obter_texto já respondeu ao produtor

    # 1) De qual cliente é este número? (multi-tenant)
    user_id = repositorio.resolver_user_id(msg.de)
    if not user_id:
        _fluxo_nao_vinculado(msg, texto)
        return

    # 2) Cliente conhecido → entende e grava.
    try:
        resultado = extrair(texto, data_referencia=msg.data)
    except Exception as e:  # noqa: BLE001 — POC: nunca deixar o produtor no vácuo
        whatsapp.log(f"[processar] erro no extrator: {e}")
        whatsapp.enviar_texto(
            msg.de,
            "Tive um probleminha para entender agora. Pode repetir? 🙏",
        )
        return

    _gravar(msg, user_id, resultado.get("acoes", []))

    resposta = resultado.get("resumo_para_produtor") or "Recebido!"
    if veio_de_audio:
        # No áudio o Whisper pode ter ouvido errado; mostramos o que entendemos
        # para o produtor conferir junto com o resumo.
        resposta = f'🎙️ Ouvi: "{texto}"\n\n{resposta}'
    whatsapp.enviar_texto(msg.de, resposta)


def _fluxo_nao_vinculado(msg: whatsapp.MensagemRecebida, texto: str) -> None:
    """Número ainda não pertence a nenhuma fazenda: tenta parear ou orienta."""
    if repositorio.tentar_vincular(msg.de, texto):
        whatsapp.enviar_texto(
            msg.de,
            "✅ Número vinculado à sua fazenda! Agora é só me mandar o dia a dia: "
            "pesagens, nascimentos, vacinas e gastos. 🐂",
        )
        return
    whatsapp.enviar_texto(
        msg.de,
        "Ainda não reconheço este número. 👋\nAbra o Manejo Certo → Parâmetros → "
        "*Conectar WhatsApp*, gere seu código e me envie aqui para ativar.",
    )


def _gravar(
    msg: whatsapp.MensagemRecebida, user_id: str, acoes: list[dict]
) -> None:
    """Persiste as ações no Supabase, com dedup por wamid.

    Confirmação interativa ("responda SIM") é da Fase 5 — aqui gravamos e o
    resumo já pergunta "Confere?". Falha de gravação é logada, não quebra o
    fluxo (o produtor ainda recebe a confirmação de entendimento).
    """
    if repositorio.ja_processada(msg.id_mensagem, user_id):
        whatsapp.log(f"[gravacao] wamid {msg.id_mensagem} já processado; pulando.")
        return

    resultados = repositorio.gravar_acoes(user_id, acoes)
    whatsapp.log(f"[gravacao] {resultados}")


def _obter_texto(msg: whatsapp.MensagemRecebida) -> tuple[str | None, bool]:
    """Normaliza a mensagem em texto puro. Retorna (texto, veio_de_audio).

    Se não der para obter texto (tipo não suportado, falha ao baixar/transcrever),
    responde ao produtor e devolve (None, ...) para encerrar o processamento.
    """
    if msg.tipo == "text" and msg.texto:
        return msg.texto, False

    if msg.tipo == "audio" and msg.audio_id:
        try:
            audio_bytes, mime = whatsapp.baixar_audio(msg.audio_id)
            texto = transcrever(
                audio_bytes, nome_arquivo=whatsapp.nome_arquivo_audio(mime)
            )
        except Exception as e:  # noqa: BLE001 — rede/Whisper podem falhar
            whatsapp.log(f"[processar] falha ao transcrever áudio: {e}")
            whatsapp.enviar_texto(
                msg.de,
                "Não consegui ouvir seu áudio agora. Pode mandar de novo ou "
                "escrever por texto? 🙏",
            )
            return None, True
        if not texto:
            whatsapp.enviar_texto(
                msg.de,
                "Seu áudio chegou sem som que eu entendesse. Pode repetir? 🎙️",
            )
            return None, True
        return texto, True

    whatsapp.enviar_texto(
        msg.de,
        "Por enquanto entendo texto e áudio. Me diz o que aconteceu no "
        "rebanho. 🐂",
    )
    return None, False
