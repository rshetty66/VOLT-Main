import express from "express";
import { z } from "zod";
import { exportFileName, type ExportRequest } from "../../shared/export.js";
import type { TemplateProfile } from "../../shared/templates.js";
import { exportDocument } from "./index.js";

const MB = 1024 * 1024;

const schema = z.object({
  format: z.enum(["docx", "pptx", "xlsx"]),
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().max(400).optional(),
  markdown: z.string().max(2 * MB),
  images: z
    .array(
      z.object({
        ref: z.string().regex(/^(chart|diagram)-\d{1,3}$/),
        png: z.string().max(10 * MB).regex(/^[A-Za-z0-9+/=]+$/),
        width: z.number().positive().max(10000),
        height: z.number().positive().max(10000),
        caption: z.string().max(200).optional(),
      }),
    )
    .max(60)
    .optional(),
  tables: z
    .array(z.object({ name: z.string().min(1).max(80), columns: z.array(z.string().max(200)).min(1).max(50), rows: z.array(z.array(z.union([z.string().max(5000), z.number(), z.null()])).max(50)).max(10000) }))
    .max(30)
    .optional(),
  templateId: z.string().max(80).optional(),
  figuresTitle: z.string().max(80).optional(),
});

/** POST / : returns the requested file as an attachment. Mounted with its own body limit, before the app's 1 MB JSON parser. */
export function exportRouter(getTemplate: (id: string) => TemplateProfile | null) {
  const router = express.Router();
  router.post("/", express.json({ limit: "40mb" }), async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: `Invalid export request: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` });
    const body = parsed.data as ExportRequest;
    try {
      const out = await exportDocument(body, body.templateId ? getTemplate(body.templateId) : null);
      res.setHeader("Content-Type", out.mime);
      res.setHeader("Content-Disposition", `attachment; filename="${exportFileName(body.title, out.ext)}"`);
      res.send(Buffer.from(out.data));
    } catch (err) {
      console.error("[export]", err);
      res.status(500).json({ error: "The file could not be built." });
    }
  });
  return router;
}
