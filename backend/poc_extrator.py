"""
Manejo Certo — POC do "cérebro" de ingestão por linguagem natural.

Objetivo desta prova de conceito:
    Validar SÓ a inteligência do sistema. Recebe uma frase solta do pecuarista
    (como se tivesse chegado por WhatsApp) e devolve um JSON estruturado com as
    ações e dados extraídos — SEM tocar em WhatsApp nem no Supabase ainda.

Fluxo real (futuro): WhatsApp -> [áudio -> Whisper] -> texto -> ESTE extrator
    -> valida -> grava no Supabase -> confirma no WhatsApp.

Como rodar:
    1. pip install -r requirements.txt
    2. copie .env.example para .env e preencha OPENAI_API_KEY
    3. python poc_extrator.py
       (ou passe uma frase: python poc_extrator.py "nasceu um bezerro macho da vaca 88")
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# gpt-4o-mini: barato, rápido e suporta "Structured Outputs" (JSON garantido).
MODELO = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Rendimento de carcaça: fração do peso vivo que vira carcaça no abate.
# Usado para converter peso dito em ARROBA (carcaça) para peso vivo (balança).
# Varia por raça/acabamento — por isso é configurável. Padrão 50%.
RENDIMENTO_CARCACA = float(os.getenv("RENDIMENTO_CARCACA", "0.50"))


# --------------------------------------------------------------------------- #
# 1. O contrato de saída (JSON Schema)
#
# Isto é o coração da POC. Em vez de "pedir por favor" pro modelo devolver JSON,
# usamos Structured Outputs: a OpenAI GARANTE que a resposta obedece este schema.
# Quando plugarmos o Supabase, cada "acao" vira quase 1:1 um INSERT.
# --------------------------------------------------------------------------- #
SCHEMA_SAIDA = {
    "name": "registro_manejo",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "acoes": {
                "type": "array",
                "description": "Uma entrada por evento identificado na mensagem. "
                "Uma frase pode conter vários (ex.: pesagem de 2 animais).",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "tipo": {
                            "type": "string",
                            "enum": [
                                "pesagem",
                                "nascimento",
                                "vacina",
                                "financeiro",
                                "desconhecido",
                            ],
                            "description": "Categoria do evento.",
                        },
                        "brinco": {
                            "type": ["string", "null"],
                            "description": "Identificador visual do animal "
                            "(brinco). Null se não mencionado.",
                        },
                        "peso_kg": {
                            "type": ["number", "null"],
                            "description": "Peso em quilos. Só para pesagem.",
                        },
                        "sexo": {
                            "type": ["string", "null"],
                            "enum": ["Macho", "Fêmea", None],
                            "description": "Sexo do animal. Útil em nascimento.",
                        },
                        "brinco_mae": {
                            "type": ["string", "null"],
                            "description": "Brinco da mãe. Só para nascimento.",
                        },
                        "vacina": {
                            "type": ["string", "null"],
                            "description": "Nome da vacina/medicamento aplicado.",
                        },
                        "mov_tipo": {
                            "type": ["string", "null"],
                            "enum": ["RECEITA", "DESPESA", None],
                            "description": "Só para financeiro: entrou dinheiro "
                            "(RECEITA) ou saiu (DESPESA).",
                        },
                        "categoria": {
                            "type": ["string", "null"],
                            "enum": [
                                "VENDA_GADO",
                                "COMPRA_GADO",
                                "INSUMOS",
                                "INFRA",
                                "MAQUINARIO",
                                "PESSOAL",
                                "OUTROS",
                                "NUTRICAO",
                                "SANIDADE",
                                "COMBUSTIVEL",
                                "FRETE",
                                "ARRENDAMENTO",
                                "IMPOSTOS",
                                None,
                            ],
                            "description": "Só para financeiro: categoria da "
                            "transação (deve ser uma das listadas).",
                        },
                        "valor": {
                            "type": ["number", "null"],
                            "description": "Só para financeiro: valor em reais "
                            "(R$). Ex.: 'cinquenta mil' -> 50000.",
                        },
                        "data": {
                            "type": ["string", "null"],
                            "description": "Data do evento em ISO AAAA-MM-DD. "
                            "Resolva termos relativos ('hoje', 'ontem') usando "
                            "a data de referência informada. Null se ausente.",
                        },
                        "confianca": {
                            "type": "string",
                            "enum": ["alta", "media", "baixa"],
                            "description": "Sua confiança na extração deste item.",
                        },
                        "observacao": {
                            "type": ["string", "null"],
                            "description": "Qualquer dado extra dito pelo produtor "
                            "que não caiba nos campos acima.",
                        },
                    },
                    "required": [
                        "tipo",
                        "brinco",
                        "peso_kg",
                        "sexo",
                        "brinco_mae",
                        "vacina",
                        "mov_tipo",
                        "categoria",
                        "valor",
                        "data",
                        "confianca",
                        "observacao",
                    ],
                },
            },
            "precisa_confirmacao": {
                "type": "boolean",
                "description": "true se algo ficou ambíguo e vale confirmar com "
                "o produtor antes de gravar.",
            },
            "resumo_para_produtor": {
                "type": "string",
                "description": "Frase curta, em português coloquial, confirmando "
                "o que foi entendido — como seria enviada de volta no WhatsApp.",
            },
        },
        "required": ["acoes", "precisa_confirmacao", "resumo_para_produtor"],
        "additionalProperties": False,
    },
}


def montar_system_prompt(data_referencia: date, rendimento: float) -> str:
    """System prompt rigoroso: define papel, regras e a data de referência.

    A data e o rendimento de carcaça são injetados aqui (não fixos no prompt)
    para o modelo resolver 'hoje'/'ontem' e a conversão de arroba corretamente —
    em produção a data virá do timestamp da mensagem do WhatsApp.
    """
    return f"""Você é o motor de extração de dados do "Manejo Certo", um sistema
