"""
Camada de integração com a WhatsApp Cloud API (Meta).

Responsabilidades:
  - Interpretar o payload que a Meta manda no webhook (parse de entrada).
  - Enviar mensagens de volta ao produtor (parse de saída).

Não contém regra de negócio nem IA — é só o "correio". Assim, se um dia
trocarmos WhatsApp por Telegram, só este arquivo muda.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import sys
from dataclasses import dataclass
from datetime import date, datetime, timezone

import httpx

GRAPH_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v21.0")


def log(msg: str) -> None:
    """print() seguro: no console do Windows (cp1252) emojis quebram com
    UnicodeEncodeError. Aqui trocamos o que não couber por '?' em vez de
    derrubar o processamento."""
    try:
        print(msg)
    except UnicodeEncodeError:
        enc = sys.stdout.encoding or "utf-8"
        print(msg.encode(enc, errors="replace").decode(enc))


@dataclass
class MensagemRecebida:
    """Uma mensagem já normalizada, independente do formato cru da Meta."""

    de: str  # número do remetente (wa_id), ex.: "5511999999999"
    tipo: str  # "text" | "audio" | outro
    texto: str | None  # corpo, quando for texto
    audio_id: str | None  # media_id do áudio, quando for áudio (Fase 2)
    data: date  # data da mensagem (do timestamp), p/ resolver "hoje"/"ontem"
    id_mensagem: str  # wamid — útil para deduplicação futura


def verificar_assinatura(corpo: bytes, cabecalho_assinatura: str | None) -> bool:
    """Confirma que o POST veio mesmo da Meta (header X-Hub-Signature-256).

    Só é aplicado se WHATSAPP_APP_SECRET estiver definido — assim o
    desenvolvimento local (curl/testes) continua simples.
    """
    app_secret = os.getenv("WHATSAPP_APP_SECRET")
    if not app_secret:
        return True  # verificação desligada (ambiente de dev)

    if not cabecalho_assinatura or not cabecalho_assinatura.startswith("sha256="):
        return False

    esperado = hmac.new(
        app_secret.encode(), corpo, hashlib.sha256
    ).hexdigest()
    recebido = cabecalho_assinatura.removeprefix("sha256=")
    return hmac.compare_digest(esperado, recebido)


def extrair_mensagens(payload: dict) -> list[MensagemRecebida]:
    """Achata o payload aninhado da Meta numa lista de MensagemRecebida.

    Ignora eventos que não são mensagens de entrada (ex.: 'statuses' de
    entrega/leitura), que chegam no mesmo webhook.
    """
    mensagens: list[MensagemRecebida] = []

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for msg in value.get("messages", []):
                tipo = msg.get("type", "desconhecido")
                mensagens.append(
                    MensagemRecebida(
                        de=msg.get("from", ""),
                        tipo=tipo,
                        texto=(msg.get("text") or {}).get("body"),
                        audio_id=(msg.get("audio") or {}).get("id"),
                        data=_data_do_timestamp(msg.get("timestamp")),
                        id_mensagem=msg.get("id", ""),
                    )
                )
    return mensagens


def _data_do_timestamp(ts: str | None) -> date:
    """Converte o timestamp unix (string) da Meta em date; hoje se ausente."""
    if not ts:
        return date.today()
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).date()
    except (ValueError, OverflowError, OSError):
        return date.today()


# Mapa mime -> extensão, para nomear o arquivo que o Whisper vai ler.
# Nota de voz do WhatsApp costuma vir como audio/ogg (codec opus).
_EXT_POR_MIME = {
    "audio/ogg": "ogg",
    "audio/opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/amr": "amr",
    "audio/wav": "wav",
    "audio/webm": "webm",
}


def nome_arquivo_audio(mime: str) -> str:
    """Nome com extensão coerente ao mime — o SDK do Whisper usa isso p/ decodar."""
    # mime pode vir como "audio/ogg; codecs=opus" -> pega só o tipo base.
    base = mime.split(";")[0].strip().lower()
    return f"audio.{_EXT_POR_MIME.get(base, 'ogg')}"


def baixar_audio(media_id: str) -> tuple[bytes, str]:
    """Baixa o áudio de uma mensagem de voz. Retorna (bytes, mime_type).

    A Cloud API entrega áudio em 2 passos: o webhook só traz um `media_id`;
    primeiro resolvemos o media_id numa URL temporária, depois baixamos os bytes
    (ambas as chamadas exigem o Bearer token).
    """
    token = os.getenv("WHATSAPP_TOKEN")
    if not token:
        raise RuntimeError("WHATSAPP_TOKEN ausente — não dá para baixar a mídia.")

    cabecalho = {"Authorization": f"Bearer {token}"}

    # 1) media_id -> metadados (inclui a URL de download)
    meta = httpx.get(
        f"https://graph.facebook.com/{GRAPH_API_VERSION}/{media_id}",
        headers=cabecalho,
        timeout=15,
    )
    meta.raise_for_status()
    info = meta.json()
    url = info["url"]
    mime = info.get("mime_type", "audio/ogg")

    # 2) baixar os bytes do arquivo (mesma autenticação)
    binario = httpx.get(url, headers=cabecalho, timeout=30)
    binario.raise_for_status()
    return binario.content, mime


def enviar_texto(para: str, texto: str) -> None:
    """Envia uma mensagem de texto de volta ao produtor via Cloud API.

    Requer WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID no ambiente. Silencioso
    em caso de erro de rede — a POC não deve derrubar o webhook por isso; em
    produção isto vira log/retry.
    """
    token = os.getenv("WHATSAPP_TOKEN")
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    if not token or not phone_id:
        log(f"[whatsapp] (dry-run, sem credenciais) -> {para}: {texto}")
        return

    url = f"https://graph.facebook.com/{GRAPH_API_VERSION}/{phone_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": para,
        "type": "text",
        "text": {"body": texto},
    }
    try:
        resposta = httpx.post(
            url,
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
            timeout=15,
        )
        resposta.raise_for_status()
    except httpx.HTTPError as e:
        log(f"[whatsapp] falha ao enviar para {para}: {e}")
