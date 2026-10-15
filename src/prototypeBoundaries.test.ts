import { describe, expect, it } from 'vitest'
import { evaluateStateRule, tryEvaluateStateRule } from './StateRuleEvaluator.js'
import { mapControlValuesToParameters } from './atdlControls.js'
import type { AtdlStrategyDto } from './types.js'

function strategy(controlId: string): AtdlStrategyDto {
  return {
    name: 'Prototype boundary',
    parameters: [],
    sourceXml: '<Strategy />',
    panel: {
      border: 'None',
      orientation: 'Vertical',
      collapsible: false,
      collapsed: false,
      children: [
        {
          kind: 'control',
          id: controlId,
          type: 'TextField_t',
          parameterRef: 'Value',
          stateRules: [],
        },
      ],
    },
  }
}

describe('inherited names are not supplied FIXatdl values', () => {
  it.each(['constructor', 'toString', '__proto__'])(
    'does not treat inherited %s as filled',
    (field) => {
      // Plain objects are intentional: the hook's null-prototype state cannot expose this regression.
      expect(
        evaluateStateRule({ field, kind: 'compare', operator: 'exists', value: null }, {}),
      ).toBe(false)
      expect(
        evaluateStateRule({ field, kind: 'compare', operator: 'not-exists', value: null }, {}),
      ).toBe(true)
      expect(
        evaluateStateRule(
          { field, kind: 'compare', operator: 'exists', value: null },
          { [field]: 'supplied' },
        ),
      ).toBe(true)
    },
  )

  it.each(['constructor', 'toString', '__proto__'])(
    'does not read inherited right-hand field %s',
    (field2) => {
      const rule = { field2, kind: 'compare', field: 'left', operator: '==', value: null } as const
      expect(evaluateStateRule(rule, { left: null })).toBe(true)
      expect(evaluateStateRule(rule, { left: 'supplied', [field2]: 'supplied' })).toBe(true)
    },
  )

  it.each(['constructor', 'toString', '__proto__'])(
    'does not select inherited comparer %s',
    (comparisonType) => {
      const rule = {
        kind: 'compare',
        field: 'left',
        operator: '>',
        value: 2,
        comparisonType,
      } as const
      // Unknown types use normal untyped comparison, not an Object.prototype function.
      expect(() => tryEvaluateStateRule(rule, { left: 3 })).not.toThrow()
      expect(tryEvaluateStateRule(rule, { left: 3 })).toBe(true)
      expect(tryEvaluateStateRule(rule, { left: 1 })).toBe(false)
    },
  )

  it.each(['constructor', 'toString', '__proto__'])(
    'maps only an own value for control %s',
    (id) => {
      expect(mapControlValuesToParameters(strategy(id), {})).toEqual({})
      expect(mapControlValuesToParameters(strategy(id), { [id]: 'supplied' })).toEqual({
        Value: 'supplied',
      })
    },
  )
})
