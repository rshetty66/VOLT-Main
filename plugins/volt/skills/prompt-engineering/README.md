# prompt-engineering

Global skill: `inject_global_skills` (`api/llm_service.py`) loads `SKILL.md` into
every prompt the application builds, so anything added there costs tokens on every
turn. That is why this file exists — notes and attribution live here, where the
loader never reads them.

Guard tests: `tests/test_output_contract.py`.

## Attribution

The **Proportionality** and **Named tells** blocks in `SKILL.md` are adapted from
[anotb/management-consulting-plugin](https://github.com/anotb/management-consulting-plugin)
(MIT), rewritten to fit this file's checkable-rule form and the house voice.
