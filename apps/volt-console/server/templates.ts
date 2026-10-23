/** The template library: brand profiles stored in the database, plus the built-in standard. */
import type { Template } from "../shared/records.js";
import type { TemplateProfile } from "../shared/template-profile.js";
import type { Db } from "./db.js";
import { MAX_LOGO_BYTES, STANDARD_BRAND, inspectLogo, type Brand } from "./office/brand.js";
import { isUuid } from "./store.js";
import { analyseTemplate } from "./template-extract.js";

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
  source: null,
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
  source: r.source_kind ? { kind: r.source_kind, fileName: r.source_file_name } : null,
  engagementCount: Number(r.engagement_count ?? 0),
  updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at ?? null,
});

const SELECT = `
  select t.id, t.name, t.description, t.organisation, t.primary_color, t.accent_color, t.heading_font, t.body_font,
         t.footer_text, t.confidentiality, t.logo is not null as has_logo, t.updated_at, t.source_kind, t.source_file_name,
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

/** Where an imported template came from: the file, what was extracted from it and the guide for agents. */
export interface TemplateSource {
  profile: TemplateProfile;
  file: Buffer;
}

export async function createTemplate(db: Db, t: TemplateInput, source?: TemplateSource): Promise<Template> {
  const l = logoColumns(t.logo);
  const { rows } = await db.query<Row>(
    `insert into templates (name, description, organisation, primary_color, accent_color, heading_font, body_font, footer_text, confidentiality, logo, logo_type, logo_width, logo_height,
       source_kind, source_file_name, source_file, source_profile, formatting_guide)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) returning id`,
    [
      t.name, t.description ?? "", t.organisation ?? "", t.primaryColor, t.accentColor, t.headingFont, t.bodyFont, t.footerText ?? "", t.confidentiality ?? "", l.logo, l.type, l.width, l.height,
      source?.profile.kind ?? null, source?.profile.fileName ?? null, source?.file ?? null, source ? JSON.stringify({ ...source.profile, guide: undefined }) : null, source?.profile.guide ?? null,
    ],
  );
  return (await getTemplate(db, rows[0].id))!;
}

// ── Import from a client's Office file ───────────────────────────────────────

/** Font names go into document XML attributes: the same rule the template form applies. */
const safeFont = (f: string | undefined) => {
  const v = f?.trim();
  return v && v.length <= 60 && /^[A-Za-z0-9 -]+$/.test(v) ? v : undefined;
};
const clip = (s: string | undefined, max: number) => (s ?? "").trim().slice(0, max);
const CONFIDENTIAL = /confidential|restricted|internal use|private and/i;

/** The template form's fields, filled from what was extracted; the standard look covers anything missing or unsafe. */
export function templateInputFromProfile(p: TemplateProfile, logo?: Buffer): TemplateInput {
  const style = (n: string) => p.word?.styles.find((s) => s.name === n);
  const heading =
    p.kind === "word" ? style("Heading 1")?.font ?? style("Title")?.font : p.kind === "powerpoint" ? p.powerpoint?.textStyles.title?.font : p.excel?.sheets.find((s) => s.headerRow?.font)?.headerRow?.font;
  const body = p.kind === "word" ? style("Normal")?.font ?? p.word?.defaults.font : p.kind === "powerpoint" ? p.powerpoint?.textStyles.body[0]?.font : p.excel?.defaultFont?.font;
  const headers = p.word?.headers ?? p.excel?.sheets.flatMap((s) => (s.header ? [s.header] : [])) ?? [];
  const footers = p.word?.footers ?? p.excel?.sheets.flatMap((s) => (s.footer ? [s.footer] : [])) ?? [];
  const colours = p.theme?.colors ?? {};
  const headingColour = p.kind === "word" ? style("Heading 1")?.color : undefined;
  const kind = { word: "Word", excel: "Excel", powerpoint: "PowerPoint" }[p.kind];
  return {
    name: clip(p.name, 100) || "Imported template",
    description: clip(`Imported from ${p.fileName} (${kind} template).`, 500),
    organisation: clip(headers[0], 100),
    primaryColor: colours.accent1 ?? headingColour ?? STANDARD_BRAND.primary,
    accentColor: colours.accent2 ?? STANDARD_BRAND.accent,
    headingFont: safeFont(heading) ?? safeFont(p.theme?.fonts.major) ?? STANDARD_BRAND.headingFont,
    bodyFont: safeFont(body) ?? safeFont(p.theme?.fonts.minor) ?? STANDARD_BRAND.bodyFont,
    footerText: clip(footers[0], 120),
    confidentiality: clip([...headers, ...footers].find((l) => CONFIDENTIAL.test(l)), 160),
    logo,
  };
}

/** Creates a library template from a Word, Excel or PowerPoint file. Throws TemplateError for files it cannot read. */
export async function importTemplate(db: Db, file: Buffer, fileName: string): Promise<Template> {
  const { profile, logo } = analyseTemplate(new Uint8Array(file), fileName);
  const logoBytes = logo && logo.data.length <= MAX_LOGO_BYTES && inspectLogo(Buffer.from(logo.data)) ? Buffer.from(logo.data) : undefined;
  if (logo && !logoBytes) profile.warnings.push("The logo in the file was not used: it must be a PNG or JPEG of 1 MB or less.");
  return createTemplate(db, templateInputFromProfile(profile, logoBytes), { profile, file });
}

/** The formatting extracted from an imported template; null for the standard and hand-made templates. */
export async function getTemplateFormatting(db: Db, id: string): Promise<{ guide: string; profile: Omit<TemplateProfile, "guide"> } | null> {
  if (!isUuid(id)) return null;
  const { rows } = await db.query<Row>("select formatting_guide, source_profile from templates where id = $1 and formatting_guide is not null", [id]);
  return rows[0] ? { guide: rows[0].formatting_guide, profile: rows[0].source_profile } : null;
}

/** The file an imported template was made from. */
export async function getTemplateSource(db: Db, id: string): Promise<{ data: Buffer; fileName: string } | null> {
  if (!isUuid(id)) return null;
  const { rows } = await db.query<Row>("select source_file, source_file_name from templates where id = $1 and source_file is not null", [id]);
  return rows[0] ? { data: Buffer.from(rows[0].source_file), fileName: rows[0].source_file_name } : null;
}

/** What a run tells its agents about the engagement's template: the full guide, and a short summary for specialists. */
export interface Formatting {
  name: string;
  guide: string;
  summary: string;
}

export async function formattingFor(db: Db, templateId: string | null | undefined): Promise<Formatting | null> {
  if (!templateId || !isUuid(templateId)) return null;
  const { rows } = await db.query<Row>("select name, formatting_guide, heading_font, body_font, primary_color, accent_color from templates where id = $1 and formatting_guide is not null", [templateId]);
  const r = rows[0];
  if (!r) return null;
  return { name: r.name, guide: r.formatting_guide, summary: `heading font ${r.heading_font}, body font ${r.body_font}, colours #${r.primary_color} and #${r.accent_color}` };
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
