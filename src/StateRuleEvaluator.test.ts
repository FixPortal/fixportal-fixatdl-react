/**
 * Shared-corpus test: runs the TypeScript StateRuleEvaluator against the same
 * JSON cases shipped as the backend-owned contracts/atdl corpus.
 *
 * WHY shared corpus: a single source of truth (state-rule-cases.json) ensures
 * both implementations agree on every edge case - numeric coercion, fail-safe
 * returns, vacuous truth for AND([]), exactly-one XOR, etc.  Any divergence is
 * caught here rather than discovered at runtime.
 */
import { describe, it, expect } from 'vitest'
import corpus from '../contracts/state-rule-cases.json'
import { evaluateStateRule, tryEvaluateStateRule } from './StateRuleEvaluator'
import type { StateRuleAstNode } from './stateRuleAst'

describe('StateRuleEvaluator (shared C# corpus)', () => {
  for (const c of corpus) {
    it(c.name, () => {
      expect(evaluateStateRule(c.ast as unknown as StateRuleAstNode, c.formState)).toBe(c.expected)
    })
  }
})

describe('StateRuleEvaluator depth guard', () => {
  // The inner compare is deliberately one that evaluates TRUE, so a test asserting
  // false is asserting the guard fired - not merely that the rule happened to be
  // false anyway.
  const satisfiedLeaf: StateRuleAstNode = { kind: 'compare', operator: '==', field: 'X', value: '1' }

  const nest = (kind: 'and' | 'not', levels: number): StateRuleAstNode => {
    let node: StateRuleAstNode = satisfiedLeaf
    for (let i = 0; i < levels; i++) node = { kind, children: [node] }
    return node
  }

  it('returns false instead of overflowing the stack beyond MAX_DEPTH', () => {
    // AND is depth-transparent (every() over one child returns that child's value),
    // so the guard's verdict arrives at the root unaltered.  This is the plain case.
    expect(evaluateStateRule(nest('and', 110), { X: '1' })).toBe(false)
  })

  it('fails closed at the root even under an odd number of NOT wrappers', () => {
    // The regression this pins.  A `return false` AT THE DEPTH CUT is inverted once
    // per level on the way back up: under an odd number of `not` wrappers it arrives
    // at the root as TRUE, so a pathological rule evaluates as SATISFIED - the exact
    // inverse of the documented fail-safe.  The guard must therefore unwind to the
    // root, not return a value into a chain of combinators that keep transforming it.
    expect(evaluateStateRule(nest('not', 111), { X: '1' })).toBe(false)
    expect(evaluateStateRule(nest('not', 110), { X: '1' })).toBe(false)
  })

  it('still evaluates normally just under the limit', () => {
    // Guards the other direction: the cut must not fire early and turn a legitimate
    // deep-but-legal rule into a silent false.
    expect(evaluateStateRule(nest('and', 64), { X: '1' })).toBe(true)
  })
})

it.each([false, true])('fails closed for an unknown node kind, nested under NOT: %s', nested => {
  const unknown = { kind: 'future-extension' } as unknown as StateRuleAstNode
  const node: StateRuleAstNode = nested ? { kind: 'not', children: [unknown] } : unknown
  expect(evaluateStateRule(node, {})).toBe(false)
})


it.each(['Data_t', 'data_t', 'Tenor_t', 'MonthYear_t', 'TZTimeOnly_t', 'TZTimestamp_t'])('reports invalid typed comparisons under NOT: %s', comparisonType => {
  const expression: StateRuleAstNode = { kind: 'not', children: [{ kind: 'compare', operator: '==', field: 'a', value: 'invalid', comparisonType }] }
  expect(tryEvaluateStateRule(expression, { a: 'invalid' })).toBeNull()
  expect(evaluateStateRule(expression, { a: 'invalid' })).toBe(false)
})

it('distinguishes a valid false rule from a malformed rule', () => {
  expect(tryEvaluateStateRule({ kind: 'compare', operator: '==', field: 'a', value: 1 }, { a: 2 })).toBe(false)
  expect(tryEvaluateStateRule({ kind: 'compare', operator: 'bogus', field: 'a', value: 1 } as unknown as StateRuleAstNode, { a: 2 })).toBeNull()
})
