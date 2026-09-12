import { useMemo, useState, useCallback } from 'react'
import type { AtdlStrategyDto, AtdlControlDto, AtdlStateRuleDto } from './types'
import { evaluateStateRule } from './StateRuleEvaluator'
import { flattenControls } from './atdlControls'
import { isUnfilledAtdlValue } from './atdlValue'
import type { StateRuleAstNode } from './stateRuleAst'

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export interface ControlFormState {
  enabled: boolean
  visible: boolean
  required: boolean
  errors: string[]
}

export interface AtdlFormStateApi {
  values: Record<string, unknown>
  setValue(controlId: string, value: unknown): void
  controlState: Record<string, ControlFormState>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * WHY: Central form-state manager for a single ATDL strategy. Owns the mutable
 * control-value map, derives per-control UI state (enabled / visible / required)
 * by evaluating each StateRule live, and runs per-type validation whenever values
 * change. Keeps all state in one place so renderers stay pure presentational.
 */
export function useAtdlFormState(strategy: AtdlStrategyDto): AtdlFormStateApi {
  const [values, setValues] = useState<Record<string, unknown>>(
    () => applyValueRules(strategy, seedValues(strategy), null),
  )

  const setValue = useCallback((controlId: string, value: unknown) => {
    setValues(prev => applyValueRules(strategy, { ...prev, [controlId]: value }, prev))
  }, [strategy])

  // WHY useMemo: controlState is a pure function of strategy + values. Re-deriving
  // only when those change avoids O(controls × rules) work on every render.
  const controlState = useMemo(
    () => deriveControlState(strategy, values),
    [strategy, values],
  )

  return { values, setValue, controlState }
}

// ---------------------------------------------------------------------------
// Value seeding
// ---------------------------------------------------------------------------

function seedValues(strategy: AtdlStrategyDto): Record<string, unknown> {
  const seeded: Record<string, unknown> = {}
  for (const control of flattenControls(strategy)) {
    const defaultValue = control.parameter?.defaultValue
    if (control.initValue !== null && control.initValue !== undefined) {
      seeded[control.id] = control.initValue
    } else if (defaultValue !== null && defaultValue !== undefined) {
      seeded[control.id] = defaultValue
    } else {
      // WHY: leaving the key absent means `exists` evaluates to false for
      // uninitialised controls, matching FIXatdl semantics where absent = not set.
    }
  }
  return seeded
}

// ---------------------------------------------------------------------------
// Value StateRules
// ---------------------------------------------------------------------------

/**
 * WHY: A FIXatdl `value` StateRule assigns a value to its control while its expression
 * holds. Unlike `enabled` and `visible`, which only derive a control's UI state, it writes
 * into the form's value map - so it cannot live in deriveControlState, which is a pure
 * derivation from values and would feed back into itself.
 *
 * The payload is `targetStringValue`; the mapper leaves `targetValue` a meaningless `false`
 * for this effect.
 *
 * Edge-triggered: a rule fires on the false -> true transition of its expression, not on
 * every evaluation while it stays true. Re-applying continuously would pin the control and
 * revert the user's own keystrokes for as long as the condition held. FIXatdl expects such
 * a control to be disabled by a companion rule, but a mis-authored file must not be able to
 * make the form untypeable. `prev === null` means the initial seed: there is no prior state
 * to transition from, so every rule that holds against the seeded values applies.
 *
 * ponytail: Single pass, evaluated against `next` and applied together, so the outcome does not depend
 * on rule order (two rules assigning the same control resolve last-wins, in document order,
 * matching applyStateRules). A value rule reading a control that another value rule has just
 * assigned therefore settles on the next edit rather than within this one; cascading value
 * rules are rare. Upgrade path if they appear: iterate to a fixed point with a pass cap - a
 * cap, because two rules can flip-flop forever.
 */
function applyValueRules(
  strategy: AtdlStrategyDto,
  next: Record<string, unknown>,
  prev: Record<string, unknown> | null,
): Record<string, unknown> {
  let result = next

  for (const control of flattenControls(strategy)) {
    for (const rule of control.stateRules) {
      if (rule.effect !== 'value' || rule.targetStringValue === null) continue

      const expression = rule.expression as unknown as StateRuleAstNode
      if (!evaluateStateRule(expression, next)) continue

      // Already firing before this edit - leave the control alone so the user can type over it.
      if (prev !== null && evaluateStateRule(expression, prev)) continue

      if (result === next) result = { ...next }
      result[control.id] = rule.targetStringValue
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// State derivation
// ---------------------------------------------------------------------------

function deriveControlState(
  strategy: AtdlStrategyDto,
  values: Record<string, unknown>,
): Record<string, ControlFormState> {
  const result: Record<string, ControlFormState> = {}

  for (const control of flattenControls(strategy)) {
    // Start permissive: enabled, visible, not required. Rules override from here.
    const base = { enabled: true, visible: true, required: control.parameter?.useValue === 'required' }

    applyStateRules(control.stateRules, values, base)

    const errors = validateControl(control, values[control.id], base.required)
    result[control.id] = { ...base, errors }
  }

  return result
}

// Panel traversal lives in ./atdlControls (shared with the FIX preview).

function applyStateRules(
  rules: AtdlStateRuleDto[],
  values: Record<string, unknown>,
  base: { enabled: boolean; visible: boolean; required: boolean },
): void {
  for (const rule of rules) {
    // WHY: The mapper emits AtdlStateRuleDto(effect, targetValue, expression) where
    // targetValue is the value the effect-field should take WHEN the expression is
    // true. For example: effect="enabled", targetValue=false, expression=(x=="A")
    // means "disable this control while x equals A". When expression is false the
    // rule has no effect and base stays at its prior value.
    //
    // Multiple rules for the same effect: the last rule whose expression evaluates
    // true wins. This matches FIXatdl, which evaluates all StateRules in document
    // order and lets the final firing rule be authoritative.
    const expressionTrue = evaluateStateRule(
      rule.expression as unknown as StateRuleAstNode,
      values,
    )
    if (!expressionTrue) continue

    if (rule.effect === 'enabled') base.enabled = rule.targetValue
    else if (rule.effect === 'visible') base.visible = rule.targetValue
    else {
      // `value` rules write into the form's value map, not a control's UI state -
      // applyValueRules owns them. Any other effect is unknown and ignored (forward-compat).
      //
      // Note there is no `required` effect: FIXatdl StateRule carries only enabled, visible
      // and value, and AtdlDtoMapper emits exactly those three. base.required comes from the
      // parameter's useValue, set in deriveControlState.
    }
  }
}

// ---------------------------------------------------------------------------
// Per-control validation
// ---------------------------------------------------------------------------

const INTEGER_TYPES = new Set(['Int_t', 'NumInGroup_t', 'Length_t', 'SeqNum_t', 'TagNum_t', 'NumInMsg_t'])
const FLOAT_TYPES = new Set(['Float_t', 'Qty_t', 'Price_t', 'PriceOffset_t', 'Amt_t', 'Percentage_t'])
// WHY: anchored integer pattern - no decimal allowed.
const INTEGER_PATTERN = /^-?\d+$/
// WHY: anchored decimal pattern - optional fractional part.
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/

function validateStringType(t: string | null | undefined, value: string, errs: string[]): void {
  if (INTEGER_TYPES.has(t ?? '')) {
    if (!INTEGER_PATTERN.test(value)) errs.push('Must be a whole number.')
  } else if (FLOAT_TYPES.has(t ?? '')) {
    if (!DECIMAL_PATTERN.test(value)) errs.push('Must be a number.')
  } else {
    // Other types have no string-format constraint at the UI layer.
  }
}

function validateRangeBounds(
  control: AtdlControlDto,
  value: number,
  errs: string[],
): void {
  const min = control.parameter?.min
  const max = control.parameter?.max
  if (min !== null && min !== undefined && value < Number(min)) {
    errs.push(`Must be ≥ ${min}.`)
  }
  if (max !== null && max !== undefined && value > Number(max)) {
    errs.push(`Must be ≤ ${max}.`)
  }
}

function validateControl(
  control: AtdlControlDto,
  value: unknown,
  required: boolean,
): string[] {
  const errs: string[] = []

  if (required && isUnfilledAtdlValue(value)) {
    errs.push('This field is required.')
  }

  // WHY: Type-specific validation is intentionally lightweight - just a
  // format/range guard to surface obvious user mistakes early, not a full
  // FIXatdl compliance check (that lives server-side). Only validate non-empty
  // strings so blank optional fields are silent.
  if (typeof value === 'string' && value !== '') {
    validateStringType(control.parameter?.type, value, errs)
    const isNumericType =
      INTEGER_TYPES.has(control.parameter?.type ?? '') ||
      FLOAT_TYPES.has(control.parameter?.type ?? '')
    if (isNumericType && DECIMAL_PATTERN.test(value)) {
      validateRangeBounds(control, Number(value), errs)
    }
  }

  // Range checks apply when value is numeric (e.g. a spinner control yields a number).
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) errs.push('Must be a finite number.')
    else {
      if (INTEGER_TYPES.has(control.parameter?.type ?? '') && !Number.isInteger(value)) {
        errs.push('Must be a whole number.')
      }
      validateRangeBounds(control, value, errs)
    }
  }

  return errs
}
