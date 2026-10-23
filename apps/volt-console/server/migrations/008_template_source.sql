-- Templates imported from a client's Word, Excel or PowerPoint file keep the file, the
-- formatting extracted from it (server/template-extract.ts) and the guide agents follow.
-- Hand-made templates leave these empty.
alter table templates add column source_kind text check (source_kind is null or source_kind in ('word', 'excel', 'powerpoint'));
alter table templates add column source_file_name text;
alter table templates add column source_file bytea;
alter table templates add column source_profile jsonb;
alter table templates add column formatting_guide text;
