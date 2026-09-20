# Contributing

Consumers need Node 22+. Development and CI use Node 24 and npm 11.
All development dependencies are public.
Run `npm ci`, `npm run docs:check`, `npm run typecheck`, `npm run lint`,
`npm run test:coverage`, `npm run build`, the four distribution assertions,
the workbench typecheck/build, and `npm pack --dry-run` before opening a pull
request against `main`. Use `npm run browser:smoke` when changing the sample,
package exports, rendering, or styles.

Keep the DTO contract compatible with the simulator backend. Preserve the shared
rule corpus, accessibility and host-owned styling. Add a regression for behaviour
changes and identify any public API break in the PR. Changes use Apache-2.0 and
Conventional Commits; PRs are merged by rebase.

Use GitHub Issues for public bugs and feature requests. Remove credentials,
broker data, and other confidential material from reports and fixtures. Report
suspected vulnerabilities privately through GitHub Security Advisories, never
through a public issue.

Releases are made from a merged `main` commit: update `package.json` and
`CHANGELOG.md`, open the release PR, create the matching `v<version>` tag after
merge, verify the npm package and provenance result, and create the GitHub
release from that tag. See [docs/releasing.md](docs/releasing.md).
