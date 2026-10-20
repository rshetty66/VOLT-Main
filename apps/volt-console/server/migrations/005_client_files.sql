-- A3 client inputs: files uploaded to an engagement, kept in the local database with
-- the text and tables extracted from them. Deleting the engagement deletes its files.
create table client_files (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  -- F1, F2… within the engagement; never reused, so citations in earlier runs keep pointing at the right file.
  ref_no integer not null,
  name text not null,
  kind text not null check (kind in ('csv', 'xlsx', 'pdf', 'docx')),
  size_bytes integer not null,
  sha256 text not null,
  data bytea not null,
  extracted text not null default '',
  summary text not null default '',
  truncated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (engagement_id, sha256),
  unique (engagement_id, ref_no)
);
create index client_files_engagement_idx on client_files (engagement_id, created_at);

-- Next F-number per engagement; deleting a file leaves a gap rather than renumbering.
alter table engagements add column next_file_ref integer not null default 1;
