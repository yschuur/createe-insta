-- Safe update for both pre-filter and filter installations. Preserves data and RLS.
begin;
alter table public.instagram_posts add column if not exists discovery_metadata jsonb;
alter table public.post_analyses add column if not exists detected_language text
 check (detected_language is null or detected_language in ('nl','en','other','unknown'));
alter table public.agent_settings add column if not exists discovery_filters jsonb;
do $$
begin
 if (select count(*) from information_schema.columns
     where table_schema='public' and
     ((table_name='instagram_posts' and column_name='discovery_metadata' and udt_name='jsonb') or
      (table_name='post_analyses' and column_name='detected_language' and udt_name='text') or
      (table_name='agent_settings' and column_name='discovery_filters' and udt_name='jsonb'))) <> 3 then
   raise exception 'Bestaande filterkolommen hebben een onverwacht type. Er is niets aangepast.';
 end if;
end $$;
commit;
