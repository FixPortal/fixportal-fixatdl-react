# FixPortal.FixAtdl.React

Standalone React library. Accepts the backend-owned FIXatdl strategy DTO contract; no simulator HTTP/auth/store imports.

Use Node 24.15+ and React 19. Checks: npm run typecheck, npm run lint, npm run test:coverage, npm run build, npm pack --dry-run.

Keep control behaviour and the shared rule corpus covered by tests. React remains external to the ESM bundle. Host applications supply Tailwind utilities and design tokens; ensure their scanner includes this package. Document browser-validation and approximate FIX-preview limits.
