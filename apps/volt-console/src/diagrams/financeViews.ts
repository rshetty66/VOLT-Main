import { SOLUTION_GROUPS, type FinanceModel } from "../../shared/financeReference";
import template from "./finance-views.html?raw";

/** The standalone, interactive HTML for a finance model: reference architecture, process taxonomy, business architecture. */
export function financeViewsHtml(model: FinanceModel): string {
  const title = model.title.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const data = JSON.stringify({ ...model, groups: SOLUTION_GROUPS }).replace(/</g, "\\u003c");
  return template.replaceAll("__TITLE__", () => title).replace("__MODEL__", () => data);
}
