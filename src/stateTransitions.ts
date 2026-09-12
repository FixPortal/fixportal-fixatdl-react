import type { AtdlStrategyDto } from './types'
import type { StateRuleAstNode } from './stateRuleAst'
import { flattenControls, controlValuesForRules, assignControlValue } from './atdlControls'
import { normalizeControlValue } from './atdlValue'
import { editClockValue } from './atdlClock'
import { evaluateStateRule } from './StateRuleEvaluator'

interface RuleMemory { active: boolean; previousValue: unknown }
export interface ValueRuleState {
  values: Record<string, unknown>
  rules: RuleMemory[]
  errors: string[]
}

/** Settle value transitions before rendering or reading values for submission. */
export function settleValueRules(
  strategy: AtdlStrategyDto,
  next: Record<string, unknown>,
  previous?: ValueRuleState,
  readonlyIds: ReadonlySet<string> = new Set(),
  now?: Date,
  externalValues: Record<string, unknown> = {},
): ValueRuleState {
  const bindings = flattenControls(strategy).flatMap(control =>
    control.stateRules.filter(rule => rule.effect === 'value' && rule.targetStringValue !== null)
      .map(rule => ({ control, rule })),
  )
  const rules = bindings.map((_, index) => ({
    active: previous?.rules[index]?.active ?? false,
    previousValue: structuredClone(previous?.rules[index]?.previousValue),
  }))
  const values = { ...next }
  // ponytail: bounded full scans; use a dependency queue if large strategies need it.
  const maxPasses = Math.max(64, bindings.length * 4)
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false
    for (const [index, { control, rule }] of bindings.entries()) {
      if (readonlyIds.has(control.id)) continue
      const memory = rules[index]
      const active = evaluateStateRule(rule.expression as StateRuleAstNode, { ...externalValues, ...controlValuesForRules(strategy, values) })
      if (active === memory.active) continue
      let value: unknown
      if (active) {
        memory.previousValue = structuredClone(values[control.id])
        try {
          value = control.type === 'Clock_t'
            ? editClockValue(control, values[control.id], rule.targetStringValue!, now)
            : normalizeControlValue(control, rule.targetStringValue)
        } catch (error) {
          return { values, rules, errors: [`${control.id}: ${error instanceof Error ? error.message : String(error)}`] }
        }
      } else if (rule.targetStringValue === '{NULL}') {
        value = structuredClone(memory.previousValue)
      } else { memory.active = false; continue }
      try { changed = assignControlValue(strategy, values, control, value, readonlyIds, now) || changed }
      catch (error) { return { values, rules, errors: [`${control.id}: ${error instanceof Error ? error.message : String(error)}`] } }
      memory.active = active
    }
    if (!changed) return { values, rules, errors: [] }
  }
  return { values, rules, errors: ['State rules did not converge. Check for a cyclic value rule.'] }
}
