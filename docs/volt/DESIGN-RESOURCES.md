# Design resources: verified repos

Verified 2026-11-05. Only repos that exist and whose role was checked against primary sources. Stars drift, so
re-check before citing popularity. Licenses come from the repo LICENSE file or GitHub's detected license.

## Reuse rules

- Prefer MIT, ISC, CC0 and Apache-2.0 repos. Keep copyright and license notices in copied files.
- No license means all rights reserved: reference only (`ckissi/kinetics`, `naughtyduk/liquidGL`, `chaitanyababuta/vibepromt`).
- Kitbitz: the art is CC0 (commercial use OK, no attribution needed). Its site, plugin and MCP code is proprietary.
- 3dicons: CC0 applies to the free v1 set. The "Pro" renders and editor are paid. The Figma plugin code is MIT.
- Inspiration galleries (minimal.gallery, appshot.gallery, kage.design) show other products' work. Borrow layout,
  type and spacing patterns, never brand assets, copy or screenshots.

## Components and UI (copy-friendly)

- shadcn-ui/ui, MIT, https://github.com/shadcn-ui/ui: base components and registry (source of ui.shadcn.com)
- magicuidesign/magicui, MIT, https://github.com/magicuidesign/magicui: animated UI components
- ibelick/motion-primitives, MIT, https://github.com/ibelick/motion-primitives: motion components (beta, lightly maintained)
- uiverse-io/galaxy, MIT, https://github.com/uiverse-io/galaxy: 3,000+ CSS/Tailwind UI elements (auto-archive of
  uiverse.io, direct PRs ignored, inactive since Sep 2024)

## Animation and effects (copy-friendly)

- juliangarnier/anime, MIT, https://github.com/juliangarnier/anime: anime.js v4
- rdev/liquid-glass-react, MIT, https://github.com/rdev/liquid-glass-react: Apple Liquid Glass for React
- archisvaze/liquid-glass, MIT, https://github.com/archisvaze/liquid-glass: physics-based SVG and WebGL Liquid Glass
  (background photos excluded from the license)
- waldbach/liquid-glass-css, MIT, https://github.com/waldbach/liquid-glass-css: pure-CSS Liquid Glass proof of concept

## Icons and illustrations (free assets)

- CaptExcellent/kits-library-assets, CC0 1.0, https://github.com/CaptExcellent/kits-library-assets: Kitbitz hand-drawn
  illustrations (artwork only; the LICENSE.md is the authority, GitHub's badge says "not identifiable")
- realvjy/3dicons, CC0-1.0 (free v1 set), https://github.com/realvjy/3dicons: 3D icons
- realvjy/3dicons-figma, MIT (plugin code), https://github.com/realvjy/3dicons-figma: 3dicons Figma plugin

## Design-system format

- google-labs-code/design.md, Apache-2.0, https://github.com/google-labs-code/design.md: DESIGN.md format spec

## Reference only: not licensed for reuse

- ckissi/kinetics: no license, spring-animation examples
- naughtyduk/liquidGL: license unclear, WebGL Liquid Glass
- 21st-dev/magic-mcp: ISC, MCP proxy only; components are hosted at 21st.dev with per-component terms

## MCP servers (no repo needed)

| Service | Setup | Auth | What Claude gets |
|---------|-------|------|------------------|
| Kage | `claude mcp add --transport http kage https://kage.design/mcp` | none | Design briefs and screenshots from real product designs |
| Kitbitz | Streamable HTTP server at `https://mcp.kitbitz.art` | none, read-only | Search and fetch CC0 illustrations, asset manifests |
| DESIGNmd | `claude mcp add -s user designmd -e DESIGNMD_API_KEY=<your-key> -- npx designmd-mcp` | free API key | Search, browse and download community DESIGN.md systems |
| 21st.dev | `npx @21st-dev/cli@latest init --client claude`, then `21st login` (MCP URL `https://21st.dev/api/mcp`, `x-api-key` header) | free key | Search and install 12,000+ components, UI generation |

Appshot has a hosted MCP screenshot generator but no public endpoint was found. Use the website instead.

## Excluded

- chaitanyababuta/vibepromt: exists, but is a stock AI Studio scaffold with no license and no link to vibeprompts.dev.
  Identity unverified, so do not cite it as the site's repo.
- designkit-md/designkit.md: referenced by designmd.ai metadata, currently 404.
- No public repo (reference sites only): minimal.gallery, kage.design, appshot.gallery, designmd.ai, vibeprompts.dev.
