# Releasing `@fix-portal/fixatdl-react`

Releases are created from a merged commit on `main`. The tag, package version,
changelog entry, GitHub release, and npm `latest` version must agree.

## Prepare the release

1. Update `package.json` and add a dated consumer-facing section to
   `CHANGELOG.md`.
2. Run the full local gate from [CONTRIBUTING.md](../CONTRIBUTING.md), including
   `npm run docs:check`, the browser smoke when applicable, and `npm pack --dry-run`.
3. Open a pull request against `main`. The repository ruleset permits rebase
   merge only and requires `CI Gate` plus `Review policy intact`.
4. After merge, update the local checkout with `git switch main` and
   `git pull --ff-only`.

## Tag and publish

Create and push the version tag from the merged `main` commit:

```powershell
git tag v0.3.0
git push origin v0.3.0
```

Replace `0.3.0` with the version in `package.json`. The release workflow
verifies that the tag is reachable from `main`, matches `package.json`, passes
the package gate, and publishes through npm trusted publishing with provenance.
Do not run `npm publish` manually for a normal release.

## Create and verify the release

Create the GitHub release for the tag and use the matching `CHANGELOG.md`
section as its notes. Confirm the release is not a draft.

```powershell
npm view @fix-portal/fixatdl-react version dist-tags --json
gh run list --repo FixPortal/fixportal-fixatdl-react --limit 5
gh release view v0.3.0 --repo FixPortal/fixportal-fixatdl-react
```

Run the verification commands after creating the release. Confirm npm `latest`
points to the same version and the workflow reports successful provenance.

## Release checklist

- [ ] Version in `package.json` and changelog agree.
- [ ] `npm run docs:check` passes.
- [ ] Full local package gate passes.
- [ ] PR merged into `main` using rebase.
- [ ] `v<version>` tag points at the merged commit.
- [ ] Release workflow passed and npm provenance is present.
- [ ] GitHub release exists for the tag.
- [ ] npm `latest` matches the tag version.
