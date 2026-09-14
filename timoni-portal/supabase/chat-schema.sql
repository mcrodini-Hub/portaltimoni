create extension if not exists pgcrypto;

create table if not exists public.chat_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.chat_users(id) on delete cascade,
  user_b uuid not null references public.chat_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint chat_conversations_distinct_users check (user_a <> user_b)
);

create unique index if not exists chat_conversations_unique_pair
  on public.chat_conversations (least(user_a, user_b), greatest(user_a, user_b));

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_user_id uuid not null references public.chat_users(id) on delete restrict,
  recipient_user_id uuid not null references public.chat_users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz null,
  constraint chat_messages_distinct_users check (sender_user_id <> recipient_user_id)
);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at);

create index if not exists chat_messages_unread_idx
  on public.chat_messages (recipient_user_id, read_at)
  where read_at is null;

alter table public.chat_users enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

-- O navegador não acessa essas tabelas diretamente. Toda leitura/escrita passa
-- pela API Next.js autenticada com a sessão Google já existente no Portal.
-- A chave secreta do Supabase fica somente no backend da Vercel.

insert into public.chat_users (email, name) values
  ('mcrodini@gmail.com', 'Ciça'),
  ('mrodini@gmail.com', 'Marcelo'),
  ('estoquetimoni@gmail.com', 'Lucas'),
  ('carolina@casatimoni.com.br', 'Carolina')
on conflict (email) do update set name = excluded.name, active = true;

create or replace function public.notify_portal_chat_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object('conversation_id', new.conversation_id),
    'chat_changed',
    'portal-chat',
    false
  );
  return new;
end;
$$;

drop trigger if exists portal_chat_message_changed on public.chat_messages;
create trigger portal_chat_message_changed
after insert or update of read_at on public.chat_messages
for each row execute function public.notify_portal_chat_change();
