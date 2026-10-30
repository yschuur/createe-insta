-- Prepared after inspection of existing columns, foreign keys and policies.
-- NOT APPLIED. Creates only new server-only tables; does not alter existing tables.
-- Fails and rolls back on name conflicts rather than trusting an unknown table.
begin;
create table public.createe_oauth_states (
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
create index createe_oauth_states_expiry_idx on public.createe_oauth_states(expires_at);
create table public.createe_token_vault (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_token text not null,
  instagram_user_id text not null,
  expires_at timestamptz not null
);
alter table public.createe_oauth_states enable row level security;
alter table public.createe_token_vault enable row level security;
revoke all on public.createe_oauth_states from public, anon, authenticated;
revoke all on public.createe_token_vault from public, anon, authenticated;
grant select, insert, update, delete on public.createe_oauth_states to service_role;
grant select, insert, update, delete on public.createe_token_vault to service_role;
commit;
-- Expired states should periodically be removed by a trusted scheduled job:
-- delete from public.createe_oauth_states where expires_at < now();
