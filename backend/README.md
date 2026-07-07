# Manejo Certo — Backend (ingestão via WhatsApp)

Serviço Python que recebe mensagens do pecuarista (texto/áudio via WhatsApp),
entende com IA e grava no Supabase. Construído por partes.

## Fase atual: POC do extrator (`poc_extrator.py`)

Valida **só a inteligência**: frase em linguagem natural → JSON estruturado.
Ainda **não** conecta WhatsApp nem banco.

### Como rodar

```bash
# 1. (recomendado) ambiente virtual isolado
python -m venv venv
venv\Scripts\activate        # Windows PowerShell:  venv\Scripts\Activate.ps1

# 2. dependências
pip install -r requirements.txt

# 3. chave da OpenAI
copy .env.example .env       # depois edite .env e cole sua OPENAI_API_KEY

# 4. rodar o banco de frases de teste
python poc_extrator.py

# ...ou testar uma frase sua:
python poc_extrator.py "nasceu um bezerro macho da vaca 88 ontem"
```

## Fase 1: Webhook FastAPI (`main.py` + `whatsapp.py`)

Recebe mensagens do WhatsApp, chama `extrair()` e responde a confirmação ao
produtor. Áudio ainda é stub (Fase 2) e nada é gravado ainda (Fase 3).

### Rodar local

```bash
uvicorn main:app --reload --port 8000
```

- `GET  /`        → healthcheck
- `GET  /webhook` → verificação da Meta (handshake com `WHATSAPP_VERIFY_TOKEN`)
- `POST /webhook` → recebe mensagens; processa em background e responde 200 na hora

### Conectar à Meta (desenvolvimento)

A Meta exige uma URL HTTPS pública. Use um túnel:

```bash
ngrok http 8000
```

No painel **Meta > WhatsApp > Configuration**, cadastre `https://SEU-TUNEL/webhook`
como Callback URL e use o mesmo `WHATSAPP_VERIFY_TOKEN` do `.env` como Verify Token.

### Testar sem a Meta (payload simulado)

Sem `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`, o envio de resposta cai em
"dry-run" (imprime no terminal em vez de chamar a Meta). Dá para simular um
recebimento com curl — veja exemplo em `test_webhook.http` / no README abaixo.

## Fase 2: Transcrição de áudio com Whisper (`transcricao.py`)

Nota de voz do WhatsApp agora é entendida. O webhook só recebe um `media_id`;
o fluxo é: `media_id` → URL temporária → baixar bytes (`whatsapp.baixar_audio`)
→ Whisper (`transcricao.transcrever`) → mesmo `extrair()` do texto.

Detalhes:
- `language="pt"` + prompt de vocabulário de curral (brinco, arroba, aftosa…)
  para o Whisper acertar o jargão.
- Na confirmação de áudio, devolvemos o que foi ouvido (`🎙️ Ouvi: "..."`) para
  o produtor conferir, já que voz pode ser mal transcrita.

## Próximas fases

3. **Gravação no Supabase** — mapear cada `acao` para INSERT/UPDATE
   (falta criar tabela de vacinas; tratar deduplicação por `wamid` e
   confirmação em lote na migração).