de gestão de pecuária de corte no Brasil. Sua ÚNICA função é ler mensagens que
o pecuarista manda (digitadas ou transcritas de áudio, muitas vezes em linguagem
informal, com sotaque regional e sem pontuação) e transformá-las em registros
estruturados.

DATA DE REFERÊNCIA (hoje): {data_referencia.isoformat()}
Use-a para resolver expressões relativas: "hoje" = essa data, "ontem" = o dia
anterior, "anteontem" = dois dias antes, etc.

RENDIMENTO DE CARCAÇA: {rendimento:.2f} (fração do peso vivo que vira carcaça).

REGRAS:
1. Extraia UMA ação por evento. Se a frase cita 2 animais pesados, gere 2 ações.
2. PESO (campo peso_kg, sempre em kg de PESO VIVO — o que a balança mostra):
   - Dito em "quilos"/"kg" -> use o valor direto.
   - Dito em "arroba"/"@" -> é peso de CARCAÇA. Converta para peso vivo:
     peso_kg = arrobas × 15 ÷ {rendimento:.2f}.
     Ex. (rendimento {rendimento:.2f}): "18 arrobas" -> 18×15÷{rendimento:.2f} = {18*15/rendimento:.0f} kg vivo.
     Marque confianca "media" quando o peso vier em arroba (é uma estimativa).
3. Palavras comuns do campo:
   - "brinco", "número", "o 102", "de número 102" -> campo brinco.
   - "nasceu", "pariu", "cria", "bezerro novo" -> tipo nascimento.
   - "vacinei", "apliquei", "dose", nomes como "aftosa", "brucelose",
     "ivermectina" -> tipo vacina.
   - "pesei", "deu X quilos", "bateu" -> tipo pesagem.
