import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CellStyle, TemplateKind, TemplateProfile, TemplateSummary, TextStyle } from "../../shared/templates";
import { TEMPLATE_EXTENSIONS } from "../../shared/templates";
import { deleteTemplate, getTemplate, uploadTemplate } from "../api";
import { Markdown } from "./Markdown";

const KIND_LABEL: Record<TemplateKind, string> = { word: "Word", excel: "Excel", powerpoint: "PowerPoint" };
const SLOT_LABEL: Record<string, string> = {
  dk1: "Dark 1", lt1: "Light 1", dk2: "Dark 2", lt2: "Light 2",
  accent1: "Accent 1", accent2: "Accent 2", accent3: "Accent 3", accent4: "Accent 4", accent5: "Accent 5", accent6: "Accent 6",
  hlink: "Link", folHlink: "Visited link",
};
const PLACEHOLDER: Record<string, string> = {
  ctrTitle: "centred title", subTitle: "subtitle", body: "text", obj: "content", dt: "date", ftr: "footer", sldNum: "slide number", pic: "picture", tbl: "table", dgm: "diagram",
};
const ACCENTS = ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"];
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

interface Props {
  templates: TemplateSummary[];
  refresh: () => Promise<void>;
  activeTemplate: string;
  setActiveTemplate: (id: string) => void;
}

