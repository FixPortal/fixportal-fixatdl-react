# FixPortal.FixAtdl.React

React adapter over a backend-mapped FIXatdl strategy DTO. No XML parser, no simulator HTTP/auth/store imports. The host maps `FixPortal.FixAtdl` `Strategy_t` into `AtdlStrategyDto` — see `docs/getting-a-strategy.md`.

Consumers: Node 22+, React 19. Maintainers/CI: Node 24 / npm 11. Checks: npm run typecheck, npm run lint, npm run test:coverage, npm run build, npm pack --dry-run.

Keep control behaviour and the shared rule corpus covered by tests. React remains external to the ESM bundle. Host applications supply Tailwind utilities and design tokens; ensure their scanner includes this package. Document browser-validation and approximate FIX-preview limits.
