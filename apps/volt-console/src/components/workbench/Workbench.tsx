import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getJSON } from "../../api";
import { Markdown } from "../Markdown";
import type { Figure } from "../../../shared/mortgageFigures";
import {
  SAMPLE_CSV, evidenceMarkdown, journalsFromFigures, mappingFromCsv, runStatus, sumUsage,
  type JournalDoc, type MappingCsv, type Report, type UsageEvent,
} from "../../workbench/logic";
import { ChatPanel, type WorkbenchBridge } from "./ChatPanel";
import { DerivedJournals } from "./DerivedJournals";
import { EvidencePack } from "./EvidencePack";
import { JournalSimulator } from "./JournalSimulator";
import { MappingProver } from "./MappingProver";
import type { Allowance } from "./ReportView";
import { SourcesStep, type Candidate, type Meta, type SourceSummary } from "./SourcesStep";

interface Demo {
  journal: JournalDoc;
  lifecycle: string;
  allowance: Allowance;
}

export type StepId = "sources" | "events" | "journal" | "mapping" | "crosswalk" | "evidence";
export const STEPS: { id: StepId; label: string; badge: string; zero: boolean }[] = [
  { id: "sources", label: "Sources", badge: "web + check", zero: false },
  { id: "events", label: "Event designer", badge: "phase 3", zero: false },
  { id: "journal", label: "Journal simulator", badge: "0 tokens", zero: true },
  { id: "mapping", label: "Mapping prover", badge: "0 tokens", zero: true },
  { id: "crosswalk", label: "Crosswalk", badge: "phase 4", zero: false },
  { id: "evidence", label: "Evidence pack", badge: "0 tokens", zero: true },
];

const CHIP: Record<string, string> = { NOT_RUN: "", PARTIAL: "partial", BLOCKED: "fail", VALIDATED_SCOPED: "full" };
const EMPTY_CSV: MappingCsv = { legacy: "", mapping: "", target: "" };
const EMPTY_META: Meta = { issuer: "", period_end: "", currency: "CAD", scale: "millions", basis: "IFRS" };

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? `${url} failed (${r.status})`);
  return data as T;
}
const validate = (kind: "journal" | "mapping", document: unknown) => post<Report>("/api/finance-architecture/validate", { kind, document });

/** Everything the workbench exposes to assistants (assistant-ui panel and the CopilotKit layer). */
export interface WorkbenchApi extends WorkbenchBridge {
  goTo: (step: StepId) => void;
  find: (issuer: string, period: string) => Promise<Candidate[]>;
  extract: (target: { url?: string; sourceId?: string }) => Promise<Report>;
  checkFigures: () => Promise<Report>;
  confirm: (ids: string[]) => void;
  state: () => Record<string, unknown>;
}

