import type { AtdlStrategyDto } from './types'
import { flattenControls, controlValuesForRules } from './atdlControls'
import { evaluateStateRule } from './StateRuleEvaluator'
import { stateRuleToText } from './stateRuleToText'
import type { StateRuleAstNode } from './stateRuleAst'

export interface RuleRow {
  controlId: string
  controlLabel: string
  effect: string
  targetValue: boolean | string | null
  conditionText: string
  expression: StateRuleAstNode
  firing: boolean
}

/**
 * WHY: One row per control state rule, with the readable condition text and its
 * live truth against the current form values. In FIXatdl a StateRule governs the
 * control it is defined on, so the row's target is that control - matching
 * applyStateRules in useAtdlFormState. Reuses the shared evaluator; no second
 * evaluation path.
 */
export function collectRuleRows(
  strategy: AtdlStrategyDto,
  values: Record<string, unknown>,
  externalValues: Record<string, unknown> = {},
): RuleRow[] {
  const rows: RuleRow[] = []
  const ruleValues = { ...externalValues, ...controlValuesForRules(strategy, values) }
  for (const control of flattenControls(strategy)) {
    for (const rule of control.stateRules ?? []) {
      // expression is typed StateRuleAstNodeDto on the wire; cast to the evaluator's
      // node type exactly as useAtdlFormState does.
      const expression = rule.expression as unknown as StateRuleAstNode
      rows.push({
        controlId: control.id,
        controlLabel: control.label ?? control.id,
        effect: rule.effect,
        targetValue: rule.effect === 'value' ? rule.targetStringValue : rule.targetValue,
        conditionText: stateRuleToText(expression),
        expression,
        firing: evaluateStateRule(expression, ruleValues),
      })
    }
  }
  return rows
}
