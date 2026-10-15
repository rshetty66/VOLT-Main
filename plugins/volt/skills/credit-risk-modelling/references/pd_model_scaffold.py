"""PD model scaffold — WOE binning, logistic fit, discrimination, calibration, cut-off.

Runnable end to end on synthetic data with only pandas + scikit-learn (both already
in requirements.txt):

    python skills/credit-risk-modelling/references/pd_model_scaffold.py

Replace `synthetic_portfolio()` with a real loader and keep the rest. The point of the
file is the *order* of the steps and the checks between them, not the toy data.

Sign convention throughout: WOE is ln(bad_share / good_share), so **higher WOE means
higher risk**. Some textbooks use the inverse. Pick one and say which.
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, roc_curve

logger = logging.getLogger("pd_model")

FEATURES = ["utilization", "delinquencies", "income", "age"]
OOT_FROM_MONTH = 18  # vintages >= this month are the out-of-time validation set


# ── 0. Data ──────────────────────────────────────────────────────────────────

def synthetic_portfolio(n: int = 8000, seed: int = 7) -> pd.DataFrame:
    """A portfolio with a real but modest signal and a ~15% bad rate.

    Real retail books run 1-5% bad. Lower the intercept to get there, and note that the
    thinner the bad class, the more the calibration step matters.
    """
    rng = np.random.default_rng(seed)
    df = pd.DataFrame(
        {
            "utilization": rng.beta(2, 5, n),
            "delinquencies": rng.poisson(0.35, n),
            "income": rng.lognormal(10.8, 0.5, n),
            "age": rng.normal(42, 12, n).clip(19, 85),
            "vintage_month": rng.integers(0, 24, n),
        }
    )
    # Missing income for some applicants — kept as a bin, never imputed.
    df.loc[rng.random(n) < 0.07, "income"] = np.nan

    income_z = (np.log(df["income"].fillna(df["income"].median())) - 10.8) / 0.5
    logit = (
        -3.1
        + 2.6 * df["utilization"]
        + 0.85 * df["delinquencies"]
        - 0.75 * income_z
        - 0.02 * (df["age"] - 42)
        + 0.25 * df["income"].isna()  # missingness itself carries risk
    )
    df["bad"] = rng.binomial(1, 1 / (1 + np.exp(-logit)))
    return df


# ── 1. WOE binning ───────────────────────────────────────────────────────────

class WOEBinner:
    """Quantile bins + WOE per bin, fitted on train only.

    ponytail: fixed quantile bins with no monotonicity enforcement. Ceiling is that a
    non-monotonic feature ships as a zig-zag; upgrade to a monotonic optimal binner
    (merge adjacent bins while the WOE order violates risk order) before production.
    """

    def __init__(self, n_bins: int = 5, smoothing: float = 0.5) -> None:
        self.n_bins = n_bins
        self.smoothing = smoothing
        self.edges_: dict[str, np.ndarray] = {}
        self.woe_: dict[str, dict[str, float]] = {}
        self.iv_: dict[str, float] = {}

    @staticmethod
    def _label(s: pd.Series, edges: np.ndarray) -> pd.Series:
        binned = pd.cut(s, bins=edges, include_lowest=True)
        # True NaN becomes its own bin. Edges are ±inf so out-of-range never lands here.
        return binned.astype("object").where(binned.notna(), "MISSING").astype(str)

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "WOEBinner":
        total_bad = float(y.sum())
        total_good = float(len(y) - y.sum())
        if total_bad == 0 or total_good == 0:
            raise ValueError("Training sample has only one class — cannot compute WOE.")

        for col in X.columns:
            q = np.linspace(0, 1, self.n_bins + 1)
            edges = np.unique(np.nanquantile(X[col].astype(float), q))
            if len(edges) < 3:
                raise ValueError(f"{col!r} has too few distinct values to bin.")
            edges[0], edges[-1] = -np.inf, np.inf
            self.edges_[col] = edges

            bins = self._label(X[col], edges)
            tab = pd.crosstab(bins, y).reindex(columns=[0, 1], fill_value=0)
            # Smoothing keeps ln() finite when a bin has no bads or no goods. A bin that
            # needs smoothing is usually a bin that should have been merged.
            bad_share = (tab[1] + self.smoothing) / (total_bad + self.smoothing * len(tab))
            good_share = (tab[0] + self.smoothing) / (total_good + self.smoothing * len(tab))
            woe = np.log(bad_share / good_share)

            self.woe_[col] = woe.to_dict()
            self.iv_[col] = float(((bad_share - good_share) * woe).sum())
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        out = {}
        for col, edges in self.edges_.items():
            bins = self._label(X[col], edges)
            mapped = bins.map(self.woe_[col])
            if mapped.isna().any():
                # A bin unseen in training scores neutral rather than crashing the batch.
                logger.warning("%s: %d rows in an unseen bin, scored WOE 0", col, int(mapped.isna().sum()))
                mapped = mapped.fillna(0.0)
            out[f"woe_{col}"] = mapped.astype(float)
        return pd.DataFrame(out, index=X.index)

    def iv_table(self) -> pd.DataFrame:
        return (
            pd.Series(self.iv_, name="iv")
            .sort_values(ascending=False)
            .to_frame()
            .assign(strength=lambda d: pd.cut(
                d["iv"],
                bins=[-np.inf, 0.02, 0.1, 0.3, 0.5, np.inf],
                labels=["drop", "weak", "medium", "strong", "check for leakage"],
            ))
        )


# ── 2-3. Metrics ─────────────────────────────────────────────────────────────

def discrimination(y: pd.Series, p: np.ndarray) -> dict[str, float]:
    auc = float(roc_auc_score(y, p))
    fpr, tpr, thresholds = roc_curve(y, p)
    j = tpr - fpr
    return {
        "auc": auc,
        "gini": 2 * auc - 1,
        # KS is the same statistic as Youden's J at its maximum.
        "ks": float(j.max()),
        "youden_threshold": float(thresholds[int(j.argmax())]),
    }


def calibration_table(y: pd.Series, p: np.ndarray, n_groups: int = 10) -> pd.DataFrame:
    """Predicted vs observed by score decile. These columns should track each other."""
    df = pd.DataFrame({"y": y.to_numpy(), "p": p})
    df["group"] = pd.qcut(df["p"], n_groups, labels=False, duplicates="drop")
    return (
        df.groupby("group")
        .agg(n=("y", "size"), predicted=("p", "mean"), observed=("y", "mean"))
        .assign(gap=lambda d: d["observed"] - d["predicted"])
    )


def strategy_table(
    p: np.ndarray,
    y: pd.Series,
    approval_rates: tuple[float, ...] = (0.9, 0.8, 0.7, 0.6, 0.5),
    lgd: float = 0.45,      # ASSUMED, not modelled — see the skill's expected-loss note
    ead: float = 15_000.0,  # ASSUMED
) -> pd.DataFrame:
    """What a lending committee decides from: the trade-off, not one threshold."""
    rows = []
    for rate in approval_rates:
        cut = float(np.quantile(p, rate))
        approved = p <= cut
        if not approved.any():
            continue
        rows.append(
            {
                "approval_rate": rate,
                "pd_cutoff": cut,
                "n_approved": int(approved.sum()),
                "observed_bad_rate": float(y.to_numpy()[approved].mean()),
                "expected_bad_rate": float(p[approved].mean()),
                "expected_loss_per_account": float(p[approved].mean() * lgd * ead),
            }
        )
    return pd.DataFrame(rows)


# ── Pipeline ─────────────────────────────────────────────────────────────────

def main() -> None:
    df = synthetic_portfolio()

    # Out-of-time split. A random split flatters the model.
    train = df[df["vintage_month"] < OOT_FROM_MONTH]
    oot = df[df["vintage_month"] >= OOT_FROM_MONTH]
    print(f"train={len(train)} bad_rate={train['bad'].mean():.3%}  "
          f"oot={len(oot)} bad_rate={oot['bad'].mean():.3%}")

    binner = WOEBinner().fit(train[FEATURES], train["bad"])
    print("\nIV:\n", binner.iv_table())

    Xtr, Xoot = binner.transform(train[FEATURES]), binner.transform(oot[FEATURES])

    # Collinearity check before trusting any coefficient sign.
    corr = Xtr.corr().abs()
    high = [(a, b, round(corr.loc[a, b], 2))
            for i, a in enumerate(corr.columns) for b in corr.columns[i + 1:]
            if corr.loc[a, b] > 0.7]
    if high:
        print("\nCorrelated WOE features (drop one of each pair):", high)

    model = LogisticRegression(max_iter=1000).fit(Xtr, train["bad"])
    coefs = pd.Series(model.coef_[0], index=Xtr.columns).sort_values(ascending=False)
    # Every coefficient should be positive: higher WOE means higher risk. A negative one
    # means collinearity has flipped a sign, and the scorecard is no longer explainable.
    print("\nCoefficients (all should be > 0):\n", coefs.round(3))

    p_tr = model.predict_proba(Xtr)[:, 1]
    p_oot = model.predict_proba(Xoot)[:, 1]

    m_tr = discrimination(train["bad"], p_tr)
    m_oot = discrimination(oot["bad"], p_oot)
    print(f"\ntrain  AUC={m_tr['auc']:.3f} Gini={m_tr['gini']:.3f} KS={m_tr['ks']:.3f}")
    print(f"oot    AUC={m_oot['auc']:.3f} Gini={m_oot['gini']:.3f} KS={m_oot['ks']:.3f}")
    print(f"train-oot AUC gap={m_tr['auc'] - m_oot['auc']:+.3f} (a large gap is overfitting)")

    print("\nCalibration (out-of-time):\n", calibration_table(oot["bad"], p_oot).round(4))
    print(f"\nYouden's J cut-off (equal-cost assumption): PD={m_oot['youden_threshold']:.4f}")
    print("\nStrategy table (out-of-time):\n", strategy_table(p_oot, oot["bad"]).round(4))

    # ── One runnable check: the pipeline is wired correctly and honest. ──
    assert 0.60 < m_oot["auc"] < 0.90, f"OOT AUC {m_oot['auc']:.3f} — below 0.60 is no signal, above 0.90 is leakage"
    assert (coefs > 0).all(), f"negative WOE coefficient — collinearity flipped a sign:\n{coefs}"
    assert abs(p_oot.mean() - oot["bad"].mean()) < 0.02, "predicted level is off the observed bad rate — recalibrate"
    assert binner.iv_["utilization"] > 0.02, "utilization lost its signal — binning is broken"
    print("\nOK: discrimination, coefficient signs, calibration level, and IV all sane.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    main()
