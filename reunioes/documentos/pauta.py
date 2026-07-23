"""Gera a Pauta de reunião (DOCX, 1 página) no padrão fixo da Casa Timoni:

    1. Pauta — abertura/contexto da reunião
    2. Controle e Atendimento WhatsApp — status + feedback (opcional;
       Araras costuma omitir esta seção — ver README)
    3. Estoque — abastecimento + nova ferramenta (se aplicável)
    4. Meta — posição atual + dificuldades
    5. Desafio de Vendas — resultados, o que funciona, dificuldades
    6. Próxima Reunião — data e horário confirmados

A numeração é ajustada automaticamente quando a seção de WhatsApp é omitida.
"""

from .estilos import (
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


def build_pauta(dados):
    """dados: dict com loja, data, participantes (opcional), pauta,
    whatsapp (opcional), estoque, meta, desafio_vendas, proxima_reuniao.
    Cada campo de conteúdo aceita string (parágrafo) ou lista (bullets).
    Retorna um docx.Document pronto para salvar."""
    doc = novo_documento()

    titulo_documento(doc, f"Reunião de Equipe — {dados['loja']}")
    subtitulo_documento(doc, dados['data'])

    lista_participantes(doc, dados.get('participantes'))

    numero = 1
    titulo_secao(doc, f'{numero}. Pauta')
    conteudo_secao(doc, dados['pauta'])
    numero += 1

    for chave, titulo in SECOES_FIXAS:
        conteudo = dados.get(chave)
        if conteudo is None:
            continue
        titulo_secao(doc, f'{numero}. {titulo}')
        conteudo_secao(doc, conteudo)
        numero += 1

    titulo_secao(doc, f'{numero}. Próxima Reunião')
    conteudo_secao(doc, dados['proxima_reuniao'])

    return doc


def build_pauta_arquivo(caminho_saida, dados):
    doc = build_pauta(dados)
    doc.save(caminho_saida)
    return caminho_saida
