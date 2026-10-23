import { useEffect, useRef, useState } from "react";
import type { Template } from "../../shared/records";
import { TEMPLATE_EXTENSIONS } from "../../shared/template-profile";
import { createTemplate, deleteTemplate, importTemplate, listTemplates, templateLogoUrl, templatePreviewUrl, updateTemplate, type TemplateForm } from "../api";
import { useCanWrite } from "../user";
import { TemplateFormatting } from "./TemplateFormatting";

const KIND_LABEL = { word: "Word", excel: "Excel", powerpoint: "PowerPoint" } as const;

const FONTS = ["Calibri", "Aptos", "Arial", "Helvetica Neue", "Segoe UI", "Verdana", "Georgia", "Cambria", "Garamond", "Times New Roman", "Lato", "Roboto", "Open Sans"];
const MAX_LOGO = 1024 * 1024;

const swatch = (hex: string) => <span style={{ display: "inline-block", width: 18, height: 18, borderRadius: 4, background: `#${hex}`, border: "1px solid var(--line-strong)" }} />;

export function Previews({ id }: { id: string }) {
  const link = (format: "docx" | "xlsx" | "pptx", label: string) => (
    <a className="btn sm" style={{ textDecoration: "none" }} href={templatePreviewUrl(id, format)} download title="Sample file in this template">
      {label}
    </a>
  );
  return (
    <span className="row" style={{ gap: 4 }}>
      <span className="micro">Preview</span>
      {link("docx", "Word")}
      {link("xlsx", "Excel")}
      {link("pptx", "PowerPoint")}
    </span>
  );
}

