# Pautas de Reunião — Casa Timoni

Ferramenta em Python (ReportLab) para gerar a pauta de reunião em PDF,
seguindo o padrão fixo usado pela Casa Timoni (Rio Claro e Araras):

- PDF preto e branco, 1 página, pronto para impressão, sem elementos decorativos.
- Fonte e espaçamento grandes o suficiente para preencher a página A4.
- Estrutura fixa: **1. Objetivo da Reunião**, **2. Abertura** (tom direto e
  provocativo sobre conversão de vendas), e a partir da seção 3, temas
  numerados definidos por reunião.

**Rio Claro e Araras são mercados distintos** — a ferramenta não define
conteúdo por loja; cada reunião define suas próprias seções no arquivo de
dados. Como referência histórica: Rio Claro costuma incluir a ferramenta de
atendimento via WhatsApp e rotinas de banheiro/limpeza; Araras costuma
omitir esses dois temas e incluir estoque, falta de pedidos e mercadoria em
atraso.

## Uso

```bash
pip install reportlab

python3 gerar_pauta.py exemplos/exemplo-araras.json
# ou especificando o caminho de saída:
python3 gerar_pauta.py exemplos/exemplo-araras.json --saida saida/pauta-05-08.pdf
```

O script avisa no terminal se o PDF gerado ficou com mais de 1 página, para
que o conteúdo seja revisado/condensado antes da impressão.

## Formato do arquivo de dados (JSON)

```json
{
  "loja": "Araras",
  "data": "05/08/2026",
  "objetivo": "Texto do objetivo da reunião.",
  "abertura": "Texto de abertura — direto e provocativo sobre conversão.",
  "secoes": [
    {
      "titulo": "Nome do tema (numerado automaticamente a partir de 3)",
      "itens": ["bullet 1", "bullet 2"],
      "tabela": {
        "cabecalho": ["Coluna A", "Coluna B"],
        "linhas": [["valor 1", "valor 2"]]
      }
    }
  ],
  "participantes": ["Nome 1", "Nome 2"]
}
```

- `secoes` é uma lista livre — cada reunião define quantos temas quiser, na
  ordem desejada. Os títulos são numerados automaticamente a partir de 3.
- `tabela` é opcional por seção; usada por exemplo para metas de vendas
  por pessoa (ver `exemplos/exemplo-araras.json`).
- `participantes` é opcional; quando presente, aparece ao final do
  documento.

Veja `exemplos/exemplo-araras.json` para um modelo completo — é um
**exemplo/modelo com conteúdo fictício** (nomes e valores de placeholder),
não a pauta real de nenhuma reunião. Substitua pelo conteúdo real de cada
reunião antes de gerar o PDF definitivo.

## Estrutura

```
reunioes/
├── README.md
├── gerar_pauta.py         # CLI: gera o PDF a partir de um JSON
├── pauta/
│   ├── estilos.py         # margens, fontes, espaçamento, tabela (spec fixa)
│   └── construtor.py      # monta o PDF (SimpleDocTemplate) a partir dos dados
├── exemplos/
│   └── exemplo-araras.json
└── saida/                 # PDFs gerados (git-ignorado, exceto .gitkeep)
```
