#!/usr/bin/env python3
"""CLI para gerar a pauta de reunião (PDF, 1 página, P&B) a partir de um
arquivo JSON com os dados da reunião.

Uso:
    python3 gerar_pauta.py exemplos/2026-08-05-araras.json
    python3 gerar_pauta.py exemplos/2026-08-05-araras.json --saida saida/pauta.pdf
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from pauta.construtor import build_pauta_de_arquivo  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dados_json', help='Caminho do arquivo JSON com os dados da reunião')
    parser.add_argument(
        '--saida',
        help='Caminho do PDF de saída (padrão: saida/<nome-do-json>.pdf)',
    )
    args = parser.parse_args()

    if args.saida:
        caminho_saida = args.saida
    else:
        base = os.path.splitext(os.path.basename(args.dados_json))[0]
        caminho_saida = os.path.join(os.path.dirname(__file__), 'saida', f'{base}.pdf')

    os.makedirs(os.path.dirname(os.path.abspath(caminho_saida)), exist_ok=True)
    build_pauta_de_arquivo(args.dados_json, caminho_saida)
    print(f'Pauta gerada em: {caminho_saida}')


if __name__ == '__main__':
    main()