/** Upload Word, Excel and PowerPoint templates and browse the formatting VOLT extracted from them. */
export function Templates({ templates, refresh, activeTemplate, setActiveTemplate }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <TemplateDetail id={open} onBack={() => setOpen(null)} refresh={refresh} activeTemplate={activeTemplate} setActiveTemplate={setActiveTemplate} />;
  return (
    <div className="stack" style={{ maxWidth: 1100 }}>
      <div>
        <h1 className="page-title">Templates</h1>
        <p className="page-sub">
          Upload a client's Word, Excel or PowerPoint template. VOLT reads its formatting (theme colours and fonts, styles, page setup, slide
          layouts, cell styles and number formats) and turns it into a formatting guide. Pick a template in the top bar and every agent in
          a run applies it; agents can also look templates up with the <code>list_templates</code> and <code>get_template</code> tools.
        </p>
      </div>
      <UploadZone
        onUploaded={async (p, openIt) => {
          await refresh();
          if (openIt) setOpen(p.id);
        }}
      />
      {templates.length === 0 ? (
        <div className="empty">No templates yet. Upload a .docx, .xlsx or .pptx file to start.</div>
      ) : (
        <div className="grid">
          {templates.map((t) => (
            <div key={t.id} className="card interactive stack" style={{ gap: 10 }} onClick={() => setOpen(t.id)}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <b>{t.name}</b>
                <span className="row">
                  {t.id === activeTemplate && <span className="badge live">In use</span>}
                  <span className="badge">{KIND_LABEL[t.kind]}</span>
                </span>
              </div>
              <Swatches colors={t.theme?.colors} slots={ACCENTS} size={22} />
              <div className="muted" style={{ fontSize: 12 }}>
                {t.theme ? `${t.theme.fonts.major || "-"} / ${t.theme.fonts.minor || "-"}` : "No theme"} · {t.fileName} · {kb(t.sizeBytes)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadZone({ onUploaded }: { onUploaded: (p: TemplateProfile, openIt: boolean) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const upload = async (files: FileList | File[]) => {
    const list = [...files];
    setErrors([]);
    let last: TemplateProfile | null = null;
    const failed: string[] = [];
    for (const f of list) {
      setBusy(f.name);
      try {
        last = await uploadTemplate(f);
      } catch (e) {
        failed.push(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setBusy(null);
    setErrors(failed);
    // One file: open its profile. Several: stay on the list.
    if (last) await onUploaded(last, list.length === 1);
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
        if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
      }}
    >
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept={TEMPLATE_EXTENSIONS.join(",")}
        onChange={(e) => {
          if (e.target.files?.length) void upload(e.target.files);
          e.target.value = "";
        }}
      />
      {busy ? (
        <span className="body">
          <span className="spinner" /> Reading {busy}…
        </span>
      ) : (
        <>
          <b>Drop a template here</b>
          <span className="muted" style={{ fontSize: 12 }}>
            Word (.docx, .dotx), Excel (.xlsx, .xltx) or PowerPoint (.pptx, .potx), up to 25 MB. Macro-enabled files are not accepted.
          </span>
          <button className="btn" onClick={() => input.current?.click()}>
            Choose files
          </button>
        </>
      )}
      {errors.map((e) => (
        <div key={e} className="upload-error">
          {e}
        </div>
      ))}
    </div>
  );
}

function TemplateDetail({ id, onBack, refresh, activeTemplate, setActiveTemplate }: { id: string; onBack: () => void } & Omit<Props, "templates">) {
  const [p, setP] = useState<TemplateProfile | null>(null);
  const [err, setErr] = useState("");
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    getTemplate(id).then(setP, (e) => setErr(String(e)));
  }, [id]);

  if (err) return <div className="empty">{err}</div>;
  if (!p) return <div className="empty"><span className="spinner" /> Loading template…</div>;
  const active = p.id === activeTemplate;

  return (
    <div className="stack" style={{ maxWidth: 1100 }}>
      <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={onBack}>
        ← All templates
      </button>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="micro">{KIND_LABEL[p.kind]} template</div>
          <h1 className="page-title">{p.name}</h1>
          <p className="page-sub">
            {p.fileName} · {kb(p.sizeBytes)} · uploaded {new Date(p.uploadedAt).toLocaleString()}
          </p>
        </div>
        <div className="row">
          <button className={`btn ${active ? "" : "primary"}`} onClick={() => setActiveTemplate(active ? "" : p.id)}>
            {active ? "Stop using in runs" : "Use in runs"}
          </button>
          <button className="btn" onClick={() => setShowGuide((x) => !x)}>
            {showGuide ? "Hide" : "Show"} formatting guide
          </button>
          <a className="btn" href={`/api/templates/${p.id}/original`}>
            Download original
          </a>
          <button
            className="btn"
            onClick={() => {
              const url = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }));
              const a = document.createElement("a");
              a.href = url;
              a.download = `${p.name}.profile.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Profile JSON
          </button>
          <button
            className="btn ghost"
            onClick={async () => {
              if (!window.confirm(`Delete the template "${p.name}"?`)) return;
              await deleteTemplate(p.id);
              if (active) setActiveTemplate("");
              await refresh();
              onBack();
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {p.warnings.length > 0 && (
        <div className="card body" style={{ fontSize: 13 }}>
          {p.warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      )}

      {showGuide && (
        <div className="card">
          <div className="micro" style={{ marginBottom: 8 }}>
            Formatting guide given to agents
          </div>
          <Markdown text={p.guide} />
        </div>
      )}

      {p.theme && (
        <Section title={`Theme · ${p.theme.name}`}>
          <div className="row" style={{ gap: 24, marginBottom: 14 }}>
            <FontSample label="Heading font" font={p.theme.fonts.major} />
            <FontSample label="Body font" font={p.theme.fonts.minor} />
          </div>
          <Swatches colors={p.theme.colors} slots={Object.keys(SLOT_LABEL)} size={40} labelled />
        </Section>
      )}

      {p.word && (
        <>
          <Section title="Page setup">
            <div className="stats">
              <Stat label="Page size" value={`${p.word.page.widthIn} x ${p.word.page.heightIn} in`} />
              <Stat label="Orientation" value={p.word.page.orientation} />
              <Stat label="Margins (T R B L)" value={`${p.word.page.marginsIn.top} / ${p.word.page.marginsIn.right} / ${p.word.page.marginsIn.bottom} / ${p.word.page.marginsIn.left} in`} />
              {p.word.page.columns && p.word.page.columns > 1 ? <Stat label="Columns" value={String(p.word.page.columns)} /> : null}
            </div>
          </Section>
          <Section title={`Styles (${p.word.styles.length})`}>
            <StyleTable styles={[p.word.defaults, ...p.word.styles]} spacing />
          </Section>
          {(p.word.headers.length > 0 || p.word.footers.length > 0) && (
            <Section title="Headers and footers">
              {p.word.headers.map((h) => (
                <div key={`h${h}`} className="body">Header: {h}</div>
              ))}
              {p.word.footers.map((f) => (
                <div key={`f${f}`} className="body">Footer: {f}</div>
              ))}
            </Section>
          )}
        </>
      )}

      {p.excel && (
        <>
          <Section title={`Sheets (${p.excel.sheets.length})`}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Sheet</th>
                    <th>Header row</th>
                    <th>Frozen at</th>
                    <th>Gridlines</th>
                    <th>Tab</th>
                    <th>Orientation</th>
                    <th>Column widths</th>
                  </tr>
                </thead>
                <tbody>
                  {p.excel.sheets.map((s) => (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td>{s.headerRow ? <CellSample c={s.headerRow} /> : "-"}</td>
                      <td>{s.frozenAt ?? "-"}</td>
                      <td>{s.showGridLines ? "shown" : "hidden"}</td>
                      <td>{s.tabColor ? <Chip hex={s.tabColor} /> : "-"}</td>
                      <td>{s.orientation ?? "-"}</td>
                      <td className="muted">{s.columnWidths.map((c) => `${c.columns} ${c.width}`).join(", ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <Section title="Number formats and styles">
            <div className="stack" style={{ gap: 10 }}>
              <div className="row">
                {p.excel.numberFormats.map((f) => (
                  <code key={f} className="chip">{f}</code>
                ))}
                {p.excel.numberFormats.length === 0 && <span className="muted">No custom number formats</span>}
              </div>
              <div className="body">Named cell styles: {p.excel.cellStyles.join(", ") || "-"}</div>
              <div className="body">Tables: {p.excel.tables.map((t) => `${t.name} (${t.sheet}): ${t.style}`).join("; ") || "-"}</div>
              {p.excel.defaultFont && <div className="body">Default cell font: <CellSample c={p.excel.defaultFont} /></div>}
            </div>
          </Section>
        </>
      )}

      {p.powerpoint && (
        <>
          <Section title="Slide setup">
            <div className="stats">
              <Stat label="Slide size" value={`${p.powerpoint.slideSize.widthIn} x ${p.powerpoint.slideSize.heightIn} in`} />
              <Stat label="Aspect" value={p.powerpoint.slideSize.aspect} />
              <Stat label="Layouts" value={String(p.powerpoint.layouts.length)} />
              <Stat label="Sample slides" value={String(p.powerpoint.slideCount)} />
            </div>
          </Section>
          <Section title="Master text styles">
            <StyleTable styles={[p.powerpoint.textStyles.title, ...p.powerpoint.textStyles.body].filter((s): s is TextStyle => !!s)} />
          </Section>
          <Section title={`Slide layouts (${p.powerpoint.layouts.length})`}>
            <div className="layouts">
              {p.powerpoint.layouts.map((l) => (
                <div key={l.name} className="layout">
                  <div className="slide" style={{ aspectRatio: `${p.powerpoint!.slideSize.widthIn} / ${p.powerpoint!.slideSize.heightIn}` }}>
                    {l.placeholders.map((ph, i) => (
                      <div key={i} className={`ph ${ph.type}`} style={{ left: `${ph.x}%`, top: `${ph.y}%`, width: `${ph.w}%`, height: `${ph.h}%` }} title={ph.name}>
                        {PLACEHOLDER[ph.type] ?? ph.type}
                      </div>
                    ))}
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12 }}>{l.name}</span>
                    {l.usedBySlides > 0 && <span className="muted" style={{ fontSize: 11 }}>{l.usedBySlides} slide{l.usedBySlides > 1 ? "s" : ""}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card">
      <div className="micro" style={{ marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Swatches({ colors, slots, size, labelled }: { colors?: Record<string, string>; slots: string[]; size: number; labelled?: boolean }) {
  if (!colors) return null;
  return (
    <div className="swatches">
      {slots
        .filter((s) => colors[s])
        .map((s) => (
          <div key={s} className="swatch" title={`${SLOT_LABEL[s]} #${colors[s]}`}>
            <span style={{ background: `#${colors[s]}`, width: size, height: size }} />
            {labelled && (
              <>
                <small>{SLOT_LABEL[s]}</small>
                <code>#{colors[s]}</code>
              </>
            )}
          </div>
        ))}
    </div>
  );
}

function Chip({ hex }: { hex: string }) {
  return (
    <span className="row" style={{ gap: 6 }}>
      <span className="dot-swatch" style={{ background: `#${hex}` }} />
      <code>#{hex}</code>
    </span>
  );
}

function FontSample({ label, font }: { label: string; font: string }) {
  return (
    <div className="stat">
      <span className="micro">{label}</span>
      <span style={{ fontFamily: `"${font}", var(--font)`, fontSize: 20 }}>{font || "-"}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="micro">{label}</span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function CellSample({ c }: { c: CellStyle }) {
  return (
    <span
      className="cell-sample"
      style={{ background: c.fill ? `#${c.fill}` : "#ffffff", color: c.color ? `#${c.color}` : "#000000", fontWeight: c.bold ? 700 : 400, fontStyle: c.italic ? "italic" : undefined }}
    >
      {[c.font, c.sizePt ? `${c.sizePt} pt` : "", c.numberFormat ?? ""].filter(Boolean).join(" · ") || "default"}
    </span>
  );
}

function StyleTable({ styles, spacing }: { styles: TextStyle[]; spacing?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Style</th>
            <th>Font</th>
            <th>Size</th>
            <th>Weight</th>
            <th>Colour</th>
            <th>{spacing ? "Spacing" : "Alignment"}</th>
          </tr>
        </thead>
        <tbody>
          {styles.map((s) => (
            <tr key={s.name}>
              <td>
                {s.name}
                {s.used && <span className="muted" style={{ fontSize: 11 }}> · used</span>}
              </td>
              <td style={{ fontFamily: s.font ? `"${s.font}", var(--font)` : undefined }}>{s.font ?? "-"}</td>
              <td>{s.sizePt !== undefined ? `${s.sizePt} pt` : "-"}</td>
              <td>{[s.bold ? "bold" : "", s.italic ? "italic" : ""].filter(Boolean).join(", ") || "regular"}</td>
              <td>{s.color ? <Chip hex={s.color} /> : "-"}</td>
              <td className="muted">
                {spacing
                  ? [s.spaceBeforePt !== undefined ? `${s.spaceBeforePt} before` : "", s.spaceAfterPt !== undefined ? `${s.spaceAfterPt} after` : "", s.lineSpacing ?? "", s.align ?? ""].filter(Boolean).join(" · ") || "-"
                  : s.align ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
