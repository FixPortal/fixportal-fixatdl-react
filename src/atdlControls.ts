import type { AtdlControlDto, AtdlPanelDto, AtdlStrategyDto } from './types'
import { controlParameterValue, isBinaryControl, isUnfilledAtdlValue, normalizeControlValue } from './atdlValue'
import { clockRuleValue, createClockValue, clockWireValue } from './atdlClock'
import { formatDecimal } from './decimalValue'

// ---------------------------------------------------------------------------
// Control-graph utilities shared by the form-state hook and the FIX preview.
// ---------------------------------------------------------------------------

/** Depth-first list of every Control in a strategy's panel tree, in document order. */
export function flattenControls(strategy: AtdlStrategyDto): AtdlControlDto[] {
  const out: AtdlControlDto[] = []
  walkPanel(strategy.panel, out)
  return out
}

function walkPanel(panel: AtdlPanelDto, out: AtdlControlDto[]): void {
  for (const child of panel.children ?? []) {
    if ('children' in child) {
      // WHY: AtdlPanelChildDto is a discriminated union; 'children' is the panel
      // discriminator property (only AtdlPanelDto carries it).
      walkPanel(child as AtdlPanelDto, out)
    } else {
      out.push(child as AtdlControlDto)
    }
  }
}

/**
 * Translate the workbench's control-id-keyed value map (as produced by
 * useAtdlFormState, keyed by control.id e.g. "c_StartTime") into the
 * parameter-name-keyed map the FIX emitter expects (keyed by parameter name
 * e.g. "StartTime").
 *
 * WHY this bridge exists: form state is keyed by control because that is the
 * unit the UI mutates, while the FIX StrategyParametersGrp emitter - mirroring
 * the C# AtdlFixPreviewEmitter - looks parameters up by name. Each control
 * carries `parameterRef` (the name of the parameter it feeds). Without this
 * translation every emitter lookup misses and the group count is always
 * 957=0 regardless of input (ISSUE-002).
 *
 * Controls with no bound parameter (labels, decorative panels) are skipped.
 * Shared radios read the selected sibling; other duplicate bindings follow
 * document order and are synchronized when edited.
 */
export function mapControlValuesToParameters(
  strategy: AtdlStrategyDto,
  controlValues: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const control of flattenControls(strategy)) {
    const paramName = control.parameterRef ?? control.parameter?.name
    if (paramName == null) continue
    if (Object.prototype.hasOwnProperty.call(controlValues, control.id)) {
      const source = parameterValueSource(strategy, controlValues, control)
      const value = controlParameterValue(source, controlValues[source.id])
      // An unmapped unchecked radio contributes no parameter value; its selected
      // sibling supplies it regardless of their document order.
      if (control.type === 'RadioButton_t' && value == null && Object.hasOwn(out, paramName)) continue
      out[paramName] = value
    }
  }
  return out
}

export function parameterValueSource(strategy: AtdlStrategyDto, values: Record<string, unknown>, control: AtdlControlDto): AtdlControlDto {
  if (control.type !== 'RadioButton_t' || !control.radioGroup) return control
  const name = control.parameterRef ?? control.parameter?.name
  return flattenControls(strategy).find(candidate => candidate.type === 'RadioButton_t' &&
    candidate.radioGroup === control.radioGroup && (candidate.parameterRef ?? candidate.parameter?.name) === name && values[candidate.id] === true) ?? control
}

export function controlValuesForRules(strategy: AtdlStrategyDto, values: Record<string, unknown>): Record<string, unknown> {
  const result = { ...values }
  for (const control of flattenControls(strategy)) {
    if (isBinaryControl(control)) result[control.id] = controlParameterValue(control, values[control.id])
    if (control.type === 'Clock_t') result[control.id] = clockRuleValue(values[control.id])
  }
  return result
}

/** Assign through the same parameter/radio relationships for user edits and value rules. */
export function assignControlValue(strategy: AtdlStrategyDto, values: Record<string, unknown>, control: AtdlControlDto, value: unknown, readonlyIds: ReadonlySet<string>, now?: Date): boolean {
  if (readonlyIds.has(control.id)) return false
  const controls = flattenControls(strategy)
  if (isLockedRadio(control, controls, values, readonlyIds)) return false
  const parameterName = control.parameterRef ?? control.parameter?.name
  const parameterValue = controlParameterValue(control, value)
  let changed = false
  for (const sibling of controls) {
    if (readonlyIds.has(sibling.id)) continue
    let next = values[sibling.id]
    if (sibling.id === control.id) next = value
    else if (parameterName && parameterName === (sibling.parameterRef ?? sibling.parameter?.name)) {
      next = normalizeControlValue(sibling, parameterValue)
      if (isBinaryControl(sibling) && (sibling.checkedEnumRef || sibling.uncheckedEnumRef)) next = parameterValue == null ? null : parameterValue === sibling.checkedEnumRef
      if (sibling.parameter?.type === 'Percentage_t' && !sibling.parameter.enumValues?.length) next = isUnfilledAtdlValue(parameterValue) ? null : formatDecimal(parameterValue, null, -2) ?? parameterValue
      if (sibling.type === 'Clock_t') next = createClockValue(sibling, control.type === 'Clock_t' ? clockWireValue(value) : parameterValue, now, 'wire')
    } else if (control.type === 'RadioButton_t' && value === true && control.radioGroup && sibling.type === 'RadioButton_t' && sibling.radioGroup === control.radioGroup) next = false
    const equal = Object.is(values[sibling.id], next) || (Array.isArray(values[sibling.id]) && Array.isArray(next) && JSON.stringify(values[sibling.id]) === JSON.stringify(next))
    if (!equal) { values[sibling.id] = next; changed = true }
  }
  return changed
}

export function isLockedRadio(control: AtdlControlDto, controls: AtdlControlDto[], values: Record<string, unknown>, readonlyIds: ReadonlySet<string>): boolean {
  return control.type === 'RadioButton_t' && !!control.radioGroup && controls.some(sibling =>
    sibling.radioGroup === control.radioGroup && sibling.type === 'RadioButton_t' && values[sibling.id] === true && readonlyIds.has(sibling.id))
}
