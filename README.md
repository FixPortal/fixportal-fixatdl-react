# FixPortal.FixAtdl.React

React 19 components and browser-side helpers for FIXatdl strategy forms, extracted from FixPortal Simulator. The npm package is `@fix-portal/fixatdl-react`.

## Package boundary

The host supplies a parsed `AtdlStrategyDto`. FixPortal Simulator obtains it from its .NET backend, which parses XML through `FixPortal.FixAtdl` and maps the model into this contract. This package has no HTTP client, authentication, router or application store.

Included: recursive panels, native controls, form state, parameter/strategy validation, state-rule evaluation/explanation and a StrategyParametersGrp FIX preview. Uploading XML, schema validation, persistence, order submission and authoritative FIX serialization belong to the host/backend.

## Installation

The package is public and needs no registry token to install:

```sh
npm install @fix-portal/fixatdl-react
```

React and React DOM 19.2+ are peer dependencies. Node 24.15+ is required for development.

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

State resets when the strategy name or source XML changes. Each mounted editor has independent state, DOM IDs and radio groups. `FormRendererHandle.getValues()` returns a snapshot of the control-value map; `isValid()` and `getErrors()` include both control and strategy errors. Hosts using the hook must honour `hasErrors`, including when copying or submitting a preview.

`AtdlFormOptions` also accepts `initialValues` (control IDs), `initialFixValues` (numeric FIX tags), `externalValues` (named fields such as `FIX_OrderQty`) and `isAmendment`. Explicit null suppresses defaults. New-order `UseFixField` initialization falls back to authored values on conversion failure; amendment loading reports invalid wire values. Constants and parameters marked immutable on amendment cannot be edited. Supply every referenced external field; explicit null means known absent. Initialization options seed a new document; remount the editor to load another order into the same document.

Supply `clock` at the host boundary when resolving time-only values or current-time initialization. Clock values retain both the UTC instant and the displayed local date/time in a `ClockValue` object, preserving loaded instants across DST overlaps. Use `clockDisplayValue`, `clockWireValue` or `mapControlValuesToParameters` instead of stringifying this object. Numeric inputs retain decimal strings when JavaScript numbers would lose precision. These value-shape changes are part of the 0.2.0 migration.

`PanelRenderer.text` accepts optional `unsupportedControlType` and `whyRule` objects with `value` and optional HTML text attributes, allowing hosts to retain localization and text-edit tooling. All broker text is rendered as React text, never HTML or XAML.

## Styling

The controls retain the simulator's Tailwind v4 utility classes and FixPortal design token names. Supply the same tokens (or compatible aliases), and explicitly scan the installed package. For a stylesheet at `src/index.css`:

```css
@import "tailwindcss";
@import "@fixportal/design/tokens.css";
@import "@fixportal/design/theme.css";
@source "../node_modules/@fix-portal/fixatdl-react/dist";
```

The package does not import global CSS or fetch a theme. Hosts own their stylesheet and branding. Native inputs remain functional without these styles.

## Supported surface and limits

- The registry handles 15 names: TextField_t, DoubleSpinner_t, SingleSpinner_t, DropDownList_t, SingleSelectList_t, CheckBox_t, RadioButton_t, RadioButtonList_t, Label_t, EditableDropDownList_t, Clock_t, Slider_t, MultiSelectList_t, CheckBoxList_t and HiddenField_t. Sliders support numeric ranges or enum positions; spinners honour increments. Shared binary radio groups preserve the selected parameter value. Native HTML controls provide the presentation.
- Browser validation covers required values, declared enums, Boolean mappings, character lengths, numeric ranges, temporal values and mapped StrategyEdits. Typed comparisons preserve string identity, decimal precision, enum IDs, field-to-field comparisons, and exactly-one XOR semantics. Invalid expressions and missing external context make the form invalid.
- Value rules settle cascades within one edit. NULL activation snapshots and clears a value, then restores it on deactivation. False enabled/visible conditions apply the inverse attribute, including on initialization. A bounded iteration guard reports cycles as form errors.
- Clock display uses the control's market timezone; parameter timezones apply to daily bounds. DST overlaps choose the earlier instant for newly entered times, while loaded instants remain intact. Gaps shift forward by the skipped interval. TZ wire values normalize offsets to UTC. Year zero, leap seconds and timezone suffixes on authored Clock initialization are unsupported and rejected.
- `emitStrategyParametersGrp` previews tags 957–960 with enum/Boolean/NULL mappings, inverted lists, percentage scaling, decimal rounding and temporal formatting. Direct parameter tags, arbitrary repeating groups and complete order construction remain host responsibilities. The host must also perform schema validation, ISO code-list checks and final order validation. Binary Data comparisons are unsupported; presence checks are supported.
- Conformance evidence targets FIXatdl 1.1 with December 2010 errata. The shared rule corpus and six shared state-transition scenarios prove agreement on those cases; they are not full FIXatdl certification. The [core conformance record](https://github.com/FixPortal/fixportal-fixatdl/blob/main/docs/conformance.md) records the assessed scope and remaining limits.

## Development

```sh
npm ci
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm pack
```

`contracts/state-rule-cases.json` is a verbatim snapshot of the backend-owned simulator corpus; the simulator integration checks it for drift. `contracts/state-transitions.json` is also consumed by the WPF model tests. Built declarations and ESM are included in the archive, with README, LICENSE and NOTICE. Simulator application files and credentials are excluded.

## Releases

Merge the version change through a PR, then tag the merged commit `v<version>`.
CI verifies that the tag is on `main` and matches `package.json`, runs the checks,
then publishes to npm with provenance. Configure npm trusted publishing for owner
`FixPortal`, repository `fixportal-fixatdl-react`, workflow `ci.yml`, with no
environment. The package is already registered with this trusted publisher.

## Provenance

Extracted from `FixPortal/fixportal-simulator-frontend` commit `17a57e0d`. FIXatdl is maintained by the FIX Trading Community. Apache-2.0; see LICENSE and NOTICE.
