# React Bits shortlist for finance work

Checked against the React Bits repository (`main`, TypeScript sources) on 2026-11-04. The registry name is the
component name without spaces, plus the flavor suffix, for example `CountUp-TS-CSS`. Check the live catalog before
use, because components are renamed and removed (the old `Squares` background no longer exists).

| Component | Category | Dependencies (TS) | Fits | Guardrail |
|---|---|---|---|---|
| Count Up | Text | `motion` | KPI tiles, extracted figures once verified | Ends on the exact source figure; static under reduced motion |
| Split Text | Text | `gsap` (`SplitText`, `ScrollTrigger`), `@gsap/react` | Page or demo title | One hero effect per page |
| Blur Text | Text | `motion` | Landing hero, section intro | Short phrases only |
| Shiny Text | Text | none beyond React | Call to action, status label | Keep contrast at AA |
| Fade Content | Animations | `gsap` (`ScrollTrigger`) | Cards or panels revealed on scroll | Not in report or print views |
| Animated Content | Animations | `gsap` (`ScrollTrigger`) | Check-result lists, step panels | Not in evidence packs |
| Spotlight Card | Components | none beyond React | Service or capability cards | Decorative only; content stays readable |
| Dot Grid | Backgrounds | none beyond React (canvas) | Landing page background | Never behind tables or figures |
| Aurora | Backgrounds | none beyond React (WebGL) | Pitch or landing hero | Heavy GPU use; hero sections only |

`gsap` has its own license terms. Check them for the client before shipping.
