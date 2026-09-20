import { describe, it, expect } from 'vitest'
import { collectRuleRows } from './ruleRows'
import type { AtdlStrategyDto } from './types'

const strategy = {
  name: 'S', description: null, parameters: [],
  panel: {
    title: null, border: 'None', orientation: 'VERTICAL', collapsible: false, collapsed: false,
    children: [
      { kind: 'control', id: 'price', type: 'TextField_t', label: 'Price', parameter: null,
        listItems: null, initValue: null, tooltip: null,
        stateRules: [{ effect: 'enabled', targetValue: false,
          expression: { kind: 'compare', operator: '==', field: 'OrdType', value: '1' } }] },
    ],
  },
} as unknown as AtdlStrategyDto

describe('collectRuleRows', () => {
  it('exposes the assigned string for a value rule', () => {
    const copy = structuredClone(strategy)
    const control = copy.panel.children[0]
    if (control.kind !== 'control') throw new Error('Expected control fixture')
    control.stateRules[0] = { ...control.stateRules[0], effect: 'value', targetStringValue: '25' }
    expect(collectRuleRows(copy, { OrdType: '1' })[0]).toMatchObject({ targetValue: '25', firing: true })
  })
  it('emits one row per control state rule with readable text and target label', () => {
    const rows = collectRuleRows(strategy, { OrdType: '2' })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      controlId: 'price', controlLabel: 'Price', effect: 'enabled',
      targetValue: false, conditionText: 'OrdType == "1"', firing: false,
    })
  })
  it('reports firing=true when the live values satisfy the condition', () => {
    const rows = collectRuleRows(strategy, { OrdType: '1' })
    expect(rows[0].firing).toBe(true)
  })
})
