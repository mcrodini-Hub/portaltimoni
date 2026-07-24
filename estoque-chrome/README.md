# Estoque CT — Timoni Portal

Extensão Chrome (Manifest V3) para a Casa Timoni, com **duas lojas**: Rio Claro e Araras.
Cada necessidade nasce carimbada com a loja de quem pediu, e cada perfil enxerga só a sua
loja (a gestão geral vê as duas). Cobre dois módulos:

- **Módulo 1 — Consulta de Produtos (Vendedores)**: o vendedor escolhe o **seu nome** (lista
  cadastrada na aba `Vendedores`, filtrada pela loja), busca por código ou descrição, e informa
  uma necessidade de compra para o produto selecionado, marcando se **tem cliente aguardando**.
  O nome vai junto no pedido e aparece para o estoque e a gestão. Sem valores, sem anexos.
- **Acompanhamento (gestão)**: um terceiro perfil que mostra a troca completa entre balcão e
  estoque (aguardando estoque, aguardando retorno do Lucas, e respondidos), com contadores no
  topo. É **ativo**: as duas primeiras seções têm os mesmos botões de resposta do estoque, então
  a gestão pode intervir e lançar pedido — inclusive na ausência do Lucas. "Respondidos" é
  histórico (leitura). Para quem fecha com o fornecedor e precisa acompanhar e agir.
