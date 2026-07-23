# Pautas e Atas de Reunião — Casa Timoni

Ferramenta em Python (python-docx) para gerar Pauta e Ata das reuniões
quinzenais/mensais de equipe da Casa Timoni (Rio Claro e Araras), em
**DOCX** — uma única página, sem elementos decorativos, pronta para Ciça
ajustar e depois converter para PDF pelo aplicativo próprio dela
(**não usamos ReportLab/PDF aqui** — decisão registrada em
`assistente/registro.md`).

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
pip install python-docx

python3 gerar_pauta.py exemplos/exemplo-pauta-rio-claro.json
python3 gerar_ata.py exemplos/exemplo-ata-rio-claro.json

# caminho de saída customizado:
python3 gerar_pauta.py exemplos/exemplo-pauta-araras.json --saida caminho/pauta.docx
```

Sem `--saida`, o arquivo é gravado seguindo a convenção de nomes/pastas da
Casa Timoni: `saida/<Local>/<Ano>/<DD_MM_AAAA>/<Local>-<Pauta|Ata>_DD_MM_AAAA.docx`
(ex: `saida/Rio_Claro/2026/22_08_2026/Rio_Claro-Pauta_22_08_2026.docx`).
Isso espelha localmente a estrutura da pasta real do projeto
(`Reuniões_Quinzenais_Casa_Timoni/...`), documentada em
`assistente/registro.md`.

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
de cada reunião antes de gerar o DOCX definitivo.

## Estrutura

```
reunioes/
├── README.md
├── gerar_pauta.py          # CLI: gera a Pauta a partir de um JSON
├── gerar_ata.py            # CLI: gera a Ata a partir de um JSON
├── documentos/
│   ├── estilos.py          # margens, fontes, espaçamento, checklist (spec fixa)
│   ├── nomes.py            # convenção de nome de arquivo/pasta
│   ├── pauta.py            # monta o DOCX da Pauta (6 seções)
│   └── ata.py              # monta o DOCX da Ata (7 seções, presença ✓/✗)
├── exemplos/
│   ├── exemplo-pauta-rio-claro.json
│   ├── exemplo-pauta-araras.json
│   └── exemplo-ata-rio-claro.json
└── saida/                  # DOCX gerados (git-ignorado, exceto .gitkeep)
```
