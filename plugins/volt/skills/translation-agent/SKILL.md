---
name: translation-agent
description: >
  Multilingual translation specialist for complex business documents. Activates when users
  mention "translate", "translation", "French", "Quebec French", "Italian", "Malayalam",
  "multilingual", "localization", "language", "document translation", "fr-CA",
  "traduction", "lingua", "മലയാളം", or ask to convert content into another language.
  Supports structure-preserving translation of proposals, reports, policies, presentations,
  SOPs, and any consulting deliverable across four target languages with full cultural adaptation.
version: 1.0.0
disable-model-invocation: true
---

# Translation Agent — Multilingual Document Intelligence

Expert translation specialist for complex enterprise documents across four target languages:
**French (European)**, **Quebec French (fr-CA)**, **Italian**, and **Malayalam**.
Preserves document structure, terminology consistency, and cultural register.

---

## Supported Languages

| Code | Language | Script | Cultural Notes |
|------|----------|--------|----------------|
| `fr` | French (European) | Latin | International business standard, DALF/DELF register |
| `fr-CA` | Quebec French | Latin | OQLF-compliant; distinct from European French; uses Quebec terminology standards |
| `it` | Italian | Latin | Formal business Italian; TU vs LEI register awareness |
| `ml` | Malayalam | Malayalam (Dravidian) | Official language of Kerala; Brahmic script; formal/informal register |

---

## When to Use This Skill

Activate automatically when:

- User says "translate this into French / Italian / Malayalam"
- User mentions "Quebec French", "fr-CA", "Québécois"
- User needs a proposal, SOP, policy, or report translated for a multilingual audience
- User asks to localize consulting deliverables for a French-Canadian or Italian-speaking client
- User needs to validate translation quality or compare source vs. translated output
- User needs a glossary of standard business terms in any of the four languages

---

## What This Skill Does

1. **Structure-Preserving Translation** — Translates text while maintaining headers, bullet points, tables, numbered lists, bold/italic formatting, and HTML tags
2. **Cultural Adaptation** — Applies the correct regional standard for each language variant (Quebec French ≠ European French)
3. **Terminology Consistency** — Maintains a running glossary of key terms translated consistently across a document
4. **Register Awareness** — Matches the formality of the source document (executive, technical, operational)
5. **Back-Translation Validation** — Optionally translates output back to English for quality assurance
6. **Glossary Generation** — Produces a bilingual term glossary for client review

---

## Language-Specific Guidance

### French (fr) — European French
- Use standard metropolitan French vocabulary
- IFRS/accounting terms follow Comité de normalisation comptable (CNC) standards
- Formal register: "vous" not "tu" in business communications
- Preserve anglicisms only where no accepted French equivalent exists

### Quebec French (fr-CA) — OQLF Standards
- Follow Office québécois de la langue française (OQLF) terminology
- Key Quebec-specific vocabulary: "courriel" (not "email"), "logiciel" (not "software"), "impartition" (not "outsourcing"), "infonuagique" (not "cloud computing")
- Business documents: formal register, avoid colloquial Québécois (joual)
- Legal/financial: follow terminology from CPA Canada and CPAQ standards
- Currency: always CAD; date format DD/MM/YYYY for Quebec
- Passive voice often preferred in formal Quebec administrative writing

### Italian (it)
- Use formal Lei (not tu) in B2B business documents
- Standard modern Italian; Accademia della Crusca-aligned vocabulary
- Finance/accounting terms follow Italian accounting standards (OIC)
- Avoid regional dialects; use standard Italiano standard

### Malayalam (ml)
- Use formal/literary Malayalam (ഗ്രന്ഥഭാഷ) for business documents — not colloquial spoken Malayalam
- Transliterate proper nouns (company names, ERP names) where no native equivalent exists
- Numbers: use both Indian/Arabic numerals and spelled-out forms for key figures
- Finance terms may be transliterated from English where the Malayalam equivalent is uncommon

---

## Translation Workflow

```
1. Receive source document

2. Detect structure (headers, bullets, tables, code blocks)

3. Apply language-specific system prompt + glossary context

4. Translate in segments (preserving structure markers)

5. Apply terminology consistency pass

6. Output: translated document + bilingual glossary (optional)

7. Back-translation summary for QA (optional)
```

---

## How to Use

### Basic Text Translation
```
Translate the following paragraph into Quebec French:
"Our Finance Transformation program will reduce the close cycle from 12 to 5 days."
```

### Full Document Translation
```
Translate this proposal into Italian. Preserve all section headers and bullet points.
Maintain consistent terminology throughout.
[paste document]
```

### With Custom Glossary
```
Translate this SOP into French. Use this glossary:
- "close" → "clôture comptable"
- "journal entry" → "écriture de journal"
- "reconciliation" → "rapprochement bancaire"
[paste SOP]
```

### Multi-Language Output
```
Translate this executive summary into all four supported languages:
French, Quebec French, Italian, and Malayalam.
[paste summary]
```

### Glossary Generation Only
```
Generate a bilingual glossary of 30 key finance transformation terms in Quebec French.
Include: close, journal entry, reconciliation, COA, trial balance, accrual, depreciation.
```

---

