import { useEffect, useState, type ReactNode } from "react";
import type { CellStyle, TemplateKind, TemplateProfile, TextStyle } from "../../shared/template-profile";
import { getTemplateFormatting, templateSourceUrl } from "../api";
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

/** What was extracted from an imported template's Office file: theme, styles, page setup, layouts, cell formats. */
export function TemplateFormatting({ id }: { id: string }) {
  const [f, setF] = useState<{ guide: string; profile: Omit<TemplateProfile, "guide"> } | null>(null);
  const [err, setErr] = useState("");
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    getTemplateFormatting(id).then(setF, (e) => setErr(String(e)));
  }, [id]);

  if (err) return <div className="card">{err}</div>;
  if (!f) return <div className="empty"><span className="spinner" /> Loading the extracted formatting...</div>;
  const p = { ...f.profile, guide: f.guide };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="micro">Extracted from {KIND_LABEL[p.kind]} file</div>
          <b>{p.fileName}</b>
        </div>
        <div className="row">
          <button className="btn sm" onClick={() => setShowGuide((x) => !x)}>
            {showGuide ? "Hide" : "Show"} formatting guide
          </button>
          <a className="btn sm" style={{ textDecoration: "none" }} href={templateSourceUrl(id)} download>
            Download original
          </a>
        </div>
      </div>

      {showGuide && (
        <div className="card">
          <div className="micro" style={{ marginBottom: 8 }}>
            Formatting guide given to agents on engagements that use this template
          </div>
          <Markdown text={p.guide} />
        </div>
      )}

      {p.warnings.length > 0 && (
        <div className="card body" style={{ fontSize: 13 }}>
          {p.warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
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
