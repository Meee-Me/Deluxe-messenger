-- Tables ---------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users on delete cascade,
  username text not null unique check (char_length(username) between 2 and 32),
  public_key text not null,               -- base64 NaCl box public key
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  name text,
  is_group boolean not null default false,
  created_by uuid references public.users,
  created_at timestamptz not null default now()
);

create table public.participants (
  conversation_id uuid not null references public.conversations on delete cascade,
  user_id uuid not null references public.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index on public.participants (user_id);

-- Everything the server stores is ciphertext. `keys` maps user_id ->
-- {n, c}: the per-message key, boxed to that participant.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  sender_id uuid not null references public.users,
  ciphertext text not null,
  nonce text not null,
  keys jsonb not null,
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at);

-- Access ---------------------------------------------------------------
-- security definer avoids RLS recursion when policies check membership
create function public.is_participant(cid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from participants where conversation_id = cid and user_id = auth.uid())
$$;

alter table public.users enable row level security;
alter table public.conversations enable row level security;
alter table public.participants enable row level security;
alter table public.messages enable row level security;

create policy "users readable" on public.users for select to authenticated using (true);
create policy "users insert self" on public.users for insert to authenticated with check (id = auth.uid());
create policy "users update self" on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "members read conversation" on public.conversations for select to authenticated using (public.is_participant(id));
create policy "members read participants" on public.participants for select to authenticated using (public.is_participant(conversation_id));
create policy "members read messages" on public.messages for select to authenticated using (public.is_participant(conversation_id));
create policy "members send messages" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_participant(conversation_id));

-- Conversations/participants have no insert policy: clients go through this
-- RPC, which also returns the existing 1-on-1 instead of duplicating it.
create function public.create_conversation(p_name text, p_members uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  others uuid[];
  cid uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select array_agg(distinct m) into others from unnest(p_members) m where m <> me;
  if others is null then raise exception 'pick at least one other member'; end if;
  if exists (select 1 from unnest(others) o where not exists (select 1 from users where id = o)) then
    raise exception 'unknown user';
  end if;
  if array_length(others, 1) = 1 then
    select c.id into cid from conversations c
    where not c.is_group
      and exists (select 1 from participants where conversation_id = c.id and user_id = me)
      and exists (select 1 from participants where conversation_id = c.id and user_id = others[1])
    limit 1;
    if cid is not null then return cid; end if;
  end if;
  insert into conversations (name, is_group, created_by)
  values (case when array_length(others, 1) > 1 then nullif(trim(p_name), '') end, array_length(others, 1) > 1, me)
  returning id into cid;
  insert into participants (conversation_id, user_id) select cid, u from unnest(others || me) u;
  return cid;
end $$;
revoke execute on function public.create_conversation(text, uuid[]) from public, anon;
grant execute on function public.create_conversation(text, uuid[]) to authenticated;

-- Realtime -------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.participants;

-- Attachments (private bucket; files are encrypted client-side) --------
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)
on conflict (id) do nothing;

create policy "members read attachments" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.is_participant((storage.foldername(name))[1]::uuid));
create policy "members upload attachments" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.is_participant((storage.foldername(name))[1]::uuid));
