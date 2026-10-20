# VOLT plugin

VOLT's finance transformation practice as a Claude Code plugin.

| Component | Count | Where |
|---|---|---|
| Specialist agents | 236 across 48 layers (orchestration, ERP, EPM, OSFI/BCAR, M&A, HCM, change, industries, skills) | `agents/` |
| Workflow commands | 35, one per VOLT multi-phase workflow: `/volt:run-<workflow>` | `commands/run-*.md` |
| Entry commands | `/volt:ask`, `/volt:find-skill`, `/volt:services` | `commands/` |
| Skills | 378 VOLT skills plus `volt-skill-finder` and `volt-services` | `skills/` |
| Console data | workflows, services, intake questions, skill index | `data/` |

## Context budget

About 36 core skills and the two catalogue skills are listed to Claude in every session. The other 342 skills carry
`disable-model-invocation: true`, so their descriptions stay out of context until the Skill Finder opens one.
That cut the plugin's always-on skill and agent description text from about 52K tokens to about 15K.
`claude plugin details volt` still projects about 79K tokens, because its estimate counts the on-demand skills' descriptions too.
The core list is `CORE_SKILLS` in `tools/import_volt.py`.

Seventeen skills VOLT references are not shipped here, because another foundation plugin provides them:
four from ECC, four document skills (docx, pptx, xlsx, pdf) from `document-skills@anthropic-agent-skills`, eight from
the optional `example-skills@anthropic-agent-skills`, and one from `andrej-karpathy-skills@karpathy-skills`.
The list is in `data/provided-elsewhere.json`.

## Rebuild from VOLT

```bash
python -I plugins/volt/tools/import_volt.py "<path to volt_deploy>"
node scripts/ci/validate-volt-plugin.js
claude plugin validate ./plugins/volt
```

Built from `volt_deploy@59787eb` (see `data/source.json`).

## Licences

VOLT-authored content is MIT. Vendored skills keep their own licences; provenance is in `THIRD_PARTY/_vendored.json`
and the `LICENSE-*` files beside it.
