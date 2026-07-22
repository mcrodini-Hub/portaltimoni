# Marketing CT — Portal Timoni

Esqueleto inicial de um novo módulo (extensão Chrome, Manifest V3),
independente do `hub-pedidos-chrome`, reservado para as futuras
funcionalidades de **Marketing da Casa Timoni**.

Este módulo ainda **não tem fluxo funcional definido** — por enquanto só
carrega, abre uma sidebar de placeholder e mantém um estado mínimo
(`pinned`) em `chrome.storage.local`, seguindo a mesma estrutura de pastas
do `hub-pedidos-chrome` para facilitar a evolução posterior.

## Instalação

1. Abra `chrome://extensions/`.
2. Ative o **Modo de desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `marketing-ct-chrome/` (esta pasta).
5. Clique no ícone da extensão — a sidebar abre com a mensagem de "em construção".

## Estrutura de arquivos

```
marketing-ct-chrome/
├── manifest.json
├── background.js          # service worker: abre sidebar, responde GET_STATE/TOGGLE_PIN/RESET_MODULE
├── sidebar.html/.css/.js  # interface placeholder
├── lib/
│   ├── state.js           # estado mínimo + persistência em chrome.storage.local
│   └── messages.js        # envelope de mensagens tipadas
└── icons/                 # reaproveitados do hub-pedidos-chrome como placeholder
```

## Próximos passos

Ainda a definir com o time: qual a primeira funcionalidade de marketing a
automatizar (ex.: campanhas via WhatsApp, gestão de posts/agenda via
Trello, etc.), quadros/planilhas envolvidos, e ícones próprios do módulo.
