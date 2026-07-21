# Changelog

## 1.1.0-alpha.9 — Busca de aba do Trello restrita à janela em foco

A alpha.7 corrigiu a aba do Trello "andar" para um cartão (trello.com/c/...)
navegando ela de volta para o board, mas o erro "Lista não encontrada"
voltou a acontecer mesmo assim, sem nenhuma mudança visível na aba que o
usuário estava olhando — sinal de que a busca por aba do Trello
(`chrome.tabs.query`) estava encontrando (e mexendo em) uma aba **de outra
janela**, já que a busca não tinha nenhuma restrição de janela.

- **Corrigido**: toda busca/abertura de aba (Trello, Drive, Sheets, Bessani)
  agora é restrita à janela atualmente em foco
  (`chrome.windows.getLastFocused`). Uma aba do Trello esquecida em outra
  janela não é mais reaproveitada por engano.
- O único link de Trello que a extensão usa continua sendo, e agora está
  ainda mais explícito no código, só o board de Compras
  (`https://trello.com/b/UfPrTr1H/compras`) — a busca por aba existente é
  só uma otimização para não abrir aba nova à toa, nunca aponta para outro
  board/URL.

## 1.1.0-alpha.8 — Diagnóstico real da planilha + coluna de mês + tentativa de evitar abrir cartão

Com o Trello já funcionando (9 fornecedores encontrados, conectado), o teste
real na planilha BAXMANN mostrou a causa raiz da extração falhar: nenhuma
célula com `role="gridcell"` aparece no HTML da planilha — o Google Sheets
desenha a grade em modo visual (canvas) por padrão, sem texto real no HTML,
e isso não tem contorno via DOM puro (a especificação proíbe OCR/captura de
tela). O fallback de `<tr>/<td>` "achava" só lixo de outras partes da
página (aviso de cotações, nomes das abas da planilha).

- **Corrigido/esclarecido**: quando nenhuma célula de grade é encontrada, a
  extensão não tenta mais o fallback de tabela (que só trazia lixo) — em vez
  disso, retorna um erro específico e acionável: ative uma vez, no Google
  Sheets, "Ferramentas > Acessibilidade > Ativar suporte a leitor de tela";
  isso faz o Sheets desenhar a grade como texto real no HTML, que é o que a
  extensão lê.
