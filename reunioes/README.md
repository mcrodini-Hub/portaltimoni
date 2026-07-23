# Pautas e Atas de Reunião — Casa Timoni

Ferramenta em Python para gerar dois formatos a partir dos mesmos dados de
cada reunião quinzenal/mensal de equipe da Casa Timoni (Rio Claro e
Araras):

- **DOCX** (python-docx) — o documento principal de Pauta/Ata, 1 página,
  sem elementos decorativos.
- **PPTX** (python-pptx) — deck de projeção para conduzir a reunião ao
  vivo, 1 slide por seção, texto grande para leitura à distância.

Não geramos PDF/ReportLab aqui. Ciça revisou o uso de PDF: o documento
final passa a ser um **Google Doc** e a projeção ao vivo um **Google
Slides** — ambos obtidos fazendo upload do DOCX/PPTX gerados aqui no
Google Drive (ver seção "De DOCX/PPTX para Google Docs/Slides" abaixo).
Decisão registrada em `assistente/registro.md`.

## Estrutura fixa dos documentos

**Pauta (6 seções):**
1. Pauta — abertura/contexto da reunião
2. Controle e Atendimento WhatsApp — status + feedback (opcional — ver nota Araras)
3. Estoque — abastecimento + nova ferramenta (se aplicável)
4. Meta — posição atual + dificuldades
5. Desafio de Vendas — resultados, o que funciona, dificuldades
6. Próxima Reunião — data e horário confirmados

**Ata (7 seções):** as mesmas 5 primeiras seções da Pauta (chamada de
"Ata" em vez de "Pauta" na seção 1) mais:
6. Feedback — checklist operacional (☐ perguntas)
7. Próxima Reunião

> **Rio Claro x Araras:** Araras historicamente omite a seção de WhatsApp
> (e rotinas de banheiro/limpeza). Basta não incluir a chave `whatsapp`
> no JSON de dados que a seção é omitida e a numeração se ajusta
> automaticamente — ver `exemplos/exemplo-pauta-araras.json`.

## Uso

```bash
pip install python-docx python-pptx

python3 gerar_pauta.py exemplos/exemplo-pauta-rio-claro.json    # documento (.docx)
python3 gerar_slides.py exemplos/exemplo-pauta-rio-claro.json   # projeção (.pptx)
python3 gerar_ata.py exemplos/exemplo-ata-rio-claro.json
python3 gerar_slides.py exemplos/exemplo-ata-rio-claro.json     # detecta Pauta x Ata pelo JSON

# caminho de saída customizado:
python3 gerar_pauta.py exemplos/exemplo-pauta-araras.json --saida caminho/pauta.docx
```

Sem `--saida`, o arquivo é gravado seguindo a convenção de nomes/pastas da
Casa Timoni: `saida/<Local>/<Ano>/<DD_MM_AAAA>/<Local>-<Pauta|Ata>_DD_MM_AAAA.<docx|pptx>`
(ex: `saida/Rio_Claro/2026/22_08_2026/Rio_Claro-Pauta_22_08_2026.pptx`).
Isso espelha localmente a estrutura da pasta real do projeto
(`Reuniões_Quinzenais_Casa_Timoni/...`), documentada em
`assistente/registro.md`.

## De DOCX/PPTX para Google Docs/Slides

Este repositório gera os arquivos localmente; a conversão para os
formatos nativos do Google acontece por upload no Drive (o Drive
converte automaticamente quando recebe um DOCX/PPTX):

- **Dentro de uma conversa com o Claude que tenha o Google Drive
  conectado** (o caso de uso real da Ciça): peça para gerar a pauta/ata —
  o Claude usa a mesma lógica deste módulo para montar o conteúdo e faz o
  upload direto no Drive como Google Doc (`application/vnd.google-apps.document`)
  e Google Slides (`application/vnd.google-apps.presentation`), sem
  passos manuais.
- **Manualmente**, a partir de um arquivo já gerado por este repositório:
  no Google Drive, `Novo → Upload de arquivo` do `.docx`/`.pptx` e depois
  `Abrir com → Google Docs/Slides` (ou simplesmente abrir o arquivo
  enviado — o Drive oferece a conversão). O resultado é editável como
  qualquer Doc/Slides nativo.

> **⚠️ Validado em 23/07/2026 — sempre subir o DOCX/PPTX binário, nunca
> texto simples.** Testamos a conversão real no Drive da Ciça: subir o
> conteúdo como texto simples (`textContent`) corrompe acentos (ex:
> "Ciça" virou "CiÃ§a"). Subir o `.docx`/`.pptx` gerado por este
> repositório (conteúdo binário) preserva a acentuação corretamente.
> Detalhes em `assistente/registro.md`.

## Formato do arquivo de dados (JSON)

```json
{
  "loja": "Rio Claro",
  "data": "22/08/2026",
  "participantes": ["Adriel", "Carina", "..."],
  "pauta": "Texto ou lista de bullets — seção 1 (Pauta) ou (Ata, no arquivo de ata usar a chave \"ata\")",
  "whatsapp": "Opcional — omitir para Araras",
  "estoque": "Texto ou lista",
  "meta": "Texto ou lista",
  "desafio_vendas": "Texto ou lista",
  "proxima_reuniao": "Texto com data/horário"
}
```

- Qualquer campo de conteúdo aceita **string** (vira um parágrafo) ou
  **lista de strings** (vira bullets).
- No arquivo de **Ata**, use a chave `"ata"` em vez de `"pauta"`, e inclua
  `"feedback"`: lista de perguntas do checklist operacional.
- Em `"participantes"`, a Ata aceita objetos `{"nome": "...", "presente": true|false}`
  para marcar presença com ✓/✗ (ver `exemplos/exemplo-ata-rio-claro.json`).
  A Pauta aceita apenas a lista simples de nomes.

Os exemplos em `exemplos/` usam **conteúdo de discussão fictício**
(placeholder) — apenas loja, data e participantes refletem dados reais já
confirmados no cronograma. Substitua o conteúdo pelas informações reais
de cada reunião antes de gerar o documento/deck definitivo.

## Estrutura

```
reunioes/
├── README.md
├── gerar_pauta.py          # CLI: gera o DOCX da Pauta a partir de um JSON
├── gerar_ata.py            # CLI: gera o DOCX da Ata a partir de um JSON
├── gerar_slides.py         # CLI: gera o PPTX de projeção (Pauta ou Ata, mesmo JSON)
├── documentos/
│   ├── estilos.py          # DOCX: margens, fontes, espaçamento, checklist (spec fixa)
│   ├── estilos_slides.py   # PPTX: slide 16:9, texto grande para projeção
│   ├── nomes.py            # convenção de nome de arquivo/pasta
│   ├── pauta.py            # monta o DOCX da Pauta (6 seções)
│   ├── ata.py              # monta o DOCX da Ata (7 seções, presença ✓/✗)
│   └── slides.py           # monta o PPTX de Pauta/Ata (1 slide por seção)
├── exemplos/
│   ├── exemplo-pauta-rio-claro.json
│   ├── exemplo-pauta-araras.json
│   └── exemplo-ata-rio-claro.json
└── saida/                  # DOCX/PPTX gerados (git-ignorado, exceto .gitkeep)
```
