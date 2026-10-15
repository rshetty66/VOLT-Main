---
name: credit-risk-modelling
description: Build and validate a probability-of-default model or application scorecard - target definition, WOE/IV binning, logistic regression, AUC/KS/Gini, calibration, cut-off selection, and a strategy table. Use for fitting or validating a PD model.
category: Financial Services
volt_desk: credit
disable-model-invocation: true
---

# Credit risk modelling — building the PD model

This skill is about **constructing and validating the model**: choosing a target, binning
features, fitting an estimator, measuring discrimination and calibration, and picking a
cut-off that a lending business can actually operate.

It is not the same job as two neighbouring skills — pick the right one:

| You want to | Skill |
|---|---|
| Judge one borrower: capacity, covenants, 5 Cs, a credit memo | `credit-analysis` |
| Compute an IFRS 9 / CECL provision from a PD, LGD, EAD you already have | `ecl-computation` |
| **Produce or validate the PD itself, or a scorecard** | this skill |

If someone asks "what is our provision", they want `ecl-computation` and this skill only
supplies the PD input. If they ask "is this PD model any good", they want this skill.

## The pipeline

Work in this order. Every step below it depends on the one above being settled, and
reopening step 1 late invalidates everything downstream.

### 1. Define the target and the outcome window

State three things in writing before touching data:

- **Bad definition** — e.g. 90+ days past due, or charge-off, or bankruptcy. "Default" is
  not self-evident; two teams will pick differently.
- **Outcome window** — over what horizon is bad observed? 12 months is the common
  application-scorecard choice and it is what an IFRS 9 12-month PD needs.
- **Observation point** — the moment the features are as-of. Everything the model sees must
  be knowable at that moment.

An `indeterminate` bucket (e.g. 30–89 dpd) is usually excluded from training rather than
forced into good or bad. Say what you did with it.

### 2. Sample, exclusions, and the split

- Exclusions declared explicitly: staff accounts, fraud, accounts closed before the window
  matured, segments the model is not for.
- **Out-of-time** validation split, not just random. A random split flatters the model
  because it lets it learn the period it is scored on. Train on earlier vintages, validate
  on later ones.
- Keep a holdout you do not look at until the end. Choosing a cut-off on the same data you
  measured AUC on produces an optimistic number.

### 3. Leakage — the failure that looks like success

An AUC above ~0.90 on real retail credit data is nearly always leakage, not skill. Check:

- Any field updated *after* the observation point (current balance, collections flags,
  latest bureau refresh, "days since last payment").
- Post-hoc identifiers — an account status, a write-off amount, a recovery code.
- Target encoded into a feature by an upstream pipeline.

Trace each feature to when its value was written. This check is not optional and it is not
the thing to simplify away — a leaked model passes every validation and fails in production.

### 4. Feature preparation — WOE and IV

Weight of evidence per bin, computed on the training split only:

```text
WOE_i = ln( (bads_i / total_bads) / (goods_i / total_goods) )
IV    = Σ_i ( bads_i/total_bads − goods_i/total_goods ) × WOE_i
```

Conventional IV reading — treat as a triage aid, not a rule:

| IV | Read as |
|---|---|
| < 0.02 | no predictive value; drop |
| 0.02 – 0.1 | weak |
| 0.1 – 0.3 | medium |
| 0.3 – 0.5 | strong |
| > 0.5 | suspiciously strong — go back to step 3 |

Binning rules that matter: each bin holds at least ~5% of the sample and at least a handful
of bads; WOE should be monotonic against risk for any ordered feature (if it is not, merge
bins rather than shipping a zig-zag the business cannot explain); missing is its own bin,
never imputed to the mean, because "missing" is usually informative.

Add a small constant (or merge the bin) when a bin has zero bads or zero goods — the log is
otherwise undefined and a silent `inf` propagates into the fit.

### 5. Fit — logistic first

Start with logistic regression on WOE-transformed features. It is monotonic, the
coefficients are inspectable, it maps directly to a points-based scorecard, and it is what a
model-risk reviewer expects to see as the baseline.

Then drop correlated features (|ρ| > ~0.7, or VIF > 5) — with WOE inputs, collinearity
flips coefficient signs and destroys the explanation, even when AUC barely moves.

A gradient-boosted challenger (`sklearn.ensemble.HistGradientBoostingClassifier`, already
available — no new dependency) is worth fitting to measure how much signal the linear form
gives up. If the challenger wins by a wide margin, that is evidence of an interaction the
scorecard is missing; go add it as a feature rather than shipping the black box by default.

**Class imbalance:** bad rates of 1–5% are normal and are not a bug to fix. Do not oversample
or SMOTE by reflex — it distorts the predicted probabilities, which is exactly what you need
to be correct. Use `class_weight="balanced"` if you need better separation, and then
recalibrate before believing any PD.

### 6. Discrimination — can it rank?

