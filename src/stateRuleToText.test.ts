import { describe, it, expect } from 'vitest'
import { stateRuleToText, stateRuleToTree } from './stateRuleToText'
import type { StateRuleAstNode } from './stateRuleAst'

const cmp = (operator: string, field: string, value: unknown): StateRuleAstNode =>
  ({ kind: 'compare', operator: operator as never, field, value })

describe('stateRuleToText', () => {
  it.each([true, false, null])('distinguishes %s from a string literal', value => {
    expect(stateRuleToText(cmp('==', 'a', value))).toBe(`a == ${String(value)}`)
  })
  it('renders malformed compound children without throwing', () => {
    expect(stateRuleToText({ kind: 'and', children: [null] } as unknown as StateRuleAstNode)).toContain('(invalid rule)')
  })
  it('renders a literal comparison with quoted string value', () => {
    expect(stateRuleToText(cmp('==', 'OrdType', '1'))).toBe('OrdType == "1"')
  })
  it('renders a numeric comparison unquoted', () => {
    expect(stateRuleToText(cmp('>', 'Price', 100))).toBe('Price > 100')
  })
  it('renders existence operators as words', () => {
    expect(stateRuleToText(cmp('exists', 'Account', null))).toBe('Account exists')
    expect(stateRuleToText(cmp('not-exists', 'Account', null))).toBe('Account not exists')
  })
  it('parenthesises compound children inside AND/OR', () => {
    const node: StateRuleAstNode = {
      kind: 'or',
      children: [cmp('==', 'OrdType', '1'), { kind: 'and', children: [cmp('==', 'TimeInForce', 'GTC'), cmp('>', 'Price', 100)] }],
    }
    expect(stateRuleToText(node)).toBe('OrdType == "1" OR (TimeInForce == "GTC" AND Price > 100)')
  })
  it('renders NOT with its single child', () => {
    expect(stateRuleToText({ kind: 'not', children: [cmp('==', 'X', '1')] })).toBe('NOT (X == "1")')
  })
  it('joins XOR children with the XOR keyword', () => {
    const node: StateRuleAstNode = { kind: 'xor', children: [cmp('==', 'A', '1'), cmp('==', 'B', '2')] }
    expect(stateRuleToText(node)).toBe('A == "1" XOR B == "2"')
  })
})

describe('stateRuleToText depth guard', () => {
  it('returns sentinel instead of recursing beyond MAX_DEPTH', () => {
    // Build a chain of 110 nested NOT nodes - beyond the shared 64-deep limit.
    let node: StateRuleAstNode = cmp('==', 'X', '1')
    for (let i = 0; i < 110; i++) node = { kind: 'not', children: [node] }
    // Should not throw or overflow the stack.
    const result = stateRuleToText(node)
    expect(result).toContain('(nested too deep)')
  })
})

describe('stateRuleToTree', () => {
  it('emits operator parents and comparison leaves with depth', () => {
    const node: StateRuleAstNode = {
      kind: 'or',
      children: [cmp('==', 'OrdType', '1'), { kind: 'and', children: [cmp('==', 'TimeInForce', 'GTC'), cmp('>', 'Price', 100)] }],
    }
    expect(stateRuleToTree(node)).toEqual([
      { depth: 0, text: 'OR', isOperator: true },
      { depth: 1, text: 'OrdType == "1"', isOperator: false },
      { depth: 1, text: 'AND', isOperator: true },
      { depth: 2, text: 'TimeInForce == "GTC"', isOperator: false },
      { depth: 2, text: 'Price > 100', isOperator: false },
    ])
  })

  it('emits a single leaf line at depth 0 for a bare comparison', () => {
    expect(stateRuleToTree(cmp('==', 'X', '1'))).toEqual([
      { depth: 0, text: 'X == "1"', isOperator: false },
    ])
  })

  it('emits NOT as an operator parent with its child indented', () => {
    expect(stateRuleToTree({ kind: 'not', children: [cmp('==', 'X', '1')] })).toEqual([
      { depth: 0, text: 'NOT', isOperator: true },
      { depth: 1, text: 'X == "1"', isOperator: false },
    ])
  })
})
