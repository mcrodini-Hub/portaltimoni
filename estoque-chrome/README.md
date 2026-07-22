# Estoque — Portal Timoni

Extensão Chrome (Manifest V3) para a Casa Timoni Rio Claro. Primeira versão cobre dois
módulos:

- **Módulo 1 — Consulta de Produtos (Balcão)**: busca por código ou descrição, e permite
  informar uma necessidade de compra para o produto selecionado, marcando se **tem cliente
  aguardando**. Sem valores, sem anexos.
- **Acompanhamento (gestão)**: um terceiro perfil que mostra a troca completa entre balcão e
  estoque (aguardando estoque, aguardando retorno do Lucas, e respondidos), com contadores no
  topo. É **ativo**: as duas primeiras seções têm os mesmos botões de resposta do estoque, então
  a gestão pode intervir e lançar pedido — inclusive na ausência do Lucas. "Respondidos" é
  histórico (leitura). Para quem fecha com o fornecedor e precisa acompanhar e agir.
- **Módulo 2 — Central de Necessidades (Estoque/Lucas)**: recebe as solicitações do balcão
  ("Aguardando você") e responde de três formas:
  - **Recebido! Vou providenciar** — o item vai para a lista de necessidade de compra;
  - **Já tem pedido** — informa nº do pedido e previsão de entrega, que volta para quem
    solicitou;
  - **Outra resposta** — texto livre (ex.: "tem no depósito, pode buscar" ou "não vamos
    repor por ora").

  A fila do Lucas mostra primeiro os itens com **cliente aguardando** (etiqueta vermelha).
  Se o mesmo produto for pedido de novo já marcando cliente aguardando, o item existente é
  promovido em vez de duplicar.

Outros recursos para agilizar o dia a dia:

- **Prioridade visível para o estoque**: quem marca "cliente aguardando" é o balcão; o Lucas
  vê a etiqueta na fila (não precisa marcar), para priorizar o retorno.
- **Situação do produto no balcão**: ao selecionar um produto, o balcão já vê se ele tem
  solicitação/pedido/previsão em aberto — evita pedir duplicado e responde na hora "tem
  pedido?".
- **Tempo de espera**: cada item da fila mostra há quanto tempo está esperando ("há 2 h",
  "há 3 dias").
- **Confirmações e dados frescos**: aviso curto ao enviar/responder, e recarga automática
  ao focar o painel (além do polling de ~15s no modo planilha).

## Dois modos de funcionamento

A extensão escolhe o modo sozinha conforme haja ou não uma planilha configurada:

- **Modo planilha (compartilhado)** — recomendado para uso real. A fila de necessidades e o
  catálogo de produtos ficam numa **planilha do Google**, acessada por um backend em
  **Apps Script** publicado como Web App. Assim, o computador do balcão e o do estoque
  (Lucas), em máquinas diferentes, veem e atualizam **a mesma fila**.
- **Modo local (fallback)** — sem planilha configurada, tudo fica em `chrome.storage.local`
  desta instalação. Serve só para testar a interface; **não é compartilhado** entre
  computadores.

## Configuração da planilha (uma vez)

1. **Crie a planilha** no Google Sheets com **duas abas**, com estes cabeçalhos na linha 1:
   - Aba **`Produtos`**: `codigo` | `descricao`
   - Aba **`Necessidades`**: `id` | `codigo` | `descricao` | `status` | `criadoEm` |
     `respondidoEm` | `numeroPedido` | `previsaoEntrega` | `observacao` | `clienteAguardando`
2. **Preencha a aba `Produtos`** com o catálogo real (código e descrição). É essa aba que
   alimenta a busca do balcão. A aba `Necessidades` começa vazia (só o cabeçalho) — a
   extensão preenche sozinha.
3. **Publique o backend**: menu **Extensões > Apps Script**, apague o conteúdo padrão, cole
   o arquivo [`apps-script/Codigo.gs`](apps-script/Codigo.gs) e salve. Depois:
   **Implantar > Nova implantação**:
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
4. **Copie a URL** que termina em `/exec`.
5. Na extensão, clique no **⚙** (topo) e cole a URL em "Planilha compartilhada", depois
   **Salvar e testar**. Faça isso em cada computador (balcão e estoque) uma vez.

## Identificação de usuário

Não há login. Cada computador é configurado uma única vez com um papel (Balcão, Estoque ou
Acompanhamento) na primeira abertura da sidebar — fica salvo localmente e pode ser trocado a
qualquer momento pelo link "Trocar" no topo.

## Notificações

No painel ⚙ há a opção **"Receber notificações neste computador"**. Ligada, a extensão avisa
(notificação do Chrome) quando entra um pedido do balcão ou quando o estoque responde —
mesmo com o painel fechado, enquanto o Chrome estiver aberto. Útil para o perfil de
Acompanhamento seguir a troca sem ficar de olho na tela. A verificação é periódica
(~1 min), reaproveitando a mesma fila (planilha no modo compartilhado).

## Instalação da extensão

1. Abra `chrome://extensions/`.
2. Ative o **Modo de desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta `estoque-chrome/`.
4. Clique no ícone da extensão — a sidebar abre. Na primeira vez, escolha o papel deste
   computador (Balcão ou Estoque) e, se for usar o modo planilha, configure a URL no ⚙.

## Teste rápido (modo local, sem planilha)

Escolha "Balcão", busque um produto (ex. "1001" ou "torneira"), informe a necessidade;
depois clique em "Trocar" e escolha "Estoque" para ver e responder a mesma solicitação.
No modo local os dados são desta sessão do Chrome, então tudo aparece na mesma janela.

## Estrutura de arquivos

```
estoque-chrome/
├── manifest.json
├── background.js         # mínimo — só abre o side panel
├── sidebar.html/.css/.js # interface (Balcão, Estoque, config da planilha)
├── lib/
│   ├── store.js            # camada de dados: modo planilha (Web App) ou local
│   └── mock-produtos.js    # catálogo de exemplo usado só no modo local
├── apps-script/
│   └── Codigo.gs           # backend do Web App (colar no Apps Script da planilha)
└── icons/
```

## Próximos passos conhecidos

- Sincronização em tempo real: hoje o modo planilha usa polling leve (recarrega a cada
  ~15s) e um botão "Atualizar". Suficiente para o volume atual.
- Módulo 2, segunda etapa: quando existirem outras lojas além de Rio Claro, adicionar
  seleção de unidade e validador responsável por unidade (Lucas Rio Claro / Lucas Araras).
- Consultar/exibir previsão de chegada já vinculada a um pedido existente diretamente no
  balcão (Módulo 1) a partir de uma aba de pedidos na planilha.
