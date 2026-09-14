# Chat interno — setup Supabase

## 1. Criar o projeto

1. Acesse o Supabase e crie um projeto no plano Free.
2. Defina uma senha forte para o banco e guarde-a fora do repositório.
3. Aguarde o projeto ficar ativo.

## 2. Criar as tabelas e o Realtime

1. No Supabase, abra **SQL Editor**.
2. Copie todo o conteúdo de `supabase/chat-schema.sql`.
3. Execute o script uma única vez.

O script cria:
- `chat_users`
- `chat_conversations`
- `chat_messages`
- índices de conversa e não lidas
- os quatro usuários iniciais: Ciça, Marcelo, Lucas e Carolina
- trigger `notify_portal_chat_change()` para avisar o navegador em tempo real via Supabase Realtime Broadcast

O payload do Realtime não carrega o texto da mensagem. Ele envia apenas o `conversation_id`; o conteúdo é buscado novamente pela API autenticada do Portal.

## 3. Obter as chaves

No Supabase, abra **Project Settings > API Keys** (ou o diálogo **Connect**):

- Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
- Publishable key (`sb_publishable_...`) -> `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Secret key (`sb_secret_...`) -> `SUPABASE_SECRET_KEY`

A Secret Key nunca deve usar prefixo `NEXT_PUBLIC_` e nunca deve ser exposta no navegador.

## 4. Configurar a Vercel

No projeto Vercel do Portal Timoni, abra **Settings > Environment Variables** e crie:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

Aplicar em Production, Preview e Development conforme necessário.

## 5. Identificação do usuário

Não há novo login. O chat usa a sessão Google/NextAuth já existente no Portal. O e-mail autenticado é comparado com a lista de participantes do chat.

Mapeamento inicial:
- Ciça -> `mcrodini@gmail.com`
- Marcelo -> `mrodini@gmail.com`
- Lucas -> `estoquetimoni@gmail.com`
- Carolina -> `carolina@casatimoni.com.br`

## 6. Segurança

- O navegador recebe somente a Publishable Key.
- Toda leitura e escrita de mensagens passa por `/api/internal-chat`.
- A API verifica a sessão do Portal e a permissão do módulo `chat` antes de acessar o Supabase.
- As tabelas ficam com RLS habilitado e sem acesso direto do navegador.
- A Secret Key fica apenas no backend da Vercel.

## 7. Publicação

Esta implementação está isolada na branch `feature/chat-interno-supabase`. Não mesclar na `main` e não publicar em produção até autorização explícita.
