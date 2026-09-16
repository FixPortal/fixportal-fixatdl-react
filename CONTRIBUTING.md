# Contributing

Consumers need Node 22+. Development and CI use Node 24 and npm 11.
All development dependencies are public.
Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:coverage`
and `npm run build` before opening a pull request against `main`.

Keep the DTO contract compatible with the simulator backend. Preserve the shared
rule corpus, accessibility and host-owned styling. Add a regression for behaviour
changes and identify any public API break in the PR. Changes use Apache-2.0 and
Conventional Commits; PRs are merged by rebase.
