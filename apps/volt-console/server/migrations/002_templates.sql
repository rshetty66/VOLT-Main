-- Output templates (brand profiles) used by the Word, Excel and PowerPoint exports.
create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  organisation text not null default '',
  primary_color text not null check (primary_color ~ '^[0-9A-F]{6}$'),
  accent_color text not null check (accent_color ~ '^[0-9A-F]{6}$'),
  heading_font text not null,
  body_font text not null,
  footer_text text not null default '',
  confidentiality text not null default '',
  logo bytea,
  logo_type text check (logo_type in ('image/png', 'image/jpeg')),
  logo_width integer,
  logo_height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- An engagement without a template uses the application's standard look.
alter table engagements add column template_id uuid references templates(id) on delete set null;
