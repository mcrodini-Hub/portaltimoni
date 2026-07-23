"""Convenção de nomes de arquivo e pastas para Pauta/Ata, seguindo o
padrão definido pela Casa Timoni: `[Local]-Pauta_DD_MM_AAAA.docx` /
`[Local]-Ata_DD_MM_AAAA.docx` (ou `.pptx` para o deck de projeção),
organizados em `<Local>/<Ano>/<DD_MM_AAAA>/`.
"""

import os
import re


def slug_local(loja):
    return re.sub(r'\s+', '_', loja.strip())


def partes_data(data_str):
    """data_str no formato 'DD/MM/AAAA'."""
    dia, mes, ano = data_str.strip().split('/')
    return dia, mes, ano


def nome_arquivo(loja, tipo, data_str, extensao='docx'):
    dia, mes, ano = partes_data(data_str)
    return f'{slug_local(loja)}-{tipo}_{dia}_{mes}_{ano}.{extensao}'


def caminho_padrao(base_dir, loja, tipo, data_str, extensao='docx'):
    dia, mes, ano = partes_data(data_str)
    pasta = os.path.join(base_dir, slug_local(loja), ano, f'{dia}_{mes}_{ano}')
    return os.path.join(pasta, nome_arquivo(loja, tipo, data_str, extensao))
