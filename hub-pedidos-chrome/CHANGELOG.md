# Changelog

## 1.1.0-alpha.30 — Ícone de linha fina (estilo profissional)

O glifo desenhado à mão (silhueta grossa) ainda não agradou — pedido foi
um estilo mais próximo de bancos de ícone profissionais (linha fina,
traço único), como o exemplo mostrado pela usuária.

- **Alterado**: ícone trocado pelo carrinho de compras da biblioteca
  [Lucide](https://lucide.dev) (`shopping-cart`, licença ISC), traço
  branco fino sobre o mesmo círculo azul do módulo.

## 1.1.0-alpha.29 — Ícone em glifo branco (era emoji colorido)

O emoji colorido (🛒) ficava "sujo"/carregado no círculo pequeno da barra
do Chrome — cores demais competindo com a cor do próprio módulo.

- **Alterado**: ícone trocado por um desenho simples em branco (carrinho
  de compras), só a silhueta, sobre o mesmo círculo azul de sempre —
  mesma ideia usada agora nos 6 módulos do Painel Timoni.

## 1.1.0-alpha.28 — Emoji no ícone do módulo

O círculo colorido do ícone (mesma cor do módulo no Painel Timoni) ficava
igual demais entre Compras/Estoque/Motorista — só a cor diferenciava.

- **Alterado**: `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png` e
  `icons/icon128.png` — mesmo círculo azul de Compras, agora com um 🛒 no
  meio. Estoque ganhou 📦, Motorista ganhou 🚚 — mesma ideia nos ícones do
  Painel Timoni (todos os 6 módulos, incluindo Agenda 📅, Reuniões 🤝 e
  Marketing 📣).

## 1.1.0-alpha.27 — Rola pro topo ao mostrar erro

O aviso de erro (`error-banner`) aparece sempre no topo da sidebar. Ao clicar
numa ação com a tela rolada mais para baixo, o aviso ficava fora da vista —
parecia que nada tinha acontecido, sem apagar nem lançar erro nenhum.

- **Corrigido**: `sidebar.js` agora rola a página para o topo sempre que um
  erro novo aparece (não rola de novo enquanto o mesmo erro continuar
  visível, para não brigar com o scroll do usuário).

## 1.1.0-alpha.26 — Ícone colorido por módulo

Os três módulos com extensão/página (Compras, Estoque, Motorista) usavam o
mesmo ícone "CASA TIMONI" em navy — igual em todo lugar, sem diferenciar qual
módulo é qual na barra do Chrome ou entre abas abertas.

- **Alterado**: `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png` e
  `icons/icon128.png` — trocados por um círculo sólido na cor de Compras
  (`--mod-compras` no Painel Timoni). Estoque ficou verde, Motorista ficou
  marrom/laranja — a mesma paleta já usada nos cartões do Painel Timoni.

## 1.1.0-alpha.25 — Espelha o estado no Painel Timoni (opcional)

O Painel Timoni (dashboard pessoal em `painel-timoni/`) reúne todos os módulos do
Portal Timoni como blocos independentes; os cartões de Compras precisavam de uma
fonte de dados real em vez de exemplo.

- **Adicionado**: `apps-script/Codigo.gs` — Web App (Apps Script) que espelha o
  estado do Compras numa planilha própria ("Compras — Painel Timoni"), com uma aba
  `Estado` (snapshot atual) e uma aba `Historico` (um registro por pedido
  finalizado — histórico que a extensão sozinha não guarda, já que "Reiniciar
  fluxo" apaga o estado local).
- **Adicionado**: nova seção "Painel Timoni" na sidebar (rodapé) para colar a URL
  do Web App publicado.
- **Adicionado**: `background.js` agora chama esse Web App (best-effort, nunca
  bloqueia nem lança erro) depois de ler fornecedores, selecionar fornecedor,
  extrair itens, salvar o link do Bessani, salvar a conferência e atualizar o
  Trello.
- Sem essa URL configurada, nada muda: o Compras continua funcionando 100%
  localmente, só o Painel Timoni fica com dados de exemplo nos 5 cartões.

## 1.1.0-alpha.24 — Corrige extração incluindo itens sem pedido no mês

Revisão contra o prompt de referência original (`2-itens-pedido-rio-claro`,
reenviado pela usuária): "Extract all rows where the current month
quantity column has a non-empty value... Ignore any rows with empty
cells in the quantity column." O código extraía o item mesmo com a coluna
de quantidade vazia, desde que código e descrição estivessem preenchidos —
ou seja, produtos do fornecedor que NÃO foram pedidos neste mês entravam
na lista extraída (e, por consequência, iam para a conferência e para o
cartão do Trello).

- **Corrigido**: `content/sheets-content.js` (`extrairItens`) agora
  também ignora a linha se a coluna de quantidade estiver vazia, além das
  checagens já existentes de código/descrição.

## 1.1.0-alpha.23 — Exportar conferência em Excel para o financeiro

A usuária precisa, ao final da conferência (Etapa 5), de um arquivo Excel
pra encaminhar ao financeiro (que ajusta preço/IPI a partir das
divergências registradas).

- **Adicionado**: `lib/xlsx-writer.js` — gerador mínimo de `.xlsx`
  (formato OOXML/SpreadsheetML), escrito na mão sem nenhuma dependência
  externa. Monta o `.zip` (método STORED, sem compressão) e o XML
  necessário (`[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`,
  `xl/_rels/workbook.xml.rels`, `xl/styles.xml`, `xl/worksheets/sheet1.xml`)
  diretamente em JS puro, usando só `TextEncoder`/`Blob`/`URL.createObjectURL`
  (já disponíveis na página da sidebar). Não foi vendorizada nenhuma
  biblioteca de terceiros (ex: SheetJS) porque o projeto não tem build
  step e o ambiente de desenvolvimento não tem acesso à rede para buscar
  esse arquivo — e o formato de uma planilha simples cabe em ~150 linhas
  sem isso.
- **Adicionado**: botão "Baixar Excel para o financeiro" na Etapa 5,
  visível só depois da conferência aprovada. Gera
  `conferencia-<fornecedor>-<data>.xlsx` com fornecedor, data da
  conferência, tipo de documento, itens do pedido e a tabela de
  divergências (valores numéricos de verdade quando possível, pra o
  financeiro poder somar direto na planilha).
- Validado abrindo o `.xlsx` gerado com `openpyxl` (round-trip de texto
  acentuado, números e células vazias) — sem acesso a um Excel real neste
  ambiente, mas o formato é o mesmo lido por Excel/Google Sheets/LibreOffice.

## 1.1.0-alpha.22 — Renomeia "Hub de Pedidos" para "Compras"

Renomeação de marca/exibição — sem mudança de comportamento. Faz mais
sentido com a direção que o projeto tomou (módulo "Compras", entre outros
módulos do Portal Timoni).

- **Alterado**: nome da extensão (`manifest.json`), título/`<h1>`/marca da
  sidebar, título do `README.md` e do `TESTES.md`, e comentários que citavam
  "Hub de Pedidos" como nome do produto — tudo passou a "Compras".
- **Não alterado** (de propósito, por serem detalhes internos sem impacto
  visível): namespace interno em JS (`HubState`, `HubMessages`, `HubTabs`,
  `HubValidators`), a chave de `chrome.storage.local`
  (`hubPedidosState`) e o nome da pasta (`hub-pedidos-chrome/`). Renomear a
  pasta trocaria o ID da extensão no Chrome (instalação "sem compactação"),
  exigindo reinstalar e perdendo o estado salvo — avisar antes de fazer
  isso, se for o caso.

## 1.1.0-alpha.21 — Divergência não trava mais a aprovação da conferência

Ajuste da alpha.20 baseado em como a Etapa 5 é usada na prática: a
conferência é um parâmetro para evitar erros, não um veto — divergências
de preço/IPI são o resultado esperado do processo, viram pauta para o
financeiro ajustar, e o pedido segue aprovado.

- **Alterado**: "Aprovar pedido" não fica mais desabilitado por
  divergências registradas — continua exigindo o checklist 100% completo.
  Havendo divergência pendente, o clique abre uma confirmação extra
  (quantas divergências, lembrete de que ficam registradas para o
  financeiro) antes de aprovar de fato.
- **Removido**: botão "Reprovar pedido" e o estado `aprovado: false`. Na
  prática esse fluxo nunca é usado — a usuária sempre aprova e resolve
  divergência depois, fora da extensão.
- Divergências continuam só na sidebar (não são adicionadas ao cartão do
  Trello) — a usuária encaminha a planilha diretamente ao financeiro por
  fora da extensão, então não há necessidade de duplicar esse dado no
  Trello.
- `PROTOCOLO_CONFERENCIA_PEDIDOS.md` ganhou uma nota de implementação
  explicando essa diferença entre o texto original da seção 4 (documento
  formal, mantido como está) e o comportamento real da Etapa 5.

## 1.1.0-alpha.20 — Nova Etapa 5: Conferência do pedido

Incorpora o `PROTOCOLO_CONFERENCIA_PEDIDOS.md` (fornecido pela usuária) ao
fluxo como uma etapa própria, entre Bessani e a atualização final do Trello
(que virou Etapa 6).

- **Adicionado**: Etapa 5 — Conferência do pedido. Marcação do tipo de
  documento de retorno recebido (orçamento/NF-e), checklist item a item
  (itens presentes, códigos, quantidades, preço unitário, IPI, frete e
  condição de pagamento, total, entrega/transportadora), registro de
  divergências (item, valor pedido x valor recebido, diferença calculada
  automaticamente) e decisão explícita **Aprovar pedido** / **Reprovar
  pedido**. Estado persistido em `chrome.storage.local` junto com o resto
  do fluxo (`lib/state.js`, chave `conferencia`).
- **Adicionado**: a Etapa 6 (Atualizar Trello) agora exige
  `conferencia.aprovado === true` — tanto na UI (botão desabilitado com
  aviso) quanto no `background.js` (`handleUpdateTrello` recusa a
  atualização mesmo se chamada diretamente). Reflete a regra 1 do
  protocolo: nenhum pedido é atualizado sem a conferência aprovada.
- Qualquer edição no checklist ou nas divergências depois de uma aprovação
  ou reprovação reabre a conferência (`aprovado` volta a `null`), forçando
  nova decisão explícita.
- Trocar de fornecedor (Etapa 2) reinicia a conferência, como já acontecia
  com itens extraídos e link do Bessani.
- **Adicionado**: `PROTOCOLO_CONFERENCIA_PEDIDOS.md` — transcrição do
  protocolo original, referenciado a partir do `README.md` e da própria
  Etapa 5 na sidebar.

## 1.1.0-alpha.19 — Corrige ativação automática: faltava clicar em "OK" no diálogo

Os prints do usuário mostraram exatamente por que a alpha.18 não resolveu:
o item de menu "Ativar suporte a leitor de tela" não é um toggle direto —
ele abre um diálogo modal "Configurações de acessibilidade" com um checkbox
e um botão "OK". O código anterior só clicava no item do menu (abrindo o
diálogo, às vezes até com o checkbox já marcado) mas nunca clicava em "OK",
então a configuração nunca era salva — o diálogo ficava aberto até a
extensão desistir e mostrar o erro.

- **Corrigido**: `tryEnableScreenReaderSupport()` agora espera o diálogo
  aparecer, garante que o checkbox "leitor de tela" está marcado (clica se
  não estiver) e clica em "OK" para confirmar de fato.

## 1.1.0-alpha.18 — Tenta ativar "Suporte a leitor de tela" automaticamente

Trello funcionando (21 cartões lidos, 15 Rio Claro, ordenação Urgente
correta), mas a extração da planilha CIFA voltou a bater no modo visual
(canvas) do Google Sheets — cada planilha nova de fornecedor tem esse modo
desligado por padrão, então pedir pro usuário ativar manualmente toda vez
que abre uma planilha diferente não escala.

- **Adicionado**: antes de mostrar o erro pedindo ativação manual,
  `content/sheets-content.js` agora tenta ativar "Suporte a leitor de tela"
  sozinho, clicando no próprio menu do Google Sheets (Ferramentas >
  Acessibilidade > Ativar suporte a leitor de tela) — só interação real de
  UI, nada de eval/API/fetch. Só clica se o item do menu estiver
  desmarcado (`aria-checked="false"`), pra nunca desativar por engano algo
  que já estava ligado. Depois de clicar, espera a planilha redesenhar a
  grade e tenta ler de novo antes de desistir.
- Se a tentativa automática falhar (menu com textos diferentes do
  esperado, ou não resolver o problema), a mensagem de erro final avisa que
  já tentou automaticamente e orienta o passo manual como antes.

## 1.1.0-alpha.17 — Fornecedores "Urgente" primeiro + total no início da descrição

Baseado nos prompts de referência fornecidos pelo usuário para cada etapa do
fluxo (fornecedores-pedido-enviar, itens-pedido-rioclaro, extract-supplier):

- **Adicionado**: Etapa 2 agora faz uma segunda passada, abrindo o board com
  o filtro nativo do Trello só para a etiqueta "Urgente"
  (`?filter=label:Urgente`) e usa o mesmo mecanismo de leitura por
  visibilidade (sem detectar cor/texto) para saber quais fornecedores também
  têm essa etiqueta. A lista final fica com os urgentes primeiro (mantendo
  ordem alfabética dentro de cada grupo), com uma etiqueta visual "Urgente"
  ao lado do nome na sidebar. Se essa segunda passada falhar por qualquer
  motivo, a listagem segue normalmente só com a ordem alfabética (não é
  bloqueante).
- **Adicionado**: a descrição gravada no cartão do Trello (Etapa 7) agora
  começa com "Total: N itens" antes da lista de código/descrição/quantidade
  — a sidebar já mostrava esse total, agora o cartão também.

## 1.1.0-alpha.16 — Usa o filtro nativo do Trello em vez de detectar cor/texto de etiqueta

Mudança de abordagem, validada manualmente pelo usuário: em vez de tentar
adivinhar se um cartão tem a etiqueta verde "Rio Claro" (lendo cor/texto do
DOM, com fallback de abrir cada cartão), a extensão agora abre o board
DIRETO com o filtro nativo do Trello aplicado via URL
(`?filter=label:Rio%20Claro` — o mesmo mecanismo que o Trello usa para link
de board pré-filtrado). O Trello esconde os cartões que não batem com o
filtro; a extensão só precisa ler quais cartões estão **visíveis** na lista
"PEDIDOS PENDENTES" — muito mais simples e confiável que detecção de cor.

- **Simplificado**: `background.js` — `ensureTrelloBoardTab()` agora sempre
  fecha qualquer aba do Trello aberta e abre uma nova em
  `TRELLO_BOARD_URL` (board + filtro), em vez de tentar reaproveitar/navegar
  a mesma aba (que tinha se mostrado frágil em várias versões anteriores:
  cartão sobreposto ao navegar, content script desatualizado ao reaproveitar
  a aba). Carregamento limpo sempre, com filtro aplicado e código atualizado
  garantidos.
- **Adicionado**: `isCardVisible()` em `content/trello-content.js` — cartão
  Rio Claro passa a ser, primeiro, "cartão visível na lista" (checando
  `offsetParent`/dimensões). A detecção antiga por cor/texto e a varredura
  profunda (abrir cada cartão) continuam no código como fallback, caso o
  filtro nativo por algum motivo não tenha sido aplicado.
- Removido código morto (`findTrelloTab`, `TRELLO_BOARD_PATH_PREFIX`) que
  ficou sem uso depois dessa simplificação.

## 1.1.0-alpha.15 — Suspeita da causa real do erro persistente: content script desatualizado

Depois de várias correções (alpha.12/13/14) mudarem a lógica de busca da lista
sem o erro sumir, a hipótese mais provável deixou de ser "a lógica está
errada" e passou a ser "a lógica nova nunca está rodando de verdade": quando
a aba do Trello já estava aberta no board (comum, já que a extensão passou a
manter isso), `ensureTrelloBoardTab()` só REATIVAVA essa aba — nunca
recarregava a página. Como o Chrome NÃO reinjeta o content script numa aba já
aberta quando a extensão é atualizada/recarregada, o código antigo (de
alpha.11 ou anterior) podia continuar rodando indefinidamente nessa aba,
não importa quantas versões novas fossem instaladas — até a aba ser
recarregada manualmente.

- **Corrigido**: `ensureTrelloBoardTab()` agora sempre recarrega a aba do
  Trello (`chrome.tabs.reload` com `bypassCache: true`) ao reaproveitá-la,
  garantindo que o content script mais recente é o que roda, mesmo que a aba
  já estivesse aberta desde antes da extensão ser atualizada.

**Se o erro persistir mesmo com essa versão**: feche COMPLETAMENTE a aba do
Trello (não só recarregue a extensão) antes de clicar em "Abrir Trello" — o
que dispara a criação de uma aba nova, com garantia de código fresco.

## 1.1.0-alpha.14 — Varredura no DOM para encontrar lista "PEDIDOS PENDENTES"

O erro "Lista de pedidos não encontrada" persistia porque `findListElement()`
só procurava por `[data-testid="list"]` e outros seletores muito específicos,
que podem variar dependendo de qual parte do board está visível ou se um cartão
está aberto. Quando o card está open (como na screenshot AZUL PACK 3658), o
DOM reorganiza e os seletores antigos não batiam.

- **Reescrito**: `findListElement()` agora tenta 6 seletores diferentes em
  ordem de preferência, e para cada um, procura pelo header/título do elemento
  (que sempre tem o nome da lista), em vez de verificar todo o textContent.
  Isso é bem mais resiliente a mudanças de layout.
- **Reescrito**: `getCardsFromList()` também tenta 5 seletores diferentes para
  encontrar os cartões dentro da lista, com fallback se o primeiro não retornar
  nada.

Resultado: a busca pela lista agora funciona independentemente de qual cartão
esteja aberto ou do layout exato do board.

## 1.1.0-alpha.13 — Procura especificamente por "PEDIDOS PENDENTES"

Alpha.12 procurava só por "pedidos", que era genérico demais e podia ter
falsos positivos se houvesse outras listas com "pedidos" no nome. Agora
procura pelos tokens "pedidos" AND "pendentes" juntos — acha especificamente
"PEDIDOS PENDENTES" sem pegar listas erradas.

- **Corrigido**: `LIST_NAME_TOKENS` agora é `['pedidos', 'pendentes']`,
  garantindo que ambas as palavras apareçam no nome da lista.

## 1.1.0-alpha.12 — Busca pela lista "PEDIDOS PENDENTES" em vez de "RELAÇÃO DE PEDIDOS"

A especificação original e os testes de desenvolvimento assumiam uma lista
chamada "RELAÇÃO DE PEDIDOS", mas o board real do Trello usa "PEDIDOS
PENDENTES". A busca por tokens agora procura só "pedidos" (palavra-chave que
aparece em ambas as variações), tornando a busca genérica o suficiente para
cobrir diferentes nomes de lista desde que contenham essa palavra.

- **Corrigido**: `LIST_NAME_TOKENS` em `content/trello-content.js` agora
  procura só por `['pedidos']` em vez de `['relacao', 'pedidos']`, cobrindo
  "PEDIDOS PENDENTES", "RELAÇÃO DE PEDIDOS" ou qualquer variação que tenha
  "pedidos" no nome.
- **Atualizado**: mensagens de erro agora dizem "Lista de pedidos não
  encontrada" em vez de referenciar o nome específico (menos frágil).

## 1.1.0-alpha.11 — Aguarda SPA renderizar + retry em injeção de scripts

A alpha.10 fechava a aba de cartão e abria nova no board, mas a leitura
falhava com "listener indicated asynchronous response... message channel
closed" — quando a extensão tentava ler o Trello logo após o tab carregar.
O problema era race condition: `waitForTabComplete` só espera o HTML
carregar, mas o Trello é uma SPA (React) que precisa de tempo para
executar, renderizar a grid de cartões e deixar tudo pronto pro content
script achar a lista.

- **Adicionado**: após `waitForTabComplete` na abertura do board, espera
  mais 1.5s para a SPA do Trello renderizar completamente. O HTML carrega
  em 100-200ms, mas React leva mais tempo para desenhar.
- **Adicionado**: retry com delay em `sendWithInjection` — se a primeira
  injeção de script falhar (timing), tenta de novo após 500ms. Também
  espera 200ms após a injeção bem-sucedida antes de enviar a mensagem,
  garantindo que o content script processou a injeção e está pronto para
  ouvir.

## 1.1.0-alpha.10 — Fecha aba de cartão e abre nova do board (sem navegação via SPA)

A alpha.9 tentou restrição de janela + navegação da aba de volta ao board
via `chrome.tabs.update`, mas o error "Lista não encontrada" continuava —
a causa raiz é que Trello trata isso como navegação interna do SPA
(History API, sem reload), então o evento de carregamento `complete` nunca
dispara, o cartão fica aberto por cima da lista, e a leitura falha.

- **Corrigido**: se a aba encontrada estiver em uma URL de cartão
  (`trello.com/c/...`) em vez do board (`trello.com/b/UfPrTr1H/...`), a
  extensão agora fecha essa aba e abre uma **nova** aba apontando para o
  board — um carregamento limpo, sem SPA interceptando, que não pode ficar
  preso num estado "cartão sobreposto".
- A aba é fechada e reaberta só quando necessário (cartão aberto); se já
  estiver no board, só é ativada, sem fechar/reabrir.

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
