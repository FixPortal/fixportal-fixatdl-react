# FixPortal.FixAtdl.React

React 19 components and browser-side helpers for FIXatdl strategy forms, extracted from FixPortal Simulator. The npm package is `@fixportal/fixatdl-react`.

## Package boundary

The host supplies a parsed `AtdlStrategyDto`. FixPortal Simulator obtains it from its .NET backend, which parses XML through `FixPortal.FixAtdl` and maps the model into this contract. This package has no HTTP client, authentication, router or application store.

Included: recursive panels, native controls, form state, control validation, state-rule evaluation/explanation and an approximate StrategyParametersGrp FIX preview. Uploading XML, schema validation, persistence, order submission and authoritative FIX formatting belong to the host/backend.

## Installation

The package is prepared for the FixPortal GitHub Packages feed. A registry release is a separate action. To consume a locally built archive:

```sh
npm install ./fixportal-fixatdl-react-0.1.0.tgz
```

React and React DOM 19.2+ are peer dependencies. Node 24.15+ is required for development.

## Render a strategy

```tsx
import { FormRenderer, type AtdlStrategyDto } from '@fixportal/fixatdl-react'

export function StrategyEditor({ strategy }: { strategy: AtdlStrategyDto }) {
  return <FormRenderer strategy={strategy} />
}
```

For a workbench with preview and rule inspection, use the state hook and controlled panel:

```tsx
import {
  PanelRenderer, useAtdlFormState, mapControlValuesToParameters,
  emitStrategyParametersGrp, type AtdlStrategyDto,
} from '@fixportal/fixatdl-react'

export function Workbench({ strategy }: { strategy: AtdlStrategyDto }) {
  const { values, setValue, controlState } = useAtdlFormState(strategy)
  const hasErrors = Object.values(controlState).some(control => control.errors.length > 0)
  const preview = emitStrategyParametersGrp(strategy, mapControlValuesToParameters(strategy, values))
  return <>
    <PanelRenderer panel={strategy.panel} values={values} setValue={setValue}
      state={controlState} highlightedControlId={null} onHighlightControl={() => {}} />
    <output>{hasErrors ? 'Correct the highlighted fields.' : JSON.stringify(preview)}</output>
  </>
}
```

Mount a new keyed workbench when changing the document/strategy. `FormRenderer` does this internally using strategy name and source XML. Each mounted editor has independent state, DOM IDs and radio groups. `FormRendererHandle.getValues()` exposes the current control-value map; it is not an order validation or submission API.

`PanelRenderer.text` accepts optional `unsupportedControlType` and `whyRule` objects with `value` and optional HTML text attributes, allowing hosts to retain localization and text-edit tooling. All broker text is rendered as React text, never HTML or XAML.

## Styling

The controls retain the simulator's Tailwind v4 utility classes and FixPortal design token names. Supply the same tokens (or compatible aliases), and explicitly scan the installed package. For a stylesheet at `src/index.css`:

```css
@import "tailwindcss";
@import "@fixportal/design/tokens.css";
@import "@fixportal/design/theme.css";
@source "../node_modules/@fixportal/fixatdl-react/dist";
```

The package does not import global CSS or fetch a theme. Hosts own their stylesheet and branding. Native inputs remain functional without these styles.

## Supported surface and limits

- The inherited registry handles 14 names: TextField_t, DoubleSpinner_t, SingleSpinner_t, DropDownList_t, SingleSelectList_t, CheckBox_t, RadioButton_t, RadioButtonList_t, Label_t, EditableDropDownList_t, Clock_t, Slider_t, MultiSelectList_t and CheckBoxList_t. Spinner variants share a numeric input; single-select variants share a select; multi-select and checkbox lists share checkboxes. This is the simulator's supported surface, not a claim of complete FIXatdl control fidelity.
- Basic required/numeric/range validation runs in the browser. The DTO does not expose strategy edits, control increments, clock timezone metadata or full amendment semantics. Hosts must validate submitted values authoritatively. There is no XML parser in this package.
- Value state rules are edge-triggered and applied in a single pass, preserving the existing simulator behaviour. Cascades do not settle to a fixed point within one edit; null restoration is not implemented. Enabled/visible rules are recalculated on each edit.
- The shared backend rule corpus covers coercion and logical operators. Passing it proves agreement on those cases, not full conformance of all three FixPortal libraries.
- `emitStrategyParametersGrp` is an approximate preview of tags 957-960. It is not a canonical wire encoder: date/time formatting, decimal fidelity, direct parameter tags and complete order construction remain backend responsibilities.
- The currently supported radio shape uses list items on each control. Separate RadioButton_t controls sharing a parameter require additional semantic work before claiming WPF parity.

## Development

```sh
npm ci
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm pack
```

The tests were extracted with the implementation. `contracts/state-rule-cases.json` is a verbatim snapshot of the backend-owned simulator corpus; the simulator integration checks it for drift. Built declarations and ESM are included in the archive, with README, LICENSE and NOTICE. Simulator application files and credentials are excluded.

## Provenance

Extracted from `FixPortal/fixportal-simulator-frontend` commit `17a57e0d`. FIXatdl is maintained by the FIX Trading Community. Apache-2.0; see LICENSE and NOTICE.
