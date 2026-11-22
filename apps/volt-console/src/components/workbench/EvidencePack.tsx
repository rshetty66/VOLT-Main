import { useState } from "react";
import { Markdown } from "../Markdown";
import { DownloadMenu } from "../DownloadMenu";

interface Props {
  markdown: string;
  preparedBy: string;
  reviewedBy: string;
  setPreparedBy: (v: string) => void;
  setReviewedBy: (v: string) => void;
}

/** Phase 2: copyable evidence pack built from the latest validator runs (0 model tokens). */
export function EvidencePack({ markdown, preparedBy, reviewedBy, setPreparedBy, setReviewedBy }: Props) {
  const [copied, setCopied] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied("Copied as Markdown.");
    } catch {
      setCopied("Copy was blocked by the browser. Select the text below and copy it.");
    }
  };
  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="micro">Evidence pack</div>
        <div className="row">
          {copied && <span className="muted" style={{ fontSize: 12 }}>{copied}</span>}
          <DownloadMenu formats={["docx", "xlsx", "md", "html"]} build={() => ({ title: "Finance architecture evidence pack", subtitle: "VOLT Finance Workbench, deterministic checks only", markdown: markdown.replace(/^# .*\n+/, "") })} />
          <button className="btn sm primary" onClick={copy}>Copy pack</button>
        </div>
      </div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <label className="row body" style={{ fontSize: 13 }} htmlFor="prepared-by">
          Prepared by (maker)
          <input id="prepared-by" className="input" style={{ width: 200 }} value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} />
        </label>
        <label className="row body" style={{ fontSize: 13 }} htmlFor="reviewed-by">
          Reviewed by (checker)
          <input id="reviewed-by" className="input" style={{ width: 200 }} value={reviewedBy} onChange={(e) => setReviewedBy(e.target.value)} />
        </label>
      </div>
      <p className="body" style={{ fontSize: 12, margin: 0 }}>
        Names are recorded as typed. The assistant can assemble the pack but never signs it off; approval and release happen outside this tool.
      </p>
      <div className="evidence">
        <Markdown text={markdown} />
      </div>
    </div>
  );
}
