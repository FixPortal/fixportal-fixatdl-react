import { describe, expect, it } from 'vitest'
import * as api from './index'

// Pins the published runtime surface: nothing else in the repository imports
// './index', so a renamed, removed, or type-only-ified value export would ship
// to npm with every other gate green. Type-only exports (PanelRendererProps,
// FixTag, `export type * from './types'`, ...) produce no runtime keys and are
// intentionally absent here.
const expectedExports: Record<string, 'function' | 'object'> = {
  PanelRenderer: 'function',
  FormRenderer: 'function',
  useAtdlFormState: 'function',
  controlRegistry: 'object',
  flattenControls: 'function',
  mapControlValuesToParameters: 'function',
  isUnfilledAtdlValue: 'function',
  clockDisplayValue: 'function',
  clockWireValue: 'function',
  evaluateStateRule: 'function',
  stateRuleToText: 'function',
  stateRuleToTree: 'function',
  collectRuleRows: 'function',
  emitStrategyParametersGrp: 'function',
  fixTypeCodeName: 'function',
}

describe('public export surface', () => {
  it('exposes exactly the expected runtime exports', () => {
    expect(Object.keys(api).sort()).toEqual(Object.keys(expectedExports).sort())
  })

  it.each(Object.entries(expectedExports))('%s has runtime type %s', (name, expectedType) => {
    expect(typeof (api as unknown as Record<string, unknown>)[name]).toBe(expectedType)
  })
})
