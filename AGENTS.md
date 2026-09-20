# FixPortal.FixAtdl.React

React adapter over a backend-mapped FIXatdl strategy DTO. No XML parser, no simulator HTTP/auth/store imports. The host maps `FixPortal.FixAtdl` `Strategy_t` into `AtdlStrategyDto` — see `docs/getting-a-strategy.md`.

Consumers: Node 22+, React 19. Maintainers/CI: Node 24 / npm 11. Checks: npm run typecheck, npm run lint, npm run test:coverage, npm run build, npm pack --dry-run, then the four dist gates under scripts/ (react-external, public-dts, no-side-effects, styles).

Keep control behaviour and the shared rule corpus covered by tests. React remains external to the ESM bundle. Document browser-validation and approximate FIX-preview limits.

Styling has two supported host paths and both are contract. A host already on Tailwind v4 supplies the ten design tokens and scans this package; a host without Tailwind imports `@fix-portal/fixatdl-react/styles.css`, built from `styles/index.css`. That stylesheet must never gain Tailwind preflight, and its scan stays explicitly scoped via `source(none)` plus `@source` - automatic source detection walks the whole repository and makes the published CSS depend on unrelated files. scripts/assert-styles.mjs gates both.

`examples/workbench` is the sample app and an npm workspace. It renders `src/__fixtures__/participate-strategy.json`, the only fixture covering all fifteen registry control types, and `src/participateSample.test.tsx` renders the same file - so adding a control type to the registry without adding it to the sample fails the suite. The sample resolves the package through its exports map, not a source alias. Its CSS themes the page only; it overrides no control style.
