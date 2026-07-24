# Guia de Configuração e Acesso — Portal Timoni

Referência única para não precisar caçar instrução espalhada em 7 READMEs diferentes.
Pra cada módulo: o que é, o status atual, **quem configura** (o "acesso especial" que só você
deve ter) e **como compartilhar o uso** com quem mais precisa mexer no dia a dia.

## O padrão usado em quase todos os módulos

Nenhum módulo tem sistema de login tradicional (usuário/senha) — o "acesso especial para
configurar" hoje funciona assim, na prática:

- **Você é a dona da planilha Google** por trás de cada módulo (Compras, Estoque, Motorista) —
  só quem tem acesso de edição nessa planilha consegue abrir o **Apps Script** e gerar/trocar a
  URL do Web App. Isso já é, sozinho, o seu "acesso especial": ninguém troca a fonte de dados
  sem estar logado com a sua conta Google na planilha certa.
- **A URL do Web App funciona como uma senha de leitura/escrita** para quem já tem a extensão
  ou a página aberta — qualquer pessoa que souber essa URL consegue configurar o app dela pra
  usar os mesmos dados. Por isso essa URL não deve ser publicada em lugar público (ela já não é
  secreta o bastante pra isso, mas também não precisa: só compartilhe por WhatsApp/e-mail
  direto com quem vai usar).
- **Compartilhar o uso**, na prática, é sempre a mesma receita: a pessoa carrega a
  extensão/página no computador dela e cola a **mesma URL** que você gerou. Não tem conta pra
  criar, não tem convite pra mandar — é colar uma URL uma vez por computador.

Agenda Ciça é a exceção: lá o controle é login Google de verdade (só a sua conta entra), porque
é a sua agenda pessoal — não é pra compartilhar com ninguém.

---

## 1. Painel Timoni (integração entre módulos)

**O que é**: o dashboard que reúne todos os módulos abaixo como blocos independentes.
**Status**: funcionando (Compras, Estoque, Motorista e Agenda Ciça já ligados; Reuniões e
Marketing ainda de exemplo).

**Quem configura**: quem abrir o arquivo `painel-timoni/index.html` consegue clicar em
**"⚙ Planilhas"** e trocar qualquer URL/token — hoje **não existe nenhuma trava** nisso.

**⚠️ Ponto de atenção**: diferente dos outros módulos, aqui não tem "planilha só sua" segurando
o acesso — é uma página estática pura. **Recomendação: não compartilhe o link/arquivo do Painel
Timoni com a equipe** — é o seu painel pessoal, não uma ferramenta de time. Se um dia você quiser
mostrar uma versão "só leitura" pra alguém (Marcelo, por exemplo), isso precisa de uma trava
nova (ex.: senha simples na gaveta de configuração) — me avisa se quiser isso, hoje não existe.

---

## 2. Agenda Ciça

**O que é**: portal (`timoni-portal`) com sua agenda do Google Calendar (Principal + TIMONI
AGENDA).
**Status**: finalizando configuração.

**Quem configura**: só você. O login (`AUTHORIZED_EMAIL=mcrodini@gmail.com`) rejeita qualquer
outra conta Google automaticamente — isso já é o "acesso especial" pronto, não precisa fazer
nada a mais.

**Compartilhar o uso**: **não se aplica** — é intencionalmente só sua, não é uma ferramenta de
equipe. O que é compartilhável é só o *resumo* dela no Painel Timoni (via o token
`PAINEL_TIMONI_TOKEN`, que também é só seu — ninguém mais precisa dele).

**Onde estão as instruções completas**: `timoni-portal/README.md` (seções 1 a 6 cobrem desde o
Google Cloud Console até o deploy na Vercel e a ligação com o Painel Timoni).

---

## 3. Motorista

**O que é**: agenda de viagens (entregas/retiradas) entre Rio Claro e Araras.
**Status**: tem pendência.

**Quem configura**: quem tem acesso de edição na planilha Google do Motorista + quem publica o
Web App (`motorista/apps-script/Codigo.gs`) — normalmente você, uma vez.

**Compartilhar o uso**: os 5 caixas que preenchem viagens (Ciça, Jaqueline, Jeovana, Reginaldo,
Thais) abrem `motorista/index.html` (local ou hospedado, ex. GitHub Pages) em qualquer
computador/celular, e cada um cola a **mesma URL do Web App** em ⚙ na primeira vez. Depois
disso, todos veem e editam a mesma agenda em tempo real — não precisa repetir a configuração,
só na primeira abertura de cada aparelho.

**Onde estão as instruções completas**: `motorista/README.md`.

---

## 4. Compras

**O que é**: extensão Chrome que assiste o fluxo Trello → fornecedor → planilha → conferência
de preços → Bessani → atualização do Trello.
**Status**: finalizado.

