-- Look a friend up by code on the server, so clients never need to read other users' rows.
create table public.friend_lookup_failures (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index on public.friend_lookup_failures (user_id, at);
alter table public.friend_lookup_failures enable row level security; -- no policies: only the function below touches it

-- Returns the conversation id, or null when no one has that code.
-- A wrong code is logged; 10 wrong codes in an hour locks the caller out for the rest of that hour.
create function public.add_friend_by_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); target uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_code !~ '^[0-9]{4}$' then return null; end if;
  if (select count(*) from friend_lookup_failures where user_id = me and at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many tries. Wait a while and try again.';
  end if;
  select id into target from users where friend_code = p_code;
  if target is null then
    insert into friend_lookup_failures (user_id) values (me);
    delete from friend_lookup_failures where at < now() - interval '1 day';
    return null;
  end if;
  if target = me then raise exception 'That is your own code.'; end if;
  return public.create_conversation(null, array[target]);
end $$;
revoke execute on function public.add_friend_by_code(text) from public, anon;
grant execute on function public.add_friend_by_code(text) to authenticated;
