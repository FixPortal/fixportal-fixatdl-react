/**
 * TypeScript twin of the C# `StateRuleEvaluator`.
 *
 * WHY: The FIXatdl state-rule engine must run in the browser (to show/hide
 * controls in real time) with identical semantics to the server-side C#
 * implementation.  A shared JSON corpus (state-rule-cases.json) provides the
 * contract; any divergence in coercion or logic is caught by the shared-corpus
 * Vitest test.
 *
 * Coercion policy mirrors the C# implementation exactly:
 *  - Numeric ordering operators (>, <, >=, <=): both operands converted to
 *    double; if either fails, returns false (fail-safe - NOT true, which would
 *    be the dangerous default for >= and <=).
 *  - Equality (==, !=): numeric coercion attempted first; if either side fails,
 *    falls back to ordinal string comparison.
 *  - Missing field: returns false for all comparison operators (fail-safe while
 *    controls are still initialising).
 *  - exists / not-exists: test key presence AND non-null value.
 */

import type { StateRuleAstNode } from './stateRuleAst'

/** Guard against pathological AST nesting from malformed server payloads. */
const MAX_DEPTH = 100

/**
 * Thrown for an invalid node or at the depth cut and caught at the root, so an over-deep rule fails
 * closed for the rule as a whole.
 *
 * WHY not `return false` at the cut: the cut point is buried under N combinators
 * that keep evaluating on the way back up, and `not` inverts.  Under an odd
 * number of `not` wrappers a returned `false` arrives at the root as `true` -
 * i.e. the pathological rule evaluates as SATISFIED, the exact opposite of the
 * fail-safe.  Unwinding to the root is the only way the guard's verdict is the
 * rule's verdict.  Throwing also preserves the stack-safety property: the stack
 * unwinds at depth 101 rather than growing.
 */
class InvalidRule extends Error {}

export function evaluateStateRule(
  node: StateRuleAstNode,
  formState: Record<string, unknown>,
  depth = 0,
): boolean {
  try {
    return evalNode(node, formState, depth)
  } catch (e) {
    // Fail-safe: treat unknown nodes and excessively nested rules as false so they don't apply.
    if (e instanceof InvalidRule) return false
    throw e
  }
}

function evalNode(
  node: StateRuleAstNode,
  formState: Record<string, unknown>,
  depth: number,
): boolean {
  if (depth > MAX_DEPTH) throw new InvalidRule()

  switch (node.kind) {
    case 'compare':
      return evalCompare(node, formState)

    case 'and':
      // All() on empty sequence = true (vacuous truth), matching C# LINQ behaviour.
      return node.children.every(c => evalNode(c, formState, depth + 1))

    case 'or':
      // Any() on empty sequence = false, matching C# LINQ behaviour.
      return node.children.some(c => evalNode(c, formState, depth + 1))

    case 'not': {
      // The type guarantees one child, but guard against malformed data cast
      // through the type boundary: a missing child fails closed (false) rather
      // than crashing the render path (M11).
      const child = node.children[0] as StateRuleAstNode | undefined
      return child ? !evalNode(child, formState, depth + 1) : false
    }

    case 'xor':
      // N-ary XOR: true when an odd number of children are true.
      // Implemented as successive boolean XOR (acc !== result), same as C# Aggregate(false, ^).
      return node.children.reduce<boolean>(
        (acc, c) => acc !== evalNode(c, formState, depth + 1),
        false,
      )

    default:
      throw new InvalidRule()
  }
}

function evalCompare(
  node: Extract<StateRuleAstNode, { kind: 'compare' }>,
  state: Record<string, unknown>,
): boolean {
  const hasKey = node.field in state
  const fieldValue = hasKey ? state[node.field] : undefined

  // Existence checks only care about key presence and null-ness.
  const presentAndNonNull = hasKey && fieldValue !== null && fieldValue !== undefined
  if (node.operator === 'exists') return presentAndNonNull
  if (node.operator === 'not-exists') return !presentAndNonNull

  // All other operators require the field to be present with a non-null value.
  // Missing or null = fail-safe false so the UI doesn't break during control init.
  if (!hasKey || fieldValue === undefined || fieldValue === null) return false

  return evalCompareOperator(node.operator, fieldValue, node.value)
}

function evalCompareOperator(
  operator: string,
  fieldValue: unknown,
  nodeValue: unknown,
): boolean {
  if (operator === '==' || operator === '!=') {
    return evalEquality(operator, fieldValue, nodeValue)
  }
  return evalNumericOrder(operator, fieldValue, nodeValue)
}

function evalEquality(operator: '==' | '!=', fieldValue: unknown, nodeValue: unknown): boolean {
  // WHY numeric-first: the AST value might be a number literal (from JSON)
  // while the field value is a string (from the form control), e.g. "5" vs 5.
  // Converting both to double before comparing matches C# CompareEqual().
  const a = toNumber(fieldValue)
  const b = toNumber(nodeValue)
  const equal =
    a !== null && b !== null
      ? a === b
      : String(fieldValue) === String(nodeValue)
  return operator === '==' ? equal : !equal
}

function evalNumericOrder(operator: string, fieldValue: unknown, nodeValue: unknown): boolean {
  const a = toNumber(fieldValue)
  const b = toNumber(nodeValue)
  // WHY early return false on coercion failure: returning 0 from a helper and
  // comparing would make >= and <= pass on non-numeric values (0 >= 0 = true),
  // which is the exact T6 fixup bug this matches (see c64b895).
  if (a === null || b === null) return false
  if (operator === '>') return a > b
  if (operator === '<') return a < b
  if (operator === '>=') return a >= b
  if (operator === '<=') return a <= b
  return false
}

/**
 * Attempts to convert an arbitrary value to a finite number.
 * Returns `null` on failure rather than a sentinel (avoids 0-as-fallback bugs).
 *
 * WHY empty-string is null: `Number("") === 0` in JS, but an empty string is not
 * a numeric value - treating it as 0 would silently mis-compare.
 * WHY boolean: C# `Convert.ToDouble(true)` returns 1.0 so booleans coerce.
 * WHY null/undefined guard first: `Number(null) === 0` in JS, which would
 * wrongly succeed.
 */
function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') {
    if (v.trim() === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}
