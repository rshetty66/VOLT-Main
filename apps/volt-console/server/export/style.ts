import type { TemplateProfile } from "../../shared/templates.js";
import { BRAND } from "./brand.js";

/** Fonts, colours and page setup for an export: the selected template where it has them, VOLT defaults otherwise. */
export interface ExportStyle {
  /** True when no client template is selected: the file carries VOLT's own branding (logo, palette, footer). */
  brand: boolean;
  bodyFont: string;
  headingFont: string;
  /** RRGGBB, no "#". */
  ink: string;
  accent: string;
  headingColor: string;
  headerFill: string;
  headerInk: string;
  bodySizePt: number;
  page: { widthIn: number; heightIn: number; margins: { top: number; right: number; bottom: number; left: number } };
  slide: { widthIn: number; heightIn: number };
}

const hex = (s: string | undefined) => (s && /^[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : undefined);

export function styleFrom(p: TemplateProfile | null | undefined): ExportStyle {
  const style = (name: string) => p?.word?.styles.find((s) => s.name === name);
  const normal = style("Normal");
  const h1 = style("Heading 1");
  const theme = p?.theme;
  const pptTitle = p?.powerpoint?.textStyles.title;
  const pptBody = p?.powerpoint?.textStyles.body[0];
  const header = p?.excel?.sheets.find((s) => s.headerRow)?.headerRow;
  const accent = hex(theme?.colors.accent1) ?? BRAND.gold;
  const bodyFont = normal?.font ?? pptBody?.font ?? p?.excel?.defaultFont?.font ?? p?.word?.defaults.font ?? theme?.fonts.minor ?? "Calibri";
  return {
    brand: !p,
    bodyFont,
    headingFont: h1?.font ?? pptTitle?.font ?? theme?.fonts.major ?? bodyFont,
    ink: hex(normal?.color) ?? hex(theme?.colors.dk1) ?? BRAND.indigo,
    accent,
    headingColor: hex(h1?.color) ?? hex(pptTitle?.color) ?? (p ? accent : BRAND.indigo),
    headerFill: hex(header?.fill) ?? (p ? accent : BRAND.indigo),
    headerInk: hex(header?.color) ?? "FFFFFF",
    bodySizePt: normal?.sizePt ?? 11,
    page: {
      widthIn: p?.word?.page.widthIn ?? 8.5,
      heightIn: p?.word?.page.heightIn ?? 11,
      margins: p?.word?.page.marginsIn ?? { top: 1, right: 1, bottom: 1, left: 1 },
    },
    slide: { widthIn: p?.powerpoint?.slideSize.widthIn ?? 13.333, heightIn: p?.powerpoint?.slideSize.heightIn ?? 7.5 },
  };
}