- **AUC / ROC** — probability a random bad scores worse than a random good.
- **Gini** = 2·AUC − 1. What credit teams usually quote.
- **KS** — maximum gap between the cumulative good and bad distributions.

Rough field expectations for retail application scorecards: Gini 0.35–0.55, KS 0.25–0.40.
Report train and out-of-time side by side; a large gap is overfitting.

### 7. Calibration — is the number a probability?

Discrimination and calibration are independent. A model can rank perfectly and still be
wrong about the level, and every downstream use — pricing, expected loss, IFRS 9 — needs
the level.

Bucket predictions into deciles and compare mean predicted PD against observed bad rate in
each. They should track. If the whole curve is shifted, recalibrate (adjust the intercept
to the true portfolio bad rate); if it is twisted, the model is wrong, not miscalibrated.

Any resampling in step 5 guarantees a shifted curve.

### 8. Cut-off — a business decision with a default

**Youden's J** picks the threshold maximising `TPR − FPR` — the point on the ROC furthest
from the diagonal. It is the right default *only when a false accept and a false reject cost
the same*, which in lending they never do.

Prefer a cost-based threshold when you can get the two numbers:

```text
choose t minimising:  FN(t) × cost_of_a_bad_loan  +  FP(t) × margin_lost_on_a_good_loan
```

Present a **strategy table** rather than one number, because this is the artefact a lending
committee actually decides from:

| Cut-off score | Approval rate | Expected bad rate | Expected loss | Volume kept |
|---|---|---|---|---|

State the approval rate for each candidate. A model that only works at a 20% approval rate
is not usable for a business that needs 60%.

### 9. Scorecard scaling (if the output is points)

Points are an affine transform of the log-odds, fixed by a chosen reference odds at a
reference score and a **PDO** (points to double the odds), commonly 20:

```text
factor = PDO / ln(2)
offset = target_score − factor × ln(target_odds)
score  = offset + factor × ln(odds)
```

Scaling changes nothing about the model's power. Do not tune PDO to make numbers look
better; pick it once and record it.

### 10. Expected loss

```text
EL = PD × LGD × EAD
```

The PD from this model is one of three inputs. LGD and EAD are separate estimation problems
— do not quietly assume LGD = 45% and present the EL as a modelled figure. Say which inputs
are modelled and which are assumed, with the assumed values written down.

### 11. Documentation and monitoring

Every model ships with: the bad definition and window, exclusions, the feature list with IV
and coefficient signs, train/out-of-time performance, the calibration table, the chosen
cut-off with its rationale, and known limitations.

Ongoing monitoring, at least: **PSI** on the score distribution (> 0.25 means the population
has moved), feature-level drift, actual vs expected bad rate by vintage, and override rates.

## Fairness and regulatory constraints

Protected characteristics (and close proxies — postcode, and anything strongly correlated
with one) do not belong in a credit model, in most jurisdictions as a matter of law rather
than taste. Adverse-action reasoning also has to be explainable to the applicant, which is a
strong argument for the logistic scorecard over the boosted challenger.

Flag any feature you suspect is a proxy rather than dropping it silently — the decision
belongs to the model-risk function, and it needs to know you saw it.

## Reject inference

An application scorecard trained only on accepted applicants is fitted on a censored
sample: you never observed how rejects would have performed. If the through-the-door
population differs materially from the accepted one, say so explicitly and treat the
model's performance on rejects as unknown. Parcelling or augmentation are the usual
treatments, and both are assumptions — label them as such.

## In this codebase

- **No live market or bureau data is connected.** Anything that needs a spread, a rating
  transition, or a bureau attribute must state the input as missing rather than invent a
  value. See the research-desk evidence gate.
- Charts follow `recharts-chart` — an ROC curve is a `line` chart, a strategy table is a
  table, and score-band bad rates are a `bar` chart.
- A model choice worth arguing about (estimator family, bad definition, cut-off policy)
  gets an `adr`. The pipeline itself gets an `rfc` before it is built.

Worked scaffold: [`references/pd_model_scaffold.py`](references/pd_model_scaffold.py) —
runnable end to end on synthetic data, using only `pandas` and `scikit-learn`, both already
in `requirements.txt`.

## Checklist

- [ ] Bad definition, outcome window, and observation point written down
- [ ] Exclusions declared; out-of-time split, not just random
- [ ] Every feature traced to a value knowable at the observation point (leakage check)
- [ ] WOE monotonic per ordered feature; missing is its own bin; no zero-count bins
- [ ] Logistic baseline fitted; correlated features dropped
- [ ] Discrimination reported train **and** out-of-time
- [ ] Calibration table: predicted vs observed by decile
- [ ] Cut-off justified — cost-based, or Youden's J with the equal-cost assumption stated
- [ ] Strategy table with approval rates, not a single threshold
- [ ] Assumed vs modelled inputs separated in any expected-loss figure
- [ ] Proxy-variable concerns flagged, not silently resolved
- [ ] Monitoring plan: PSI, drift, actual vs expected
