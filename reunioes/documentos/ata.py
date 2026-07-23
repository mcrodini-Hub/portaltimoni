"""Gera a Ata de reunião (DOCX, 1 página) no padrão fixo da Casa Timoni:

    1. Ata — resumo da discussão
    2. Controle e Atendimento WhatsApp — feedback + dificuldades (opcional)
    3. Estoque — status do abastecimento
    4. Meta — posição atual + dificuldades
    5. Desafio de Vendas — resultados + funcionamento + dificuldades
    6. Feedback — checklist operacional
    7. Próxima Reunião — data confirmada

Participantes são marcados com ✓ (presente) / ✗ (ausente).
"""

from .estilos import (
    checklist_item,
    conteudo_secao,
    lista_participantes,
    novo_documento,
    subtitulo_documento,
    titulo_documento,
    titulo_secao,
)

SECOES_FIXAS = [
    ('whatsapp', 'Controle e Atendimento WhatsApp'),
    ('estoque', 'Estoque'),
    ('meta', 'Meta'),
    ('desafio_vendas', 'Desafio de Vendas'),
]


def build_ata(dados):
    """dados: dict com loja, data, participantes (lista de strings ou de
    {"nome":..., "presente": bool}), ata, whatsapp (opcional), estoque,
    meta, desafio_vendas, feedback (lista de perguntas do checklist),
    proxima_reuniao. Retorna um docx.Document pronto para salvar."""
    doc = novo_documento()

    titulo_documento(doc, f"Ata de Reunião — {dados['loja']}")
    subtitulo_documento(doc, dados['data'])

    lista_participantes(doc, dados.get('participantes'))

    numero = 1
    titulo_secao(doc, f'{numero}. Ata')
    conteudo_secao(doc, dados['ata'])
    numero += 1

    for chave, titulo in SECOES_FIXAS:
        conteudo = dados.get(chave)
        if conteudo is None:
            continue
        titulo_secao(doc, f'{numero}. {titulo}')
        conteudo_secao(doc, conteudo)
        numero += 1

    titulo_secao(doc, f'{numero}. Feedback')
    for pergunta in dados.get('feedback', []):
        checklist_item(doc, pergunta)
    numero += 1

    titulo_secao(doc, f'{numero}. Próxima Reunião')
    conteudo_secao(doc, dados['proxima_reuniao'])

    return doc


def build_ata_arquivo(caminho_saida, dados):
    doc = build_ata(dados)
    doc.save(caminho_saida)
    return caminho_saida
