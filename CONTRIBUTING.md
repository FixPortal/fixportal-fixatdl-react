# Contributing

Consumers need Node 22+. Development and CI use Node 24 and npm 11.
All development dependencies are public.
Run `npm ci`, `npm run docs:check`, `npm run typecheck`, `npm run lint`,
`npm run test:coverage`, `npm run build`, the four distribution assertions,
the workbench typecheck/build, and `npm pack --dry-run` before opening a pull
request against `main`. Use `npm run browser:smoke` when changing the sample,
package exports, rendering, or styles.

Keep the DTO contract compatible with `FixPortal.FixAtdl.Contracts`, which
produces it: `src/contractsPackageSample.test.tsx` renders that package's real
output. The shared rule corpus is canonical in fixportal-fixatdl; change it
there first. Preserve accessibility and host-owned styling. Add a regression for behaviour
changes and identify any public API break in the PR. Changes use Apache-2.0 and
Conventional Commits; PRs are merged by rebase.

Some files under `.github/` are shared CI assets synced from FixPortal's
internal tooling (listed in `.github/canonical-assets.json`); CI rejects local
edits to them. If one needs changing, say so in an issue or PR description and
a maintainer will make the change upstream.

Use GitHub Issues for public bugs and feature requests. Remove credentials,
broker data, and other confidential material from reports and fixtures. Report
suspected vulnerabilities privately through GitHub Security Advisories, never
through a public issue.

Releases are made from a merged `main` commit: update `package.json` and
`CHANGELOG.md`, open the release PR, create the matching `v<version>` tag after
merge, verify the npm package and provenance result, and create the GitHub
release from that tag. See [docs/releasing.md](docs/releasing.md).

## Maintenance checklist

- Review Dependabot updates and keep the Node/npm support floor deliberate.
- Check FIXatdl/core compatibility and shared conformance-corpus drift.
- Run the package, workbench, and browser smoke checks before releases.
- Verify the release tag, npm provenance, npm `latest`, and GitHub release agree.
