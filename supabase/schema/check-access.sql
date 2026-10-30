-- Read-only. One result table, so CSV Export includes every section.
select 'constraint' as section, c.relname as table_name,
       con.conname as name, pg_get_constraintdef(con.oid) as details
from pg_constraint con
join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
('instagram_connections','categories','instagram_posts','post_analyses','comment_drafts','agent_settings')
union all
select 'policy', tablename, policyname,
       json_build_object('roles',roles,'command',cmd,'using',qual,'check',with_check)::text
from pg_policies where schemaname='public' and tablename in
('instagram_connections','categories','instagram_posts','post_analyses','comment_drafts','agent_settings')
union all
select 'default', table_name, column_name, coalesce(column_default,'(none)')
from information_schema.columns where table_schema='public' and table_name in
('instagram_connections','categories','instagram_posts','post_analyses','comment_drafts','agent_settings')
order by section, table_name, name;
