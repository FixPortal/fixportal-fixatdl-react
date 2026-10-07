# Changelog

Notable changes to `@fix-portal/fixatdl-react`. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

Dates are the release-tag date, in UTC. Entries are consumer-facing: build, CI
and test-infrastructure commits are omitted unless they change what a consumer
sees.

The repository history starts at the 0.3.2 release. Earlier versions remain
installable from npm; their notes are kept below, but their tags were retired
with the pre-release history.

## [Unreleased]

### Fixed

- A text or hidden field bound to `MultipleStringValue_t` or
  `MultipleCharValue_t` validates each space-separated token. A value made of
  declared enum ids is accepted, and the preview emits each token's wire
  value. An editable dropdown may still contain free text: known tokens are
  translated, unknown tokens pass through, and `invertOnWire` is not applied
  while any token is unknown.
- The error summary no longer repeats a visible control's error for a hidden
  control bound to the same parameter.
- Replacing the strategy object with one that differs only by property order,
  or by writing `null` for a member that was omitted, no longer resets the
  form.

## [0.4.0] - 2026-10-07

### Changed

- **Type change:** in `AtdlStrategyDto` and its member types, every member
  that is nullable in C# is now optional (`?: T | null`). This matches
  `FixPortal.FixAtdl.Contracts`, which omits null members from the JSON, so its
  output now type-checks without a cast. Code that reads these members, such as
  `control.parameter`, `parameter.min` or `node.children`, may need to handle
  `undefined` as well as `null`. At runtime they were already absent.

### Fixed

- The published declarations now resolve under `moduleResolution: NodeNext`.
  Relative specifiers in `dist/*.d.ts` carry explicit `.js` extensions. Before
  this, `import type { AtdlStrategyDto } from '@fix-portal/fixatdl-react'`
  failed with TS2305 outside bundler resolution.
- A `value` state rule with no `targetStringValue` is now ignored, as one with
  a `null` target already was.
- Documentation: in `getting-a-strategy.md`, the non-.NET DTO example now
  inlines the bound control's `parameter`. The form reads requiredness, bounds
  and amendment mutability from `control.parameter`. The
  initial value is the control's `initValue`, then `parameter.defaultValue`,
  then `false` for a checkbox or radio. The old example left `parameter`
  `null`, so the form enforced none of those constraints.
  The page also states that the Contracts packages need .NET 10, and the
  dataflow diagram shows `FixPortal.FixAtdl.Contracts` doing the mapping.

## [0.3.3] - 2026-10-07

### Changed

- Documentation: `getting-a-strategy.md` now maps strategies with the public
  `FixPortal.FixAtdl.Contracts` NuGet package (DTOs, mapper and state-rule AST
  builder) instead of describing a mapper in a private repository. The package
  description and NOTICE no longer point at private repositories.

## [0.3.2] - 2026-10-03

### Fixed

- Percentage validation errors now show bounds in the same percent units as
  the control.
- Form values remain safe for reserved object property names such as
  `__proto__`, including unseeded controls and value-rule updates.
- State-rule comparisons now match the shared server corpus for invalid
  temporal values, duplicate selections, and Boolean wire text.

## 0.3.1 - 2026-09-20

### Changed

- README hero and GitHub social preview drop the angel wings from the XML
  card. The markdown image URL is unchanged.

## 0.3.0 - 2026-09-20

### Changed

- `aria-invalid` is exposed on each multi-select checkbox rather than its group wrapper.
- Unset sliders no longer announce their visible "Not selected" marker twice.
- The package smoke test now resolves the published `./styles.css` export.

## 0.2.1 - 2026-09-17

### Added

- Diagrams. `docs/getting-a-strategy.md` replaces its ASCII pipeline with a
  server/browser data-flow diagram that makes the "you write the mapper" boundary
  explicit; the README leads with the same image by absolute URL so it renders on
  npmjs.org. Source is self-contained HTML in `docs/diagrams/`.
- `docs/api.md` — exhaustive reference for every public export: renderers,
  the form-state hook, the control registry, clock and rule-explanation
  helpers, the FIX preview emitter, and the `AtdlStrategyDto` contract.
