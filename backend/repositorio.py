"""
Camada de gravação no Supabase (Fase 3).

Recebe as `acoes` estruturadas pelo extrator e persiste nas tabelas do Manejo
Certo. É a fronteira com o banco — nenhuma regra de IA aqui.

Estratégia de autenticação:
  O servidor grava com a SERVICE ROLE KEY (secreta, server-side), que ignora o
  RLS. Por isso, definimos `user_id` explicitamente em CADA insert. O dono é
  resolvido a partir do número de WhatsApp (por ora, single-tenant via env).

Degrada com elegância: sem SUPABASE_URL/SERVICE_ROLE_KEY, `_client()` devolve
None e a gravação vira "dry-run" (loga o que faria), para testar sem banco.
"""

from __future__ import annotations

import os
import re
from datetime import date, datetime, timezone

from supabase import Client, create_client

# Nomes reais das tabelas (prefixo do app confirmado no banco de produção).
TABELA_ANIMAIS = "app_34b6ab49dc_animais"
TABELA_PESAGENS = "app_34b6ab49dc_pesagens_animal"
TABELA_TRANSACOES = "app_34b6ab49dc_transacoes"
TABELA_WPP = "app_34b6ab49dc_wpp_processados"  # controle de idempotência
TABELA_VINCULOS = "app_34b6ab49dc_whatsapp_vinculos"  # multi-tenant wa_id↔user

# Um código de pareamento sozinho na mensagem (ex.: "AB3X9K" ou "vincular AB3X9K").
_CODIGO_RE = re.compile(r"^\s*(?:vincular\s+)?([A-Za-z0-9]{6})\s*$", re.IGNORECASE)

_cliente: Client | None = None


def _client() -> Client | None:
    """Cria (uma vez) o cliente com service role. None se faltam credenciais."""
    global _cliente
    if _cliente is not None:
        return _cliente
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    _cliente = create_client(url, key)
    return _cliente


def resolver_user_id(wa_id: str) -> str | None:
    """Descobre a qual cliente pertence este número de WhatsApp.

    Consulta a tabela de vínculos (wa_id já pareado a um user_id). Retorna None
    se o número ainda não foi vinculado — nesse caso o fluxo tenta o pareamento.
    Sem banco (dry-run local), cai no MANEJO_USER_ID do .env.
    """
    sb = _client()
    if sb is None:
        return os.getenv("MANEJO_USER_ID")  # dry-run / teste local
    try:
        r = (
            sb.table(TABELA_VINCULOS)
            .select("user_id")
            .eq("wa_id", wa_id)
            .eq("status", "vinculado")
            .limit(1)
            .execute()
        )
        if r.data:
            return r.data[0]["user_id"]
    except Exception as e:  # noqa: BLE001 — tabela ausente não deve travar
        print(f"[repositorio] falha ao resolver vínculo ({e}).")
    return None


