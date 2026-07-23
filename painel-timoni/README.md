# Painel Timoni

Dashboard pessoal, estático (HTML/CSS/JS, sem build), que reúne os módulos do Portal Timoni
como blocos independentes — abra, leia ou atualize qualquer módulo sem depender dos outros.
Dentro de **Compras**, as 5 etapas (Fornecedores, Itens, Conferência de preços, Bessani,
Atualização) ficam agrupadas na mesma cor por serem do mesmo fluxo; os demais módulos
(Reuniões, Agenda Ciça, Marketing, Estoque, Motorista) moram em blocos próprios, lado a lado.

Uso pessoal, sem login: abra `index.html` direto no navegador (arquivo local) ou hospede como
página estática (GitHub Pages, por exemplo).

## O que é "ao vivo" e o que é exemplo

Hoje só dois módulos já publicam dados via planilha (Google Sheets + Apps Script Web App, o
mesmo padrão gratuito usado pela extensão Estoque e pela página Motorista):

- **Estoque** — fila de necessidades (`estoque-chrome/apps-script/Codigo.gs`)
- **Motorista** — viagens do dia (`agenda-motorista/apps-script/Codigo.gs`)

Clique em **⚙ Planilhas** no topo e cole a URL do Web App (terminada em `/exec`) de cada um —
é a mesma URL já configurada na extensão/página do próprio módulo. Os cards passam a mostrar
o selo **ao vivo** e os números reais; sem URL configurada (ou se a planilha responder erro),
o card mostra o selo **exemplo**/**erro** e mantém dados ilustrativos.

Compras, Reuniões, Agenda Ciça e Marketing continuam com dados de exemplo porque ainda não têm
um endpoint web para este painel consultar:

- **Compras** é uma extensão Chrome que só lê Trello/Sheets por scraping de DOM dentro da
  própria aba — não existe um serviço web para uma página externa chamar. Dá pra "ligar" no
  futuro publicando um Apps Script Web App próprio (mesmo padrão do Estoque/Motorista) que
  leia a planilha do fornecedor e/ou fale com a API do Trello.
- **Reuniões** é um arquivo (`assistente/registro.md`) mantido por um subagente — não é um
  serviço web.
- **Agenda Ciça** (`timoni-portal`, Next.js) exige login Google (NextAuth) — puxar os eventos
  aqui exigiria autenticação, então o card só linka para o portal.
- **Marketing** ainda não tem fluxo definido (placeholder).

## Estrutura

```
painel-timoni/
├── index.html              # marcação dos 6 módulos e da barra de navegação
├── app.css                 # identidade visual (paleta por módulo, cards, drawer)
├── app.js                  # pin, filtro por status, navegação, drawer de config, render dos dados reais
└── lib/
    ├── config.js            # URLs dos Web Apps em localStorage (com validação)
    └── sources/
        ├── estoque.js       # fetch em ?action=listar + cálculo de "atrasado"
        └── motorista.js     # fetch em ?action=dia + detecção de conflito de horário
```

## Filtros e navegação

- **Todos / Precisam de atenção / Concluídos** — filtra os cards por status; um módulo sem
  nenhum card visível some da página e some da barra de navegação.
- Barra de módulos no topo — um chip colorido por módulo, com scroll suave e destaque
  automático (via `IntersectionObserver`) do módulo que está na tela.
- **Fixar painel** — só uma preferência de UI salva no navegador (`localStorage`), não afeta
  os dados.

## Próximos passos

Para o painel inteiro ficar "ao vivo": dar a Compras um Web App próprio (Apps Script lendo a
planilha do fornecedor e, opcionalmente, falando com a API do Trello) segue a mesma receita já
usada em Estoque e Motorista — grátis, sem servidor próprio, só Google Sheets + Apps Script.
