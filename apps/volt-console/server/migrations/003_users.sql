-- People who sign in. Passwords are stored only as scrypt hashes.
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin', 'consultant', 'viewer')),
  password_hash text not null,
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- Signed-in browser sessions. Only a SHA-256 of the cookie token is stored.
create table auth_sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);
create index auth_sessions_user_idx on auth_sessions (user_id);

-- Who owns an engagement, and who else works on it.
alter table engagements add column owner_id uuid references users(id) on delete set null;
create table engagement_members (
  engagement_id uuid not null references engagements(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (engagement_id, user_id)
);

-- Who started each run, and whose conversation each lead-agent session is.
alter table runs add column user_id uuid references users(id) on delete set null;
alter table sessions add column user_id uuid references users(id) on delete set null;

-- What happened, by whom: sign-ins, exports, stops, resumes, template and user changes.
create table audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid references users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb
);
create index audit_log_at_idx on audit_log (at desc);
