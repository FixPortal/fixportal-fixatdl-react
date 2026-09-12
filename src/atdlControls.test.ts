import { describe, it, expect } from 'vitest'
import { flattenControls, mapControlValuesToParameters, assignControlValue } from './atdlControls'
import type { AtdlPanelChildDto, AtdlPanelDto, AtdlStrategyDto, AtdlParameterDto } from './types'

function control(id: string, parameterRef: string | null) {
  return {
    id,
    parameterRef,
    type: 'TextField_t',
    label: id,
    parameter: null,
    listItems: null,
    initValue: null,
    stateRules: [],
    tooltip: null,
    kind: 'control' as const,
  }
}

function panel(children: AtdlPanelChildDto[]) {
  return {
    children,
    title: null,
    border: 'None',
    orientation: 'Vertical',
    collapsible: false,
    collapsed: false,
    kind: 'panel' as const,
  }
}

function strategy(p: AtdlPanelDto): AtdlStrategyDto {
  return { name: 'S', description: null, parameters: [], panel: p, sourceXml: '<Strategy />' }
}

describe('flattenControls', () => {
  it('returns controls from nested panels in document order', () => {
    const s = strategy(panel([
      control('c_A', 'A'),
      panel([control('c_B', 'B'), control('c_C', 'C')]),
    ]))
    expect(flattenControls(s).map(c => c.id)).toEqual(['c_A', 'c_B', 'c_C'])
  })
})

describe('mapControlValuesToParameters', () => {
  it.each([['bad', 'bad'], ['12.5', '12.5'], ['', null], [null, null]])('preserves invalid linked percentage input: %s', (value, expected) => {
    const parameter: AtdlParameterDto = { name: 'P', type: 'Percentage_t', fixTag: 9001, enumValues: null, min: null, max: null, precision: null, mutableOnCxlRpl: true, useValue: 'optional', defaultValue: null }
    const first = { ...control('first', 'P'), parameter }
    const second = { ...control('second', 'P'), parameter }
    const values: Record<string, unknown> = {}
    assignControlValue(strategy(panel([first, second])), values, first, value, new Set())
    expect(values.second).toBe(expected)
  })
  it('rekeys control-id values to their parameter names', () => {
    const s = strategy(panel([control('c_StartTime', 'StartTime'), control('c_Part', 'Participation')]))
    const out = mapControlValuesToParameters(s, { c_StartTime: '09:30', c_Part: '25' })
    expect(out).toEqual({ StartTime: '09:30', Participation: '25' })
  })

  it('skips controls with no bound parameter', () => {
    const s = strategy(panel([control('c_label', null), control('c_Qty', 'Qty')]))
    const out = mapControlValuesToParameters(s, { c_label: 'ignored', c_Qty: 100 })
    expect(out).toEqual({ Qty: 100 })
  })

  it('omits parameters whose control was never given a value', () => {
    const s = strategy(panel([control('c_Qty', 'Qty'), control('c_Price', 'Price')]))
    const out = mapControlValuesToParameters(s, { c_Qty: 100 })
    expect(out).toEqual({ Qty: 100 })
  })

  it('preserves falsy-but-present values (0, empty string) so the emitter decides', () => {
    const s = strategy(panel([control('c_Qty', 'Qty'), control('c_Note', 'Note')]))
    const out = mapControlValuesToParameters(s, { c_Qty: 0, c_Note: '' })
    expect(out).toEqual({ Qty: 0, Note: '' })
  })
})
