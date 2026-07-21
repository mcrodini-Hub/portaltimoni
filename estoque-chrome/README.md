# Estoque — Portal Timoni

Extensão Chrome (Manifest V3) para a Casa Timoni Rio Claro. Primeira versão cobre dois
módulos:

- **Módulo 1 — Consulta de Produtos (Balcão)**: busca por código ou descrição, e permite
  informar uma necessidade de compra para o produto selecionado. Sem valores, sem anexos.
- **Módulo 2 — Central de Necessidades (Estoque/Lucas)**: recebe as solicitações do balcão
  e responde de duas formas — "Recebido, vamos providenciar o pedido de compra!" (o item
  vai para a lista de necessidade de compra) ou "Já tem pedido" (informa nº do pedido e
  previsão de entrega, que aparece de volta para quem solicitou).

## Estado atual: MOCKADO

Este é um esqueleto funcional para validar o fluxo, **não a versão final**:

- O catálogo de produtos (`lib/mock-produtos.js`) é uma lista de exemplo fixa no código.
  Será substituído pela fonte real assim que ela for disponibilizada.
- As necessidades ficam salvas em `chrome.storage.local`, que é **local à instalação da
  extensão** (um Chrome/computador só). Balcão e Estoque rodando em computadores
  diferentes ainda **não compartilham** essa fila entre si — para isso funcionar de
  verdade entre máquinas diferentes, é necessário conectar a uma fonte de dados
  compartilhada (ex.: planilha do Google Sheets, no mesmo padrão que o
  `hub-pedidos-chrome/content/sheets-content.js` já usa para ler/escrever numa aba aberta).

## Identificação de usuário

Não há login. Cada computador é configurado uma única vez com um papel (Balcão ou
Estoque) na primeira abertura da sidebar — fica salvo localmente e pode ser trocado a
qualquer momento pelo link "Trocar" no topo.

## Instalação (para testes)

1. Abra `chrome://extensions/`.
2. Ative o **Modo de desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta `estoque-chrome/`.
4. Clique no ícone da extensão — a sidebar abre. Na primeira vez, escolha o papel deste
   computador (Balcão ou Estoque).

Para testar o fluxo completo sozinho: escolha "Balcão", busque um produto (ex. "1001" ou
"torneira"), informe a necessidade; depois clique em "Trocar" e escolha "Estoque" para
ver e responder a mesma solicitação (os dados são locais ao navegador, então tudo aparece
na mesma sessão do Chrome usada para o teste).

## Estrutura de arquivos

```
estoque-chrome/
├── manifest.json
├── background.js       # mínimo por enquanto — só abre o side panel
├── sidebar.html/.css/.js
├── lib/
│   ├── store.js          # dados + chrome.storage.local (papel, produtos, necessidades)
│   └── mock-produtos.js  # catálogo de exemplo, a substituir pela fonte real
└── icons/
```

## Próximos passos conhecidos

- Conectar o catálogo real de produtos e estoque (fonte a ser disponibilizada).
- Conectar a fila de necessidades a um armazenamento compartilhado entre computadores.
- Módulo 2, segunda etapa: quando existirem outras lojas além de Rio Claro, adicionar
  seleção de unidade e validador responsável por unidade.
