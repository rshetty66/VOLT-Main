import { useEffect, useState } from "react";
import type { BudgetStatus, Estimate } from "../../shared/records";
import { getEstimate } from "../api";
import { usd } from "../money";

/**
 * One line before a live run: what it is likely to cost, and what is left of the person's budget.
 * `refresh` re-fetches when it changes, e.g. after a run finishes.
 */
export function CostEstimate({
  live,
  workflowId,
  agentId,
  refresh,
  onBlocked,
}: {
  live: boolean;
  workflowId?: string;
  agentId?: string;
  refresh?: unknown;
  /** Told whether the person's monthly budget is used up, so the caller can disable its Run button. */
  onBlocked?: (blocked: boolean) => void;
}) {
  const [data, setData] = useState<{ estimate: Estimate; budget: BudgetStatus } | null>(null);
  const blocked = !!data && data.budget.monthlyBudgetUsd > 0 && data.budget.monthRemainingUsd === 0;
  useEffect(() => onBlocked?.(blocked), [blocked, onBlocked]);
  useEffect(() => {
    if (!live) return;
    let current = true;
    getEstimate({ workflowId, agentId }).then(
      (d) => current && setData(d),
      () => current && setData(null),
    );
    return () => {
      current = false;
    };
  }, [live, workflowId, agentId, refresh]);
  if (!live || !data) return null;
  const { estimate: e, budget: b } = data;
  const used = b.monthlyBudgetUsd > 0 && b.monthRemainingUsd === 0;
  const tight = !used && b.monthRemainingUsd !== null && b.monthRemainingUsd < e.high;
  return (
    <span className={`cost-line ${used ? "error" : tight ? "warn" : ""}`} data-testid="cost-estimate">
      <span title={e.basis === "history" ? `Median of the last ${e.runs} finished run(s) like this one` : "From typical token counts; becomes the median of real runs once there are some"}>
        Estimated {usd(e.usd)} <span className="muted">({usd(e.low)}–{usd(e.high)}{e.basis === "rough" ? ", rough" : `, ${e.runs} earlier run${e.runs === 1 ? "" : "s"}`})</span>
      </span>
      {b.monthlyBudgetUsd > 0 && (
        <span>
          {" · "}
          {used ? `Monthly budget of ${usd(b.monthlyBudgetUsd)} used: an admin can raise it under Usage, or switch on demo` : `${usd(b.monthRemainingUsd)} of ${usd(b.monthlyBudgetUsd)} left this month`}
        </span>
      )}
      {b.runBudgetUsd > 0 && <span className="muted"> · stops at {usd(b.runBudgetUsd)}</span>}
    </span>
  );
}
