# API reference — `@fix-portal/fixatdl-react`

> Every public export of `@fix-portal/fixatdl-react` (package 0.2.x), exactly
> as re-exported from `src/index.ts`. Walkthroughs stay in the
> [README](../README.md); how to produce the DTO is in
> [getting-a-strategy.md](getting-a-strategy.md). This page is the
> exhaustive list.

## Renderers

| Export | What it is |
|---|---|
| `FormRenderer` | Uncontrolled strategy form. Give it an order-specific React `key` when switching orders; state resets when the strategy DTO content changes. Does **not** accept `text` — "why?" / unsupported-control copy is English-only on this path. |
| `FormRendererProps` | Props: `strategy`, `options`, `highlightedControlId`, `onHighlightControl`, `ref`. |
| `FormRendererHandle` | `getValues()` snapshots the control-value map; `isValid()` and `getErrors()` include control and strategy errors. |
| `PanelRenderer` | Controlled panel for workbench UIs. Props: `panel`, `values`, `setValue`, `state`, `highlightedControlId`, `onHighlightControl`, optional `text` (`unsupportedControlType`, `whyRule`). |
| `PanelRendererProps`, `PanelRendererText` | Types for the above. |

## Form state

| Export | What it is |
|---|---|
| `useAtdlFormState(strategy, options)` | Settles values and validation. Returns `values`, `setValue`, `controlState`, `strategyErrors`, `hasErrors`. Each mounted editor has independent state, DOM IDs and radio groups. |
| `AtdlFormStateApi` | That return shape. Honour `hasErrors` before copying or submitting a preview. |
| `AtdlFormOptions` | `clock`, `initialValues`, `initialFixValues`, `externalValues`, `isAmendment`. The `initial*` seeds are mount-only; explicit null suppresses defaults. |
| `ControlFormState` | Per-control snapshot: `enabled`, `visible`, `required`, `errors`. |

## Registry and values

| Export | What it is |
|---|---|
| `controlRegistry` | Control-type name → component for the 15 supported names (`TextField_t` … `HiddenField_t`). |
| `ControlProps`, `ControlState` | Props and state types for registry components. |
| `flattenControls(strategy)` | Recursively collects every control in the panel tree. |
| `mapControlValuesToParameters(strategy, values)` | Converts the control-value map to parameter values; feed the result into the FIX preview. |
| `isUnfilledAtdlValue(value)` | Whether a value counts as unfilled (unset). |

## Clocks

`ClockValue` carries both the UTC instant and the displayed local date/time.
Never stringify it — use the helpers.

| Export | What it is |
|---|---|
| `ClockValue` | Clock control value shape. |
| `clockDisplayValue(value)` | Display string (at most milliseconds). |
| `clockWireValue(value, parameterType?)` | FIX wire for a `ClockValue`. Non-clock inputs are passed through (`unknown`). |

## State rules and explanation

| Export | What it is |
|---|---|
| `evaluateStateRule(node, state)` | Evaluates a parsed rule AST against control state. Invalid or unsupported expressions return **`false`**. The form-state hook uses an internal `tryEvaluateStateRule` that returns `null` on invalid input and records a form error instead. |
| `StateRuleAstNode`, `StateRuleOperator` | Parsed rule AST types. |
| `stateRuleToText(node)`, `stateRuleToTree(node)` | Human-readable explanation behind the form's "why?" buttons. |
| `TreeLine` | One rendered explanation-tree line. |
| `collectRuleRows(strategy, values, externalValues?)` | Row model for a rules inspector. Wire it to `highlightedControlId` / `onHighlightControl` so the form's "why?" buttons have somewhere to go. |
| `RuleRow` | `controlId`, `controlLabel`, `effect`, `targetValue`, `conditionText`, `expression`, `firing`. |

## FIX preview

| Export | What it is |
|---|---|
| `emitStrategyParametersGrp(strategy, filledValues)` | Tags 957–960 preview. `filledValues` is keyed by **parameter name** (use `mapControlValuesToParameters` first). `constValue` on a parameter wins over a filled value. **Throws** if a name (958) or wire value (960) contains SOH — catch it; do not pass the control-id map or you get an empty 957. A preview only. |
| `FixTag` | `{ tag, value }` pair. |
| `fixTypeCodeName(code)` | Tag-959 type code → ATDL type name (unknown codes fall back to `String_t`). |

Tag 959 codes match FIX 5.0 SP2 and the core library: `Int_t=1` … `Percentage_t=11`,
`Char_t=12`, `Boolean_t=13`, `String_t=14`, `MultipleCharValue_t=15`,
`Currency_t=16`, `Exchange_t=17`, `MonthYear_t=18`, `UTCTimestamp_t=19`,
`UTCTimeOnly_t=20`, `LocalMktDate_t=21`, `UTCDateOnly_t=22`, `Data_t=23`,
`MultipleStringValue_t=24`, `Country_t=25`, `Language_t=26`,
`TZTimeOnly_t=27`, `TZTimestamp_t=28`, `Tenor_t=29`. `NumInMsg_t` and
`XMLData_t` fall through to String (14).

## Contract types (`types.ts`)

The host backend parses XML through `FixPortal.FixAtdl` and maps the model
into these DTOs. This package never parses XML itself.

| Export | What it is |
|---|---|
| `AtdlStrategyDto` | `name`, `description`, `parameters`, `panel`, `sourceXml`, optional `strategyEdits`. |
| `AtdlParameterDto` | `name`, `fixTag`, `type`, `enumValues`, `min`/`max`, `precision`, `mutableOnCxlRpl`, `useValue`, `defaultValue`, plus optional `trueWireValue`, `falseWireValue`, `invertOnWire`, `constValue`, `minLength`, `maxLength`, `multiplyBy100`, `localMktTz`. |
| `AtdlControlDto` | `id`, `type`, `label`, `parameterRef`, `parameter`, `listItems`, `initValue`, `stateRules`, `tooltip`, plus optional `checkedEnumRef`, `uncheckedEnumRef`, `radioGroup`, increments, `initPolicy`, `initFixField`, `initValueMode`, `localMktTz`. |
| `AtdlPanelDto`, `AtdlPanelChildDto` | Recursive panel tree. Children are `{ kind: 'panel' \| 'control', … }`. |
| `AtdlEnumPairDto`, `AtdlListItemDto` | Enum id ↔ wire value and list item ↔ display string. |
| `AtdlStrategyEditDto`, `AtdlStateRuleDto`, `StateRuleAstNodeDto` | Strategy-level edits and control state rules as received on the wire. Field-level mapping: [getting-a-strategy.md](getting-a-strategy.md). |

Anything importable from a source file but absent here is internal and may
change without a major bump.

---

<sub>Diagram sources live in [`docs/diagrams/`](diagrams/) as self-contained HTML.
Open one in a browser to edit, then re-export the PNG.</sub>
