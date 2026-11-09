import { EXPORT_MIME, type ExportFormat, type ExportRequest } from "../../shared/export.js";
import type { TemplateProfile } from "../../shared/templates.js";
import { writeDocx } from "./docx.js";
import { writePptx } from "./pptx.js";
import { styleFrom } from "./style.js";
import { writeXlsx } from "./xlsx.js";

export { styleFrom } from "./style.js";

const WRITERS: Record<ExportFormat, typeof writeDocx> = { docx: writeDocx, pptx: writePptx, xlsx: writeXlsx };

/** Builds a Word, PowerPoint or Excel file from a markdown deliverable, its pictures and an optional template. */
export async function exportDocument(req: ExportRequest, template: TemplateProfile | null) {
  const data = await WRITERS[req.format](req, styleFrom(template));
  return { data, mime: EXPORT_MIME[req.format], ext: req.format };
}