export function Templates({ onChanged }: { onChanged: () => void }) {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const canWrite = useCanWrite();
  const load = () => listTemplates().then(setTemplates, (e) => setErr(String(e)));
  useEffect(() => {
    load();
  }, []);

  if (editing)
    return (
      <TemplateEditor
        template={editing === "new" ? null : editing}
        standard={templates?.find((t) => t.builtIn) ?? null}
        onDone={() => {
          setEditing(null);
          load();
          onChanged();
        }}
      />
    );

  return (
    <div className="stack" style={{ maxWidth: 1000 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">Output templates</h1>
          <p className="page-sub">
            The look of Word, Excel and PowerPoint exports: logo, colours, fonts, header and footer text. Create a template once, then
            choose it on any engagement. Engagements without one use the VOLT standard.
          </p>
        </div>
        {canWrite && (
          <button className="btn primary" onClick={() => setEditing("new")}>
            New template
          </button>
        )}
      </div>
      {err && <div className="card">{err}</div>}
      {canWrite && (
        <ImportZone
          onImported={(t) => {
            load();
            onChanged();
            setEditing(t);
          }}
        />
      )}
      {!templates ? (
        <div className="empty"><span className="spinner" /> Loading...</div>
      ) : (
        <div className="grid">
          {templates.map((t) => (
            <div key={t.id} className="card stack" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <b>{t.name}</b>
                {t.builtIn && <span className="badge">built in</span>}
              </div>
              <div style={{ height: 44, display: "flex", alignItems: "center" }}>
                {t.hasLogo ? (
                  <img src={templateLogoUrl(t)} alt={`${t.name} logo`} style={{ maxHeight: 44, maxWidth: 200, background: "#fff", padding: 4, borderRadius: 4 }} />
                ) : (
                  <span className="muted" style={{ fontSize: 12 }}>No logo</span>
                )}
              </div>
              <div className="row" style={{ fontSize: 12 }}>
                {swatch(t.primaryColor)} {swatch(t.accentColor)}
                <span className="muted">
                  {t.headingFont}
                  {t.bodyFont !== t.headingFont ? ` / ${t.bodyFont}` : ""}
                </span>
              </div>
              {t.confidentiality && <div className="body" style={{ fontSize: 12 }}>{t.confidentiality}</div>}
              {t.source && (
                <div className="muted" style={{ fontSize: 12 }}>
                  Imported from {t.source.fileName} <span className="badge">{KIND_LABEL[t.source.kind]}</span>
                </div>
              )}
              <div className="muted" style={{ fontSize: 12 }}>
                Used by {t.engagementCount} engagement{t.engagementCount === 1 ? "" : "s"}
              </div>
              <Previews id={t.id} />
              {!t.builtIn && canWrite && (
                <div className="row">
                  <button className="btn sm" onClick={() => setEditing(t)}>
                    {t.source ? "Edit and view formatting" : "Edit"}
                  </button>
                  {confirmDelete === t.id ? (
                    <>
                      <button
                        className="btn sm"
                        onClick={() =>
                          deleteTemplate(t.id).then(
                            () => {
                              setConfirmDelete(null);
                              load();
                              onChanged();
                            },
                            (e) => setErr(String(e)),
                          )
                        }
                      >
                        Confirm delete
                      </button>
                      <button className="btn ghost sm" onClick={() => setConfirmDelete(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button className="btn ghost sm" onClick={() => setConfirmDelete(t.id)} title={t.engagementCount ? "Its engagements will use the VOLT standard" : undefined}>
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateEditor({ template, standard, onDone }: { template: Template | null; standard: Template | null; onDone: () => void }) {
  const base = template ?? standard;
  const [f, setF] = useState<TemplateForm>({
    name: template?.name ?? "",
    description: template?.description ?? "",
    organisation: base?.organisation ?? "",
    primaryColor: base?.primaryColor ?? "1F3864",
    accentColor: base?.accentColor ?? "2E75B6",
    headingFont: base?.headingFont ?? "Calibri",
    bodyFont: base?.bodyFont ?? "Calibri",
    footerText: base?.footerText ?? "Working draft",
    confidentiality: template?.confidentiality ?? "",
    logo: undefined,
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(template?.hasLogo ? templateLogoUrl(template) : null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof TemplateForm) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) return setErr("The logo must be a PNG or JPEG image.");
    if (file.size > MAX_LOGO) return setErr("The logo must be 1 MB or smaller.");
    const reader = new FileReader();
    reader.onload = () => {
      setErr("");
      setF((x) => ({ ...x, logo: String(reader.result) }));
      setLogoPreview(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      if (template) await updateTemplate(template.id, f);
      else await createTemplate(f);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const colourField = (k: "primaryColor" | "accentColor", label: string, hint: string) => (
    <label className="stack" style={{ gap: 4 }}>
      <span className="micro">{label}</span>
      <span className="row">
        <input type="color" aria-label={`${label} picker`} value={`#${f[k]}`} onChange={(e) => setF({ ...f, [k]: e.target.value.slice(1).toUpperCase() })} style={{ width: 44, height: 32, padding: 0, border: 0, background: "none" }} />
        <input className="input" style={{ width: 110 }} aria-label={label} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value.replace(/^#/, "").toUpperCase() })} />
      </span>
      <span className="muted" style={{ fontSize: 11 }}>{hint}</span>
    </label>
  );
  const textField = (k: keyof TemplateForm, label: string, placeholder = "", list?: string) => (
    <label className="stack" style={{ gap: 4, flex: 1, minWidth: 220 }}>
      <span className="micro">{label}</span>
      <input className="input" aria-label={label} list={list} placeholder={placeholder} value={(f[k] as string) ?? ""} onChange={set(k)} />
    </label>
  );

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={onDone}>
        &larr; All templates
      </button>
      <h1 className="page-title">{template ? `Edit ${template.name}` : "New template"}</h1>
      {template?.source && (
        <p className="page-sub">
          Filled in from {template.source.fileName}. Check the values below and save any changes. Agents on engagements that use this
          template also get the full formatting guide extracted from the file.
        </p>
      )}
      <datalist id="volt-fonts">
        {FONTS.map((x) => (
          <option key={x} value={x} />
        ))}
      </datalist>
      <div className="card stack">
        <div className="row" style={{ alignItems: "flex-start" }}>
          {textField("name", "Template name", "e.g. Maple Harbour Financial")}
          {textField("organisation", "Organisation in page headers", "e.g. VOLT Advisory")}
        </div>
        {textField("description", "Notes (optional)", "When to use this template")}
        <div className="row" style={{ alignItems: "flex-start", gap: 24 }}>
          {colourField("primaryColor", "Primary colour", "Cover, titles, table headers")}
          {colourField("accentColor", "Accent colour", "Subheadings and highlights")}
        </div>
        <div className="row" style={{ alignItems: "flex-start" }}>
          {textField("headingFont", "Heading font", "Calibri", "volt-fonts")}
          {textField("bodyFont", "Body font", "Calibri", "volt-fonts")}
        </div>
        <span className="muted" style={{ fontSize: 11 }}>Fonts must be installed where the files are opened; otherwise Office substitutes a similar font.</span>
        <div className="row" style={{ alignItems: "flex-start" }}>
          {textField("footerText", "Footer text", "Working draft")}
          {textField("confidentiality", "Confidentiality label (optional)", "e.g. Confidential - prepared for the Board")}
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <span className="micro">Logo (PNG or JPEG, up to 1 MB)</span>
          <div className="row">
            {logoPreview ? <img src={logoPreview} alt="Logo preview" style={{ maxHeight: 56, maxWidth: 240, background: "#fff", padding: 4, borderRadius: 4 }} /> : <span className="muted" style={{ fontSize: 12 }}>No logo</span>}
            <input type="file" accept="image/png,image/jpeg" aria-label="Logo file" onChange={(e) => pickLogo(e.target.files?.[0])} />
            {logoPreview && (
              <button
                className="btn ghost sm"
                onClick={() => {
                  setF({ ...f, logo: null });
                  setLogoPreview(null);
                }}
              >
                Remove logo
              </button>
            )}
          </div>
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--danger, #f87171)" }}>{err}</span>
          <button className="btn primary" disabled={busy || !f.name.trim()} onClick={save}>
            {busy ? "Saving..." : template ? "Save template" : "Create template"}
          </button>
        </div>
      </div>
      {template && <Previews id={template.id} />}
      {template?.source && (
        <div className="card">
          <TemplateFormatting id={template.id} />
        </div>
      )}
    </div>
  );
}

/** Drop or choose a Word, Excel or PowerPoint file; the server turns it into a template. */
function ImportZone({ onImported }: { onImported: (t: Template) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const run = async (file: File | undefined) => {
    if (!file) return;
    setErr("");
    setBusy(file.name);
    try {
      onImported(await importTemplate(file));
    } catch (e) {
      setErr(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy("");
    }
  };
  return (
    <div
      className={`card dropzone ${over ? "over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void run(e.dataTransfer.files[0]);
      }}
    >
      <input
        ref={input}
        type="file"
        hidden
        aria-label="Template file"
        accept={TEMPLATE_EXTENSIONS.join(",")}
        onChange={(e) => {
          void run(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {busy ? (
        <span className="body">
          <span className="spinner" /> Reading {busy}...
        </span>
      ) : (
        <>
          <b>Import a client template</b>
          <span className="muted" style={{ fontSize: 12 }}>
            Drop a Word (.docx, .dotx), Excel (.xlsx, .xltx) or PowerPoint (.pptx, .potx) file, up to 25 MB. VOLT reads its colours, fonts,
            header, footer and logo into a new template, plus a formatting guide for agents. Macro-enabled files are not accepted.
          </span>
          <button className="btn" onClick={() => input.current?.click()}>
            Choose file
          </button>
        </>
      )}
      {err && <div className="upload-error">{err}</div>}
    </div>
  );
}
