# Extensão Compras — legado opcional

Esta pasta preserva a extensão Chrome desenvolvida durante a primeira fase do projeto.

**A extensão não é mais uma dependência do Portal Timoni nem a fonte oficial do processo.** Ela pode continuar instalada como atalho local enquanto for útil, mas o fluxo oficial está documentado em `WORKFLOW_OFICIAL.md` e aparece na página **Portal Timoni → Compras**.

## Fonte oficial atual

- pedidos e status: Trello;
- itens do pedido: planilha do fornecedor;
- lançamento: Bessani;
- conferência: módulo `/dashboard/conferencia-pedidos` do Portal;
- comunicação: WhatsApp;
- central de acesso: Portal Timoni.

## O que a extensão ainda faz

1. Lê fornecedores no Trello.
2. Extrai código, descrição e quantidade de uma planilha.
3. Guarda link e print do Bessani como referência local.
4. Atualiza cartões do Trello com os itens extraídos.

A extensão não deve ser necessária para abrir ou usar o módulo Compras no Portal.

## Conferência de pedidos

A Conferência é um processo separado e mais robusto no Portal Timoni:

`https://portaltimoni.vercel.app/dashboard/conferencia-pedidos`

O módulo:

- recebe PDFs, fotos, prints e imagens manuscritas;
- compara o pedido MCR/Rodini com o documento do fornecedor;
- analisa itens, quantidades, códigos, preços, totais e condições comerciais;
- não usa APROVAR, REVISAR ou BLOQUEAR;
- gera Excel com preço divergente em amarelo e demais divergências em laranja;
- não armazena os documentos enviados.

`PROTOCOLO_CONFERENCIA_PEDIDOS.md` é referência histórica do fluxo manual anterior. Não deve ser usado para recriar botões de aprovação dentro da extensão.

## Instalação opcional

1. Abra `chrome://extensions/`.
2. Ative o **Modo de desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `hub-pedidos-chrome/`.
5. Clique no ícone da extensão para abrir a sidebar.

## Versão arquivada

**1.1.3**

O artefato foi validado pelo GitHub Actions quanto ao manifest e à sintaxe JavaScript. Novas funcionalidades devem ser implementadas no Portal sempre que possível, e não nesta extensão.
