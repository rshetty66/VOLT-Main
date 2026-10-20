# Oracle ERP Cloud — Procurement & Purchasing

Complete implementation reference for Oracle Cloud Procurement.

---

## Module Overview

| Aspect | Detail |
|--------|--------|
| **Full Name** | Oracle Procurement Cloud (Purchasing, Self-Service Procurement, Sourcing, Supplier Qualification) |
| **Purpose** | Requisitioning, PO management, sourcing, supplier qualification, contracts |
| **Key Users** | Buyers, procurement managers, requisitioners, category managers |
| **Typical Implementation** | 10-14 weeks |

---

## Procurement Process Flow

```
REQUISITION → APPROVAL → SOURCING/PO → RECEIPT → INVOICE MATCH → PAYMENT
     │            │           │            │            │              │
  Requester   Manager/     Buyer/       Warehouse    AP Team       Treasury
  (employee)  Delegated    System       (3-way)
              Authority    (Auto-PO)
```

---

## Key Modules

| Module | Purpose | Key Features |
|--------|---------|--------------|
| **Self-Service Procurement** | Employee shopping experience | Catalog, punchout, non-catalog requests |
| **Purchasing** | PO management and buyer workflows | PO creation, amendment, change orders |
| **Sourcing** | Competitive bidding and negotiations | RFQ, auction, award |
| **Supplier Qualification** | Supplier onboarding and compliance | Questionnaires, certifications, risk scoring |
| **Contracts** | Agreement management | Blanket agreements, contract terms, pricing |

---

## Requisition Processing

### Requisition Types

| Type | Source | Approval |
|------|--------|----------|
| **Catalog** | Employee selects from approved catalog | Auto-route by amount/category |
| **Punchout** | Employee shops on supplier website | Returns to Oracle for approval |
| **Non-Catalog** | Free-form request (services, unique items) | Manual review required |
| **Internal** | Transfer from another inventory org | Inter-org transfer request |

### Approval Rules (AME)

| Dimension | Rule Example |
|-----------|-------------|
| Amount | <$5K auto-approve; $5K-$50K manager; >$50K VP + Procurement |
| Category | IT purchases require CTO approval above $10K |
| Cost Center | Each cost center manager approves own department |
| Supplier | New suppliers require procurement review |
| Budget | Check available budget before approval |

---

## Purchase Order Management

### PO Types

| PO Type | Use Case | Pricing |
|---------|----------|---------|
| **Standard PO** | One-time purchase with delivery | Fixed price per line |
| **Blanket Purchase Agreement (BPA)** | Long-term pricing agreement | Agreed prices; releases against it |
| **Contract Purchase Agreement (CPA)** | Terms only (no pricing) | Framework; POs reference it |
| **Planned PO** | Pre-committed purchases by date | Scheduled releases |

### PO Lifecycle

```
DRAFT → APPROVED → OPEN → RECEIVED → INVOICED → CLOSED
                     │         │          │
              Change Order  Partial    Partial
              (amendment)   Receipt    Invoice
```

### Auto-Create PO from Requisition

Oracle can automatically generate POs from approved requisitions when:
- Supplier is pre-assigned (catalog item or requisition has supplier)
- Sourcing rules match (preferred supplier, agreement)
- Amount within buyer's authority
- No negotiation needed

---

## Sourcing (RFQ/Bidding)

### Negotiation Types

| Type | Description | Use Case |
|------|-------------|----------|
| **RFQ (Request for Quotation)** | Invite suppliers to quote | Standard competitive bid |
| **RFI (Request for Information)** | Information gathering | Market research, capability assessment |
| **Auction (Reverse)** | Suppliers bid prices down | High-value, commodity items |
| **Sealed Bid** | Confidential pricing until deadline | Public sector / compliance |

---

## Receiving

### Receipt Types

| Receipt Type | Source | Tolerance Check |
|-------------|--------|-----------------|
| **Standard** | Against PO line | Quantity ± tolerance |
| **Blind** | Without PO reference | No match (for services, non-PO) |
| **Return to Supplier** | Defective goods | Creates return shipment |
| **Correction** | Adjust prior receipt | ± quantity adjustment |

### 3-Way Matching

```
PURCHASE ORDER (Quantity × Price)
         Match
RECEIPT (Quantity received at dock)
         Match
AP INVOICE (Quantity × Price billed)

All three must agree within tolerance for invoice validation to pass.
```

---

## Contracts & Agreements

| Agreement Type | Duration | Pricing | Release Mechanism |
|----------------|----------|---------|-------------------|
| **BPA** | 1-3 years typical | Fixed catalog prices | PO release lines |
| **CPA** | Multi-year | Not in agreement (on PO) | Standard POs reference CPA |
| **Volume Agreement** | Annual | Tiered pricing by volume | Cumulative releases |

---

## Key Configuration

### Procurement Business Unit Setup

| Configuration | Purpose |
|---------------|---------|
| Document Numbering | PO, Req, Receipt number sequences |
| Approval Rules | AME configuration for requisitions and POs |
| Receiving Parameters | Tolerance %, receipt routing, inspection required |
| Tax Configuration | Default tax treatment on procurement transactions |
| Account Generator | Default GL accounts on distributions |

---

## FBDI Templates for Procurement

| Template | Purpose |
|----------|---------|
| `PoHeadersInterfaceTemplate.xlsm` | PO header import |
| `PoLinesInterfaceTemplate.xlsm` | PO lines import |
| `PoDistributionsInterfaceTemplate.xlsm` | PO distributions import |
| `ReqHeadersInterfaceTemplate.xlsm` | Requisition import |
| `RcvShipmentHeadersTemplate.xlsm` | Receipt import |
| `PoItemCategoriesTemplate.xlsm` | Item category hierarchy |

---

## Common Issues & Troubleshooting

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Req stuck in approval | No matching approval rule | Check AME rules; assign approver |
| PO won't approve | Budget exceeded or supplier inactive | Check budget availability; activate supplier |
| Auto-create PO not firing | Sourcing rule missing or supplier not assigned | Configure sourcing rule for category |
| Receipt tolerance exceeded | Received qty > PO qty + tolerance | Amend PO or adjust tolerance |
| Invoice match fails | PO price ≠ invoice price | Price override or PO change order |
| Punchout catalog not loading | Supplier site URL changed | Update punchout configuration |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| Procurement Implementation | `docs.oracle.com/en/cloud/saas/procurement/24d/fapro/` |
| Purchasing | `docs.oracle.com/en/cloud/saas/procurement/24d/faprc/` |
| Self-Service Procurement | `docs.oracle.com/en/cloud/saas/procurement/24d/fasse/` |
| Sourcing | `docs.oracle.com/en/cloud/saas/procurement/24d/fasrc/` |
| Supplier Qualification | `docs.oracle.com/en/cloud/saas/procurement/24d/fasqm/` |
| REST API | `docs.oracle.com/en/cloud/saas/procurement/24d/fapra/` |
