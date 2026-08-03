# Testes — Compras

## Fluxo oficial do Portal

### Página Compras

- [ ] Abrir `https://portaltimoni.vercel.app/dashboard/compras`.
- [ ] A página abre sem exigir extensão.
- [ ] O fluxo oficial aparece em seis etapas.
- [ ] **Abrir pedidos no Trello** abre o quadro correto.
- [ ] **Abrir Conferência** abre `/dashboard/conferencia-pedidos`.
- [ ] A mensagem padrão ao fornecedor aparece na página.

### Conferência de pedidos

- [ ] Enviar ao menos um arquivo do pedido MCR/Rodini e um arquivo do fornecedor.
- [ ] Aceitar PDF, JPG, PNG e WEBP, inclusive fotos, prints e manuscritos legíveis.
- [ ] Comparar itens, códigos, quantidades, preços, totais e condições comerciais.
- [ ] Não mostrar APROVAR, REVISAR ou BLOQUEAR.
- [ ] Gerar Excel com preço divergente em amarelo e demais divergências em laranja.
- [ ] Não persistir os documentos enviados após o processamento.

## Extensão 1.1.3 — validação de legado opcional

A extensão não faz parte do teste de aceite do Portal. Os testes abaixo servem apenas caso ela continue instalada como atalho local.

- [x] `manifest.json` válido no artefato do GitHub Actions.
- [x] Sintaxe de `background.js`, `background-portal.js`, `sidebar.js`, `sidebar-direct-update.js`, `lib/*.js` e `content/*.js` validada.
- [x] Arquivos referenciados pelo manifest presentes no pacote.
- [ ] **Abrir Trello** lista urgentes primeiro e inclui os pedidos de Rio Claro.
- [ ] A extração usa código, descrição e quantidade, ignora quantidade vazia e preserva a ordem.
- [ ] O link e o print do Bessani permanecem apenas como referência local.
- [ ] **Atualizar Trello** executa diretamente, sem segunda confirmação.
- [ ] O conteúdo usa `código | descrição | quantidade`.
- [ ] Trocar de fornecedor limpa os dados do fornecedor anterior.

## Limitações conhecidas

1. A extensão depende do DOM do Trello e do Google Sheets e pode quebrar quando esses sites mudarem.
2. O Bessani permanece manual.
3. O Portal não depende da extensão e não deve voltar a detectar, abrir ou exigir a sidebar.
4. A Conferência depende da autenticação configurada no ambiente de produção.
