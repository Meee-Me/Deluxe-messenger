-- Profile fields synced from the sign-in provider, plus a 4-digit friend code.
alter table public.users add column avatar_url text, add column friend_code text;

create function public.gen_friend_code() returns text
language plpgsql as $$
declare c text; tries int := 0;
begin
  loop
    c := lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when not exists (select 1 from public.users where friend_code = c);
    tries := tries + 1;
    -- shortcut: 4 digits = 10,000 users max; widen the code before that fills up.
    if tries > 200 then raise exception 'no friend codes left'; end if;
  end loop;
  return c;
end $$;

-- Give existing users a code, one statement at a time so each sees the last.
do $$ declare r record; begin
  for r in select id from public.users where friend_code is null loop
    update public.users set friend_code = public.gen_friend_code() where id = r.id;
  end loop;
end $$;

alter table public.users
  alter column friend_code set default public.gen_friend_code(),
  alter column friend_code set not null,
  add constraint users_friend_code_key unique (friend_code),
  add constraint users_friend_code_format check (friend_code ~ '^[0-9]{4}$');

-- The code is assigned by the default only: clients may not pick or change it.
revoke insert, update on public.users from authenticated;
grant insert (id, username, public_key, avatar_url) on public.users to authenticated;
grant update (username, public_key, avatar_url) on public.users to authenticated;
