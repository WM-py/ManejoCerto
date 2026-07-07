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

## Fase 3: Gravação no Supabase (`repositorio.py`)

Cada `acao` extraída vira INSERT/UPDATE nas tabelas do Manejo Certo
(`animais`, `pesagens_animal`, `transacoes`), com dedup por `wamid`
(`wpp_processados`) e resolução multi-tenant do dono via `whatsapp_vinculos`
(código de pareamento gerado em Parâmetros → WhatsApp no app).

## Deploy em produção (sair do laptop + ngrok)

Hoje o serviço só roda localmente (`run.bat` + túnel ngrok), o que exige seu
PC ligado e uma URL que muda a cada restart do túnel — inviável para clientes
reais. Para produção, hospede como um serviço web comum (já tem `Procfile` e
`.python-version` prontos):

**Opção recomendada: Railway** (mais previsível, sem cold start — importante
porque a Meta espera resposta rápida do webhook).
1. Crie um projeto novo apontando para este repo, com **root directory
   `backend/`**.
2. Railway detecta Python via Nixpacks e usa o `Procfile` automaticamente.
3. Configure as variáveis de ambiente (mesmas do `.env`, ver lista abaixo).
4. Deploy gera uma URL pública HTTPS fixa (`https://SEU-APP.up.railway.app`).

**Alternativa gratuita: Render** (free tier, mas o serviço "dorme" após
inatividade e leva ~30-50s para acordar no primeiro request — risco de a
Meta considerar o webhook lento/atrasado em rajadas pouco frequentes).
Mesmo `Procfile`, root directory `backend/`.

### Variáveis de ambiente no host (dashboard do Railway/Render)

Copie os valores do seu `backend/.env` local — **não** commitar o `.env` em
si (já é ignorado pelo git):

| Variável | Necessária? |
|---|---|
| `OPENAI_API_KEY` | sim |
| `OPENAI_MODEL`, `OPENAI_WHISPER_MODEL`, `RENDIMENTO_CARCACA` | opcional (têm padrão) |
| `WHATSAPP_VERIFY_TOKEN` | sim |
| `WHATSAPP_TOKEN` | sim — **trocar pelo token permanente** (System User no Meta Business Suite); o gerado em "API Setup" expira em ~24h e não serve para produção |
| `WHATSAPP_PHONE_NUMBER_ID` | sim |
| `WHATSAPP_APP_SECRET` | recomendado (valida assinatura dos webhooks) |
| `WHATSAPP_API_VERSION` | opcional (padrão v21.0) |
| `SUPABASE_URL` | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | sim |
| `MANEJO_USER_ID` | **não precisa** — só usado no dry-run local sem banco; produção resolve o dono via `whatsapp_vinculos` |

### Depois do deploy

No painel **Meta > WhatsApp > Configuration**, troque a Callback URL do
webhook de `https://SEU-TUNEL-NGROK/webhook` para
`https://SEU-APP-EM-PRODUCAO/webhook`, mantendo o mesmo
`WHATSAPP_VERIFY_TOKEN`. Teste com `GET /` (healthcheck) antes de recadastrar.

## Próximas fases

- Confirmação em lote na migração de histórico (resumo "47 pesagens,
  confirma?", em vez de 1 a 1).
- Tabela própria de vacinas/sanidade (hoje grava como observação livre).