def tentar_vincular(wa_id: str, texto: str) -> bool:
    """Se `texto` for um código de pareamento pendente, vincula o wa_id a ele.

    Retorna True se vinculou agora; False se o texto não é um código válido/
    pendente (aí o fluxo pede pro produtor gerar o código no app).
    """
    sb = _client()
    if sb is None:
        return False
    m = _CODIGO_RE.match(texto or "")
    if not m:
        return False
    codigo = m.group(1).upper()
    try:
        achado = (
            sb.table(TABELA_VINCULOS)
            .select("id,status")
            .eq("codigo", codigo)
            .limit(1)
            .execute()
        )
        if not achado.data or achado.data[0]["status"] == "vinculado":
            return False
        sb.table(TABELA_VINCULOS).update(
            {
                "wa_id": wa_id,
                "status": "vinculado",
                "linked_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", achado.data[0]["id"]).execute()
        return True
    except Exception as e:  # noqa: BLE001 — ex.: wa_id já vinculado a outro
        print(f"[repositorio] falha ao vincular ({e}).")
        return False


# --------------------------------------------------------------------------- #
# Idempotência: a Meta reenvia o webhook se demorarmos. Sem isso, um reenvio
# duplicaria transações financeiras (pesagem é protegida por chave única/dia).
# --------------------------------------------------------------------------- #
def ja_processada(wamid: str, user_id: str) -> bool:
    """Registra a mensagem como processada. True se JÁ havia sido (deve pular).

    Se a tabela de controle não existir (migração não aplicada), a dedup fica
    desligada de forma silenciosa — não bloqueia a gravação.
    """
    sb = _client()
    if sb is None or not wamid:
        return False
    try:
        existe = (
            sb.table(TABELA_WPP)
            .select("wamid")
            .eq("wamid", wamid)
            .limit(1)
            .execute()
        )
        if existe.data:
            return True
        sb.table(TABELA_WPP).insert(
            {"wamid": wamid, "user_id": user_id}
        ).execute()
        return False
    except Exception as e:  # noqa: BLE001 — tabela ausente/erro não deve travar
        print(f"[repositorio] dedup indisponível ({e}); seguindo sem dedup.")
        return False


# --------------------------------------------------------------------------- #
# Gravação das ações
# --------------------------------------------------------------------------- #
def gravar_acoes(user_id: str, acoes: list[dict]) -> list[dict]:
    """Persiste cada ação. Retorna um resumo por ação (para log/telemetria)."""
    sb = _client()
    resultados: list[dict] = []

    for acao in acoes:
        tipo = acao.get("tipo")
        if sb is None:
            resultados.append({"tipo": tipo, "status": "dry-run"})
            continue
        try:
            if tipo == "pesagem":
                r = _gravar_pesagem(sb, user_id, acao)
            elif tipo == "nascimento":
                r = _gravar_nascimento(sb, user_id, acao)
            elif tipo == "vacina":
                r = _gravar_vacina(sb, user_id, acao)
            elif tipo == "financeiro":
                r = _gravar_financeiro(sb, user_id, acao)
            else:
                r = {"tipo": tipo, "status": "ignorado"}
        except Exception as e:  # noqa: BLE001 — uma ação ruim não derruba as outras
            r = {"tipo": tipo, "status": "erro", "detalhe": str(e)}
        resultados.append(r)

    return resultados


def _buscar_ou_criar_animal(
    sb: Client,
    user_id: str,
    brinco: str | None,
    sexo: str | None = None,
    origem: str | None = None,
) -> str:
    """Acha o animal pelo brinco visual; se não existir, cria. Retorna o id.

    É o coração do fluxo de curral: o produtor vai "etiquetando" o rebanho ao
    citar brincos que ainda não estão cadastrados.
    """
    if brinco:
        achado = (
            sb.table(TABELA_ANIMAIS)
            .select("id")
            .eq("user_id", user_id)
            .eq("brinco_visual", str(brinco))
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if achado.data:
            return achado.data[0]["id"]

    novo = {"user_id": user_id, "status": "ativo"}
    if brinco:
        novo["brinco_visual"] = str(brinco)
    if sexo:
        novo["sexo"] = sexo
    if origem:
        novo["origem"] = origem
    criado = sb.table(TABELA_ANIMAIS).insert(novo).execute()
    return criado.data[0]["id"]


def _gravar_pesagem(sb: Client, user_id: str, acao: dict) -> dict:
    peso = acao.get("peso_kg")
    if not peso:
        return {"tipo": "pesagem", "status": "incompleto", "motivo": "sem peso"}

    animal_id = _buscar_ou_criar_animal(
        sb, user_id, acao.get("brinco"), sexo=acao.get("sexo")
    )
    data_p = acao.get("data") or date.today().isoformat()
    registro = {
        "user_id": user_id,
        "animal_id": animal_id,
        "data_pesagem": data_p,
        "peso_kg": peso,
    }

    # 1 peso por animal por dia (índice único). Reenvio/repesagem = update.
    existe = (
        sb.table(TABELA_PESAGENS)
        .select("id")
        .eq("animal_id", animal_id)
        .eq("data_pesagem", data_p)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    )
    if existe.data:
        sb.table(TABELA_PESAGENS).update({"peso_kg": peso}).eq(
            "id", existe.data[0]["id"]
        ).execute()
        acao_status = "atualizado"
    else:
        sb.table(TABELA_PESAGENS).insert(registro).execute()
        acao_status = "criado"

    return {
        "tipo": "pesagem",
        "status": acao_status,
        "animal_id": animal_id,
        "peso_kg": peso,
    }


def _gravar_nascimento(sb: Client, user_id: str, acao: dict) -> dict:
    obs = acao.get("observacao") or ""
    mae = acao.get("brinco_mae")
    if mae:
        obs = f"{obs} | mãe: brinco {mae}".strip(" |")

    novo = {"user_id": user_id, "origem": "nascimento", "status": "ativo"}
    if acao.get("brinco"):
        novo["brinco_visual"] = str(acao["brinco"])
    if acao.get("sexo"):
        novo["sexo"] = acao["sexo"]
    if acao.get("data"):
        novo["data_nascimento"] = acao["data"]
    if obs:
        novo["observacao"] = obs

    criado = sb.table(TABELA_ANIMAIS).insert(novo).execute()
    return {"tipo": "nascimento", "status": "criado", "animal_id": criado.data[0]["id"]}


def _gravar_vacina(sb: Client, user_id: str, acao: dict) -> dict:
    # Decisão de produto: vacina fica como OBSERVAÇÃO no animal (sem tabela
    # própria por ora). Sem brinco (ex.: "lote todo") não há animal-alvo.
    brinco = acao.get("brinco")
    if not brinco:
        return {
            "tipo": "vacina",
            "status": "pulado",
            "motivo": "vacina sem brinco (lote todo) ainda não é registrável",
        }

    animal_id = _buscar_ou_criar_animal(sb, user_id, brinco)
    quando = acao.get("data") or date.today().isoformat()
    produto = acao.get("vacina") or "não especificado"
    nota = f"[{quando}] sanidade: {produto}"
    if acao.get("observacao"):
        nota += f" ({acao['observacao']})"

    atual = (
        sb.table(TABELA_ANIMAIS)
        .select("observacao")
        .eq("id", animal_id)
        .single()
        .execute()
    )
    obs_atual = (atual.data or {}).get("observacao") or ""
    nova_obs = f"{obs_atual}\n{nota}".strip()
    sb.table(TABELA_ANIMAIS).update({"observacao": nova_obs}).eq(
        "id", animal_id
    ).execute()
    return {"tipo": "vacina", "status": "anotado", "animal_id": animal_id}


def _gravar_financeiro(sb: Client, user_id: str, acao: dict) -> dict:
    mov = acao.get("mov_tipo")
    valor = acao.get("valor")
    if not mov or valor is None:
        return {"tipo": "financeiro", "status": "incompleto"}

    registro = {
        "user_id": user_id,
        "tipo": mov,  # RECEITA | DESPESA
        "categoria": acao.get("categoria") or "OUTROS",
        "valor": valor,
        "data": acao.get("data") or date.today().isoformat(),
        "descricao": acao.get("observacao") or "Lançado via WhatsApp",
    }
    # NB: venda/compra de gado grava só o lado financeiro; a baixa/entrada no
    # rebanho (RPC registrar_venda_saida) é decisão à parte, fora da Fase 3.
    criado = sb.table(TABELA_TRANSACOES).insert(registro).execute()
    return {
        "tipo": "financeiro",
        "status": "criado",
        "transacao_id": criado.data[0]["id"],
        "valor": valor,
    }
