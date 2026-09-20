# Getting a strategy into `@fix-portal/fixatdl-react`

> This package never parses FIXatdl XML. The host backend parses with
> [`FixPortal.FixAtdl`](https://github.com/FixPortal/fixportal-fixatdl)
> and maps the resulting `Strategy_t` into the JSON `AtdlStrategyDto`
> this page describes. The C# DTO of the same name lives in FixPortal
> Simulator, not in the core NuGet package — an OSS host writes its own
> mapper.

A worked JSON example is
[`src/__fixtures__/twap-strategy.json`](https://github.com/FixPortal/fixportal-fixatdl-react/blob/main/src/__fixtures__/twap-strategy.json).

## Worked mapper example

The mapper belongs to the host backend. It receives the parsed `Strategy_t`
from `FixPortal.FixAtdl` and emits the JSON contract consumed by this package.
The maintained FixPortal Simulator implementation is [`AtdlDtoMapper.cs`](https://github.com/FixPortal/fixportal-simulator-backend/blob/main/src/FixPortal.Simulator.Atdl/Mapping/AtdlDtoMapper.cs).
The following is the important end-to-end shape from that mapper, reduced to
the strategy, parameter, panel, and control boundaries:

```csharp
private AtdlStrategyDto MapStrategy(
    Strategy_t source,
    IReadOnlyDictionary<string, string> sourceXmlByStrategy,
    EditCollection? globalEdits)
{
    var parameterDtos = source.Parameters.Select(MapParameter).ToList();
    var parametersByName = parameterDtos
        .GroupBy(parameter => parameter.Name)
        .ToDictionary(group => group.Key, group => group.Last());
    var comparisonTypes = source.Controls
        .GroupBy(control => control.Id)
        .ToDictionary(
            group => group.Key,
            group => group.Last() switch
            {
                Clock_t => "Clock_t",
                ListControlBase => "EnumState",
                BinaryControlBase binary when binary.HasEnumeratedState => "EnumState",
                _ => (string?)null,
            });
    var astBuilder = new StateRuleAstBuilder(globalEdits, source.Edits, comparisonTypes);
    var panel = source.StrategyLayout?.StrategyPanel is { } root
        ? MapPanel(root, parametersByName, astBuilder)
        : new AtdlPanelDto(null, "None", "Vertical", false, false, []);

    sourceXmlByStrategy.TryGetValue(source.Name, out var sourceXml);
    return new AtdlStrategyDto(
        source.Name,
        source.Description?.Content,
        parameterDtos,
        panel,
        sourceXml ?? string.Empty,
        source.StrategyEdits.Select(edit => MapStrategyEdit(edit, astBuilder, parametersByName)).ToList());
}

private AtdlPanelDto MapPanel(
    StrategyPanel_t source,
    IReadOnlyDictionary<string, AtdlParameterDto> parametersByName,
    StateRuleAstBuilder astBuilder)
{
    var children = source.StrategyPanels
        .Select(child => (AtdlPanelChildDto)MapPanel(child, parametersByName, astBuilder))
        .Concat(source.Controls.OrderBy(control => control.Index)
            .Select(control => (AtdlPanelChildDto)MapControl(control, parametersByName, astBuilder)))
        .ToList();
    return new AtdlPanelDto(
        source.Title,
        source.Border?.ToString() ?? "None",
        source.Orientation?.ToString() ?? "Vertical",
        source.Collapsible ?? false,
        source.Collapsed ?? false,
        children);
}

private static AtdlControlDto MapControl(
    Control_t source,
    IReadOnlyDictionary<string, AtdlParameterDto> parametersByName,
    StateRuleAstBuilder astBuilder)
{
    parametersByName.TryGetValue(source.ParameterRef ?? string.Empty, out var parameter);
    var listItems = source is ListControlBase list && list.HasListItems
        ? list.ListItems.Select(item => new AtdlListItemDto(item.EnumId, item.UiRep)).ToList()
        : null;
    return new AtdlControlDto(
        source.Id,
        source.GetType().Name,
        source.Label,
        string.IsNullOrEmpty(source.ParameterRef) ? null : source.ParameterRef,
        parameter,
        listItems,
        GetInitValue(source),
        MapStateRules(source, astBuilder),
        source.ToolTip);
}
```

The omitted helpers are mechanical projections of the same contract: map every
parameter field, inline the resolved parameter into each control, emit each
`enabled`, `visible`, and `value` state rule with its AST, preserve strategy
edits, and carry control-specific fields such as enums, increments, clocks,
timezones, and `UseFixField` initialization. A production mapper must also
bound panel recursion and preserve the host’s validation/error policy. In JSON,
the complete minimal DTO handed to the browser looks like this; panel children
carry the discriminator explicitly:

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
      "parameter": null,
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

In the production payload, `parameter` is normally the resolved inline copy
of the matching entry in `parameters`; the example leaves it `null` only to
show that the top-level parameter list is the source of truth for the DTO
contract. The actual Simulator mapper inlines it for controls and emits all
control-specific fields.

Return the DTO from the host API, then pass it to the published package:

```tsx
import { FormRenderer, type AtdlStrategyDto } from '@fix-portal/fixatdl-react'

export function StrategyEditor({ strategy }: { strategy: AtdlStrategyDto }) {
  return <FormRenderer strategy={strategy} options={{ clock: () => new Date() }} />
}
```

## Pipeline

![From broker XML to a rendered form: the core .NET library parses the XML on the server, host-owned backend mapping code turns Strategy_t into the AtdlStrategyDto JSON contract, and the @fix-portal/fixatdl-react package renders it and previews the 957-960 tags](images/strategy-dataflow.png)

<sub>Source: [`docs/diagrams/strategy-dataflow.html`](diagrams/strategy-dataflow.html) — open in a browser to edit, then re-export.</sub>

Do not stringify `ClockValue` objects on the way back. Use
`clockWireValue` / `mapControlValuesToParameters` when converting form
state to parameter values.

## `AtdlStrategyDto`

| Field | Required | Maps from |
|---|---|---|
| `name` | yes | `Strategy_t.Name` |
| `description` | yes, nullable | `Strategy_t.Description` text |
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
| `defaultValue` | default / init | |
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
- Mapping `Strategy_t` → this JSON. There is no published OpenAPI.
- Authoritative FIX serialization. `emitStrategyParametersGrp` is a
  preview of tags 957–960 and **throws** if a name or value contains
  SOH. Direct parameter tags and the rest of the order are yours.
- Supplying `clock` for time-only clocks and `initValueMode=1`.
- Remounting `<FormRenderer key={orderId} …>` when switching orders.
