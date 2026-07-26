# Painel Timoni

Dashboard pessoal, estático (HTML/CSS/JS, sem build), que reúne os módulos do Portal Timoni
como blocos independentes — abra, leia ou atualize qualquer módulo sem depender dos outros.
Dentro de **Compras**, as 5 etapas (Fornecedores, Itens, Conferência de preços, Bessani,
Atualização) ficam agrupadas na mesma cor por serem do mesmo fluxo; os demais módulos
(Reuniões, Agenda Ciça, Marketing, Estoque, Motorista) moram em blocos próprios, lado a lado.

Uso pessoal, sem login: abra `index.html` direto no navegador (arquivo local) ou hospede como
página estática (GitHub Pages, por exemplo).

## Identidade por cor

Cada módulo tem uma cor fixa (`--mod-compras`, `--mod-estoque`, etc., em `app.css`), usada na
faixa lateral dos cartões, no chip da barra de navegação e agora também no círculo com emoji ao
lado do título de cada módulo (`icons/mod-*.png`: 🛒 Compras, 📦 Estoque, 🚚 Motorista, 📅 Agenda
Ciça, 🤝 Reuniões, 📣 Marketing). Compras, Estoque e Motorista usam esse mesmo círculo como ícone
da extensão/página (`hub-pedidos-chrome/icons/`, `estoque-chrome/icons/`, `motorista/icons/`),
para que módulo seja reconhecível de relance tanto aqui quanto na barra do Chrome.

## O que é "ao vivo" e o que é exemplo

Quatro módulos já publicam dados reais, todos com o mesmo espírito gratuito (Google como base,
sem servidor próprio):

- **Compras** — espelho do estado da extensão, via planilha (`hub-pedidos-chrome/apps-script/Codigo.gs`)
- **Estoque** — fila de necessidades, via planilha (`estoque-chrome/apps-script/Codigo.gs`)
- **Motorista** — viagens do dia, via planilha (`motorista/apps-script/Codigo.gs`)
- **Agenda Ciça** — resumo do Google Calendar de hoje, direto do `timoni-portal` (Next.js) —
  ver `timoni-portal/README.md` seção 6

Clique em **⚙ Planilhas** no topo:

- Compras/Estoque/Motorista: cole a URL do Web App (Apps Script, terminada em `/exec`) — a
  mesma já configurada na extensão/página do próprio módulo (no caso do Compras, na seção
  "Painel Timoni" no rodapé da sidebar).
- Agenda Ciça: cole a URL do `timoni-portal` (ex.: `https://timoni-portal-xxxx.vercel.app`) e o
  token gerado lá (`PAINEL_TIMONI_TOKEN`) — não é o login do portal, é um token simples só para
  essa rota de resumo (ver `timoni-portal/README.md` seção 6 para o passo a passo completo).

Os cards passam a mostrar o selo **ao vivo** e os dados reais; sem configuração (ou se o
módulo responder erro), o card mostra o selo **exemplo**/**erro** e mantém dados ilustrativos.
Logo depois de colar a URL do Compras, os cards podem aparecer com o selo "ao vivo" mas ainda
com dados de exemplo por um instante — é a planilha nova, sem nenhum registro até a extensão
rodar a primeira etapa.

Reuniões e Marketing continuam com dados de exemplo porque ainda não têm um endpoint web para
este painel consultar:

- **Reuniões** é um arquivo (`assistente/registro.md`) mantido por um subagente — não é um
  serviço web.
- **Marketing** ainda não tem fluxo definido (placeholder).

## Estrutura

```
painel-timoni/
├── index.html              # marcação dos 6 módulos e da barra de navegação
├── app.css                 # identidade visual (paleta por módulo, cards, drawer)
├── app.js                  # pin, filtro por status, navegação, drawer de config, render dos dados reais
├── icons/                  # logo "Casa Timoni" recolorido na cor de cada módulo (mod-*.png)
└── lib/
    ├── config.js            # URLs/tokens dos módulos em localStorage (com validação)
    └── sources/
        ├── compras.js       # fetch em ?action=estado (espelho do Compras)
        ├── agenda.js        # fetch em /api/public/agenda-resumo (timoni-portal, com token)
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

Para o painel inteiro ficar "ao vivo" falta Reuniões e Marketing — cada um precisa primeiro de
um jeito de expor dados por HTTP (nenhum dos dois tem isso hoje).
