# Changelog

## 1.1.0-alpha.3 — Extração da planilha corrigida + link direto + print do Bessani

Segunda rodada de correções após teste real com a planilha do fornecedor
BAXMANN:

- **Corrigido**: extração de itens pegava a linha errada como cabeçalho da
  planilha (assumia que era a primeira linha não vazia — nesse caso, "Forn.:
  1918 H LOUIS BAXMANN..."). Agora `content/sheets-content.js` procura, entre
  as primeiras 30 linhas, a primeira em que dá para identificar as três
  colunas de verdade, e usa essa como cabeçalho.
- **Corrigido**: detecção de coluna de código priorizava a palavra "item"
  (que nesse layout é só o número sequencial da linha) sobre "compra" (a
  coluna com o código de verdade, ex.: 312). `lib/validators.js` agora tenta
  primeiro palavras fortes (código, cod., sku, compra, referência) e só cai
  para "item" como último recurso, além de garantir que código/descrição/
  quantidade nunca apontem para a mesma coluna.
- **Adicionado** (sugestão do usuário): campo "Cole aqui o link da planilha"
  na Etapa 3. Se preenchido, a extensão abre/reaproveita essa aba sozinha ao
  clicar em "Extrair itens" — não depende mais de deixar manualmente a aba do
  Sheets ativa. Continua funcionando sem o link (usa a aba ativa, como antes)
  se o campo ficar em branco.
- **Adicionado**: campo para colar (Ctrl+V) ou fazer upload de um print do
  Bessani na Etapa 4, guardado só como referência visual na própria sidebar
  (miniatura + botão "Remover print") — não é enviado nem anexado a lugar
  nenhum, conforme confirmado com o usuário.
- `sheetUrl` e `bessaniPrint` (novos campos de estado) são limpos ao trocar
  de fornecedor, assim como já acontecia com os itens extraídos.

## 1.1.0-alpha.2 — Correções pós-teste manual no Chrome

Correções feitas após o primeiro teste real no Chrome, reportado pelo usuário
com prints do board de verdade:

- **Corrigido**: `ReferenceError: Cannot access 'observer' before
  initialization` em `waitFor()` (`content/trello-content.js` e
  `content/sheets-content.js`) — acontecia sempre que o elemento procurado já
  existia na primeira tentativa (ex.: Trello já carregado ao clicar em "Abrir
  Trello"), quebrando a leitura do Trello. `observer`/`poll` agora são `let`
  inicializados antes de `cleanup()` poder referenciá-los.
- **Corrigido**: filtro "Rio Claro" retornando 0 fornecedores mesmo com
  cartões visivelmente etiquetados em verde no board real. O board do
  usuário mostra as etiquetas na frente do cartão só como barra colorida,
  sem texto/aria-label/title legível por scraping. Adicionada uma
  verificação de fallback: quando a leitura rápida não encontra nenhum
  cartão Rio Claro, a extensão abre cada cartão da lista, lê o nome da
  etiqueta no painel de detalhes (onde sempre aparece por extenso) e fecha
  antes de seguir — usada tanto na listagem (Etapa 2) quanto na atualização
  (Etapa 7), que tinha o mesmo problema.
- Removido `"default_locale": "pt_BR"` do `manifest.json` — estava declarado
  sem a pasta `_locales/` correspondente, o que fazia o Chrome recusar
  carregar a extensão ("Default locale was specified, but _locales subtree
  is missing").

## 1.1.0-alpha.1 — Reescrita incremental sobre a base v1.0.12

Reescrita da extensão seguindo `ESPECIFICACAO_CLAUDE_CODE_HUB_PEDIDOS_V2.md`,
partindo da auditoria completa da base `hub-pedidos-chrome-v1.0.12.zip`
(preservada em `hub-pedidos-chrome-v1.0.12-REFERENCIA/` na raiz do repositório).

Ainda não é `2.0.0`: os critérios de aceite da spec exigem um Trello, Google
Drive/Sheets e Bessani reais para validação end-to-end, que não estão
disponíveis neste ambiente de desenvolvimento (ver "Limitações conhecidas" em
`TESTES.md`). O código foi validado por sintaxe, revisão cruzada com a base e
um smoke test da sidebar em DOM simulado (jsdom) — não por execução no Chrome
com os sites reais.

### Adicionado

- Marca **Portal Timoni** na sidebar (título, ícone `H` azul).
- Sidebar como única interface (`sidebar.html/css/js`), com o visual definido
  pelo usuário: cards numerados, botões azuis, estados desabilitados em azul
  claro, header com pino/fechar, checkbox "Fixar".
- Máquina de estados explícita (`lib/state.js`) persistida em
  `chrome.storage.local`: `INICIO, TRELLO_ABERTO, FORNECEDORES_CARREGADOS,
  FORNECEDOR_SELECIONADO, DRIVE_ABERTO, PLANILHA_ABERTA, ITENS_EXTRAIDOS,
  BESSANI_ABERTO, PRONTO_PARA_ATUALIZAR, FINALIZADO, ERRO`.
- `lib/tabs.js`: função única de abrir-ou-reaproveitar aba, aplicada a Trello,
  Drive e Bessani (a base só tinha essa lógica de forma parcial/ad-hoc).
- `lib/validators.js`: detecção automática das colunas código/descrição/
  quantidade pelo cabeçalho da planilha (com erro claro se não identificar).
- Extração de **todos** os itens visíveis da planilha (a base só lia a
  primeira linha de dados).
- Filtro de fornecedores por etiqueta **verde** "Rio Claro" (a base filtrava
  só pelo texto, sem checar cor, e caía para "mostrar todos" se o filtro não
  achasse nada — bug removido).
- Deduplicação e ordenação alfabética dos fornecedores (não existia na base).
- Painel de diagnóstico visível (URL da aba ativa, cartões lidos, cartões Rio
  Claro, fornecedores encontrados, fornecedor selecionado, itens extraídos,
  último erro) com botão **Copiar diagnóstico**.
- Resultado por cartão na atualização do Trello: `atualizado / ignorado / não
  encontrado / erro`.
- Ícones da extensão (16/32/48/128) usando o logo real da Casa Timoni
  (recortado em círculo a partir da foto enviada pelo usuário), aplicado
  também no cabeçalho da sidebar — a base não tinha nenhum ícone.

### Removido

- **WhatsApp Web por completo**: `content-whatsapp.js`, permissões
  (`web.whatsapp.com`), mensagens (`buscarFornecedor`, `enviarMensagem`) e
  toda referência visual (botão, textarea de mensagem, etapa 4/6 antigas).
- **Popup antigo** (`popup.html`/`popup.js`): era o orquestrador de estado da
  base, mas por ser uma janela efêmera (fecha ao perder foco), o estado se
  perdia constantemente. A sidebar agora é autossuficiente.
- Permissões excessivas: `<all_urls>`, `webRequest`, `clipboardRead`,
  `clipboardWrite`, `activeTab`, `webNavigation` — nenhuma é usada no novo
  fluxo.
- Injeção de `<script>` com função serializada no contexto da página do
  Google Sheets (`executarEmContextoPagina` da base) — equivalente a `eval`,
  proibido pela spec. A leitura agora acontece só dentro do content script,
  que já enxerga o DOM da página sem precisar injetar código nela.

### Mudança de comportamento importante

Na base v1.0.12, a etapa "Atualizar Trello" gravava no cartão o **número do
pedido, datas e print do Bessani** (fluxo Bessani → Trello). Na nova
especificação (Etapa 7), a atualização do cartão usa os **itens extraídos da
planilha** (`código | descrição | quantidade`), e o Bessani virou uma etapa
independente — só abre um link colado pelo usuário, sem anexar print nem
datas ao cartão. Isso é uma mudança pedida explicitamente na
`ESPECIFICACAO_CLAUDE_CODE_HUB_PEDIDOS_V2.md`, não uma perda acidental — mas
é a diferença de comportamento mais visível para quem já usava a v1.0.12, por
isso vale confirmar se é isso mesmo que se espera antes de usar em produção.

### Corrigido (bugs da base)

- Sidebar não recebia atualizações de forma confiável: o `popup.js` da base
  tinha duas definições da função `enviarParaSidebar` e a segunda sobrescrevia
  a que usava `chrome.runtime.sendMessage` (o único canal que a sidebar
  realmente escutava) — na prática a maior parte das atualizações nunca
  chegava. A V2 usa `chrome.storage.onChanged`, que é o canal correto para uma
  side panel.
- Etiqueta "Pedido Enviado": a base só verificava se ela já existia no
  cartão, mas nunca a adicionava de fato quando faltava (código morto). A V2
  não reintroduziu essa etiqueta porque a nova spec não pede — ver seção
  "Removido".

## Arquivos alterados (comparado à base v1.0.12)

| Arquivo | Situação |
|---|---|
| `manifest.json` | Reescrito — permissões mínimas, side panel abre direto no clique |
| `background.js` | Reescrito — vira o orquestrador (era quase vazio na base) |
| `sidebar.html` | Reescrito — novo visual (Portal Timoni) |
| `sidebar.css` | Novo arquivo (estilo estava inline no HTML da base) |
| `sidebar.js` | Reescrito — state via `chrome.storage`, não mais mensageria quebrada |
| `content/trello-content.js` | Reescrito a partir de `content-trello.js` (lógica de leitura preservada e corrigida) |
| `content/sheets-content.js` | Reescrito a partir de `content-drive.js` (extração de item único → lista completa, sem injeção de script) |
| `lib/state.js` | Novo |
| `lib/tabs.js` | Novo (generaliza `criarAbaRobusta` da base) |
| `lib/messages.js` | Novo |
| `lib/validators.js` | Novo |
| `icons/*.png` | Novo |
| `popup.html`, `popup.js` | Removidos |
| `content-whatsapp.js` | Removido |
| `launcher.html` | Removido (não fazia parte da extensão instalável, e o fluxo de link direto já é coberto pelos botões "Abrir Trello/Drive/Bessani") |

## Regressões evitadas (preservado da base v1.0.12)

- Heurística de localização da lista e dos cartões no Trello (múltiplas
  estratégias de seletor, com fallback).
- Técnica de abrir o cartão e escrever no campo de descrição.
- Leitura de células via `[role="gridcell"]` agrupadas por linha no Sheets.
- Conceito de sidebar persistente para acompanhamento do processo.
