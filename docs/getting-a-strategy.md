# Getting a strategy into `@fix-portal/fixatdl-react`

> This package never parses FIXatdl XML. The host backend parses with
> [`FixPortal.FixAtdl`](https://www.nuget.org/packages/FixPortal.FixAtdl/)
> and maps the resulting model into the JSON `AtdlStrategyDto` this page
> describes, using
> [`FixPortal.FixAtdl.Contracts`](https://www.nuget.org/packages/FixPortal.FixAtdl.Contracts/).
> Both are public NuGet packages; no FixPortal account or token is needed.

A worked JSON example is
[`src/__fixtures__/twap-strategy.json`](https://github.com/FixPortal/fixportal-fixatdl-react/blob/main/src/__fixtures__/twap-strategy.json).

## Mapping on a .NET backend

`FixPortal.FixAtdl.Contracts` contains the C# records for this contract, the
mapper from the parsed `Strategies_t`, and the state-rule AST builder that turns
FIXatdl `Edit` trees into the `stateRules` / `strategyEdits` this package
evaluates. It is the same code FixPortal's own services use.

```shell
dotnet add package FixPortal.FixAtdl.Contracts --version 1.3.0
```

Both packages target `net10.0`, so the host project must too. On an older
target framework the restore fails with `NU1202`.

```csharp
using System.Text.Json;
using FixPortal.FixAtdl.Contracts;
using FixPortal.FixAtdl.Xml;

using var stream = File.OpenRead("strategies.xml");
var strategies = new StrategiesReader().Load(stream);

AtdlStrategiesDto contract = new AtdlDtoMapper().Map(strategies);

// Hand one strategy to the browser; FormRenderer takes a single AtdlStrategyDto.
AtdlStrategyDto pov = contract.Strategies.Single(s => s.Name == "POV");
string json = JsonSerializer.Serialize(pov, AtdlContractJson.Options);
```

Serialize with `AtdlContractJson.Options` (camelCase, null members omitted).
Contracts 1.3.0 omits null members. This package treats an omitted member and
an explicit `null` as the same value.

Two details:

- `Map` takes an optional `IReadOnlyDictionary<string, string>` of each
  strategy's source XML, emitted as `sourceXml`. The form uses `sourceXml` only
  as an identity (state resets when it changes), so an empty string is fine if
  you do not keep the fragment.
- Mapping throws `AtdlParseException` for a document whose state rules cannot
  be built: an unresolved `EditRef`, an unknown operator, an invalid literal, or
  nesting past the supported depth. `Code` carries a machine-readable reason.

The output of exactly this snippet, for the `pov.xml` fixture in the core
repository, is committed here as
[`src/__fixtures__/contracts-pov-strategy.json`](https://github.com/FixPortal/fixportal-fixatdl-react/blob/main/src/__fixtures__/contracts-pov-strategy.json)
and rendered by `src/contractsPackageSample.test.tsx`. That file is the
output of Contracts 1.3.0, the version on the install line above. After every
build, `scripts/assert-consumer-types.mjs` compiles that committed JSON,
uncast, against the built `AtdlStrategyDto` declarations under both `NodeNext`
and `bundler` module resolution. The render test and that check fail when this
repository and the pinned 1.3.0 output disagree. They do not build a newer
Contracts package. When Contracts changes, regenerate the fixture from that
package's output and move the version pin with it.

## Hosts that are not .NET

The contract is plain JSON. A host in another language maps its own FIXatdl
model into the shape below; the field tables that follow and
[`contracts/state-rule-cases.json`](https://github.com/FixPortal/fixportal-fixatdl/blob/main/contracts/state-rule-cases.json)
(the state-rule AST cases both evaluators are tested against) are the
specification. The complete minimal DTO handed to the browser looks like this;
panel children carry the discriminator explicitly:

```json
{
  "name": "DemoStrategy",
  "description": "Synthetic example",
  "parameters": [{
    "name": "OrderQty",
    "fixTag": 38,
    "type": "Int_t",
    "enumValues": null,
    "min": 1,
    "max": 1000000,
    "precision": null,
    "mutableOnCxlRpl": true,
    "useValue": "required",
    "defaultValue": null
  }],
  "panel": {
    "title": null,
    "border": "None",
    "orientation": "Vertical",
    "collapsible": false,
    "collapsed": false,
    "children": [{
      "kind": "control",
      "id": "orderQty",
      "type": "SingleSpinner_t",
      "label": "Order quantity",
      "parameterRef": "OrderQty",
      "parameter": {
        "name": "OrderQty",
        "fixTag": 38,
        "type": "Int_t",
        "min": 1,
        "max": 1000000,
        "mutableOnCxlRpl": true,
        "useValue": "required"
      },
      "listItems": null,
      "initValue": null,
      "stateRules": [],
      "tooltip": null,
      "increment": 1
    }]
  },
  "sourceXml": "<Strategy name=\"DemoStrategy\" />",
  "strategyEdits": []
}
```

A bound control must carry `parameter`, the resolved inline copy of the
matching entry in `parameters`. The form reads requiredness, `min` / `max`
and amendment mutability from `control.parameter` only; it does not look them
up through `parameterRef`. The initial value is `control.initValue`, then
`parameter.defaultValue`, then `false` for a checkbox or radio. A control
whose `parameter` is missing or `null` still renders, but none of the
parameter constraints are enforced.
`FixPortal.FixAtdl.Contracts` inlines it for every bound control and emits all
control-specific fields. Validate the order on the server as well: the form is
a convenience, not the authority.

Any nullable member may be sent as `null` or omitted. The top-level parameter
above spells its nulls out, the inline copy omits them, and
`FixPortal.FixAtdl.Contracts` always omits them.

## Rendering it

Return the DTO from the host API, then pass it to the published package:

```tsx
import { FormRenderer, type AtdlStrategyDto } from '@fix-portal/fixatdl-react'

export function StrategyEditor({ strategy }: { strategy: AtdlStrategyDto }) {
  return <FormRenderer strategy={strategy} options={{ clock: () => new Date() }} />
}
```

## Pipeline

![From broker XML to a rendered form: the core .NET library parses the XML on the server, FixPortal.FixAtdl.Contracts maps Strategy_t into the AtdlStrategyDto JSON contract the host serves, and the @fix-portal/fixatdl-react package renders it and emits 957-960 tag tuples](images/strategy-dataflow.png)

<sub>Source: [`docs/diagrams/strategy-dataflow.html`](diagrams/strategy-dataflow.html) — open in a browser to edit, then re-export.</sub>

Do not stringify `ClockValue` objects on the way back. Use
`clockWireValue` / `mapControlValuesToParameters` when converting form
state to parameter values.

## `AtdlStrategyDto`

| Field | Required | Maps from |
|---|---|---|
| `name` | yes | `Strategy_t.Name` |
| `description` | no | `Strategy_t.Description` text |
| `parameters` | yes | `Strategy_t.Parameters` |
| `panel` | yes | `Strategy_t.StrategyLayout.StrategyPanel` |
| `sourceXml` | yes | Original strategy XML fragment (identity; state resets when it changes) |
| `strategyEdits` | no | `Strategy_t.StrategyEdits` |

## `AtdlParameterDto`

| Field | Maps from | Notes |
|---|---|---|
| `name` | `IParameter.Name` | Emitter keys on **parameter name**, not control id. |
| `fixTag` | `IParameter.FixTag` | `null` = local to the form, never emitted. |
| `type` | parameter `xsi:type` local name | `Int_t`, `UTCTimestamp_t`, … |
| `enumValues` | `EnumPair` collection | `{ enumId, wireValue }` |
| `min` / `max` | parameter bounds | Native type; percentages are the **wire** fraction unless `multiplyBy100`. |
| `precision` | decimal precision | |
| `mutableOnCxlRpl` | `MutableOnCxlRpl` | `false` locks the control when `isAmendment`. |
| `useValue` | `Use_t` | `"required"` / `"optional"` / `null`. |
| `defaultValue` | parameter default | Used only when the control has no `initValue`. A checkbox or radio with neither starts unchecked. |
| `trueWireValue` / `falseWireValue` | Boolean mappings | |
| `invertOnWire` | inverted list | |
| `constValue` | constant parameter | **Wins** over filled form values in the preview emitter. |
| `minLength` / `maxLength` | string length | |
| `multiplyBy100` | `Percentage_t` display | |
| `localMktTz` | IANA zone | Daily bounds and clocks. |

## `AtdlControlDto`

| Field | Maps from | Notes |
|---|---|---|
| `id` | `Control_t.Id` | Must be nonempty and unique in the strategy. |
| `type` | control `xsi:type` | One of the 15 names in the registry. |
| `label` | `Label` | Rendered as React text, never HTML. |
| `parameterRef` / `parameter` | `ParameterRef` | Embed the resolved parameter DTO when present. |
| `listItems` | `ListItem`s | `{ enumId, uiRep }` |
| `initValue` | `InitValue` | |
| `stateRules` | `StateRule`s | See below. |
| `tooltip` | `ToolTip` | |
| `checkedEnumRef` / `uncheckedEnumRef` | binary enum refs | |
| `radioGroup` | `RadioButton_t.RadioGroup` | Shared-parameter radios. |
| `increment` / `innerIncrement` / `outerIncrement` | spinner/slider | |
| `initPolicy` / `initFixField` / `initValueMode` | `UseFixField` init | `initValueMode=1` needs a host `clock`. |
| `localMktTz` | clock zone | |

## Panels

`AtdlPanelDto`: `title`, `border`, `orientation`, `collapsible`,
`collapsed`, `children`.

Each child is a discriminated union: `{ kind: 'panel', … }` or
`{ kind: 'control', … }`. Recurse; `flattenControls` walks this tree
in document order.

## State rules and edits

`AtdlStateRuleDto.effect` is exactly one of `enabled`, `visible`,
`value`. For the first two, `targetValue` is the boolean payload; for
`value`, `targetStringValue` is the payload (`targetValue` is unused
`false`). `{NULL}` as the value payload clears the control.

`StateRuleAstNodeDto` is the wire AST (`kind`, `operator`, `field`,
`value`, `children`, optional `field2` / `comparisonType`). The
evaluator uses a parallel `StateRuleAstNode` type; hosts building a
rules inspector should go through `collectRuleRows` rather than
evaluating the DTO by hand.

## What the host still owns

- Schema validation of the XML (the core library does not ship the XSD).
- Serving the JSON. `FixPortal.FixAtdl.Contracts` does the mapping; the
  endpoint, auth and caching around it are the host's.
- Authoritative FIX serialization. `emitStrategyParametersGrp` is a
  preview of tags 957–960 and **throws** if a name or value contains
  SOH. Direct parameter tags and the rest of the order are yours.
- Supplying `clock` for time-only clocks and `initValueMode=1`.
- Remounting `<FormRenderer key={orderId} …>` when switching orders.
