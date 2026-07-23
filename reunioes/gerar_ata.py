#!/usr/bin/env python3
"""CLI para gerar a Ata de reunião (DOCX, 1 página) a partir de um
arquivo JSON com os dados da reunião.

Uso:
    python3 gerar_ata.py exemplos/exemplo-ata-rio-claro.json
    python3 gerar_ata.py exemplos/exemplo-ata-rio-claro.json --saida caminho/ata.docx
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from documentos.ata import build_ata_arquivo  # noqa: E402
from documentos.nomes import caminho_padrao  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dados_json', help='Caminho do arquivo JSON com os dados da reunião')
    parser.add_argument(
        '--saida',
        help='Caminho do .docx de saída (padrão: saida/<Local>/<Ano>/<DD_MM_AAAA>/<Local>-Ata_DD_MM_AAAA.docx)',
    )
    args = parser.parse_args()

    with open(args.dados_json, 'r', encoding='utf-8') as f:
        dados = json.load(f)

    if args.saida:
        caminho_saida = args.saida
    else:
        base_dir = os.path.join(os.path.dirname(__file__), 'saida')
        caminho_saida = caminho_padrao(base_dir, dados['loja'], 'Ata', dados['data'])

    os.makedirs(os.path.dirname(os.path.abspath(caminho_saida)), exist_ok=True)
    build_ata_arquivo(caminho_saida, dados)
    print(f'Ata gerada em: {caminho_saida}')


if __name__ == '__main__':
    main()
