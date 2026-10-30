-- Adds optional metadata. Does not change existing records, constraints or policies.
-- Run once in Supabase SQL Editor before deploying the updated agent.
begin;
alter table public.instagram_posts add column discovery_metadata jsonb;
alter table public.post_analyses add column detected_language text
 check (detected_language is null or detected_language in ('nl','en','other','unknown'));
commit;
-- Older posts keep unknown counts/language until fetched/analyzed again.
