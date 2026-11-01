import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getJSON } from "../../api";
import { Markdown } from "../Markdown";
import { SAMPLE_CSV, evidenceMarkdown, mappingFromCsv, runStatus, sumUsage, type JournalDoc, type MappingCsv, type Report, type UsageEvent } from "../../workbench/logic";
import { ChatPanel, type WorkbenchBridge } from "./ChatPanel";
import { EvidencePack } from "./EvidencePack";
import { JournalSimulator } from "./JournalSimulator";
import { MappingProver } from "./MappingProver";
import type { Allowance } from "./ReportView";

interface Demo {
  journal: JournalDoc;
  lifecycle: string;
  allowance: Allowance;
}

type StepId = "intake" | "events" | "journal" | "mapping" | "crosswalk" | "evidence";
const STEPS: { id: StepId; label: string; phase: number; model: boolean }[] = [
  { id: "intake", label: "Intake", phase: 3, model: true },
  { id: "events", label: "Event designer", phase: 3, model: true },
  { id: "journal", label: "Journal simulator", phase: 2, model: false },
  { id: "mapping", label: "Mapping prover", phase: 2, model: false },
  { id: "crosswalk", label: "Crosswalk", phase: 4, model: true },
  { id: "evidence", label: "Evidence pack", phase: 2, model: false },
];

const CHIP: Record<string, string> = { NOT_RUN: "", PARTIAL: "partial", BLOCKED: "fail", VALIDATED_SCOPED: "full" };

async function validate(kind: "journal" | "mapping", document: unknown): Promise<Report> {
  const r = await fetch("/api/finance-architecture/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, document }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error ?? `Validation failed (${r.status})`);
  return body as Report;
}

/** Finance Architecture Workbench (UX phases 1 and 2) over the design-finance-architecture skill. */
export function Workbench({ live }: { live: boolean }) {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [step, setStep] = useState<StepId>("journal");
  const [journal, setJournal] = useState<JournalDoc | null>(null);
  const [csv, setCsv] = useState<MappingCsv>(SAMPLE_CSV);
  const [journalReport, setJournalReport] = useState<Report>();
  const [mappingReport, setMappingReport] = useState<Report>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<UsageEvent[]>([]);
  const [validatorRuns, setValidatorRuns] = useState(0);
  const [preparedBy, setPreparedBy] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");

  useEffect(() => {
    getJSON<Demo>("/api/finance-architecture/demo").then(
      (d) => { setDemo(d); setJournal(structuredClone(d.journal)); },
      (e) => setError(String(e)),
    );
  }, []);

  const mapping = useMemo(() => mappingFromCsv(journal?.tenant_id ?? "SYNTHETIC", csv), [csv, journal?.tenant_id]);
  const status = runStatus(journalReport, mappingReport);
  const evidence = evidenceMarkdown({ journal: journalReport, mapping: mappingReport, preparedBy, reviewedBy, generatedAt: new Date().toISOString().slice(0, 19) + "Z" });
  const meter = sumUsage(usage);

  const run = useCallback(
    async (kind: "journal" | "mapping") => {
      setBusy(true);
      setError("");
      try {
        const r = await validate(kind, kind === "journal" ? journal : mapping.document);
        (kind === "journal" ? setJournalReport : setMappingReport)(r);
        setValidatorRuns((n) => n + 1);
        return r;
      } catch (e) {
        setError(String(e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [journal, mapping.document],
  );

  // Edits invalidate the last proof, so the status chip never shows a stale pass.
  const editJournal = (d: JournalDoc) => { setJournal(d); setJournalReport(undefined); };
  const editCsv = (c: MappingCsv) => { setCsv(c); setMappingReport(undefined); };

  const bridge = useRef<WorkbenchBridge | null>(null);
  bridge.current = {
    validate: run,
    evidence: () => evidence,
    context: () =>
      `run status ${status}; ${journal?.lines.length ?? 0} journal lines in ${new Set(journal?.lines.map((l) => l.journal_id)).size} journals; ` +
      `journal proof ${journalReport?.status ?? "not run"}${journalReport?.blockers.length ? ` (${journalReport.blockers.join("; ")})` : ""}; ` +
      `mapping proof ${mappingReport?.status ?? "not run"}${mappingReport?.blockers.length ? ` (${mappingReport.blockers.join("; ")})` : ""}.`,
    onUsage: (u) => setUsage((xs) => [...xs, u]),
    demo: !live,
  };

  if (error && !demo) return <div className="empty">Could not load the workbench: {error}</div>;
  if (!demo || !journal) return <div className="empty"><span className="spinner" /> Loading workbench…</div>;

  const current = STEPS.find((s) => s.id === step)!;
  return (
    <div className="wb">
      <div className="wb-main stack">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="page-title">Finance Architecture Workbench</h1>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Synthetic Canadian residential mortgage, IFRS 9 with a US CECL overlay. Proofs run on the <code>design-finance-architecture</code> skill's
              validators. ILLUSTRATIVE_EXAMPLE: no postings, no approvals.
            </p>
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
              <span className="muted">Validator runs</span><b className="num">{validatorRuns} · 0 tokens</b>
            </div>
            <span className="muted" style={{ fontSize: 11 }}>{meter.calls ? `${meter.calls} model calls, measured` : "No model calls yet"}{live ? "" : " · demo mode"}</span>
          </div>
        </div>

        <ol className="stepper" aria-label="Workbench steps">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <button className={s.id === step ? "active" : ""} onClick={() => setStep(s.id)} aria-current={s.id === step ? "step" : undefined}>
                <span className="n">{i + 1}</span>
                <span>{s.label}</span>
                <span className={`badge ${s.model ? "" : "full"}`}>{s.model ? `phase ${s.phase}` : "0 tokens"}</span>
              </button>
            </li>
          ))}
        </ol>

        {error && <div className="card body">{error}</div>}

        {step === "journal" && (
          <JournalSimulator doc={journal} golden={demo.journal} setDoc={editJournal} report={journalReport} busy={busy} onValidate={() => run("journal").catch(() => {})} allowance={demo.allowance} />
        )}
        {step === "mapping" && <MappingProver csv={csv} setCsv={editCsv} errors={mapping.errors} report={mappingReport} busy={busy} onValidate={() => run("mapping").catch(() => {})} />}
        {step === "evidence" && <EvidencePack markdown={evidence} preparedBy={preparedBy} reviewedBy={reviewedBy} setPreparedBy={setPreparedBy} setReviewedBy={setReviewedBy} />}
        {current.model && (
          <div className="card stack">
            <div className="row">
              <div className="micro">{current.label}</div>
              <span className="badge partial">arrives in phase {current.phase}</span>
            </div>
            <p className="body" style={{ fontSize: 13, margin: 0 }}>
              {step === "intake" && "Claude will draft the intake completeness matrix (required-for-phase, owner, blocker) for you to accept or edit. Until then, ask the assistant on the right."}
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