- **Adicionado**: detecção da coluna de quantidade agora reconhece colunas
  de mês (`nov25`, `dez25`, `mar26`, `jul26`, formato "3 letras + 2
  dígitos") e usa a mais à direita — que é como a planilha real do
  fornecedor guarda a quantidade do pedido do mês corrente (não existe uma
  coluna chamada "quantidade"). Só cai para "última coluna não vazia" se
  nenhuma coluna de mês for encontrada.
- **Tentativa**: antes de abrir cartão por cartão pra achar a etiqueta "Rio
  Claro" (quando a frente do cartão não mostra texto), a extensão agora
  tenta primeiro o atalho nativo do Trello (tecla "L" com o board em foco,
  que mostra o nome de todas as etiquetas direto na frente dos cartões). Se
  o Trello aceitar esse evento simulado, elimina a necessidade de abrir
  cada cartão; se não aceitar, nada muda e segue como antes.

## 1.1.0-alpha.7 — Mesma aba do Trello "navegava" para fora do board

A alpha.5 restringiu o reaproveitamento de aba a `trello.com/b/UfPrTr1H/*`
para não pegar a aba errada, mas isso quebrou o caso mais comum: o Trello
troca a URL da MESMA aba para `trello.com/c/.../cartao` sempre que um cartão
é aberto (por SPA, sem trocar de aba) — o que acontece o tempo todo, inclusive
quando o próprio usuário abre um cartão para conferir algo. Com a URL fora do
padrão restrito, a extensão parava de "achar" essa aba e caía direto em
"Lista 'RELAÇÃO DE PEDIDOS' não encontrada".

- **Corrigido**: `background.js` agora procura qualquer aba do Trello aberta
  (`ensureTrelloBoardTab()`) e, se ela estiver em outra página (ex.: um
  cartão), navega essa MESMA aba de volta para o board de Compras antes de
  ler/atualizar — em vez de exigir que a aba já estivesse exatamente na URL
  do board. Usado por "Abrir Trello", "Atualizar fornecedores" e "Atualizar
  Trello".

## 1.1.0-alpha.6 — Cabeçalho da planilha fixado na linha 3 (com fallback)

Confirmado com o usuário: nas planilhas reais dos fornecedores, o cabeçalho
(`ITEM | VENDA | COMPRA | DESCRICAO | ... | ESTOQUE | UNIDADE`) está sempre na
linha 3. `findHeaderRow()` em `content/sheets-content.js` agora tenta a linha 3
(índice 2) primeiro; se as três colunas forem identificadas ali, usa direto —
sem precisar varrer as primeiras 30 linhas. Se a linha 3 não bater (planilha
fora do padrão), continua caindo para a varredura completa como antes, então
nenhum caso que já funcionava deixa de funcionar.

Também esclarecido (sem mudança de código): durante a leitura profunda de
etiquetas no Trello (quando a frente do cartão não mostra o texto da
etiqueta, só a barra colorida), a extensão abre e fecha cada cartão da lista
rapidamente para ler o nome de verdade no painel de detalhes — isso inclui
cartões com outras etiquetas (ex.: "Araras"), que são abertos, verificados e
descartados. É esperado ver cartões abrindo e fechando rapidamente durante
"Trello aberto — lendo fornecedores...". Para evitar esse "piscar" de
cartões, dá para configurar o board para sempre mostrar o texto das
etiquetas na frente do cartão (no board do Trello, com o quadro em foco,
tecla **L** alterna "mostrar nomes nas etiquetas") — com o texto visível na
frente, a leitura rápida encontra "Rio Claro" direto, sem precisar abrir
cartão nenhum.

## 1.1.0-alpha.5 — "Abrir Trello" reaproveitava aba de cartão específico

- **Corrigido**: ao clicar em "Abrir Trello" estando numa página de cartão
  específico (`trello.com/c/...`), a extensão reaproveitava essa aba (o
  padrão de busca era genérico, "qualquer página do trello.com"), em vez de
  ir para o board de Compras — a lista "RELAÇÃO DE PEDIDOS" não é encontrada
  numa página de cartão. `TRELLO_URL_PATTERN` em `background.js` agora é
  restrito a `https://trello.com/b/UfPrTr1H/*`, então só reaproveita abas do
  board correto; qualquer outra aba do Trello (cartão, outro board) resulta
  em abrir uma aba nova apontando para o board de Compras.

## 1.1.0-alpha.4 — Agrupamento de linhas da planilha mais robusto

O fix da alpha.3 corrigiu qual linha é tratada como cabeçalho, mas o erro
"não foi possível identificar as colunas" continuou — o problema real é
anterior: a forma como as células da planilha eram agrupadas em linhas
(`readGridRows()` em `content/sheets-content.js`) dependia de `aria-rowindex`,
que a planilha real do usuário aparentemente não expõe do jeito esperado,
fragmentando ou misturando o conteúdo das linhas.

- **Corrigido**: `readGridRows()` agora agrupa células pelo próprio elemento
  ancestral `role="row"` (identidade do nó, testado e confirmado em Chromium
  real), e só cai para agrupar por posição vertical (arredondada, tolerando
  sub-pixel) se nenhuma célula tiver um ancestral `role="row"`.
- **Adicionado**: quando a extração falha por não identificar as colunas, o
  diagnóstico agora mostra quantas linhas foram lidas, se caiu no modo de
  leitura alternativo (tabela HTML) e uma prévia do conteúdo das primeiras
  linhas — assim, se ainda falhar, dá para corrigir direto a partir do
  diagnóstico copiado, sem precisar de mais uma rodada de prints.

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