**Quem configura**: quem publica o Apps Script (`hub-pedidos-chrome/apps-script/Codigo.gs`) —
você. A extensão em si não tem tela de login; quem instala e usa já consegue operar o fluxo
inteiro.

**Compartilhar o uso**: hoje é uma extensão de uso individual (o fluxo de compra/conferência é
seu). Se quiser que outra pessoa (o Marcelo, por exemplo) também opere: ela carrega a extensão
sem compactação (`chrome://extensions/` → Modo de desenvolvedor → Carregar sem compactação →
pasta `hub-pedidos-chrome/`) no computador dela. A URL do "Painel Timoni" (opcional, rodapé da
sidebar) é a mesma para todo mundo que usar — sem ela, cada instalação continua funcionando
100% local, só não aparece no dashboard.

**Onde estão as instruções completas**: `hub-pedidos-chrome/README.md`.

---

## 5. Estoque

**O que é**: ponte entre balcão (vendedores) e estoque (Lucas) nas duas lojas.
**Status**: finalizado.

**Quem configura**: quem publica a planilha/Apps Script (`estoque-chrome/apps-script/Codigo.gs`)
— você, uma vez.

**Compartilhar o uso** (este é o módulo pensado desde o início pra várias pessoas ao mesmo
tempo): em **cada computador** que vai usar —
1. `chrome://extensions/` → Modo de desenvolvedor → Carregar sem compactação → pasta
   `estoque-chrome/` (leve a pasta pro computador por ZIP do GitHub, pen drive ou rede).
2. Abrir a extensão pela primeira vez pede pra escolher o **perfil** da máquina (Vendedores,
   Estoque/Lucas, Gerência ou Gestão) e a **loja** (Rio Claro/Araras) — fica salvo naquele
   computador.
3. Colar a **mesma URL do Web App** em ⚙ → Planilha compartilhada → Salvar e testar.

Isso precisa ser feito uma vez em cada computador (balcão Rio Claro, balcão Araras, computador
do Lucas). Depois, todos enxergam a mesma fila em tempo real, cada um filtrado pelo perfil/loja
dele.

**Onde estão as instruções completas**: `estoque-chrome/README.md` (seções "Perfis e lojas",
"Configuração da planilha" e "Instalação da extensão" / "Instalar nas outras máquinas").

---

## 6. Reuniões

**O que é**: assistente pessoal (subagente Claude) que cobra pendências e registra decisões das
quinzenais de Rio Claro/Araras, mantido em `assistente/registro.md`.
**Status**: você mencionou precisar acessar os documentos.

**Quem configura**: não há configuração — é um arquivo neste repositório, atualizado pelo
subagente a cada conversa.

**Onde estão os documentos de verdade**: no seu Google Drive, pasta **"REUNIÕES"**
(a mesma pasta plana identificada no registro, sem subpastas por loja/ano — id
`1K28hA9drzFXP8f1_1-F3MTu78MQ6fiu7`). O `assistente/registro.md` é só o *rastreador* de
pendências/decisões — as pautas e atas em si (Google Docs/PDF) ficam nessa pasta do Drive, não
no git. Se estiver com dificuldade de achar algo específico lá, me diga o que procura que eu
consulto o registro e/ou o Drive.

**Compartilhar o uso**: não se aplica no sentido de "outras pessoas mexerem" — é uma ferramenta
sua, de gestão. Se quiser que Marcelo/Jeovana também acompanhem pendências, o caminho seria dar
acesso de leitura à pasta do Drive (fora deste repositório).

---

## 7. Marketing

**O que é**: esqueleto reservado, sem fluxo funcional definido ainda.
**Status**: em desenvolvimento (nada pra configurar ou compartilhar por enquanto).

Quando você tiver clareza da primeira funcionalidade real (campanhas WhatsApp? quadro de posts
no Trello?), voltamos aqui pra desenhar o mesmo padrão dos outros módulos.

---

## Checklist rápido pra começar a usar de verdade

Pra "começar a usar e verificar erros" como você pediu, a ordem mais segura é:

1. **Compras** e **Estoque** — já finalizados, comece por eles. Se der erro, é provável que seja
   na Etapa de leitura do Trello/planilha (mais sensível a mudanças de interface) — me manda o
   "Mostrar diagnóstico" (rodapé da sidebar) que eu leio.
2. **Motorista** — termine a pendência que você mencionou antes de colocar a equipe toda pra
   usar ao mesmo tempo (evita confusão se algo mudar no meio do caminho).
3. **Agenda Ciça** — é só sua, pode finalizar e testar sem afetar mais ninguém.
4. **Painel Timoni** — depois que Compras/Estoque/Motorista/Agenda estiverem com URL real
   configurada, abra o painel e confirme que os 4 primeiros módulos mostram "ao vivo" — é o
   jeito mais rápido de ver tudo de uma vez e pegar algo que ficou torto.
