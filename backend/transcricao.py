"""
Camada de transcrição de áudio (OpenAI Whisper).

Recebe os bytes de um áudio (nota de voz do WhatsApp) e devolve o texto. Fica
separada do extrator porque é uma etapa opcional do fluxo: só entra quando a
mensagem é de voz. Depois de transcrever, o texto segue pelo MESMO caminho de
uma mensagem digitada.
"""

from __future__ import annotations

import io
import os

from openai import OpenAI

# whisper-1 é o modelo de transcrição da OpenAI; barato e ótimo com português.
MODELO_TRANSCRICAO = os.getenv("OPENAI_WHISPER_MODEL", "whisper-1")

# "Dica" de vocabulário: o Whisper usa este prompt como contexto para acertar
# jargão de curral que ele erraria (brinco, arroba, aftosa, brucelose...).
_PROMPT_CONTEXTO = (
    "Áudio de um pecuarista brasileiro registrando manejo do rebanho. "
    "Termos comuns: brinco, bezerro, novilha, vaca, boi, garrote, "
    "peso em quilos e arrobas, GMD, aftosa, brucelose, ivermectina, "
    "vermífugo, nascimento, pesagem, lote, pasto."
)


def transcrever(audio_bytes: bytes, nome_arquivo: str = "audio.ogg") -> str:
    """Transcreve os bytes de áudio para texto em português.

    O SDK da OpenAI descobre o formato pela extensão do `name` do arquivo, por
    isso passamos um nome coerente com o mime (ver whatsapp.nome_arquivo_audio).
    """
    client = OpenAI()  # lê OPENAI_API_KEY do ambiente

    arquivo = io.BytesIO(audio_bytes)
    arquivo.name = nome_arquivo

    resposta = client.audio.transcriptions.create(
        model=MODELO_TRANSCRICAO,
        file=arquivo,
        language="pt",  # fixa português: melhora muito com sotaque regional
        prompt=_PROMPT_CONTEXTO,
    )
    return resposta.text.strip()
