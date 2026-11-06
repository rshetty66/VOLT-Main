---
name: react-bits-prototyping
description: Add React Bits animated components (DavidHDev/react-bits) to a client prototype, vision demo, landing page or the VOLT Console, with finance guardrails - exact figures, no motion in evidence or exports, reduced-motion support - and the MIT + Commons Clause license rule that React Bits source is never vendored into VOLT. Use when a finance demo or prototype needs animated text, count-ups, reveal effects or a quiet background.
---

# React Bits Prototyping

React Bits (<https://github.com/DavidHDev/react-bits>) is a library of animated, interactive React components. You
copy each one into an app with the shadcn or jsrepo CLI, choosing a flavor: `JS` or `TS`, then `CSS` or `TW`
(Tailwind). This skill covers when a finance deliverable may use those components and how to add them safely.

## When to Use

- A client vision demo, rapid prototype or pitch that needs some motion: a hero headline, figures that count up,
  cards that reveal on scroll, a quiet background.
- The VOLT Console or a VOLT landing page.
- A production finance UI only when the client's design-system owner approves it. Production screens follow the
  client's own component library first.

Do not use this skill for evidence packs, reports, exports, print views or regulatory outputs. These stay static.

## How It Works

1. **Check the license first.** Read [references/license.md](references/license.md). In short, you may use the
   components inside an application, site or product, commercially too, but you must never redistribute the
   component source. Never commit React Bits source into the VOLT plugin, a VOLT template pack or any reusable
   bundle. Add components only inside the client app being built.
2. **Pick at most a few components** from [references/components.md](references/components.md), one per job. The
   shortlist suits finance; anything else in the catalog needs the same guardrail review.
3. **Add a component** from the app root:

   ```bash
   npx shadcn@latest add @react-bits/CountUp-TS-CSS
   # or
   npx jsrepo@latest add https://reactbits.dev/r/CountUp-TS-CSS
   ```

   Choose the flavor that matches the app (the VOLT Console uses `TS-CSS`). For the shadcn MCP route, add
   `"@react-bits": "https://reactbits.dev/r/{name}.json"` under `registries` in `components.json`.
4. **Add its dependencies** (`motion`, `gsap`, ...; see the shortlist). Pin exact versions, run `npm audit`, and
   compare the production bundle size before and after.
5. **Read the copied files** before using them. They are now app code, so they need review, tests and lint like any
   other code.
6. **Apply the finance guardrails** below, then run the app's tests and build.
7. **Record provenance.** Keep the React Bits copyright notice that the files carry, and mention React Bits and its
   license in the app's third-party notices.

## Finance Guardrails

- **Exact figures.** A count-up must end on exactly the source figure, with the source's scale, currency and decimal
  places. Render the final value as plain text for screen readers, and make the static value what gets copied or
  printed.
- **Verified figures only.** Never animate a figure that is still awaiting verification or failed its check. Motion
  implies confidence.
- **No motion in evidence.** Evidence packs, report views, exports, print styles and screenshots for audit are static.
- **Reduced motion.** Respect `prefers-reduced-motion: reduce`, so the component shows its end state immediately.
- **Restraint.** At most one hero effect per page. No WebGL backgrounds behind data tables or dense figures. No
  flashing, and keep text contrast at WCAG AA or better.
- **Unicode.** No emoji or pictographic characters in copy or code, so VOLT's
  `scripts/ci/check-unicode-safety.js` keeps passing.

## Examples

| Task | Components | Notes |
|---|---|---|
| CFO close-dashboard vision demo | Split Text (title), Count Up (days to close, verified only), Fade Content (cards) | Static fallback for print |
| VOLT Workbench landing hero | Blur Text or Shiny Text, Dot Grid background | One hero effect, reduced motion respected |
| Workbench check results | Animated Content on the result list | Report view stays static |

## Anti-Patterns

- Committing React Bits components into `plugins/volt/` or shipping them as a VOLT starter kit. This breaks the
  Commons Clause.
- Animating unverified or rounded-differently figures.
- Stacking several effects on one screen, or putting a WebGL background behind a reconciliation table.
- Adding a component without reviewing its code and dependencies.