- **Módulo 2 — Central de Necessidades (Estoque/Lucas)**: recebe as solicitações dos vendedores
  ("Aguardando você") e responde de três formas:
  - **Recebido! Vou providenciar** — o item vai para a lista de necessidade de compra;
  - **Já tem pedido** — informa nº do pedido e previsão de entrega, que volta para quem
    solicitou;
  - **Outra resposta** — texto livre (ex.: "tem no depósito, pode buscar" ou "não vamos
    repor por ora").

  Quando o pedido é feito, o item vai para **"A caminho"**; ao chegar, o estoque/gestão marca
  **"Chegou"** e o vendedor vê **"Chegou! Avise o cliente"** — fechando o ciclo até o cliente.
  Itens pendentes há muito tempo (ou com cliente aguardando há poucas horas) ganham a etiqueta
  **"Atrasado"**. O vendedor pode informar **quantidade** e uma **observação** curta no pedido.

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

1. **Crie a planilha** no Google Sheets com **três abas**, com estes cabeçalhos na linha 1:
   - Aba **`Produtos`**: `codigo` | `descricao` | `unidade`
     (unidade de medida do produto — ex.: `un`, `barra`, `sc`, `rolo`, `lata`; pode ficar em branco)
   - Aba **`Necessidades`**: `id` | `codigo` | `descricao` | `status` | `criadoEm` |
     `respondidoEm` | `numeroPedido` | `previsaoEntrega` | `observacao` | `clienteAguardando` |
     `unidade` | `vendedor` | `quantidade` | `notaVendedor` | `chegouEm`
   - Aba **`Vendedores`** (para a lista de nomes): `nome` | `unidade`
     (unidade em branco = o vendedor aparece nas duas lojas)
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

> Atalho: em [`apps-script/planilha/`](apps-script/planilha/) há uma planilha pronta
> (`Estoque-Portal-Timoni.xlsx`, com as 3 abas e nomes já preenchidos) e o passo a passo
> completo em [`PLANILHA.md`](apps-script/planilha/PLANILHA.md).

## Atualizar produtos e vendedores

O catálogo e a lista de nomes ficam **na planilha** — atualizar é só editar as abas, **sem
mexer no Apps Script e sem republicar** (o Web App lê a planilha ao vivo).

- **Produtos** (aba `Produtos`): mantenha a **linha 1** (`codigo` | `descricao` | `unidade`) intacta.
  A partir da linha 2, coluna **A = código** (único), **B = descrição** e **C = unidade de medida**
  (ex.: `un`, `barra`, `sc`, `rolo`, `lata`; pode ficar em branco). A unidade já vem pré-selecionada
  no pedido do vendedor quando ele escolhe o produto. Pode colar em bloco de outra planilha; quanto
  mais completa a descrição, mais fácil achar na busca (que casa com **código ou qualquer palavra da
  descrição**).
- **Vendedores** (aba `Vendedores`): coluna **A = nome**, coluna **B = unidade**
  (`rio_claro`, `araras`, ou em branco = aparece nas duas lojas).
- Depois de editar, na extensão (perfil Vendedores) clique em **Atualizar** para a busca já
  usar a lista nova. A aba `Necessidades` é preenchida pela própria extensão — não edite à mão.

## Perfis e lojas

Há **dois setores**: **Vendas** e **Gestão**. Cada computador escolhe um perfil na primeira abertura.

| Setor | Perfil | Enxerga | Age? |
|---|---|---|---|
| **Vendas** | Vendedores — Rio Claro / Araras | só a sua loja | cria pedidos (pode alternar de loja) |
| **Gestão** | Estoque — Lucas Rio Claro / Lucas Araras | só a sua loja | responde |
| **Gestão** | Gestão geral — Ciça / Marcelo / Jeovana / Reginaldo | Rio Claro + Araras | vê tudo, consulta produto e responde (fecha com fornecedor) |

- Só os **Vendedores** podem alternar de loja (CT Rio Claro ⇄ CT Araras) pelo botão no topo — é
  troca de *loja*, não de *perfil*.
- A **Gestão geral** (Ciça, Marcelo, Jeovana e Reginaldo) vê as duas lojas juntas, com etiqueta da
  loja em cada item, um **resumo de 7 dias** (volume, tempo médio de resposta, atrasados) e a
  **Consulta de produto** (situação atual por loja) — todos com o mesmo acesso.
- **"Registrar pedido em aberto"** (opcional): lançar um pedido já feito que não veio de uma
  solicitação (ex.: os que estão no Trello/PDF), para ele aparecer na "situação atual" do
  produto. Disponível para toda a **Gestão geral**.
- Notificações e contadores respeitam a loja de cada computador.

## Identificação de usuário

Não há login. Cada computador é configurado uma única vez com um perfil (Vendedores, Estoque,
Gerência ou Gestão) e a sua loja na primeira abertura da sidebar — fica salvo localmente. No dia a dia o perfil
é **fixo**: a troca não fica na barra de cima, e sim dentro do **⚙** (configuração da máquina),
com confirmação. Assim o vendedor não muda de perfil sozinho; a troca serve só para
reconfigurar a máquina ou para testar os perfis.

## Notificações

No painel ⚙ há a opção **"Receber notificações neste computador"**. Ligada, a extensão avisa
(notificação do Chrome) quando entra um pedido de um vendedor ou quando o estoque responde —
mesmo com o painel fechado, enquanto o Chrome estiver aberto. Útil para o perfil de
Acompanhamento seguir a troca sem ficar de olho na tela. A verificação é periódica
(~1 min), reaproveitando a mesma fila (planilha no modo compartilhado).

## Instalação da extensão

1. Abra `chrome://extensions/`.
2. Ative o **Modo de desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta `estoque-chrome/`.
4. Clique no ícone da extensão — a sidebar abre. Na primeira vez, escolha o perfil deste
   computador (Vendedores, Estoque, Gerência ou Gestão) e, se for usar o modo planilha,
   configure a URL no ⚙.

### Instalar nas outras máquinas

A extensão é carregada "sem compactação", então em **cada** computador:

1. **Leve a pasta** `estoque-chrome/` para a máquina: no GitHub, branch de trabalho →
   **Code → Download ZIP** e descompacte (ou copie a pasta por pen drive / rede).
2. `chrome://extensions/` → **Modo de desenvolvedor** → **Carregar sem compactação** →
   selecione a pasta **`estoque-chrome`**.
3. Escolha **o perfil daquela máquina** na primeira abertura.
4. **⚙ → cole a mesma URL `/exec`** (a mesma em todas as máquinas — é o que liga todas à
   planilha) → **Salvar e testar** até dar "conexão OK".
5. Opcional: marque **"Receber notificações neste computador"** no ⚙.

> ⚠️ **Não apague nem mova** a pasta `estoque-chrome/` depois de carregar — o Chrome lê os
> arquivos daquele local. Deixe numa pasta fixa (ex.: `Documentos/EstoqueCT`). Para atualizar
> a extensão numa máquina, substitua os arquivos da pasta e clique em **recarregar (↻)** no
> `chrome://extensions/`.

## Teste rápido (modo local, sem planilha)

Escolha "Balcão", busque um produto (ex. "1001" ou "torneira"), informe a necessidade;
depois clique em "Trocar" e escolha "Estoque" para ver e responder a mesma solicitação.
No modo local os dados são desta sessão do Chrome, então tudo aparece na mesma janela.

## Limpeza automática das listas

Itens já resolvidos (**Chegou** ou respondidos com observação) somem sozinhos das telas
depois de **7 dias** — de "Minhas solicitações" (vendedor) e de "Respondidos" (Gestão).
Não é apagado nada: o histórico completo continua na aba `Necessidades` da planilha, só
não polui mais o dia a dia. Itens ainda em andamento (aguardando estoque, aguardando
retorno, a caminho) continuam visíveis até serem resolvidos, não importa a idade.

## Limpar solicitações (zona de teste)

Na tela de Acompanhamento, só o perfil **Gestão geral — Ciça** tem, no final, o botão **"Limpar
solicitações (teste)"** — é exclusivo dela, os demais perfis de Gestão geral (Marcelo, Jeovana,
Reginaldo) não veem esse botão. Ele apaga **todas** as solicitações — as duas lojas, sem volta —
para começar do zero num teste. Não mexe nas abas `Produtos` nem `Vendedores`. Pede
**confirmação em duas etapas** antes de executar, porque no modo planilha limpa para todo mundo
na hora.

> Requer a versão atual do `Codigo.gs` publicada (ação `limpar`). Se o botão der erro, é
> porque a planilha ainda está com uma versão mais antiga do script — cole o `Codigo.gs`
> atualizado no Apps Script e **Implantar > Gerenciar implantações > editar (lápis) > Nova
> versão**.

## Desempenho

Pensado para ser leve mesmo com polling e várias telas lendo a mesma fila:

- **Backend não trava nas leituras**: o Apps Script só usa `LockService` nas escritas
  (criar/responder). As leituras — que o polling dispara com frequência — não pegam o lock.
- **Cache curto da fila** (~3s, em memória, por contexto): seleção de produto, recarga por
  foco e polling reaproveitam a mesma busca em vez de irem à planilha várias vezes seguidas.
  Qualquer escrita invalida o cache, então os dados seguem frescos.
- **Polling pausa quando o painel não está visível** e retoma (com recarga imediata) ao
  reaparecer. O botão "Atualizar" só refaz o catálogo no perfil Balcão.

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
- Consultar/exibir previsão de chegada já vinculada a um pedido existente diretamente para
  o vendedor (Módulo 1) a partir de uma aba de pedidos na planilha.
