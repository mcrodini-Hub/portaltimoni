# Timoni Portal — Agenda Google

App web pessoal (Next.js) que integra com a agenda **Principal** do Google
Calendar de `mcrodini@gmail.com`: mostra os próximos eventos com destaque
visual para compromissos iminentes, e permite criar, editar e cancelar
eventos direto pelo portal.

Login restrito a um único email (`AUTHORIZED_EMAIL`). Nenhum banco de dados
próprio — o Google Calendar é a fonte de verdade dos dados.

## 1. Configuração manual no Google Cloud Console (obrigatória, uma vez)

Isso não pode ser feito por automação — siga os passos abaixo com a conta
`mcrodini@gmail.com`:

1. Acesse https://console.cloud.google.com/ e crie um novo projeto (ex.:
   "Timoni Portal").
2. Ative a **Google Calendar API**: menu "APIs e Serviços" → "Biblioteca" →
   busque "Google Calendar API" → **Ativar**.
3. Configure a **Tela de consentimento OAuth** ("OAuth consent screen"):
   - Tipo de usuário: **Externo**.
   - Nome do app: "Timoni Portal". Email de suporte/contato:
     `mcrodini@gmail.com`.
   - Escopo: adicione `.../auth/calendar.events`.
   - Em **Test users**, adicione `mcrodini@gmail.com` (mantenha o app em
     modo **Testing** — evita o processo de verificação do Google, que não é
     necessário para uso pessoal).
4. Crie uma credencial: "Credenciais" → "Criar credenciais" → **ID do
   cliente OAuth** → tipo **Aplicativo da Web**.
   - **Origens JavaScript autorizadas**: `http://localhost:3000` (adicione a
     URL da Vercel depois do primeiro deploy — ver seção 4).
   - **URIs de redirecionamento autorizados**:
     `http://localhost:3000/api/auth/callback/google` (idem, adicione a de
     produção depois do primeiro deploy).
5. Copie o **Client ID** e **Client Secret** gerados — vão nas variáveis de
   ambiente abaixo.

> **Atenção**: em modo "Testing", o Google pode expirar o `refresh_token`
> após ~7 dias de inatividade. Para uso pessoal isso é aceitável — basta
> entrar de novo pelo botão "Entrar com Google" quando isso acontecer.

## 2. Variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha:

```
GOOGLE_CLIENT_ID=            # do passo 5 acima
GOOGLE_CLIENT_SECRET=        # do passo 5 acima
NEXTAUTH_SECRET=             # gerar com: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
AUTHORIZED_EMAIL=mcrodini@gmail.com
```

## 3. Rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000, clique em "Entrar com Google" e use
`mcrodini@gmail.com`. Qualquer outra conta é rejeitada automaticamente.

## 4. Deploy na Vercel

Via CLI (recomendado para o primeiro setup):

```bash
npm i -g vercel
vercel login
vercel link            # Root Directory = timoni-portal (o repo tem outros projetos na raiz)
vercel env add GOOGLE_CLIENT_ID production
vercel env add GOOGLE_CLIENT_SECRET production
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production
vercel env add AUTHORIZED_EMAIL production
vercel --prod
```

Ou via dashboard: importe o repositório `mcrodini-hub/portaltimoni`, defina
**Root Directory = `timoni-portal`** durante o wizard, e preencha as mesmas
5 variáveis antes do primeiro deploy.

Depois do primeiro deploy, pegue a URL gerada (ex.:
`https://timoni-portal-xxxx.vercel.app`) e:

1. Atualize `NEXTAUTH_URL` na Vercel com essa URL exata (se ainda não
   estava certa).
2. Volte ao Google Cloud Console (passo 4 da seção 1) e adicione essa URL
   exata em "Origens JavaScript autorizadas" e o callback
   (`https://<url>/api/auth/callback/google`) em "URIs de redirecionamento".
3. Faça um novo deploy (ou apenas tente logar de novo).

**Limitação conhecida**: cada deploy de *Preview* da Vercel gera uma URL
diferente, o que quebraria o login OAuth nesses ambientes (o Google só
aceita redirect URIs cadastrados). Teste login só em `localhost` e na URL de
**Production** — não é viável cadastrar toda URL de preview.

## 5. Como testar de ponta a ponta

1. **Login**: entrar com `mcrodini@gmail.com` deve levar a `/dashboard`.
   Testar com outra conta Google deve ser rejeitado.
2. **Listar**: crie 2-3 eventos de teste direto no Google Calendar (um daqui
   a 1h, outro amanhã) e confirme que aparecem no dashboard com o destaque
   de cor certo (vermelho ≤2h, amarelo hoje, cinza futuro).
3. **Criar**: use "+ Novo evento" no portal e confirme que aparece também
   no Google Calendar real (agenda Principal).
4. **Editar**: altere um evento pelo portal e confirme nos dois lugares.
5. **Cancelar**: cancele um evento pelo portal e confirme que some dos dois
   lugares.
6. **Alertas**: crie um evento "daqui a 10 min" e observe o destaque mudar
   de cor sem precisar recarregar a página (a lista atualiza sozinha a cada
   60s).

## Estrutura do projeto

```
timoni-portal/
├── app/
│   ├── login/            # tela de login
│   ├── dashboard/        # tela principal (protegida por middleware.ts)
│   └── api/
│       ├── auth/         # rotas do NextAuth
│       └── events/       # CRUD de eventos (chama a Calendar API)
├── lib/
│   ├── auth.ts           # config do NextAuth (provider Google, refresh de token)
│   ├── auth-guard.ts     # checagem de sessão/autorização nas rotas de API
│   └── google-calendar.ts# wrapper sobre googleapis (list/create/update/delete)
└── components/
```
