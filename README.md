![FixAtdl React: editable strategy forms from parsed FIXatdl definitions](https://raw.githubusercontent.com/FixPortal/fixportal-fixatdl-react/main/docs/images/fixatdl-react-hero.png)

# FixPortal.FixAtdl.React

React 19 components and browser-side helpers for FIXatdl strategy forms, extracted from FixPortal Simulator. The public npm package is [`@fix-portal/fixatdl-react`](https://www.npmjs.com/package/@fix-portal/fixatdl-react).

## Package boundary

The host supplies a parsed `AtdlStrategyDto`. FixPortal Simulator obtains it from its .NET backend, which parses XML through the headless [`FixPortal.FixAtdl`](https://www.nuget.org/packages/FixPortal.FixAtdl/) core and maps the model into this contract. This package has no HTTP client, authentication, router or application store.

Included: recursive panels, native controls, form state, parameter/strategy validation, state-rule evaluation/explanation and a StrategyParametersGrp FIX preview. Uploading XML, schema validation, persistence, order submission and authoritative FIX serialization belong to the host/backend.

## In action

![The Participate sample strategy rendered side by side in a light host and a dark host, each showing the form, the live StrategyParametersGrp tag preview and the state-rule inspector](https://raw.githubusercontent.com/FixPortal/fixportal-fixatdl-react/main/docs/images/sample-light-dark.png)

The `examples/workbench` sample rendering the synthetic **Participate** strategy, in a
light host and a dark host. The only difference between the two panes is the value of ten
CSS custom properties. Run it yourself:

```sh
npm ci
npm run dev
```

`npm run dev` builds the library and starts the sample on Vite's dev server. The sample
resolves `@fix-portal/fixatdl-react` through the package's own `exports` map rather than
a source alias, so its imports are the ones you would write in your own app.

The strategy it renders is `src/__fixtures__/participate-strategy.json` - synthetic, from
the fictional provider `DEMO`, and covering all fifteen control types the registry
supports. The test suite renders that same file (`src/participateSample.test.tsx`), so
the sample cannot quietly stop working.

## Installation

The package is public and needs no registry token to install:

```sh
npm install @fix-portal/fixatdl-react
```

React and React DOM 19.2+ are peer dependencies. Consumers need Node 22+.
Maintainers and CI use Node 24 / npm 11.

![From broker XML to a rendered form: the core .NET library parses the XML on the server, host-owned backend mapping code turns Strategy_t into the AtdlStrategyDto JSON contract, and the @fix-portal/fixatdl-react package renders it and previews the 957-960 tags](https://raw.githubusercontent.com/FixPortal/fixportal-fixatdl-react/main/docs/images/strategy-dataflow.png)

## Read these first

- [Getting a strategy](https://github.com/FixPortal/fixportal-fixatdl-react/blob/main/docs/getting-a-strategy.md) — XML is parsed by the core library; this package takes a mapped JSON DTO.
- [API reference](https://github.com/FixPortal/fixportal-fixatdl-react/blob/main/docs/api.md) — every public export.
- [Conformance corpora](https://github.com/FixPortal/fixportal-fixatdl-react/blob/main/docs/conformance.md) — the JSON files shared with core and WPF.

For contributors, see [CONTRIBUTING.md](https://github.com/FixPortal/fixportal-fixatdl-react/blob/main/CONTRIBUTING.md).
For vulnerability reports, use the [security policy](https://github.com/FixPortal/fixportal-fixatdl-react/blob/main/SECURITY.md).

## Related packages

- [`FixPortal.FixAtdl`](https://www.nuget.org/packages/FixPortal.FixAtdl/)
  ([repository](https://github.com/FixPortal/fixportal-fixatdl)) parses and
  validates strategy XML and emits FIX-tag values. It is a .NET backend/core
  package, not a dependency of this browser package.
- [`FixPortal.FixAtdl.Wpf`](https://www.nuget.org/packages/FixPortal.FixAtdl.Wpf/)
  ([repository](https://github.com/FixPortal/fixportal-fixatdl-wpf)) is a
  separate WPF desktop adapter. It is not a dependency of this React package.

Choose the adapter for the host UI. The host remains responsible for obtaining
and validating strategy XML, mapping it to `AtdlStrategyDto`, persistence,
order construction and authoritative server-side FIX validation/serialization.

## Render a strategy

```tsx
import { FormRenderer, type AtdlStrategyDto } from '@fix-portal/fixatdl-react'

export function StrategyEditor({ strategy }: { strategy: AtdlStrategyDto }) {
  return <FormRenderer strategy={strategy} options={{ clock: () => new Date() }} />
}
```

For a workbench with preview and rule inspection, use the state hook and controlled panel:

```tsx
import {
  PanelRenderer, useAtdlFormState, mapControlValuesToParameters,
  emitStrategyParametersGrp, type AtdlStrategyDto,
} from '@fix-portal/fixatdl-react'

export function Workbench({ strategy }: { strategy: AtdlStrategyDto }) {
  const { values, setValue, controlState, hasErrors, strategyErrors } =
    useAtdlFormState(strategy, { clock: () => new Date() })
  const preview = emitStrategyParametersGrp(strategy, mapControlValuesToParameters(strategy, values))
  return <>
    {strategyErrors.map((error, index) => <p role="alert" key={index}>{error}</p>)}
    <PanelRenderer panel={strategy.panel} values={values} setValue={setValue}
      state={controlState} highlightedControlId={null} onHighlightControl={() => {}} />
    <output>{hasErrors ? 'Correct the highlighted fields.' : JSON.stringify(preview)}</output>
  </>
}
```

State resets when the strategy DTO content changes, including duplicate-named strategies sharing source XML. Each mounted editor has independent state, DOM IDs and radio groups. `FormRendererHandle.getValues()` returns a snapshot of the control-value map; `isValid()` and `getErrors()` include both control and strategy errors. Hidden-control errors appear in the form summary. Hosts using the hook must honour `hasErrors`, including when copying or submitting a preview.

`AtdlFormOptions` also accepts `initialValues` (control IDs), `initialFixValues` (numeric FIX tags), `externalValues` (named fields such as `FIX_OrderQty`) and `isAmendment`. Explicit null suppresses defaults. New-order `UseFixField` initialization falls back to authored values on conversion failure; amendment loading reports invalid wire values. Constants and parameters marked immutable on amendment cannot be edited. Supply every referenced external field; explicit null means known absent. `initialValues` and `initialFixValues` are mount-only seeds: changing them for the same strategy does not replace edits. Use `<FormRenderer key={orderId} strategy={strategy} options={options} />` when switching orders; remount a hook consumer the same way.

Connect `onHighlightControl` and `highlightedControlId` to your rules inspector to enable the form's "why?" buttons. Without that callback the buttons are omitted. An unset slider displays "Not selected" and offers a button to select its current position. Clock inputs display at most milliseconds; loaded instants retain their full fraction until edited. Native numeric and range widgets still have browser precision limits; exact decimal bounds and values are retained by the library where the browser supplies them.

Supply `clock` at the host boundary when resolving time-only values or current-time initialization. Clock values retain both the UTC instant and the displayed local date/time in a `ClockValue` object, preserving loaded instants across DST overlaps. Use `clockDisplayValue`, `clockWireValue` or `mapControlValuesToParameters` instead of stringifying this object. Numeric inputs retain decimal strings when JavaScript numbers would lose precision. These value-shape changes are part of the 0.2.0 migration.

`PanelRenderer.text` accepts optional `unsupportedControlType` and `whyRule` objects with `value` and optional HTML text attributes, allowing hosts to retain localization and text-edit tooling. `FormRenderer` does not take `text`; its "why?" copy is English-only. All broker text is rendered as React text, never HTML or XAML.

## Styling

The controls emit Tailwind **v4** utility classes against ten design token names. There
are two supported ways to resolve them, and which one is right depends on whether the
host already runs Tailwind. `tailwindcss` is not a peer dependency, and native inputs
remain functional under neither.

### A host not running Tailwind: import the packaged stylesheet

```ts
import '@fix-portal/fixatdl-react/styles.css'
```

That file carries every utility class the controls emit, plus the ten tokens at the
neutral default values listed below. It deliberately contains **no Tailwind preflight**,
so it resets nothing on the host page. Every token is a plain custom property, so
redeclaring any of them anywhere in your own cascade rebrands the controls or adds a dark
scheme; `examples/workbench` does exactly that and overrides no control style at all.

### A host already running Tailwind v4: supply the tokens

Keep owning the stylesheet and scan the installed package instead (`@theme` / `@source`
are v4 syntax; Tailwind v3 will not pick them up). For a stylesheet at `src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-text: #1f2937;
  --color-muted: #6b7280;
  --color-card: #ffffff;
  --color-border-base: #d1d5db;
  --color-brand: #2563eb;
  --color-brand-soft: #93c5fd;
  --color-bad-text: #b91c1c;
  --color-bad-border: #ef4444;
  --color-warn-bg: #fef3c7;
  --color-warn-border: #f59e0b;
}

@source "../node_modules/@fix-portal/fixatdl-react/dist";
```

The **names** are the contract — they are what the rendered class names resolve against. The values above are a neutral starting palette, not a brand specification; replace them with your own, or map them onto tokens you already have.

Each token is used for: body text (`text`), secondary labels (`muted`), input backgrounds (`card`), input and panel borders (`border-base`), the slider accent (`brand`) and its focus ring (`brand-soft`), validation text and borders (`bad-text`, `bad-border`), and the highlighted-control outline and wash (`warn-border`, `warn-bg`).

The package does not import global CSS or fetch a theme. Hosts own their stylesheet and branding. Native inputs remain functional without these styles.

## Supported surface and limits

- The registry handles 15 names: TextField_t, DoubleSpinner_t, SingleSpinner_t, DropDownList_t, SingleSelectList_t, CheckBox_t, RadioButton_t, RadioButtonList_t, Label_t, EditableDropDownList_t, Clock_t, Slider_t, MultiSelectList_t, CheckBoxList_t and HiddenField_t. Sliders support numeric ranges or enum positions; spinners honour increments. Shared binary radio groups preserve the selected parameter value. Native HTML controls provide the presentation.
- Browser validation covers required values, declared enums, Boolean mappings, character lengths, numeric ranges, temporal values and mapped StrategyEdits. Typed comparisons preserve string identity, decimal precision, enum IDs, field-to-field comparisons, and exactly-one XOR semantics. Invalid expressions and missing external context make the form invalid.
- Value rules settle cascades within one edit. NULL activation snapshots and clears a value, then restores it on deactivation. False enabled/visible conditions apply the inverse attribute, including on initialization. A bounded iteration guard reports cycles as form errors.
- Clock display uses the control's market timezone; parameter timezones apply to daily bounds. DST overlaps choose the earlier instant for newly entered times, while loaded instants remain intact. Gaps shift forward by the skipped interval. TZ wire values normalize offsets to UTC. Year zero, leap seconds and timezone suffixes on authored Clock initialization are unsupported and rejected.
- `emitStrategyParametersGrp` previews tags 957–960 with enum/Boolean/NULL mappings, inverted lists, percentage scaling, decimal rounding and temporal formatting. Feed it the **parameter-name** map from `mapControlValuesToParameters`; a control-id map emits an empty group. It **throws** if a parameter name or wire value contains the FIX field delimiter (SOH) — catch it at the preview pane. Direct parameter tags, arbitrary repeating groups and complete order construction remain host responsibilities. The host must also perform schema validation, ISO code-list checks and final order validation. Binary Data comparisons are unsupported; presence checks are supported.
- Conformance evidence targets FIXatdl 1.1 with December 2010 errata. The shared rule corpus and six shared state-transition scenarios prove agreement on those cases; they are not full FIXatdl certification. The [core conformance record](https://github.com/FixPortal/fixportal-fixatdl/blob/main/docs/conformance.md) records the assessed scope and remaining limits.

## API reference

Every public export is listed in the
[API reference](https://github.com/FixPortal/fixportal-fixatdl-react/blob/main/docs/api.md).
That page is GitHub-only - the npm tarball ships `dist`, `LICENSE`,
`NOTICE` and this README, and nothing under `docs/` - so the README on
npmjs.org links it by absolute URL.

## Development

```sh
npm ci
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm pack
node scripts/assert-react-external.mjs
node scripts/assert-public-dts.mjs
node scripts/assert-no-side-effects.mjs
node scripts/assert-styles.mjs
```

The repo is an npm workspace: `examples/workbench` is the sample app, and `npm ci`
installs it alongside the package. `npm run dev` builds the library and serves the
sample. `docs/images/sample-light-dark.png` is regenerated by `node
scripts/capture-screenshot.mjs` - see that file's header for the two builds and the
one-off `npx playwright install chromium` it needs. The focused consumer smoke is
`npm run browser:smoke` after building the library and workbench; it uses Chromium
to verify rendering, preview updates, and an accessible validation error. It is
not a full browser, device, or accessibility certification.

`contracts/state-rule-cases.json` is a verbatim snapshot of the backend-owned simulator corpus; the simulator integration checks it for drift. `contracts/state-transitions.json` is also consumed by the WPF model tests. Built declarations and ESM are included in the archive, with README, LICENSE and NOTICE. Simulator application files and credentials are excluded.

## Releases

Merge a version change through a PR, then tag the merged commit `v<version>`.
CI verifies the tag is reachable from `main` and matches `package.json`, then
publishes the public package to npm with provenance through npm trusted
publishing. Ordinary branch and pull-request builds validate and pack the
package but do not publish it.

## Attribution

Extracted from `FixPortal/fixportal-simulator-frontend` commit `17a57e0d`.
FIXatdl is maintained by the FIX Trading Community. This package is licensed
under Apache-2.0; see [LICENSE](LICENSE) and [NOTICE](NOTICE).
