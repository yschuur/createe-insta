-- Read-only. Run in Supabase Dashboard > SQL Editor and share the result tables.
-- No tokens, user records or other application data are selected.
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in
('instagram_connections','categories','instagram_posts','post_analyses','comment_drafts','agent_settings')
order by table_name, ordinal_position;

select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname='public' and tablename in
('instagram_connections','categories','instagram_posts','post_analyses','comment_drafts','agent_settings');

select c.relname as table_name, con.conname, pg_get_constraintdef(con.oid) as definition
from pg_constraint con join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
('instagram_connections','categories','instagram_posts','post_analyses','comment_drafts','agent_settings');

select relname as table_name, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class join pg_namespace n on n.oid=relnamespace
where n.nspname='public' and relname in
('instagram_connections','categories','instagram_posts','post_analyses','comment_drafts','agent_settings');
