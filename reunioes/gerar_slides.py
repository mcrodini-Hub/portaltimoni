#!/usr/bin/env python3
"""CLI para gerar o deck de projeção (PPTX, 1 slide por seção) a partir do
mesmo arquivo JSON usado por gerar_pauta.py / gerar_ata.py.

O tipo (Pauta ou Ata) é detectado automaticamente pelas chaves do JSON:
presença de "ata"/"feedback" => Ata; caso contrário => Pauta.

Uso:
    python3 gerar_slides.py exemplos/exemplo-pauta-rio-claro.json
    python3 gerar_slides.py exemplos/exemplo-ata-rio-claro.json --saida caminho/slides.pptx
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from documentos.nomes import caminho_padrao  # noqa: E402
from documentos.slides import (  # noqa: E402
    build_ata_slides_arquivo,
    build_pauta_slides_arquivo,
)


def eh_ata(dados):
    return 'ata' in dados or 'feedback' in dados


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dados_json', help='Caminho do arquivo JSON com os dados da reunião')
    parser.add_argument(
        '--saida',
        help='Caminho do .pptx de saída (padrão: saida/<Local>/<Ano>/<DD_MM_AAAA>/<Local>-<Pauta|Ata>_DD_MM_AAAA.pptx)',
    )
    args = parser.parse_args()

    with open(args.dados_json, 'r', encoding='utf-8') as f:
        dados = json.load(f)

    tipo = 'Ata' if eh_ata(dados) else 'Pauta'

    if args.saida:
        caminho_saida = args.saida
    else:
        base_dir = os.path.join(os.path.dirname(__file__), 'saida')
        caminho_saida = caminho_padrao(base_dir, dados['loja'], tipo, dados['data'], extensao='pptx')

    os.makedirs(os.path.dirname(os.path.abspath(caminho_saida)), exist_ok=True)

    if tipo == 'Ata':
        build_ata_slides_arquivo(caminho_saida, dados)
    else:
        build_pauta_slides_arquivo(caminho_saida, dados)

    print(f'Slides de {tipo.lower()} gerados em: {caminho_saida}')


if __name__ == '__main__':
    main()
