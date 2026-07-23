# Compras — Portal Timoni

Extensão Chrome (Manifest V3) que assiste o fluxo de compras por etapas, abrindo
Trello, Google Drive e Bessani **somente sob demanda**, com uma sidebar fixável
como interface única.

Fluxo: **Trello → escolher fornecedor → Google Drive/Sheets → extrair itens →
Bessani (opcional) → conferência item a item → atualizar Trello**.

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
3. **3. Planilha aberta** — no Drive, abra manualmente a planilha do fornecedor
   (ou cole o link dela no campo da Etapa 3, e a extensão abre/reaproveita a
   aba sozinha). Clique em **Extrair itens da planilha**. Os itens
   (código | descrição | quantidade) aparecem na sidebar.
4. **4. Bessani** — cole o link do pedido no Bessani e clique em **Abrir Bessani**
   quando quiser (a ação é sempre manual, o link fica salvo mesmo se você não
   abrir agora). Também dá para colar (Ctrl+V) ou fazer upload de um print do
   Bessani só como referência visual guardada na sidebar — não é enviado nem
   anexado a lugar nenhum.
5. **5. Conferência do pedido** — marque o tipo de documento recebido do
   fornecedor (orçamento ou NF-e) e percorra o checklist item a item
   (itens presentes, códigos, quantidades, preço, IPI, frete/pagamento,
   total, entrega). Registre qualquer divergência encontrada (item, valor
   pedido x valor recebido). **Aprovar pedido** exige o checklist completo,
   mas não exige zerar as divergências — elas não travam a aprovação, só
   disparam uma confirmação extra e ficam guardadas na sidebar para
   repassar ao financeiro (preço/IPI são ajustados depois, fora da
   extensão). Esta etapa segue `PROTOCOLO_CONFERENCIA_PEDIDOS.md` e
   bloqueia a Etapa 6 enquanto não for aprovada. Depois de aprovar, aparece
   o botão **Baixar Excel para o financeiro**, que gera um `.xlsx` com
   fornecedor, data, itens do pedido e as divergências encontradas — pronto
   para encaminhar.
6. **6. Atualização final** — revise o resumo do fornecedor e a quantidade de
   itens, clique em **Atualizar Trello**, confirme, e acompanhe o resultado por
   cartão (atualizado / ignorado / não encontrado / erro). Só fica disponível
   depois da conferência da Etapa 5 aprovada. A confirmação desta etapa é
   proposital e independente da aprovação da Etapa 5: uma aprova o
   *conteúdo* do pedido, a outra confirma a *ação* de gravar no Trello —
   duas camadas de segurança, mantidas por decisão explícita (não é
   redundância a remover).

A opção **Fixar** (no topo) preserva o estado (fornecedor selecionado, itens
extraídos, link do Bessani) mesmo trocando de aba ou fechando/reabrindo a
sidebar — tudo fica salvo em `chrome.storage.local`.

Use **Reiniciar fluxo** para começar um novo fornecedor do zero, e o painel
**Mostrar diagnóstico** (rodapé) para copiar um relatório de texto útil em caso
de problema.

## Painel Timoni (opcional)

A seção **"Mostrar configuração do Painel Timoni"** (rodapé, ao lado do diagnóstico)
permite colar a URL de um Web App (Apps Script) publicado a partir de
`apps-script/Codigo.gs`. Com a URL salva, cada etapa passa a espelhar o estado atual
numa planilha própria ("Compras — Painel Timoni"), e o
[Painel Timoni](../painel-timoni/README.md) mostra os 5 cartões de Compras (Fornecedores,
Itens, Conferência de preços, Bessani, Atualização) com dados reais em vez de exemplo.
É só um espelho — a extensão continua funcionando 100% normalmente sem essa URL
configurada, e nenhuma etapa do fluxo depende dela.

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
│   ├── validators.js       # validação de URLs e colunas da planilha
│   └── xlsx-writer.js      # gerador mínimo de .xlsx (Etapa 5 → financeiro)
├── apps-script/
│   └── Codigo.gs           # backend (Web App) do espelho para o Painel Timoni — opcional
├── PROTOCOLO_CONFERENCIA_PEDIDOS.md  # protocolo por trás da Etapa 5
├── prompts-referencia/     # prompts originais que especificam cada etapa (fonte de verdade)
└── icons/
```
