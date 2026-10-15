# Cross-Function Entities: Finance, Risk and Treasury

Reference for `banking-data-model`. Use when scoping a shared data foundation — the
convergence patterns in `banking-tom-design/references/convergence-patterns.md` depend on
agreeing this table before any platform decision.

## The core claim

The three functions need **the same entities at the same grain** and differ almost entirely
in *attributes* and *measurement basis*. Where an institution has three data flows, it is
usually not because the entities differ — it is because each function added its own
attributes and nobody owned the union.

So the design question is never "whose model wins". It is: which attributes are shared,
which are function-specific, and who owns each.

## Entity-by-function requirement

`` required, `` useful, `—` not needed.

| Entity | Finance | Risk | Treasury | Shared grain |
|---|---|---|---|---|
| Party |  |  |  | One per legal person/entity |
| Contract / Account |  |  |  | One per financial contract |
| Position / Balance |  |  |  | Contract × date × ledger |
| Cashflow |  |  |  | Contract × date × flow type |
| Collateral |  |  |  | One per collateral item, linked many-to-many to Contract |
| Rating / PD-LGD |  |  | — | Party or Contract × date |
| Rate / Curve |  |  |  | Curve × tenor × date |
| Limit | — |  |  | Party or portfolio × limit type |
| Transaction / Event |  |  |  | One per business event |
| Journal |  | — |  | Event × ledger × account |
| Product |  |  |  | Reference, effective-dated |
| Organisation |  |  |  | Reference, two hierarchies |

Note where the `` columns line up: **Contract, Position, Cashflow, Rate and Product are
required by all three.** That set is the shared foundation, and it is most of the volume.
Collateral, Rating and Limit are Risk-led additions; Journal is Finance-only. Nothing here
justifies three separate contract extracts.

## Attribute overlap on the shared entities

### Contract

| Attribute group | Owner | Consumed by |
|---|---|---|
| Identifiers, product, party role, currency | Finance (books of record) | All |
| Contractual dates, rate basis, reset terms | Treasury | All |
| Status, stage/classification (IFRS 9) | Risk methodology, Finance sign-off | Finance, Risk |
| Origination channel, vintage | Business Finance | Risk, Business Finance |

### Position

| Attribute group | Owner | Consumed by |
|---|---|---|
| Principal, accrued interest | Finance | All |
| Amortised cost, EIR, carrying value | Finance | Finance, Risk |
| Provision / ECL | Risk calculates, Finance books | Finance, Risk |
| Exposure at default, RWA | Risk | Risk, Finance (capital) |
| Fair value, valuation source | Treasury / Finance | All |

The provision row is where convergence programmes actually stall. Risk owns the model,
Finance owns the number in the accounts, and both are right — so the data model must hold
the Risk-calculated value and the Finance-booked value as **distinct attributes on the same
Position**, with the difference explainable. Modelling one and deriving the other is the
error; it hides an approval step that regulators expect to see.

### Cashflow

| Attribute group | Owner | Consumed by |
|---|---|---|
| Contractual cashflows | Treasury | All |
| Expected cashflows (behavioural) | Risk | Treasury, Risk |
| Discounted values, FTP-adjusted | Treasury | Business Finance |

Contractual and expected cashflows are separate attribute sets on the same grain, not
separate entities. Institutions that split them lose the ability to explain the behavioural
adjustment.

## Measurement basis: the real divergence

Same contract, three legitimate bases. The model must support all three simultaneously
rather than pick one.

| Basis | Used for | Implication for the model |
|---|---|---|
| Accounting (IFRS 9 / local GAAP) | Financial statements | Requires ledger dimension and multi-GAAP capability |
| Regulatory (Basel / OSFI BCAR) | Capital and regulatory returns | Requires regulatory classification as a dimension, not a filter |
| Economic / management | FTP, profitability, ALM | Requires internal rate and allocation attributes |

If regulatory classification is implemented as a report filter rather than a stored
dimension, every return becomes a bespoke extract — the most common reason regulatory
reporting ends up outside the data foundation.

## Ownership model

Assign one owner per entity, not per attribute group, or nothing gets decided.

| Entity | Data owner | Rationale |
|---|---|---|
| Party, Product, Organisation, Chart of Accounts | Finance (with MDM governance) | Books of record; statutory mapping |
| Contract, Position, Journal, Event | Finance | Ties to the GL |
| Collateral, Rating, Limit | Risk | Risk methodology and models |
| Rate / Curve, Cashflow | Treasury | Market data and ALM |

Attribute-level disputes then escalate to the entity owner, which is a decidable rule.
Shared ownership of an entity is not.

## Assessment checklist

Before recommending a shared foundation, confirm:

1. **One definition of Contract** across the three functions. Facility vs drawn balance vs
   sub-account is the usual disagreement — resolve it in writing first.
2. **One definition of Position date.** Business date, booking date and value date are
   distinct; each function may currently mean a different one by "as at".
3. **Where adjustments live.** Post-extract spreadsheet adjustments must be inventoried;
   they are the residual that blocks tie-out.
4. **Whether regulatory classification is stored or derived.** Derived means it is not in
   the model yet.
5. **Reference-data mastering location.** If Risk and Finance master product hierarchies
   separately, that is the first remediation, ahead of any contract work.

## Cross-References

- **banking-data-model** — the parent skill and full entity catalog
- **banking-tom-design** — `references/convergence-patterns.md` for the four patterns this enables
- **master-data-management** — reference-data governance for the Product/Organisation rows
- **osfi-regulatory-expert** — regulatory classification and BCAR requirements
- **si-data-architect** — physical design and implementation sequencing
