-- A5: which run a resumed run continues, and whether the server resumed it by itself after a restart.
alter table runs add column resumed_from uuid references runs(id) on delete set null;
alter table runs add column auto_resumed boolean not null default false;
