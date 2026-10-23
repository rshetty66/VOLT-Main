/** Formatting profile extracted from an uploaded Word, Excel or PowerPoint template. */

export type TemplateKind = "word" | "excel" | "powerpoint";

export interface ThemeInfo {
  name: string;
  /** Theme colour slots (dk1, lt1, dk2, lt2, accent1..6, hlink, folHlink) as RRGGBB hex. */
  colors: Record<string, string>;
  fonts: { major: string; minor: string };
}

export interface TextStyle {
  name: string;
  type?: string;
  basedOn?: string;
  font?: string;
  sizePt?: number;
  bold?: boolean;
  italic?: boolean;
  /** RRGGBB hex, resolved from the theme where the template uses a theme colour. */
  color?: string;
  align?: string;
  spaceBeforePt?: number;
  spaceAfterPt?: number;
  /** "1.15x" for proportional spacing, "14 pt" for exact or minimum spacing. */
  lineSpacing?: string;
  /** True when the template's own content uses the style. */
  used?: boolean;
}

export interface CellStyle {
  font?: string;
  sizePt?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  fill?: string;
  numberFormat?: string;
  align?: string;
}

export interface WordFormat {
  page: {
    widthIn: number;
    heightIn: number;
    orientation: "portrait" | "landscape";
    marginsIn: { top: number; right: number; bottom: number; left: number; header?: number; footer?: number };
    columns?: number;
  };
  defaults: TextStyle;
  styles: TextStyle[];
  headers: string[];
  footers: string[];
  fonts: string[];
}

export interface ExcelSheet {
  name: string;
  tabColor?: string;
  frozenAt?: string;
  showGridLines: boolean;
  zoomPct?: number;
  orientation?: string;
  columnWidths: { columns: string; width: number }[];
  header?: string;
  footer?: string;
  headerRow?: CellStyle;
}

export interface ExcelFormat {
  defaultFont?: CellStyle;
  sheets: ExcelSheet[];
  cellStyles: string[];
  numberFormats: string[];
  fonts: CellStyle[];
  fills: string[];
  tables: { name: string; sheet: string; style: string }[];
}

export interface Placeholder {
  type: string;
  name: string;
  /** Position and size as a percentage of the slide. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PowerPointFormat {
  slideSize: { widthIn: number; heightIn: number; aspect: string };
  slideCount: number;
  masterCount: number;
  background?: string;
  masterImages: number;
  textStyles: { title?: TextStyle; body: TextStyle[] };
  layouts: { name: string; type: string; placeholders: Placeholder[]; usedBySlides: number }[];
  slides: { index: number; layout: string; title?: string }[];
}

export interface TemplateProfile {
  id: string;
  name: string;
  kind: TemplateKind;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  uploadedAt: string;
  theme: ThemeInfo | null;
  word?: WordFormat;
  excel?: ExcelFormat;
  powerpoint?: PowerPointFormat;
  warnings: string[];
  /** Markdown formatting guide that agents apply to deliverables. */
  guide: string;
}

export type TemplateSummary = Pick<TemplateProfile, "id" | "name" | "kind" | "fileName" | "sizeBytes" | "uploadedAt" | "theme">;

export const TEMPLATE_EXTENSIONS = [".docx", ".dotx", ".xlsx", ".xltx", ".pptx", ".potx"] as const;
export const MAX_TEMPLATE_BYTES = 25 * 1024 * 1024;
