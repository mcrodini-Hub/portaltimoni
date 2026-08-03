# Workflow oficial — Compras

**Status:** vigente  
**Fonte técnica oficial:** branch `main` de `mcrodini-Hub/portaltimoni`.

## Objetivo

Executar cada fornecedor com rapidez, sem duplicar controles e sem depender da extensão antiga.

## Fluxo operacional

1. Abrir **Portal Timoni → Compras**.
2. Abrir o Trello pelo botão **Abrir pedidos no Trello**.
3. Priorizar cartões urgentes e, depois, os fornecedores de Rio Claro.
4. Trabalhar um fornecedor por vez.
5. Abrir a planilha do fornecedor e obter somente:
   - código;
   - descrição;
   - quantidade do mês atual.
6. Ignorar linhas cuja quantidade esteja vazia e preservar a ordem original da planilha.
7. Lançar o pedido manualmente no Bessani.
8. Atualizar o cartão no Trello com o padrão operacional vigente: fornecedor, número do pedido, datas, etiqueta, movimentação e anexo quando aplicável.
9. Abrir **Conferência de pedidos** no Portal.
10. Enviar o pedido MCR/Rodini e o documento do fornecedor.
11. Baixar o Excel quando houver divergências e encaminhá-lo ao financeiro.
12. Enviar o pedido ao fornecedor pelo WhatsApp.
13. Manter o cartão na relação correspondente até que a pendência seja efetivamente concluída.

## Mensagem padrão ao fornecedor

> Olá, segue pedido de compra. Aguardo retorno com a previsão de entrega. Obrigada, Ciça.

## Regras fixas

- Trello é a fonte oficial do status dos pedidos.
- Não criar um segundo controle de status no Portal.
- Bessani permanece manual.
- Não usamos SKU ou EAN como regra padrão de pareamento.
- A lista de itens usa código, descrição e quantidade.
- Quantidade vazia significa item não pedido naquele mês.
- A ordem da planilha deve ser preservada.
- A Conferência é independente da extensão.
- A Conferência não usa APROVAR, REVISAR ou BLOQUEAR.
- Preço divergente fica amarelo no Excel.
- Outras divergências ficam laranja.
- O pedido é tratado por fornecedor, do início ao fim, antes de passar ao próximo.

## Fontes oficiais

| Informação | Fonte |
|---|---|
| Relação, prioridade e status | Trello |
| Código, descrição e quantidade | Planilha do fornecedor |
| Número e lançamento | Bessani |
| Comparação dos documentos | Conferência de pedidos no Portal |
| Divergências para ajuste | Excel gerado pela Conferência |
| Acessos e orientação do fluxo | Portal Timoni |

## Extensão antiga

A pasta `hub-pedidos-chrome` permanece no repositório apenas como legado e ferramenta opcional. O Portal não deve detectar, abrir nem exigir essa extensão.

## Não retomar

- versões V1.0.9 a V1.0.12 do Claude;
- abertura automática de várias abas;
- conferência manual com Aprovar/Reprovar dentro da extensão;
- confirmação duplicada antes de atualizar o Trello;
- duplicação do status do Trello;
- dependência obrigatória de API paga;
- alterações diretas em `main` sem validação por PR.
