-- RLS policies still decide which rows; these grants only let the signed-in role reach the tables.
grant select, insert, update on public.users to authenticated;
grant select on public.conversations to authenticated;
grant select on public.participants to authenticated;
grant select, insert on public.messages to authenticated;
