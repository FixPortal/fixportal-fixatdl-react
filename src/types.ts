/** Mirrors C# AtdlStrategyDto - one FIXatdl Strategy element with parameters and panel tree. */
export interface AtdlStrategyDto {
  name: string
  description: string | null
  parameters: AtdlParameterDto[]
  panel: AtdlPanelDto
  sourceXml: string
}

/** Mirrors C# AtdlParameterDto - a FIXatdl Parameter with type metadata and optional enum values. */
export interface AtdlParameterDto {
  name: string
  fixTag: number | null
  type: string
  enumValues: AtdlEnumPairDto[] | null
  min: unknown
  max: unknown
  precision: number | null
  mutableOnCxlRpl: boolean
  useValue: string | null
  defaultValue: unknown
}

/** Mirrors C# AtdlEnumPairDto - one enumeration identifier paired with its FIX wire value. */
export interface AtdlEnumPairDto {
  enumId: string
  wireValue: string
}

/** Mirrors C# AtdlListItemDto - one item in a list control pairing enum ID with UI display string. */
export interface AtdlListItemDto {
  enumId: string
  uiRep: string
}

/** Mirrors C# AtdlControlDto - a FIXatdl Control element. */
export interface AtdlControlDto {
  id: string
  type: string
  label: string | null
  parameterRef: string | null
  parameter: AtdlParameterDto | null
  listItems: AtdlListItemDto[] | null
  initValue: unknown
  stateRules: AtdlStateRuleDto[]
  tooltip: string | null
}

/** Mirrors C# AtdlPanelDto - a FIXatdl StrategyPanel with layout metadata and ordered children. */
export interface AtdlPanelDto {
  title: string | null
  border: string
  orientation: string
  collapsible: boolean
  collapsed: boolean
  children: AtdlPanelChildDto[]
}

/**
 * Discriminated union mirroring C# AtdlPanelChildDto (abstract, JsonPolymorphic).
 * The "kind" discriminator is only emitted on the wire when the declared type is
 * AtdlPanelChildDto; the concrete subtypes are tested individually without it.
 */
export type AtdlPanelChildDto =
  | (AtdlPanelDto & { kind: 'panel' })
  | (AtdlControlDto & { kind: 'control' })

/**
 * Mirrors C# AtdlStateRuleDto - one FIXatdl StateRule binding an AST condition to a UI effect.
 *
 * The mapper emits exactly three effects: `enabled`, `visible` and `value`. For the first
 * two the payload is the boolean `targetValue`; for `value` it is `targetStringValue` (and
 * `targetValue` is a meaningless `false`).
 */
export interface AtdlStateRuleDto {
  effect: string
  targetValue: boolean
  targetStringValue: string | null
  expression: StateRuleAstNodeDto
}

/** Mirrors C# StateRuleAstNodeDto - one node in a StateRule condition tree (recursive). */
export interface StateRuleAstNodeDto {
  kind: string
  operator: string | null
  field: string | null
  value: unknown
  children: StateRuleAstNodeDto[] | null
}
