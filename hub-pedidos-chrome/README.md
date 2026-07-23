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

1. **1. Relação de pedidos** — escolha a **região** (Rio Claro ou Araras) e clique
   em **Abrir Trello**. A extensão abre (ou reaproveita) a aba
   `https://trello.com/b/UfPrTr1H/compras`, localiza a lista **PEDIDOS PENDENTES**
   e lista os fornecedores com a etiqueta da região escolhida (sem duplicidade).
   Para **Rio Claro** (verde), em ordem alfabética com os **Urgente** no topo. Para
   **Araras** (azul), sem reordenar — só na ordem em que os cartões aparecem no
   board filtrado (ver `prompts-referencia/`). Trocar de região reinicia a
   listagem e o fluxo em andamento.
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
6. **6. Atualização final** — revise o resumo, informe o **número do pedido**
   (vira o novo nome do cartão, padrão `<FORNECEDOR> <NÚMERO>MCR` — ex:
   `ROMPLAS 6055MCR`) e, se quiser, as **datas de envio e entrega**. Clique em
   **Atualizar Trello**, confirme, e acompanhe o resultado por cartão
   (atualizado / ignorado / não encontrado / erro). Só fica disponível
   depois da conferência da Etapa 5 aprovada **e** do número do pedido
   preenchido. A confirmação desta etapa é proposital e independente da
   aprovação da Etapa 5: uma aprova o *conteúdo* do pedido, a outra confirma
   a *ação* de gravar no Trello — duas camadas de segurança, mantidas por
   decisão explícita (não é redundância a remover). Ao confirmar, a
   extensão: escreve os itens na descrição, renomeia o cartão, preenche as
   datas informadas, adiciona a etiqueta **Enviado**, move o cartão para o
   topo da lista de enviados da região (ex: "PEDIDOS ENVIADO RIO CLARO") e
   **deixa o cartão aberto** para você anexar o documento manualmente — a
   extensão nunca anexa nada sozinha. Ao concluir todos os passos, aparece
   a confirmação **"Pronto!"**.
   > **Interação nova, ainda não validada contra o Trello real**: renomear,
   > preencher datas, adicionar etiqueta e mover o cartão são automações de
   > DOM recém-escritas (ver `prompts-referencia/3-trello-atualizar.txt`).
   > Cada passo falha isoladamente sem travar os outros — se algum seletor
   > não bater com o Trello ao vivo, o resultado do cartão aparece como
   > "erro" com o detalhe de quais passos funcionaram, em vez de travar a
   > extensão. Espera-se precisar ajustar seletores depois do primeiro teste
   > real (mesmo padrão de iteração de todo o resto do projeto — ver
   > `CHANGELOG.md`).

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
│   ├── validators.js       # validação de URLs e colunas da planilha
│   ├── xlsx-writer.js      # gerador mínimo de .xlsx (Etapa 5 → financeiro)
│   └── regioes.js          # config por região (etiqueta, cor, ordenação, lista de enviados)
├── PROTOCOLO_CONFERENCIA_PEDIDOS.md  # protocolo por trás da Etapa 5
├── prompts-referencia/     # prompts originais que especificam cada etapa (fonte de verdade)
└── icons/
```