4. FINANCEIRO (tipo "financeiro"): quando a mensagem falar em dinheiro.
   - "paguei", "comprei", "gastei", "saiu", "custou" -> mov_tipo DESPESA.
   - "vendi", "recebi", "entrou", "caiu", "ganhei" -> mov_tipo RECEITA.
   - Preencha `valor` em reais: "mil"=1000, "50 mil"=50000, "2,5 mil"=2500.
   - Escolha a `categoria` pelo contexto:
     ração/sal/silagem -> NUTRICAO; vacina/remédio/veterinário -> SANIDADE;
     salário/diária/peão -> PESSOAL; diesel/gasolina -> COMBUSTIVEL;
     frete/transporte -> FRETE; arame/cerca/adubo/semente -> INSUMOS;
     trator/implemento -> MAQUINARIO; benfeitoria/curral/galpão -> INFRA;
     arrendamento/aluguel de pasto -> ARRENDAMENTO; imposto/taxa -> IMPOSTOS;
     venda de gado/boi/bezerro -> VENDA_GADO; compra de gado -> COMPRA_GADO;
     sem encaixe claro -> OUTROS.
   - Use `descricao`? Não há campo; ponha o detalhe livre em `observacao`.
   - Venda de gado também dá baixa no rebanho, mas AQUI registre só o lado
     financeiro; deixe confianca "media" para venda/compra de gado.
6. NÃO invente dados. Se um campo não foi dito, deixe null.
7. Se a mensagem não tiver nada de manejo nem financeiro (ex.: "bom dia"),
   retorne uma única ação tipo "desconhecido" e precisa_confirmacao = true.
8. Marque confianca "baixa" ou "media" quando o texto for ambíguo, e ligue
   precisa_confirmacao = true nesses casos.
9. resumo_para_produtor deve ser curto e humano, para reenvio no WhatsApp.
   Ex.: "Anotei: bezerro 102 com 450 kg e bezerro 105 com 460 kg. Confere?"
"""


def extrair(mensagem: str, data_referencia: date | None = None) -> dict:
    """Envia a mensagem ao LLM e devolve o dicionário estruturado já validado."""
    if data_referencia is None:
        data_referencia = date.today()

    client = OpenAI()  # lê OPENAI_API_KEY do ambiente

    resposta = client.chat.completions.create(
        model=MODELO,
        temperature=0,  # determinístico: extração não é lugar de criatividade
        messages=[
            {
                "role": "system",
                "content": montar_system_prompt(
                    data_referencia, RENDIMENTO_CARCACA
                ),
            },
            {"role": "user", "content": mensagem},
        ],
        response_format={"type": "json_schema", "json_schema": SCHEMA_SAIDA},
    )

    return json.loads(resposta.choices[0].message.content)


# --------------------------------------------------------------------------- #
# Execução direta — pequeno "banco de testes" de frases reais de curral.
# --------------------------------------------------------------------------- #
FRASES_TESTE = [
    "hoje pesei o bezerro do brinco 102 e deu 450 quilos, e o 105 deu 460",
    "nasceu um bezerro macho da vaca de brinco 88 ontem",
    "vacinei o lote todo contra aftose hoje, apliquei tambem no 77 a ivermectina",
    "o boi 203 bateu 18 arroba na balanca",
    "paguei 3 mil e quinhentos de racao pro gado hoje",
    "vendi 10 bois por 50 mil ontem",
    "bom dia, tudo certo por ai?",
]


def main() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        sys.exit(
            "ERRO: defina OPENAI_API_KEY (copie .env.example para .env e preencha)."
        )

    # Se o usuário passou uma frase no terminal, testa só ela.
    frases = [" ".join(sys.argv[1:])] if len(sys.argv) > 1 else FRASES_TESTE

    for frase in frases:
        print("\n" + "=" * 70)
        print(f"MENSAGEM: {frase}")
        print("-" * 70)
        resultado = extrair(frase)
        print(json.dumps(resultado, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
