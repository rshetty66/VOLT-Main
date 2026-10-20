-- Engagements group the runs done for one client piece of work.
create table engagements (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per console run (orchestration, single agent or workflow).
create table runs (
  id uuid primary key,
  engagement_id uuid references engagements(id) on delete cascade,
  session_id text not null,
  kind text not null check (kind in ('orchestrate', 'agent', 'workflow')),
  title text not null,
  prompt text not null,
  workflow_id text,
  agent_id text,
  intake jsonb,
  mode text not null check (mode in ('live', 'demo')),
  model text not null,
  status text not null default 'running' check (status in ('running', 'done', 'error', 'stopped')),
  final_text text not null default '',
  error text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index runs_engagement_started_idx on runs (engagement_id, started_at desc);

-- The run's event stream, so a saved run can be replayed exactly as it was shown.
create table run_events (
  run_id uuid not null references runs(id) on delete cascade,
  seq integer not null,
  event jsonb not null,
  primary key (run_id, seq)
);

-- Lead-agent conversations, so follow-up questions keep their context across restarts.
create table sessions (
  id text primary key,
  agent_id text,
  messages jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