/** Finance Architecture Workbench over the design-finance-architecture skill. Real documents first. */
export function Workbench({ live, onApi }: { live: boolean; onApi?: (api: WorkbenchApi) => void }) {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [dataMode, setDataMode] = useState<"real" | "illustrative">("real");
  const [step, setStep] = useState<StepId>("sources");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  // Sources
  const [source, setSource] = useState<SourceSummary>();
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [meta, setMeta] = useState<Meta>(EMPTY_META);
  const [figures, setFigures] = useState<Figure[]>([]);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [extractionReport, setExtractionReport] = useState<Report>();
  // Proofs
  const [illustrativeJournal, setIllustrativeJournal] = useState<JournalDoc | null>(null);
  const [approvedBy, setApprovedBy] = useState("");
  const [csv, setCsv] = useState<MappingCsv>(EMPTY_CSV);
  const [journalReport, setJournalReport] = useState<Report>();
  const [mappingReport, setMappingReport] = useState<Report>();
  const [usage, setUsage] = useState<UsageEvent[]>([]);
  const [validatorRuns, setValidatorRuns] = useState(0);
  const [preparedBy, setPreparedBy] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");

  useEffect(() => {
    getJSON<Demo>("/api/finance-architecture/demo").then(setDemo, (e) => setError(String(e)));
  }, []);

  const real = dataMode === "real";
  // Figures carry the review-table metadata, so edits to scale, currency or period apply to every figure.
  const stamped = useMemo(() => figures.map((f) => ({ ...f, scale: meta.scale, currency: meta.currency, period: meta.period_end })), [figures, meta]);
  const derived = useMemo(
    () => journalsFromFigures(stamped, confirmed, { sourceSha: source?.sha256 ?? "", entity: (meta.issuer || "ISSUER").toUpperCase().replace(/[^A-Z0-9]+/g, "-"), basis: meta.basis || "IFRS", approvedBy }),
    [stamped, confirmed, source, meta, approvedBy],
  );
  const journal = real ? derived.doc : illustrativeJournal;
  const mapping = useMemo(() => mappingFromCsv("WORKBENCH", csv), [csv]);
  const status = real ? runStatus(extractionReport, journalReport, mappingReport) : runStatus(journalReport, mappingReport);
  const evidence = evidenceMarkdown({
    dataMode, extraction: extractionReport, journal: journalReport, mapping: mappingReport, preparedBy, reviewedBy,
    generatedAt: new Date().toISOString().slice(0, 19) + "Z",
    sources: sources.map((s) => ({ title: s.title, url: s.url, retrievedAt: s.retrievedAt, sha256: s.sha256, evidenceClass: s.evidenceClass })),
    figures: stamped.map((f) => ({ id: f.id, label: f.label, value: f.value, scale: f.scale, currency: f.currency, page: f.page, quote: f.quote, confirmed: confirmed.has(f.id) })),
  });
  const meter = sumUsage(usage);

  const guard = useCallback(async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
    setBusy(label);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setBusy("");
    }
  }, []);

  const adoptSource = (s: SourceSummary) => {
    setSource(s);
    setSources((xs) => [...xs.filter((x) => x.id !== s.id), s]);
  };
  const resetProofs = () => { setExtractionReport(undefined); setJournalReport(undefined); };

  const find = (issuer: string, period: string) =>
    guard("find", async () => {
      const r = await post<{ candidates: Candidate[]; usage: UsageEvent }>("/api/finance-architecture/sources/find", { issuer, period });
      setCandidates(r.candidates);
      setUsage((u) => [...u, r.usage]);
      setMeta((m) => ({ ...m, issuer: m.issuer || issuer }));
      return r.candidates;
    });
  const extract = (target: { url?: string; sourceId?: string }) =>
    guard("extract", async () => {
      const r = await post<{ source: SourceSummary; meta: Meta & { statement_reference: string }; figures: Figure[]; report: Report; usage: UsageEvent }>(
        "/api/finance-architecture/sources/extract", target);
      adoptSource(r.source);
      setMeta({ issuer: r.meta.issuer, period_end: r.meta.period_end, currency: r.meta.currency, scale: r.meta.scale, basis: r.meta.basis });
      setFigures(r.figures);
      setConfirmed(new Set());
      setExtractionReport(r.report);
      setJournalReport(undefined);
      setUsage((u) => [...u, r.usage]);
      setValidatorRuns((n) => n + 1);
      return r.report;
    });
  const upload = (file: File) =>
    guard("upload", async () => {
      const r = await fetch("/api/finance-architecture/sources/upload", { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) }, body: file });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? `Upload failed (${r.status})`);
      adoptSource(data as SourceSummary);
      setFigures([]);
      setConfirmed(new Set());
      resetProofs();
    }).catch(() => {});
  const checkFigures = () =>
    guard("verify", async () => {
      if (!source) throw new Error("Choose or upload a source document first.");
      const r = await post<Report>("/api/finance-architecture/sources/verify", { sourceId: source.id, figures: stamped });
      setExtractionReport(r);
      setValidatorRuns((n) => n + 1);
      return r;
    });
  const run = (kind: "journal" | "mapping") =>
    guard(kind, async () => {
      if (kind === "journal" && !journal) throw new Error("No journal to validate yet: confirm the movement figures on the Sources step.");
      const r = await validate(kind, kind === "journal" ? journal : mapping.document);
      (kind === "journal" ? setJournalReport : setMappingReport)(r);
      setValidatorRuns((n) => n + 1);
      return r;
    });

  const useIllustrative = () => {
    if (!demo) return;
    setDataMode("illustrative");
    setIllustrativeJournal(structuredClone(demo.journal));
    setCsv(SAMPLE_CSV);
    setJournalReport(undefined);
    setMappingReport(undefined);
    setStep("journal");
  };
  const useReal = () => {
    setDataMode("real");
    setCsv(EMPTY_CSV);
    setJournalReport(undefined);
    setMappingReport(undefined);
    setStep("sources");
  };
  const confirmIds = (ids: string[]) => {
    setConfirmed((c) => new Set([...c, ...ids.filter((id) => figures.some((f) => f.id === id))]));
    setJournalReport(undefined);
  };

  const api: WorkbenchApi = {
    validate: run,
    evidence: () => evidence,
    context: () =>
      `data ${dataMode}; run status ${status}; source ${source ? `${source.title} (${source.evidenceClass})` : "none"}; ` +
      `${figures.length} figures, ${confirmed.size} confirmed; extraction check ${extractionReport?.status ?? "not run"}; ` +
      `journal proof ${journalReport?.status ?? "not run"}; mapping proof ${mappingReport?.status ?? "not run"}.`,
    onUsage: (u) => setUsage((xs) => [...xs, u]),
    demo: !live,
    goTo: setStep,
    find,
    extract,
    checkFigures,
    confirm: confirmIds,
    state: () => ({
      dataMode, step, runStatus: status, meta, source: source ?? null, candidates,
      figures: stamped.map((f) => ({ ...f, confirmed: confirmed.has(f.id) })),
      extractionBlockers: extractionReport?.blockers ?? [], journalBlocked: derived.blocked,
      journalProof: journalReport?.status ?? "not run", mappingProof: mappingReport?.status ?? "not run",
    }),
  };
  const bridge = useRef<WorkbenchBridge | null>(null);
  bridge.current = api;
  useEffect(() => { onApi?.(api); });

  if (error && !demo) return <div className="empty">Could not load the workbench: {error}</div>;
  if (!demo) return <div className="empty"><span className="spinner" /> Loading workbench…</div>;

  const current = STEPS.find((s) => s.id === step)!;
  return (
    <div className="wb">
      <div className="wb-main stack">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="page-title">Finance Architecture Workbench</h1>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              {real
                ? "Residential mortgages from real documents: a client's statements or an issuer's published filing, every figure checked against its page."
                : "ILLUSTRATIVE_EXAMPLE: synthetic Canadian residential mortgage, used because real data was stated as not available. No postings, no approvals."}
            </p>
            {!real && <button className="btn sm ghost" onClick={useReal}>Switch back to real data</button>}
          </div>
          <div className="wb-meter card" aria-label="Run status and token meter">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="micro">Run status</span>
              <span className={`badge ${CHIP[status]}`}>{status}</span>
            </div>
            <div className="meter-grid">
              <span className="muted">Model input</span><b className="num">{meter.input.toLocaleString()}</b>
              <span className="muted">Cache reads</span><b className="num">{meter.cacheRead.toLocaleString()}</b>
              <span className="muted">Model output</span><b className="num">{meter.output.toLocaleString()}</b>
              <span className="muted">Web searches / fetches</span><b className="num">{meter.webSearches} / {meter.webFetches}</b>
              <span className="muted">Validator runs</span><b className="num">{validatorRuns} · 0 tokens</b>
            </div>
            <span className="muted" style={{ fontSize: 11 }}>{meter.calls ? `${meter.calls} model calls, measured` : "No model calls yet"}{live ? "" : " · demo mode"} · {real ? "real data" : "illustrative data"}</span>
          </div>
        </div>

        <ol className="stepper" aria-label="Workbench steps">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <button className={s.id === step ? "active" : ""} onClick={() => setStep(s.id)} aria-current={s.id === step ? "step" : undefined}>
                <span className="n">{i + 1}</span>
                <span>{s.label}</span>
                <span className={`badge ${s.zero ? "full" : ""}`}>{s.badge}</span>
              </button>
            </li>
          ))}
        </ol>

        {error && <div className="card body" role="alert">{error}</div>}

        {step === "sources" && (
          <SourcesStep
            live={live} busy={busy} source={source} meta={meta}
            setMeta={(m) => { setMeta(m); resetProofs(); }}
            figures={figures}
            setFigures={(f) => { setFigures(f); resetProofs(); }}
            confirmed={confirmed}
            toggleConfirmed={(id) => { setConfirmed((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; }); setJournalReport(undefined); }}
            candidates={candidates} report={extractionReport}
            onFind={(i, p) => { find(i, p).catch(() => {}); }}
            onExtract={(t) => { extract(t).catch(() => {}); }}
            onUpload={upload}
            onVerify={() => { checkFigures().catch(() => {}); }}
            onIllustrative={useIllustrative}
          />
        )}
        {step === "journal" && (real
          ? <DerivedJournals doc={derived.doc} blocked={derived.blocked} approvedBy={approvedBy} setApprovedBy={(v) => { setApprovedBy(v); setJournalReport(undefined); }} report={journalReport} busy={busy === "journal"} onValidate={() => { run("journal").catch(() => {}); }} />
          : illustrativeJournal && <JournalSimulator doc={illustrativeJournal} golden={demo.journal} setDoc={(d) => { setIllustrativeJournal(d); setJournalReport(undefined); }} report={journalReport} busy={busy === "journal"} onValidate={() => { run("journal").catch(() => {}); }} allowance={demo.allowance} />)}
        {step === "mapping" && (
          <MappingProver csv={csv} setCsv={(c) => { setCsv(c); setMappingReport(undefined); }} errors={csv.legacy || csv.mapping || csv.target ? mapping.errors : []} report={mappingReport} busy={busy === "mapping"} onValidate={() => { run("mapping").catch(() => {}); }} allowSample={!real} />
        )}
        {step === "evidence" && <EvidencePack markdown={evidence} preparedBy={preparedBy} reviewedBy={reviewedBy} setPreparedBy={setPreparedBy} setReviewedBy={setReviewedBy} />}
        {(step === "events" || step === "crosswalk") && (
          <div className="card stack">
            <div className="row">
              <div className="micro">{current.label}</div>
              <span className="badge partial">arrives in {current.badge}</span>
            </div>
            <p className="body" style={{ fontSize: 13, margin: 0 }}>
              {step === "events" && "Claude will draft event-to-accounting rows for you to accept or edit, each with an evidence class. The reference lifecycle it works from is below."}
              {step === "crosswalk" && "The EPM and OSFI M4/E2/N3 crosswalk editor, with maker-checker sign-off, arrives in phase 4."}
            </p>
            {step === "events" && <Markdown text={demo.lifecycle} />}
          </div>
        )}
      </div>
      <aside className="wb-chat">
        <ChatPanel bridge={bridge} live={live} />
      </aside>
    </div>
  );
}
