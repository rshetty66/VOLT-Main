/** The template library: brand profiles stored in the database, plus the built-in standard. */
import type { Template } from "../shared/records.js";
import type { Db } from "./db.js";
import { STANDARD_BRAND, inspectLogo, type Brand } from "./office/brand.js";
import { isUuid } from "./store.js";

type Row = Record<string, any>;

export const STANDARD_ID = "standard";

export interface TemplateInput {
  name: string;
  description?: string;
  organisation?: string;
  primaryColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  footerText?: string;
  confidentiality?: string;
  /** New logo bytes; null removes the logo; undefined keeps the current one. */
  logo?: Buffer | null;
}

export const standardTemplate = (engagementCount = 0): Template => ({
  id: STANDARD_ID,
  builtIn: true,
  name: STANDARD_BRAND.name,
  description: "The application's own look, used by every engagement without a template.",
  organisation: STANDARD_BRAND.organisation,
  primaryColor: STANDARD_BRAND.primary,
  accentColor: STANDARD_BRAND.accent,
  headingFont: STANDARD_BRAND.headingFont,
  bodyFont: STANDARD_BRAND.bodyFont,
  footerText: STANDARD_BRAND.footer,
  confidentiality: STANDARD_BRAND.confidentiality,
  hasLogo: false,
  engagementCount,
  updatedAt: null,
});

const toTemplate = (r: Row): Template => ({
  id: r.id,
  builtIn: false,
  name: r.name,
  description: r.description,
  organisation: r.organisation,
  primaryColor: r.primary_color,
  accentColor: r.accent_color,
  headingFont: r.heading_font,
  bodyFont: r.body_font,
  footerText: r.footer_text,
  confidentiality: r.confidentiality,
  hasLogo: r.has_logo,
  engagementCount: Number(r.engagement_count ?? 0),
  updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at ?? null,
});

const SELECT = `
  select t.id, t.name, t.description, t.organisation, t.primary_color, t.accent_color, t.heading_font, t.body_font,
         t.footer_text, t.confidentiality, t.logo is not null as has_logo, t.updated_at,
         (select count(*)::int from engagements e where e.template_id = t.id) as engagement_count
  from templates t`;

export async function listTemplates(db: Db): Promise<Template[]> {
  const { rows } = await db.query<Row>(`${SELECT} order by lower(t.name)`);
  const standardUse = await db.query<{ n: number }>("select count(*)::int as n from engagements where template_id is null");
  return [standardTemplate(standardUse.rows[0].n), ...rows.map(toTemplate)];
}

export async function getTemplate(db: Db, id: string): Promise<Template | null> {
  if (id === STANDARD_ID) return (await listTemplates(db))[0];
  if (!isUuid(id)) return null;
  const { rows } = await db.query<Row>(`${SELECT} where t.id = $1`, [id]);
  return rows[0] ? toTemplate(rows[0]) : null;
}

export async function getLogo(db: Db, id: string): Promise<{ data: Buffer; type: string } | null> {
  if (!isUuid(id)) return null;
  const { rows } = await db.query<Row>("select logo, logo_type from templates where id = $1 and logo is not null", [id]);
  return rows[0] ? { data: Buffer.from(rows[0].logo), type: rows[0].logo_type } : null;
}

function logoColumns(logo: Buffer | null | undefined) {
  if (!logo) return { logo: null, type: null, width: null, height: null };
  const info = inspectLogo(logo);
  if (!info) throw new Error("The logo must be a PNG or JPEG image.");
  return { logo, type: info.type, width: info.width, height: info.height };
}

export async function createTemplate(db: Db, t: TemplateInput): Promise<Template> {
  const l = logoColumns(t.logo);
  const { rows } = await db.query<Row>(
    `insert into templates (name, description, organisation, primary_color, accent_color, heading_font, body_font, footer_text, confidentiality, logo, logo_type, logo_width, logo_height)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning id`,
    [t.name, t.description ?? "", t.organisation ?? "", t.primaryColor, t.accentColor, t.headingFont, t.bodyFont, t.footerText ?? "", t.confidentiality ?? "", l.logo, l.type, l.width, l.height],
  );
  return (await getTemplate(db, rows[0].id))!;
}

export async function updateTemplate(db: Db, id: string, t: TemplateInput): Promise<Template | null> {
  if (!isUuid(id)) return null;
  await db.query(
    `update templates set name = $2, description = $3, organisation = $4, primary_color = $5, accent_color = $6, heading_font = $7,
       body_font = $8, footer_text = $9, confidentiality = $10, updated_at = now() where id = $1`,
    [id, t.name, t.description ?? "", t.organisation ?? "", t.primaryColor, t.accentColor, t.headingFont, t.bodyFont, t.footerText ?? "", t.confidentiality ?? ""],
  );
  if (t.logo !== undefined) {
    const l = logoColumns(t.logo);
    await db.query("update templates set logo = $2, logo_type = $3, logo_width = $4, logo_height = $5 where id = $1", [id, l.logo, l.type, l.width, l.height]);
  }
  return getTemplate(db, id);
}

/** Deletes a template; engagements that used it go back to the application standard. */
export async function deleteTemplate(db: Db, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const { rows } = await db.query<Row>("delete from templates where id = $1 returning id", [id]);
  return rows.length > 0;
}

/** The brand an engagement's exports use: its template, else the application standard. */
export async function brandFor(db: Db, templateId: string | null | undefined): Promise<Brand> {
  if (!templateId || !isUuid(templateId)) return STANDARD_BRAND;
  const { rows } = await db.query<Row>("select * from templates where id = $1", [templateId]);
  const r = rows[0];
  if (!r) return STANDARD_BRAND;
  return {
    name: r.name,
    primary: r.primary_color,
    accent: r.accent_color,
    headingFont: r.heading_font,
    bodyFont: r.body_font,
    organisation: r.organisation,
    footer: r.footer_text,
    confidentiality: r.confidentiality,
    logo: r.logo ? { data: Buffer.from(r.logo), type: r.logo_type, width: r.logo_width, height: r.logo_height } : undefined,
  };
}
