# Pending schema inspection — do not create or alter existing tables yet

No database migration has been applied. Run `inspect.sql` first. The Edge Function
currently expects the following contract. This is a provisional adapter contract,
not a claim about the user's actual schema. Adapt the function to the inspection
results before deploying against production. Do not rename existing data blindly.

Every application table needs `user_id uuid` referencing auth.users. Every user-
owned query is scoped to the verified JWT user inside the server. Verify RLS as
well, because the public Supabase API remains independently accessible.

| Existing table | Fields used by the adapter | Constraints expected |
| --- | --- | --- |
| instagram_connections | user_id, instagram_user_id text, username text, page_id text | unique(user_id) |
| categories | Not written; five initial category names are selected via agent_settings | Inspect existing records before mapping category strings/IDs |
| instagram_posts | id uuid default, user_id, permalink text, caption text, category text, timestamp timestamptz nullable, media_type text nullable, media_url text nullable, thumbnail_url text nullable, source text, relevance integer | unique(user_id,permalink) |
| post_analyses | id default, user_id, post_id uuid, analysis text, created_at default now() | ownership-preserving FK to posts |
| comment_drafts | id uuid default, user_id, post_id uuid, text text, style text, status text, created_at default now() | status draft/approved/published, ownership-preserving FK |
| agent_settings | user_id, settings jsonb | unique(user_id) |

Manually entered links have unknown publication dates (`timestamp = null`).
Filters on publication dates omit these posts. Official discovery provides actual
timestamps. `relevance = 0` means not analyzed; it is not an AI judgment.

Two NEW server-only tables are required for OAuth. They are deliberately not
created by this MVP until the existing schema and policies have been inspected:

- `createe_oauth_states(state_hash text primary key, user_id uuid, expires_at timestamptz)`
- `createe_token_vault(user_id uuid primary key, encrypted_token text, instagram_user_id text, expires_at timestamptz)`

Use foreign keys to auth.users with ON DELETE CASCADE. Enable RLS, grant **no**
access to anon/authenticated (including select), and grant access only to
service_role. Never put tokens in browser-readable instagram_connections fields.
The function encrypts tokens using AES-256-GCM and stores only hashed, expiring,
single-use OAuth states. Schedule deletion of expired states. OAuth is not usable
until these tables are securely provisioned after inspection.

For existing tables, grant authenticated users access only to rows where
`auth.uid() = user_id`, using both USING and WITH CHECK. Ensure a user cannot link
an analysis/draft to another user's post. Review any existing token columns:
remove public access and migrate existing credentials through a separate reviewed
migration before exposing the frontend.

Generation currently makes several separate writes (not a single DB transaction).
A provider failure leaves existing comments intact. A database failure after AI
completion can leave an analysis without drafts. Add a reviewed transaction RPC
and durable per-user quota before public, multi-user production use.
