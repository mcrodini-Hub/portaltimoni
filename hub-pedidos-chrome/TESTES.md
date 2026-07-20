# Testes — Hub de Pedidos v1.1.0-alpha.1

## O que foi validado neste ambiente (sem Chrome real / sem acesso ao Trello, Drive e Bessani reais)

- ✅ Sintaxe de todos os arquivos `.js` (`node --check`).
- ✅ `manifest.json` é JSON válido e carrega as permissões mínimas descritas na spec.
- ✅ `lib/validators.js`: testado isoladamente em Node (normalização de texto,
  detecção de colunas por cabeçalho, validação de URL do Bessani/Trello/Sheets).
- ✅ `sidebar.js`: smoke test com DOM simulado (jsdom) — carregamento inicial,
  renderização de fornecedores/itens/resultados a partir de um estado
  simulado, clique em fornecedor, toggle do diagnóstico. Nenhuma exceção
  lançada.
- ✅ IDs referenciados em `sidebar.js` conferidos 1:1 contra `sidebar.html`.
- ✅ Revisão cruzada de todo o código contra a base v1.0.12 (ver `CHANGELOG.md`).

## O que NÃO pôde ser testado aqui (precisa de validação manual no Chrome)

Este ambiente não tem Chrome instalado nem acesso às contas de Trello, Google
Drive/Sheets e Bessani reais. Os testes abaixo, tirados diretamente dos
critérios de aceite da especificação, precisam ser executados manualmente
depois de carregar a extensão via `chrome://extensions/`.

### Teste 1 — Sidebar
- [ ] Clicar no ícone abre a sidebar diretamente (sem popup).
- [ ] Opção "Fixar" aparece e funciona.
- [ ] Estado é preservado após fechar e reabrir a sidebar.

### Teste 2 — Trello
- [ ] "Abrir Trello" abre só o Trello (nenhuma outra aba).
- [ ] Aba existente do Trello é reaproveitada, não duplicada.
- [ ] Lista "RELAÇÃO DE PEDIDOS" é localizada corretamente.

### Teste 3 — Filtro
- [ ] Só cartões com etiqueta verde "Rio Claro" aparecem na lista de fornecedores.
- [ ] Cartões de outras etiquetas/cores são ignorados.
- [ ] Fornecedores duplicados aparecem uma única vez, em ordem alfabética.

### Teste 4 — Drive
- [ ] Botão "Abrir Google Drive" fica bloqueado sem fornecedor selecionado.
- [ ] Depois de selecionar, o botão libera.
- [ ] Clicar abre só o Drive (aba reaproveitada se já existir).

### Teste 5 — Planilha
- [ ] Clicar em "Extrair itens" sem Sheets aberto como aba ativa mostra erro claro.
- [ ] Com a planilha aberta e ativa, extrai todos os itens (não só o primeiro).
- [ ] Nenhum `fetch()` é disparado (checar aba Rede do DevTools).
- [ ] A planilha não é editada (nenhuma célula muda).
- [ ] Se as colunas não forem identificadas, mostra erro claro e mantém o estado anterior.

### Teste 6 — Bessani
- [ ] Link pode ser colado e salvo mesmo sem clicar em "Abrir".
- [ ] Só abre ao clicar em "Abrir Bessani".
- [ ] Nunca abre sozinho.

### Teste 7 — Atualização do Trello
- [ ] Mostra resumo do fornecedor + itens antes de atualizar.
- [ ] Pede confirmação explícita.
- [ ] Atualiza somente os cartões do fornecedor selecionado, dentro da lista/filtro.
- [ ] Mostra resultado por cartão (atualizado/ignorado/não encontrado/erro).

### Teste 8 — Regressão
- [ ] Leitura do Trello continua funcionando.
- [ ] Filtro Rio Claro continua funcionando.
- [ ] Extração de fornecedor continua funcionando.
- [ ] Extração de itens continua funcionando (agora para todos os itens).
- [ ] Atualização do Trello continua funcionando (agora com formato código|descrição|quantidade).

## Diagnóstico de limitações conhecidas

1. **Seletores do Trello e do Sheets dependem da estrutura atual do DOM.**
   Ambos os sites mudam o HTML com frequência sem aviso. O código usa múltiplas
   estratégias de seleção (como a base já fazia), mas se a Trello/Google
   mudarem a estrutura, os seletores em `content/trello-content.js` e
   `content/sheets-content.js` podem precisar de ajuste. Use o painel de
   diagnóstico + "Copiar diagnóstico" para relatar problemas.

2. **Detecção de cor da etiqueta "Rio Claro".** O Trello não expõe a cor da
   etiqueta de forma 100% padronizada no DOM (varia por atributo
   `data-color`, classe CSS ou `aria-label`, dependendo da versão da
   interface). O código tenta essas três estratégias e, se nenhuma
   conseguir determinar a cor, aceita o cartão só pelo texto exato da
   etiqueta ("Rio Claro") — o que é mais permissivo que "cor verde
   obrigatória" em casos raros onde a cor não pôde ser lida. Isso é uma
   limitação da leitura de DOM, não uma escolha de negócio.

3. **Coluna de quantidade na planilha.** A detecção tenta achar uma coluna
   com nome tipo "quantidade/qtd" no cabeçalho; se não encontrar, assume a
   última coluna não vazia (mês corrente), replicando a suposição da base
   v1.0.12. Planilhas com layout muito diferente do padrão observado podem
   precisar de ajuste em `lib/validators.js` (`detectColumns`).

4. **Fechar a sidebar por script.** O Chrome não oferece uma API pública
   confiável para fechar o side panel programaticamente. O botão "X" tenta
   `window.close()` como melhor esforço; se o Chrome bloquear (comportamento
   normal em várias versões), nada acontece — o usuário fecha pelo ícone da
   extensão ou pelo controle nativo do navegador, como a própria spec prevê
   ("não depender de tentativa de fechar a sidebar por script se o Chrome não
   permitir essa ação").

5. **"Fixar painel" não força o Chrome a manter o painel aberto.** Não existe
   API pública para isso — painéis globais (nosso caso) já tendem a persistir
   ao trocar de aba por padrão do próprio Chrome. O que "Fixar" garante de
   fato, e que está implementado, é a **restauração do estado salvo** ao
   reabrir a sidebar.

6. **Anexar imagem/print ao cartão do Trello não foi implementado na V2** —
   a nova spec não pede esse recurso (ver "Mudança de comportamento
   importante" no `CHANGELOG.md`). Se ainda for necessário, é preciso pedir
   explicitamente, pois a Etapa 6 (Bessani) da nova spec não inclui anexos.

7. **Testes automatizados de UI (Chrome real) não foram executados** neste
   ambiente por não haver Chrome, Trello, Drive ou Bessani reais disponíveis.
   Todos os itens marcados `[ ]` acima precisam de validação manual.
