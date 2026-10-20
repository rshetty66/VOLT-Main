-- A6: how long an engagement keeps its runs and client files (null: until deleted by hand).
alter table engagements add column retention_days integer check (retention_days is null or retention_days between 1 and 3650);

-- Spend from runs that were deleted (by hand or by retention), so deleting data never
-- gives budget back: monthly budgets add this to the spend of runs still saved.
create table deleted_spend (
  user_id uuid references users(id) on delete set null,
  month date not null,
  cost_usd double precision not null default 0,
  runs integer not null default 0,
  input_tokens bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  cache_read_tokens bigint not null default 0,
  output_tokens bigint not null default 0
);
create index deleted_spend_user_month_idx on deleted_spend (user_id, month);