- `docs/getting-a-strategy.md` — how a host maps `Strategy_t` into the JSON
  DTO this package consumes (the C# DTO lives in the simulator, not in the
  core NuGet package).
- `docs/conformance.md` — names the two JSON corpora as the shared
  cross-language contract with core and WPF.

### Changed

- **`emitStrategyParametersGrp` omits tag 957 entirely when no parameter is
  filled**, rather than emitting `957=0` with no entries following it. An empty
  repeating group should not appear on the wire at all, and the C# emitter
  already omitted it at the same point. Consumer-visible: the returned array is
  now empty in that case, so a caller reading `tags[0]` unconditionally throws.
  This shipped in 0.2.1 and was missing from this entry until 2026-09-20; it
  broke the FixPortal Simulator's preview pane on upgrade.
- **`emitStrategyParametersGrp` now rejects the FIX field delimiter** in a
  parameter name (tag 958) or wire value (tag 960) rather than passing it
  through. The previous contract left the delimiter to `validateControl`, which
  a direct caller of this public export never reaches; a value carrying SOH
  would inject arbitrary FIX fields once the host joined the tags onto the wire.
  Parameter names were never checked at all, by either layer. The C# emitter
  rejects both at the same point.
- **Tag 959 type codes corrected to match the core library.** This table had
  drifted to `Language_t=30`, `NumInMsg_t=26` and `XMLData_t=29` with no
  `Tenor_t`, so the same strategy emitted a different tag 959 here than from the
  WPF adapter. Core's codes are read off the FIX 5.0 SP2 enumeration for tag 959
  and are now mirrored exactly: `Language_t=26`, `Tenor_t=29`, and `NumInMsg_t`
  and `XMLData_t` fall back to the String default because neither names a type in
  the FIXatdl model.
- The `engines` floor relaxes from `>=24.15.0` to `>=22`. The old floor produced
  `EBADENGINE` on install for every Node 22 LTS consumer. CONTRIBUTING and
  AGENTS now say the same: consumers Node 22+, maintainers/CI Node 24.
- The README's styling section listed `@import "@fixportal/design/tokens.css"`
  and `theme.css`. That package is not on npmjs.org, so a consumer following the
  README got an unresolvable import and unstyled controls with no error. The
  section now lists the ten design tokens by name with a neutral starting palette.
  API/getting-a-strategy/conformance links in the README are absolute GitHub
  URLs so they resolve on npmjs.org (those pages are not in the tarball).
- `package.json` `files` now includes `LICENSE` so the Apache-2.0 text ships
  in the npm tarball.

### Fixed

- The FIX delimiter constant in `fixPreviewEmitter` was a raw U+0001 byte in
  the source rather than a `'\u0001'` escape - invisible in every editor and
  diff, and silently destroyable by any tool that normalises control
  characters. Same value, now legible.
- `deriveControlState` called `flattenControls` inside its per-control loop, a
  full recursive panel walk per control on every value change. Hoisted, matching
  what `seedValues` and `setValue` already did.
- The multi-select and checkbox-list now expose `aria-invalid` on each checkbox,
  where the role supports it, rather than on their `group` wrapper. Error state
  therefore reaches assistive technology without relying on deprecated group usage.
  (`aria-required` is deliberately not used there: it is not a supported
  attribute of role `group`, which is why the required state is folded into the
  accessible name instead.)
- An unset slider announced its raw thumb position, so a screen reader read "0"
  as though the first item were selected. It now announces "Not selected",
  matching the visible pip.

### Removed

- `docs/launch/pre-announcement-draft.md`, which was tracked in a public repo
  while headed "Not approved for publication".

## 0.2.0 - 2026-09-12

First public release of the extracted package. React FIXatdl strategy forms:
`FormRenderer`, `PanelRenderer`, the `useAtdlFormState` hook, the 15-control
registry, state-rule evaluation and the StrategyParametersGrp preview emitter.

[Unreleased]: https://github.com/FixPortal/fixportal-fixatdl-react/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/FixPortal/fixportal-fixatdl-react/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/FixPortal/fixportal-fixatdl-react/releases/tag/v0.3.3
[0.3.2]: https://github.com/FixPortal/fixportal-fixatdl-react/releases/tag/v0.3.2
