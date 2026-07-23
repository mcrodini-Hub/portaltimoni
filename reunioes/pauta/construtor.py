"""Monta o PDF da pauta a partir de um dicionário de dados da reunião.

Estrutura fixa (seção 3 do contexto compilado):
  1. Objetivo da Reunião
  2. Abertura — tom direto/provocativo
  3+. Seções numeradas por tema, definidas em `dados["secoes"]`

Rio Claro e Araras são mercados distintos: cada reunião define suas
próprias seções (WhatsApp/banheiro só fazem sentido em Rio Claro; estoque/
pedidos em atraso são mais comuns em Araras) — este módulo não assume
conteúdo por loja, apenas renderiza o que for passado em `dados`.
"""

import json
from xml.sax.saxutils import escape

from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table

from .estilos import (
    ABERTURA,
    BULLET,
    CORPO,
    MARGEM_BASE,
    MARGEM_LATERAL,
    MARGEM_TOPO,
    PAGE_SIZE,
    SUBTITULO_DOCUMENTO,
    TITULO_DOCUMENTO,
    TITULO_SECAO,
    CenterWrapper,
    tabela_style,
)


def _p(texto, estilo):
    return Paragraph(escape(str(texto)), estilo)


def _tabela(dados_tabela):
    cabecalho = dados_tabela['cabecalho']
    linhas = dados_tabela['linhas']
    tabela = Table([cabecalho] + linhas, hAlign='CENTER')
    tabela.setStyle(tabela_style(len(linhas) + 1))
    return CenterWrapper(tabela)


def build_pauta(dados, caminho_saida):
    """dados: dict com as chaves loja, data, objetivo, abertura, secoes
    (lista de {titulo, itens[], tabela?}) e participantes[] (opcional).
    Retorna o caminho do PDF gerado."""
    doc = SimpleDocTemplate(
        caminho_saida,
        pagesize=PAGE_SIZE,
        topMargin=MARGEM_TOPO,
        bottomMargin=MARGEM_BASE,
        leftMargin=MARGEM_LATERAL,
        rightMargin=MARGEM_LATERAL,
        title=f"Pauta {dados['loja']} - {dados['data']}",
    )

    story = [
        _p(f"Reunião de Equipe — {dados['loja']}", TITULO_DOCUMENTO),
        _p(dados['data'], SUBTITULO_DOCUMENTO),
        _p('1. Objetivo da Reunião', TITULO_SECAO),
        _p(dados['objetivo'], CORPO),
        _p('2. Abertura', TITULO_SECAO),
        _p(dados['abertura'], ABERTURA),
    ]

    numero = 3
    for secao in dados.get('secoes', []):
        story.append(_p(f"{numero}. {secao['titulo']}", TITULO_SECAO))
        for item in secao.get('itens', []):
            story.append(_p(f'• {item}', BULLET))
        if secao.get('tabela'):
            story.append(Spacer(1, 6))
            story.append(_tabela(secao['tabela']))
        numero += 1

    participantes = dados.get('participantes')
    if participantes:
        story.append(Spacer(1, 12))
        story.append(_p('Participantes: ' + ', '.join(participantes), CORPO))

    doc.build(story)

    if doc.page > 1:
        print(
            f"AVISO: a pauta gerada tem {doc.page} páginas; o padrão da Casa "
            "Timoni exige 1 página. Reduza o conteúdo das seções."
        )

    return caminho_saida


def build_pauta_de_arquivo(caminho_json, caminho_saida):
    with open(caminho_json, 'r', encoding='utf-8') as f:
        dados = json.load(f)
    return build_pauta(dados, caminho_saida)
