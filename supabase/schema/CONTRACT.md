# Existing schema adapter

The user supplied `tests/fixtures/supabase-columns.csv`. All six existing tables
have RLS enabled according to the supplied screenshot. No database migrations have
been run and existing tables have not been changed.

The backend now maps the real column names to the frontend view:

| Table | Mapping |
| --- | --- |
| instagram_connections | instagram_account_id (not instagram_user_id); no page_id column |
| categories | per-user name/enabled/hashtags/target_accounts; posts reference category UUID |
| instagram_posts | category_id, published_at, discovered_at; relevance lives in analyses |
| post_analyses | summary, relevance_score, humorous_angles, analysis_sources, analysis_limitations |
| comment_drafts | generated_text preserved; edited_text stored separately; humor_type/humor_level/language |
| agent_settings | default_humor_level and preferred_language; categories stored in categories.enabled |

Humor level, language, enabled categories and the playfield discovery_filters JSON persist as account preferences.
Style, length and free instructions are per-session editor controls; there are no
matching account columns in the supplied schema. Every generated draft retains
its own humor settings and language. Uploaded images are sent for analysis, not
persisted as media in the database.

## Constraints and policies inspected

The user's second export is retained in `tests/fixtures/supabase-access.json`.
The comment status constraint permits draft/approved/posted/rejected. The adapter
translates the UI's published status to posted on writes and back on reads.
Humor values use playful/sarcastic/pun; language values use nl/en. Existing auto
preferences fall back to Nederlands in this MVP's two-language editor. No existing
rows or defaults are changed. New posts use the existing default status new.

The supplied policies scope SELECT/INSERT/UPDATE/DELETE to auth.uid() = user_id
for settings, categories, posts, analyses and drafts, including WITH CHECK for
inserts/updates. Composite foreign keys bind drafts and analyses to posts of the
same user. instagram_connections has no policies in the export; with RLS enabled
it remains inaccessible to ordinary clients, while the verified Edge Function
uses the service role. Live tests with two accounts are still required; a static
policy review does not verify live grants, extensions or runtime behavior.

Unique constraints exist for settings(user_id), categories(user_id,name),
posts(user_id,permalink) and connections(user_id,instagram_account_id).
Connections may contain multiple accounts; the current MVP refuses to replace an
ambiguous set. Select-then-insert flows can still encounter uniqueness conflicts
under concurrent requests and report them rather than overwrite another record.

The category foreign key covers category_id only, not category_id/user_id.
Backend category reads and writes verify ownership. Direct database clients need
an additional ownership-preserving category constraint before production writes
are opened broadly; do not replace existing constraints without auditing data.

## OAuth storage is still pending

The inspected token_secret_id UUID column has no foreign key in the export. No
secrets have been read. The current code uses independent encrypted storage and
does not modify existing token_secret_id values. A migration has been prepared at
`supabase/migrations/20261030103000_createe_oauth_storage.sql` for these new tables:

- createe_oauth_states(state_hash text primary key, user_id uuid, expires_at timestamptz)
- createe_token_vault(user_id uuid primary key, encrypted_token text, instagram_user_id text, expires_at timestamptz)

The user reported successfully running this OAuth migration. The cloud agent has not independently queried the resulting tables. The prepared migration is transactional, fails on
name conflicts and changes no existing tables. It enables RLS, denies public,
anon and authenticated access, grants only service_role access and adds foreign
keys to auth.users. Review any pre-existing vault integration before applying. Tokens are AES-256-GCM encrypted by the function;
OAuth state is hashed, expiring and atomically consumed. OAuth remains blocked
until storage is securely configured.

Generation currently makes separate writes. A database failure after AI
completion may leave an analysis without drafts. Add a reviewed transaction RPC
and per-user quota before public multi-user use. Live integration has not yet
been validated.


## Discovery update

`20261030110000_discovery_filters.sql` adds nullable instagram_posts.discovery_metadata
and post_analyses.detected_language. This migration has NOT been applied by the
agent and is required before deploying the new server function. It changes no
existing data or policies. Language classification uses nl/en/other/unknown; legacy
analyses remain unknown. Counts are optional Meta observations, never inferred.


## Playfield selection

`20261030120000_playfield_settings.sql` adds nullable agent_settings.discovery_filters
and includes missing optional columns from the previous filter migration, with
existing-type checks. It has not been applied by the agent. Saved criteria are
loaded server-side; client-supplied filters do not override them. Meta discovery
returns cheap-filtered candidates without persistence. Each candidate is selected
in a separate authenticated request; AI language/relevance are checked before
saveCandidate is called. Rejected new posts are not stored. A criteria fingerprint
rejects stale requests after settings change. Existing selected posts are retained.
