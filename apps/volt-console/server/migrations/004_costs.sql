-- A2 cost control: cache writes and an estimated cost per run, admin settings
-- (price table, budgets, specialist model) and an optional per-person monthly budget.
alter table runs add column cache_write_tokens integer not null default 0;
alter table runs add column cost_usd double precision not null default 0;
create index runs_user_started_idx on runs (user_id, started_at);

alter table users add column monthly_budget_usd double precision;

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id) on delete set null
);

-- Runs saved before costs were tracked: estimate from Claude Opus 5.5 list prices
-- (cache writes were not recorded then, so these slightly understate).
update runs
set cost_usd = round(((input_tokens * 4.0 + cache_read_tokens * 0.2 + output_tokens * 20.0) / 1000000.0)::numeric, 4)
where mode = 'live' and model like 'claude-opus-5-5%';
