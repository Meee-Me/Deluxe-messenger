-- Which Supabase user belongs to which Deluxe Main account. Only the deluxe-signin
-- Edge Function (service role) reads or writes this; apps and signed-in users cannot.
create table public.deluxe_accounts (
  deluxe_id text primary key check (deluxe_id ~ '^[A-Za-z0-9_-]{1,120}$'),
  user_id uuid not null unique references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.deluxe_accounts enable row level security; -- no policies on purpose
grant select, insert on public.deluxe_accounts to service_role;
