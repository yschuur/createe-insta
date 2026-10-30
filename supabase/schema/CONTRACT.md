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

Only humor level, language and enabled categories persist as account preferences.
Style, length and free instructions are per-session editor controls; there are no
matching account columns in the supplied schema. Every generated draft retains
its own humor settings and language. Uploaded images are sent for analysis, not
persisted as media in the database.

## Remaining verification before live deployment

Run `check-access.sql` in SQL Editor and export its single result table as CSV.
It reads only constraint definitions, policies and column defaults. It reads no
application data or secrets. Column types alone do not reveal allowed status,
humor_type, source or language values, defaults, unique keys or policy behavior.

Current writes use draft/approved/published for comments, discovered for posts,
manual/meta for sources, Speels/Sarcastisch/Woordgrap for humor type and
Nederlands/Engels for language. Check these against actual constraints before
using live writes. Never remove a constraint just to make an insert pass.

User-keyed settings and connections explicitly look up existing IDs before
updates, without assuming unique(user_id). Category resolution is also scoped to
the user. Duplicate existing rows trigger an error. Check actual uniqueness before
production concurrency; select-then-insert does not itself prevent races.

Every request verifies JWT identity and every query is scoped to that user.
Existing public API access still needs correct RLS USING and WITH CHECK policies.
Ensure a draft or analysis cannot reference another user's post. RLS being enabled
alone does not demonstrate correct authorization.

## OAuth storage is still pending

The existing token_secret_id UUID column may reference an existing vault; inspect
its foreign key before deciding how tokens should be stored. No secrets have
been read. The current code still expects two additional server-only tables:

- createe_oauth_states(state_hash text primary key, user_id uuid, expires_at timestamptz)
- createe_token_vault(user_id uuid primary key, encrypted_token text, instagram_user_id text, expires_at timestamptz)

These have NOT been created. Do not provision redundant token storage until the
existing constraints/vault integration are understood. If this storage is used,
enable RLS, deny anon/authenticated access and grant only service_role, with
foreign keys to auth.users. Tokens are AES-256-GCM encrypted by the function;
OAuth state is hashed, expiring and atomically consumed. OAuth remains blocked
until storage is securely configured.

Generation currently makes separate writes. A database failure after AI
completion may leave an analysis without drafts. Add a reviewed transaction RPC
and per-user quota before public multi-user use. Live integration has not yet
been validated.