## Document Structure Preservation Rules

| Element | Handling |
|---------|---------|
| `# Headers` | Translate text, preserve Markdown `#` prefix |
| `**Bold**` | Translate text, preserve `**` markers |
| `- Bullet points` | Translate text, preserve `-` or `•` prefix |
| `1. Numbered lists` | Translate text, preserve numbering |
| `| Tables |` | Translate cell content, preserve `|` structure |
| `<HTML tags>` | Translate text nodes only, preserve all tags and attributes |
| Code blocks | Do NOT translate — preserve verbatim |
| Proper nouns | Preserve company names, ERP names, acronyms |
| Financial figures | Preserve numbers exactly; only translate surrounding text |

---

## Example Output

**Source (English):**
> **Month-End Close Process**
> Our target is to reduce the close from 12 to 5 days using the following approach:
> - Automated journal entries via Oracle ERP Cloud
> - Real-time reconciliation with BlackLine
> - Centralized COA governance

**Quebec French (fr-CA):**
> **Processus de clôture de fin de mois**
> Notre objectif est de réduire la clôture de 12 à 5 jours en utilisant l'approche suivante :
> - Écritures de journal automatisées via Oracle ERP Cloud
> - Rapprochement en temps réel avec BlackLine
> - Gouvernance centralisée du plan comptable

**Italian (it):**
> **Processo di Chiusura di Fine Mese**
> Il nostro obiettivo è ridurre la chiusura da 12 a 5 giorni utilizzando il seguente approccio:
> - Registrazioni contabili automatizzate tramite Oracle ERP Cloud
> - Riconciliazione in tempo reale con BlackLine
> - Governance centralizzata del piano dei conti

**Malayalam (ml):**
> **മാസാന്ത ക്ലോഷർ പ്രക്രിയ**
> Oracle ERP Cloud വഴി യാന്ത്രിക ജേർണൽ എൻട്രികൾ, BlackLine ഉപയോഗിച്ച് തത്സമയ അനുരഞ്ജനം, കേന്ദ്രീകൃത COA ഭരണം എന്നിവ ഉപയോഗിച്ച് ക്ലോഷർ 12 ദിവസത്തിൽ നിന്ന് 5 ദിവസമായി കുറയ്ക്കുക എന്നതാണ് ഞങ്ങളുടെ ലക്ഷ്യം.

---

## Standard Finance Glossary (Quick Reference)

| English | French (fr) | Quebec French (fr-CA) | Italian (it) | Malayalam (ml) |
|---------|-------------|----------------------|--------------|----------------|
| Close | Clôture | Clôture comptable | Chiusura | ക്ലോഷർ |
| Journal Entry | Écriture comptable | Écriture de journal | Registrazione contabile | ജേർണൽ എൻട്രി |
| Reconciliation | Rapprochement | Rapprochement bancaire | Riconciliazione | അനുരഞ്ജനം |
| Chart of Accounts | Plan comptable | Plan comptable général | Piano dei conti | അക്കൗണ്ടുകളുടെ ചാർട്ട് |
| Trial Balance | Balance de vérification | Balance de vérification | Bilancio di verifica | ട്രയൽ ബാലൻസ് |
| Accrual | Régularisation | Charge à payer | Rateo | അക്രൂവൽ |
| Depreciation | Amortissement | Amortissement | Ammortamento | മൂല്യത്തകർച്ח |
| Budget | Budget | Budget | Budget | ബജറ്റ് |
| Forecast | Prévision | Prévision financière | Previsione | ഫോർകാസ്റ്റ് |
| Invoice | Facture | Facture | Fattura | ഇൻവോയ്സ് |
| General Ledger | Grand livre | Grand livre général | Libro mastro | ജനറൽ ലെഡ്ജർ |
| Accounts Payable | Comptes fournisseurs | Comptes fournisseurs | Debiti verso fornitori | അക്കൗണ്ട്സ് പേയബിൾ |
| Accounts Receivable | Comptes clients | Comptes clients | Crediti verso clienti | അക്കൗണ്ട്സ് റിസീവബിൾ |
| Audit | Audit / Contrôle | Vérification comptable | Revisione | ഓഡിറ്റ് |
| Compliance | Conformité | Conformité réglementaire | Conformità | കംപ്ലയൻസ് |

---

## Tips

- Specify the language code (`fr`, `fr-CA`, `it`, `ml`) for precision
- Provide a source-language glossary to lock in terminology before translation
- For long documents (>5 pages), translate section by section and request a consolidated glossary at the end
- Quebec French: always mention OQLF compliance if the output is for formal government or regulated-industry use
- Malayalam: specify whether the audience is Kerala-based (standard Malayalam) or diaspora audience
- For HTML documents, instruct the agent to preserve all CSS classes and tag attributes
- Back-translation QA is recommended for externally published documents or regulatory submissions

---

## Related Agents

- **Document Factory** — Produce DOCX/PDF output from translated content
- **Comms Writer** — Rewrite translated content with stronger narrative voice
- **SOP Generator** — Produce SOPs that can then be translated
- **OCM Accelerator** — Develop multilingual change communications
- **Creative Studio** — Design bilingual/multilingual visual assets
