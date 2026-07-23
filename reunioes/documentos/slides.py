"""Gera o deck de projeção (PPTX) para condução ao vivo da reunião: um
slide por seção da Pauta/Ata, com texto grande para leitura à distância.
Usa os mesmos dicts de dados de `pauta.py` / `ata.py` — mesma fonte de
verdade, dois formatos de saída (documento em DOCX, projeção em PPTX).
"""

from .estilos_slides import (
    nova_apresentacao,
    slide_capa,
    slide_conteudo,
    slide_participantes,
)

SECOES_FIXAS = [
    ('whatsapp', 'Controle e Atendimento WhatsApp'),
    ('estoque', 'Estoque'),
    ('meta', 'Meta'),
    ('desafio_vendas', 'Desafio de Vendas'),
]


def build_pauta_slides(dados):
    prs = nova_apresentacao()
    slide_capa(prs, f"Reunião de Equipe — {dados['loja']}", dados['data'])

    if dados.get('participantes'):
        slide_participantes(prs, dados['participantes'])

    slide_conteudo(prs, 'Pauta', dados['pauta'])

    for chave, titulo in SECOES_FIXAS:
        conteudo = dados.get(chave)
        if conteudo is None:
            continue
        slide_conteudo(prs, titulo, conteudo)

    slide_conteudo(prs, 'Próxima Reunião', dados['proxima_reuniao'])

    return prs


def build_ata_slides(dados):
    prs = nova_apresentacao()
    slide_capa(prs, f"Ata de Reunião — {dados['loja']}", dados['data'])

    if dados.get('participantes'):
        slide_participantes(prs, dados['participantes'])

    slide_conteudo(prs, 'Ata', dados['ata'])

    for chave, titulo in SECOES_FIXAS:
        conteudo = dados.get(chave)
        if conteudo is None:
            continue
        slide_conteudo(prs, titulo, conteudo)

    if dados.get('feedback'):
        slide_conteudo(prs, 'Feedback', dados['feedback'], checklist=True)

    slide_conteudo(prs, 'Próxima Reunião', dados['proxima_reuniao'])

    return prs


def build_pauta_slides_arquivo(caminho_saida, dados):
    prs = build_pauta_slides(dados)
    prs.save(caminho_saida)
    return caminho_saida


def build_ata_slides_arquivo(caminho_saida, dados):
    prs = build_ata_slides(dados)
    prs.save(caminho_saida)
    return caminho_saida
