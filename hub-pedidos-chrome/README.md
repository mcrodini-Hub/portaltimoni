# Hub de Pedidos — Portal Timoni

Extensão Chrome (Manifest V3) que assiste o fluxo de compras por etapas, abrindo
Trello, Google Drive e Bessani **somente sob demanda**, com uma sidebar fixável
como interface única.

Fluxo: **Trello → escolher fornecedor → Google Drive/Sheets → extrair itens →
Bessani (opcional) → atualizar Trello**.

## Instalação

1. Abra `chrome://extensions/`.
2. Ative o **Modo de desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** (ou "Carregar extensão sem empacotamento").
4. Selecione a pasta `hub-pedidos-chrome/` (esta pasta).
5. Clique no ícone da extensão na barra de ferramentas — a sidebar abre direto
   (não existe mais popup separado).

## Como usar

1. **1. Relação de pedidos** — clique em **Abrir Trello**. A extensão abre (ou
   reaproveita) a aba `https://trello.com/b/UfPrTr1H/compras`, localiza a lista
   **RELAÇÃO DE PEDIDOS** e lista os fornecedores com etiqueta verde **Rio Claro**
   (sem duplicidade, em ordem alfabética).
2. **2. Escolher fornecedor** — clique em um fornecedor da lista. O botão
   **Abrir Google Drive** só é liberado depois da seleção.
3. **3. Planilha aberta** — no Drive, abra manualmente a planilha do fornecedor.
   Com a planilha do Google Sheets como aba ativa, clique em **Extrair itens da
   planilha**. Os itens (código | descrição | quantidade) aparecem na sidebar.
4. **4. Bessani** — cole o link do pedido no Bessani e clique em **Abrir Bessani**
   quando quiser (a ação é sempre manual, o link fica salvo mesmo se você não
   abrir agora).
5. **5. Atualização final** — revise o resumo do fornecedor e a quantidade de
   itens, clique em **Atualizar Trello**, confirme, e acompanhe o resultado por
   cartão (atualizado / ignorado / não encontrado / erro).

A opção **Fixar** (no topo) preserva o estado (fornecedor selecionado, itens
extraídos, link do Bessani) mesmo trocando de aba ou fechando/reabrindo a
sidebar — tudo fica salvo em `chrome.storage.local`.

Use **Reiniciar fluxo** para começar um novo fornecedor do zero, e o painel
**Mostrar diagnóstico** (rodapé) para copiar um relatório de texto útil em caso
de problema.

## O que mudou em relação à v1.0.12

Veja `CHANGELOG.md` para o detalhamento completo, incluindo a mudança de
comportamento mais importante: a atualização do cartão do Trello agora usa os
**itens extraídos da planilha** (código | descrição | quantidade), e não mais o
print/número de pedido do Bessani — o Bessani virou uma etapa independente,
apenas de abertura de link sob demanda.

## Limitações conhecidas

Ver seção dedicada em `TESTES.md`.

## Estrutura de arquivos

```
hub-pedidos-chrome/
├── manifest.json
├── background.js          # orquestração: abas, mensagens, estado, erros
├── sidebar.html/.css/.js  # única interface do usuário
├── content/
│   ├── trello-content.js  # leitura/filtro/atualização de cartões
│   └── sheets-content.js  # extração de itens da planilha
├── lib/
│   ├── state.js           # máquina de estados + chrome.storage.local
│   ├── tabs.js             # abrir/reaproveitar aba única
│   ├── messages.js         # envelope de mensagens tipadas
│   └── validators.js       # validação de URLs e colunas da planilha
└── icons/
```
