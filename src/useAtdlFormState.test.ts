import { describe, it, expect, vi } from 'vitest'
import { StrictMode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { useAtdlFormState } from './useAtdlFormState'
import type { AtdlStrategyDto, AtdlControlDto, AtdlParameterDto, AtdlStateRuleDto } from './types'
import type { StateRuleAstNodeDto } from './types'
import { mapControlValuesToParameters } from './atdlControls'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeParam(overrides: Partial<AtdlParameterDto> = {}): AtdlParameterDto {
  return {
    name: 'P1',
    fixTag: 9001,
    type: 'String_t',
    enumValues: null,
    min: null,
    max: null,
    precision: null,
    mutableOnCxlRpl: true,
    useValue: 'optional',
    defaultValue: null,
    ...overrides,
  }
}

function makeControl(overrides: Partial<AtdlControlDto> = {}): AtdlControlDto {
  return {
    id: 'ctrl1',
    type: 'TextField_t',
    label: 'Field 1',
    parameterRef: null,
    parameter: null,
    listItems: null,
    initValue: null,
    stateRules: [],
    tooltip: null,
    ...overrides,
  }
}

function makeEqExpression(field: string, value: unknown): StateRuleAstNodeDto {
  return { kind: 'compare', operator: '==', children: null, field, value }
}

function makeStrategy(controls: AtdlControlDto[]): AtdlStrategyDto {
  return {
    name: 'TestStrategy',
    description: null,
    parameters: [],
    panel: {
      title: null,
      border: 'None',
      orientation: 'Vertical',
      collapsible: false,
      collapsed: false,
      children: controls.map(c => ({ ...c, kind: 'control' as const })),
    },
    sourceXml: '',
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAtdlFormState', () => {
  it.each(['1', '2'])('loads either selected radio from an amended order: %s', wire => {
    const parameter = makeParam({ enumValues: [{ enumId: 'buy', wireValue: '1' }, { enumId: 'sell', wireValue: '2' }] })
    const strategy = makeStrategy(['buy', 'sell'].map(id => makeControl({ id, type: 'RadioButton_t', radioGroup: 'side', checkedEnumRef: id, parameter })))
    const { result } = renderHook(() => useAtdlFormState(strategy, { isAmendment: true, initialFixValues: { 9001: wire } }))
    expect(result.current.values).toEqual({ buy: wire === '1', sell: wire === '2' })
    expect(result.current.hasErrors).toBe(false)
  })

  it('excludes a boolean radio sibling sharing the same parameter', () => {
    const parameter = makeParam({ type: 'Boolean_t' })
    const strategy = makeStrategy(['a', 'b'].map(id => makeControl({ id, type: 'RadioButton_t', radioGroup: 'group', parameter })))
    const { result } = renderHook(() => useAtdlFormState(strategy))
    act(() => result.current.setValue('a', true))
    expect(result.current.values).toEqual({ a: true, b: false })
    act(() => result.current.setValue('b', true))
    expect(result.current.values).toEqual({ a: false, b: true })
  })

  it('reports a selected radio error only on the selected sibling', () => {
    const parameter = makeParam({ enumValues: [{ enumId: 'buy', wireValue: '1' }] })
    const strategy = makeStrategy([
      makeControl({ id: 'buy', type: 'RadioButton_t', radioGroup: 'side', checkedEnumRef: 'buy', parameter }),
      makeControl({ id: 'sell', type: 'RadioButton_t', radioGroup: 'side', checkedEnumRef: 'sell', parameter }),
    ])
    const { result } = renderHook(() => useAtdlFormState(strategy))
    act(() => result.current.setValue('sell', true))
    expect(result.current.controlState.sell.errors).toContain('Must be a declared enumeration value.')
    expect(result.current.controlState.buy.errors).toEqual([])
  })

  it.each(['__proto__', 'constructor'])('keeps control state safe for the reserved id %s', id => {
    const strategy = makeStrategy([makeControl({ id, initValue: 'safe' })])
    const { result } = renderHook(() => useAtdlFormState(strategy))
    expect(Object.hasOwn(result.current.values, id)).toBe(true)
    expect(result.current.values[id]).toBe('safe')
    expect(Object.hasOwn(result.current.controlState, id)).toBe(true)
  })

  it('allows partial typing beside a linked clock and synchronizes the completed timestamp', () => {
    const parameter = makeParam({ type: 'UTCTimestamp_t' })
    const strategy = makeStrategy([makeControl({ id: 'text', parameter }), makeControl({ id: 'clock', type: 'Clock_t', parameter, localMktTz: 'UTC' })])
    const { result } = renderHook(() => useAtdlFormState(strategy))
    act(() => result.current.setValue('text', '2'))
    expect(result.current.values.text).toBe('2')
    expect(result.current.hasErrors).toBe(true)
    act(() => result.current.setValue('text', '20260912-13:00:00'))
    expect(result.current.values.clock).toMatchObject({ instant: '20260912-13:00:00' })
    expect(result.current.hasErrors).toBe(false)
  })

  it.each([undefined, 'original'])('restores NULL rule absence or original value, without discarding active edits: %s', initValue => {
    const strategy = makeStrategy([
      makeControl({ id: 'trigger', initValue: 'off' }),
      makeControl({ id: 'target', initValue, stateRules: [{ effect: 'value', targetValue: false, targetStringValue: '{NULL}', expression: makeEqExpression('trigger', 'on') }] }),
    ])
    const { result } = renderHook(() => useAtdlFormState(strategy))
    act(() => result.current.setValue('trigger', 'on'))
    expect(result.current.values.target).toBeNull()
    act(() => result.current.setValue('trigger', 'off'))
    expect(Object.hasOwn(result.current.values, 'target')).toBe(initValue !== undefined)
    expect(result.current.values.target).toBe(initValue)
    act(() => result.current.setValue('trigger', 'on'))
    act(() => result.current.setValue('target', 'edited'))
    act(() => result.current.setValue('trigger', 'off'))
    expect(result.current.values.target).toBe('edited')
  })

  it.each([false, true])('reports a malformed multi-value constant without throwing during initialization, inverted=%s', invertOnWire => {
    const parameter = makeParam({ type: 'MultipleStringValue_t', constValue: 'unknown', enumValues: [{ enumId: 'a', wireValue: 'A' }], invertOnWire })
    const strategy = makeStrategy([makeControl({ type: 'MultiSelectList_t', parameter })])
    const { result } = renderHook(() => useAtdlFormState(strategy))
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.controlState.ctrl1.errors.join(' ')).toContain('Unknown enumeration wire value')
  })

  it('loads an enum-ID multi-value constant into the control', () => {
    const parameter = makeParam({ type: 'MultipleStringValue_t', constValue: 'a b', invertOnWire: true, enumValues: [{ enumId: 'a', wireValue: 'A' }, { enumId: 'b', wireValue: 'B' }, { enumId: 'c', wireValue: 'C' }] })
    const { result } = renderHook(() => useAtdlFormState(makeStrategy([makeControl({ type: 'MultiSelectList_t', parameter })])))
    expect(result.current.values.ctrl1).toEqual(['a', 'b'])
    expect(result.current.hasErrors).toBe(false)
  })

  it.each(['constructor', '__proto__', 'toString'])('treats unsupplied prototype-named parameters as absent in strategy edits: %s', name => {
    const strategy = makeStrategy([])
    strategy.parameters = [makeParam({ name })]
    strategy.strategyEdits = [{ errorMessage: 'Must be absent.', expression: { ...makeEqExpression(name, null), operator: 'not-exists' } }]
    const { result } = renderHook(() => useAtdlFormState(strategy))
    expect(result.current.hasErrors).toBe(false)
  })

  it('accepts custom Boolean wires with the backend-normalized Boolean AST literal', () => {
    const parameter = makeParam({ type: 'Boolean_t', trueWireValue: 'T', falseWireValue: 'F' })
    const strategy = makeStrategy([makeControl({ type: 'CheckBox_t', parameter, initValue: true })])
    strategy.parameters = [parameter]
    strategy.strategyEdits = [{ errorMessage: 'Must be true.', expression: { ...makeEqExpression('P1', true), comparisonType: 'Boolean_t' } }]
    const { result } = renderHook(() => useAtdlFormState(strategy))
    expect(result.current.hasErrors).toBe(false)
  })

  it('retains the backend no-selection radio fallback to unchecked mappings in document order', () => {
    const parameter = makeParam({ enumValues: ['a', 'b', 'noneA', 'noneB'].map(enumId => ({ enumId, wireValue: enumId })) })
    const strategy = makeStrategy(['a', 'b'].map(id => makeControl({ id, type: 'RadioButton_t', parameter, radioGroup: 'group', checkedEnumRef: id, uncheckedEnumRef: id === 'a' ? 'noneA' : 'noneB' })))
    const { result } = renderHook(() => useAtdlFormState(strategy))
    expect(mapControlValuesToParameters(strategy, result.current.values)).toEqual({ P1: 'noneB' })
  })
  it('seeds values from each control initValue', () => {
    const ctrl = makeControl({ id: 'ctrl1', initValue: 'hello' })
    const strategy = makeStrategy([ctrl])

    const { result } = renderHook(() => useAtdlFormState(strategy))

    expect(result.current.values['ctrl1']).toBe('hello')
  })

  it('seeds values from parameter defaultValue when initValue is absent', () => {
    const param = makeParam({ defaultValue: '42' })
    const ctrl = makeControl({ id: 'ctrl2', initValue: null, parameter: param })
    const strategy = makeStrategy([ctrl])

    const { result } = renderHook(() => useAtdlFormState(strategy))

    expect(result.current.values['ctrl2']).toBe('42')
  })

  it('updates values on setValue and triggers controlState recompute', () => {
    const ctrl = makeControl({ id: 'ctrl1' })
    const strategy = makeStrategy([ctrl])

    const { result } = renderHook(() => useAtdlFormState(strategy))

    expect(result.current.values['ctrl1']).toBeUndefined()

    // controlState is re-derived - the object reference changes on each set.
    // A stale object is also "defined", so capture and compare the reference.
    const stateBefore = result.current.controlState['ctrl1']

    act(() => {
      result.current.setValue('ctrl1', 'newVal')
    })

    expect(result.current.values['ctrl1']).toBe('newVal')
    expect(result.current.controlState['ctrl1']).not.toBe(stateBefore)
  })

  it('disables a control when its StateRule effect=enabled evaluates with targetValue=false', () => {
    // WHY: effect="enabled", targetValue=false means "disable when expression is true".
    // Initial value of trigger is "trigger" so the expression is immediately true.
    const triggerCtrl = makeControl({ id: 'trigger', initValue: 'trigger' })
    const rule: AtdlStateRuleDto = {
      effect: 'enabled',
      targetValue: false,
      targetStringValue: null,
      expression: makeEqExpression('trigger', 'trigger'),
    }
    const subject = makeControl({ id: 'subject', stateRules: [rule] })
    const strategy = makeStrategy([triggerCtrl, subject])

    const { result } = renderHook(() => useAtdlFormState(strategy))

    expect(result.current.controlState['subject'].enabled).toBe(false)

    // After changing the trigger to a non-matching value the rule no longer fires.
    act(() => {
      result.current.setValue('trigger', 'other')
    })

    expect(result.current.controlState['subject'].enabled).toBe(true)
  })

  it('hides a control when its StateRule effect=visible fires with targetValue=false', () => {
    const triggerCtrl = makeControl({ id: 'show_flag', initValue: 'hide' })
    const rule: AtdlStateRuleDto = {
      effect: 'visible',
      targetValue: false,
      targetStringValue: null,
      expression: makeEqExpression('show_flag', 'hide'),
    }
    const subject = makeControl({ id: 'hideable', stateRules: [rule] })
    const strategy = makeStrategy([triggerCtrl, subject])

    const { result } = renderHook(() => useAtdlFormState(strategy))

    expect(result.current.controlState['hideable'].visible).toBe(false)

    act(() => {
      result.current.setValue('show_flag', 'show')
    })

    expect(result.current.controlState['hideable'].visible).toBe(true)
  })

  it('marks a control required from the parameter useValue, and surfaces an empty-value error', () => {
    // WHY: `required` is NOT a StateRule effect - FIXatdl StateRule carries only enabled,
    // visible and value, and the mapper emits exactly those three. A control is required
    // because its parameter says so, which is the path asserted here.
    const param = makeParam({ useValue: 'required' })
    const subject = makeControl({ id: 'qty', parameter: param })
    const strategy = makeStrategy([subject])

    const { result } = renderHook(() => useAtdlFormState(strategy))

    expect(result.current.controlState['qty'].required).toBe(true)
    expect(result.current.controlState['qty'].errors).toContain('This field is required.')

    act(() => {
      result.current.setValue('qty', '100')
    })

    expect(result.current.controlState['qty'].errors).not.toContain('This field is required.')
  })

  // -------------------------------------------------------------------------
  // effect=value - assigns into the value map rather than the control's UI state
  // -------------------------------------------------------------------------

  function makeValueRule(field: string, equals: string, assign: string): AtdlStateRuleDto {
    return {
      effect: 'value',
      // The mapper leaves targetValue a meaningless `false` for a value rule; the
      // payload rides on targetStringValue.
      targetValue: false,
      targetStringValue: assign,
      expression: makeEqExpression(field, equals),
    }
  }

  it('applies a value StateRule at seed when its expression already holds', () => {
    const ordType = makeControl({ id: 'ord_type', initValue: 'Market' })
    const price = makeControl({ id: 'price', initValue: '99', stateRules: [makeValueRule('ord_type', 'Market', '0')] })
    const strategy = makeStrategy([ordType, price])

    const { result } = renderHook(() => useAtdlFormState(strategy))

    // The rule holds against the seeded values, so it overrides price's own initValue.
    expect(result.current.values['price']).toBe('0')
  })

  it('fires a value StateRule when its expression transitions to true', () => {
    const ordType = makeControl({ id: 'ord_type', initValue: 'Limit' })
    const price = makeControl({ id: 'price', initValue: '99', stateRules: [makeValueRule('ord_type', 'Market', '0')] })
    const strategy = makeStrategy([ordType, price])

    const { result } = renderHook(() => useAtdlFormState(strategy))

    expect(result.current.values['price']).toBe('99')

    act(() => {
      result.current.setValue('ord_type', 'Market')
    })

    expect(result.current.values['price']).toBe('0')
  })

  it('does not re-apply a value StateRule while its expression stays true, so the user can type over it', () => {
    // WHY: value rules are edge-triggered. Re-applying on every evaluation would pin the
    // control and revert each keystroke for as long as the condition held.
    const ordType = makeControl({ id: 'ord_type', initValue: 'Market' })
    const price = makeControl({ id: 'price', stateRules: [makeValueRule('ord_type', 'Market', '0')] })
    const strategy = makeStrategy([ordType, price])

    const { result } = renderHook(() => useAtdlFormState(strategy))

    expect(result.current.values['price']).toBe('0')

    act(() => {
      result.current.setValue('price', '123')
    })

    // The expression is still true, but it did not transition - the user's edit stands.
    expect(result.current.values['price']).toBe('123')
  })

  it('runs per-control regex validation and reports the failure on controlState[id].errors', () => {
    // WHY: Int_t parameters must receive whole-number strings. Setting "abc" should
    // produce a type-validation error without any required-field rule needed.
    const param = makeParam({ type: 'Int_t' })
    const ctrl = makeControl({ id: 'qty', parameter: param })
    const strategy = makeStrategy([ctrl])

    const { result } = renderHook(() => useAtdlFormState(strategy))

    act(() => {
      result.current.setValue('qty', 'abc')
    })

    expect(result.current.controlState['qty'].errors).toContain('Must be a whole number.')

    // A valid integer string clears the error.
    act(() => {
      result.current.setValue('qty', '42')
    })

    expect(result.current.controlState['qty'].errors).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // validateRangeBounds - every fixture above uses min:null/max:null (makeParam's
  // default), so the range-bound branches of validateRangeBounds have never run.
  // -------------------------------------------------------------------------

  it('reports a below-min error and clears it once the value is in range', () => {
    const param = makeParam({ type: 'Int_t', min: 10, max: 100 })
    const ctrl = makeControl({ id: 'qty', parameter: param })
    const strategy = makeStrategy([ctrl])

    const { result } = renderHook(() => useAtdlFormState(strategy))

    act(() => { result.current.setValue('qty', '5') })
    expect(result.current.controlState['qty'].errors).toContain('Must be ≥ 10.')

    act(() => { result.current.setValue('qty', '50') })
    expect(result.current.controlState['qty'].errors).toHaveLength(0)
  })

  it('reports an above-max error', () => {
    const param = makeParam({ type: 'Int_t', min: 10, max: 100 })
    const ctrl = makeControl({ id: 'qty', parameter: param })
    const strategy = makeStrategy([ctrl])

    const { result } = renderHook(() => useAtdlFormState(strategy))

    act(() => { result.current.setValue('qty', '500') })
    expect(result.current.controlState['qty'].errors).toContain('Must be ≤ 100.')
  })

  it('does not range-check when min/max are both null (the un-bounded default)', () => {
    const param = makeParam({ type: 'Int_t' })
    const ctrl = makeControl({ id: 'qty', parameter: param })
    const strategy = makeStrategy([ctrl])

    const { result } = renderHook(() => useAtdlFormState(strategy))

    act(() => { result.current.setValue('qty', '999999') })
    expect(result.current.controlState['qty'].errors).toHaveLength(0)
  })

  it('preserves earlier field updates when multiple setValue calls batch together', () => {
    const strategy = makeStrategy([
      makeControl({ id: 'qty', initValue: '100' }),
      makeControl({ id: 'price', initValue: '1.25' }),
    ])

    const { result } = renderHook(() => useAtdlFormState(strategy))

    act(() => {
      result.current.setValue('qty', '150')
      result.current.setValue('price', '1.50')
    })

    expect(result.current.values['qty']).toBe('150')
    expect(result.current.values['price']).toBe('1.50')
  })
})

it.each([
  [1.5, 'Must be a whole number.'],
  [Number.NaN, 'Must be a finite number.'],
  [Number.POSITIVE_INFINITY, 'Must be a finite number.'],
] as const)('rejects invalid integer value %s from a control', (value, expectedError) => {
  const control = makeControl({ parameter: makeParam({ type: 'Int_t' }) })
  const { result } = renderHook(() => useAtdlFormState(makeStrategy([control])))
  act(() => result.current.setValue('ctrl1', value))
  expect(result.current.controlState.ctrl1.errors).toContain(expectedError)
})

it('accepts finite numeric prices whose string representation uses an exponent', () => {
  const control = makeControl({ parameter: makeParam({ type: 'Price_t' }) })
  const { result } = renderHook(() => useAtdlFormState(makeStrategy([control])))
  act(() => result.current.setValue('ctrl1', 1e-7))
  expect(result.current.controlState.ctrl1.errors).toEqual([])
})

it('validates StrategyEdits against parameter wire values and field2', () => {
  const param = makeParam({ name: 'Start', type: 'Int_t' })
  const end = makeParam({ name: 'End', type: 'Int_t' })
  const strategy = makeStrategy([
    makeControl({ id: 'start', parameter: param, initValue: '10' }),
    makeControl({ id: 'end', parameter: end, initValue: '5' }),
  ])
  strategy.parameters = [param, end]
  strategy.strategyEdits = [{ errorMessage: 'Start must precede End.', expression: { kind: 'compare', field: 'Start', field2: 'End', value: null, operator: '<', children: null, comparisonType: 'Int_t' } }]
  const { result } = renderHook(() => useAtdlFormState(strategy))
  expect(result.current.strategyErrors).toContain('Start must precede End.')
  expect(result.current.hasErrors).toBe(true)
  act(() => result.current.setValue('end', '15'))
  expect(result.current.hasErrors).toBe(false)
})

it('maps grouped radios to one enum parameter in either direction', () => {
  const parameter = makeParam({ enumValues: [{ enumId: 'buy', wireValue: '1' }, { enumId: 'sell', wireValue: '2' }] })
  const strategy = makeStrategy([
    makeControl({ id: 'buy', type: 'RadioButton_t', parameter, radioGroup: 'side', checkedEnumRef: 'buy', initValue: true }),
    makeControl({ id: 'sell', type: 'RadioButton_t', parameter, radioGroup: 'side', checkedEnumRef: 'sell', initValue: false }),
  ])
  const { result } = renderHook(() => useAtdlFormState(strategy))
  expect(mapControlValuesToParameters(strategy, result.current.values)).toEqual({ P1: 'buy' })
  act(() => result.current.setValue('sell', true))
  expect(result.current.values).toEqual({ buy: false, sell: true })
  expect(mapControlValuesToParameters(strategy, result.current.values)).toEqual({ P1: 'sell' })
  act(() => result.current.setValue('buy', true))
  expect(result.current.values).toEqual({ buy: true, sell: false })
})

it('ignores inactive radio NULL enum mappings in output and required validation', () => {
  const parameter = makeParam({ useValue: 'required', enumValues: [{ enumId: 'buy', wireValue: '1' }, { enumId: 'sell', wireValue: '2' }, { enumId: 'none', wireValue: '{NULL}' }] })
  const strategy = makeStrategy([
    makeControl({ id: 'buy', type: 'RadioButton_t', parameter, radioGroup: 'side', checkedEnumRef: 'buy', uncheckedEnumRef: 'none', initValue: true }),
    makeControl({ id: 'sell', type: 'RadioButton_t', parameter, radioGroup: 'side', checkedEnumRef: 'sell', uncheckedEnumRef: 'none', initValue: false }),
  ])
  const { result } = renderHook(() => useAtdlFormState(strategy))
  expect(mapControlValuesToParameters(strategy, result.current.values)).toEqual({ P1: 'buy' })
  expect(result.current.hasErrors).toBe(false)
})

it('loads FIX values ahead of defaults and locks immutable amendment parameters', () => {
  const parameter = makeParam({ mutableOnCxlRpl: false })
  const strategy = makeStrategy([makeControl({ parameter, initValue: 'default' })])
  const { result } = renderHook(() => useAtdlFormState(strategy, { isAmendment: true, initialFixValues: { 9001: 'loaded' } }))
  expect(result.current.values.ctrl1).toBe('loaded')
  expect(result.current.controlState.ctrl1.enabled).toBe(false)
  act(() => result.current.setValue('ctrl1', 'changed'))
  expect(result.current.values.ctrl1).toBe('loaded')
})

it('preserves explicit loaded absence and clones loaded selections', () => {
  const loaded = ['a']
  const strategy = makeStrategy([makeControl({ id: 'list', type: 'MultiSelectList_t', initValue: 'b' }), makeControl({ id: 'text', initValue: 'default' })])
  const { result } = renderHook(() => useAtdlFormState(strategy, { initialValues: { list: loaded, text: null } }))
  loaded.push('b')
  expect(result.current.values).toEqual({ list: ['a'], text: null })
})

it('validates enum wire numbers instead of the selected enum ID', () => {
  const parameter = makeParam({ type: 'Int_t', min: 10, enumValues: [{ enumId: 'large', wireValue: '20' }] })
  const strategy = makeStrategy([makeControl({ parameter, type: 'DropDownList_t', initValue: 'large', listItems: [{ enumId: 'large', uiRep: 'Large' }] })])
  const { result } = renderHook(() => useAtdlFormState(strategy))
  expect(result.current.hasErrors).toBe(false)
  act(() => result.current.setValue('ctrl1', 'missing'))
  expect(result.current.hasErrors).toBe(true)
})

it('checks decimal bounds without losing significant digits', () => {
  const strategy = makeStrategy([makeControl({ parameter: makeParam({ type: 'Qty_t', max: '9007199254740992' }), initValue: '9007199254740993' })])
  const { result } = renderHook(() => useAtdlFormState(strategy))
  expect(result.current.hasErrors).toBe(true)
})

it('preserves a loaded instant in a DST overlap until the clock is edited', () => {
  const parameter = makeParam({ type: 'UTCTimestamp_t' })
  const strategy = makeStrategy([makeControl({ type: 'Clock_t', parameter, localMktTz: 'America/New_York' })])
  const { result } = renderHook(() => useAtdlFormState(strategy, { isAmendment: true, initialFixValues: { 9001: '20261101-06:30:45' }, clock: () => new Date('2026-11-01T12:00:00Z') }))
  expect(result.current.hasErrors).toBe(false)
  expect(mapControlValuesToParameters(strategy, result.current.values)).toEqual({ P1: '20261101-06:30:45' })
  act(() => result.current.setValue('ctrl1', '01:45:00'))
  expect(mapControlValuesToParameters(strategy, result.current.values)).toEqual({ P1: '20261101-05:45:00' })
})

it('surfaces invalid clock configuration without crashing the form', () => {
  const strategy = makeStrategy([makeControl({ type: 'Clock_t', initValue: '09:00:00', localMktTz: 'Not/AZone' })])
  const { result } = renderHook(() => useAtdlFormState(strategy, { clock: () => new Date('2026-09-12T10:00:00Z') }))
  expect(result.current.hasErrors).toBe(true)
  expect(result.current.controlState.ctrl1.errors.length).toBeGreaterThan(0)
})

it.each([
  ['Int_t', '2147483648', 'Value is outside the Int_t range.'],
  ['Length_t', '0', 'Value is outside the Length_t range.'],
  ['Qty_t', '-1', 'Must be ≥ 0.'],
  ['Float_t', '79228162514264337593543950336', 'Value is outside the Float_t range.'],
  ['Float_t', '1,2', 'Must be a number.'],
  ['Percentage_t', '1,2', 'Must be a number.'],
  ['Char_t', 'AB', 'Must be exactly one character.'],
  ['UTCDateOnly_t', '20260230', 'Must be a valid FIX UTCDateOnly_t value.'],
  ['UTCTimeOnly_t', '25:00:00', 'Must be a valid FIX UTCTimeOnly_t value.'],
  ['TZTimeOnly_t', '10:00:00+15', 'Must be a valid FIX TZTimeOnly_t value.'],
  ['TZTimestamp_t', '10:00:00Z', 'Must be a valid FIX TZTimestamp_t value.'],
  ['String_t', 'bad\u0001value', 'A value cannot contain the FIX field delimiter.'],
  ['Boolean_t', 'maybe', 'Must be a declared Boolean value.'],
])('rejects an invalid %s parameter value: %s', (type, initValue, expectedError) => {
  const strategy = makeStrategy([makeControl({ parameter: makeParam({ type }), initValue })])
  const { result } = renderHook(() => useAtdlFormState(strategy))
  expect(result.current.hasErrors).toBe(true)
  // Every row must name its own validator: a bare hasErrors pass cannot tell
  // "the right validator fired" from "some unrelated path also set hasErrors".
  expect(result.current.controlState.ctrl1.errors).toContain(expectedError)
})

it.each([false, true])('round-trips whole-percent UI values and checks fractional bounds (multiplyBy100=%s)', multiplyBy100 => {
  const parameter = makeParam({ type: 'Percentage_t', min: '0.1', max: '0.8', multiplyBy100, precision: 1 })
  const strategy = makeStrategy([makeControl({ parameter, type: 'SingleSpinner_t' })])
  const { result } = renderHook(() => useAtdlFormState(strategy, { isAmendment: true, initialFixValues: { 9001: multiplyBy100 ? '75' : '0.75' } }))
  expect(Number(result.current.values.ctrl1)).toBe(75)
  expect(Number(mapControlValuesToParameters(strategy, result.current.values).P1)).toBe(0.75)
  expect(result.current.hasErrors).toBe(false)
  act(() => result.current.setValue('ctrl1', 90))
  expect(result.current.hasErrors).toBe(true)
})

it('honours UseValue and UseFixField independently of the bound parameter tag', () => {
  const parameter = makeParam({ type: 'Int_t' })
  const strategy = makeStrategy([
    makeControl({ id: 'authored', parameter, initPolicy: 'UseValue', initValue: 5 }),
    makeControl({ id: 'external', parameter, initPolicy: 'UseFixField', initFixField: 44, initValue: 5 }),
  ])
  const { result } = renderHook(() => useAtdlFormState(strategy, { initialFixValues: { 9001: 9, 44: 12 } }))
  expect(result.current.values).toEqual({ authored: 5, external: 12 })
})

it('requires named FIX context and settles value rules when it changes', () => {
  const expression = makeEqExpression('FIX_OrdType', '1')
  const strategy = makeStrategy([makeControl({ initValue: 'limit', stateRules: [{ effect: 'value', targetValue: false, targetStringValue: 'market', expression }] })])
  const { result, rerender } = renderHook(({ externalValues }: { externalValues: Record<string, unknown> }) => useAtdlFormState(strategy, { externalValues }), { initialProps: { externalValues: {} } })
  expect(result.current.hasErrors).toBe(true)
  rerender({ externalValues: { FIX_OrdType: '1' } })
  expect(result.current.hasErrors).toBe(false)
  expect(result.current.values.ctrl1).toBe('market')
})

const circularExternalValue: Record<string, unknown> = {}
circularExternalValue.self = circularExternalValue

it.each([
  ['BigInt', 1n], ['circular object', circularExternalValue], ['NaN', Number.NaN],
  ['infinity', Number.POSITIVE_INFINITY], ['undefined', undefined], ['array', ['1']],
  ['symbol', Symbol('value')], ['function', () => '1'],
])('reports unsupported external FIX %s values without crashing and recovers when corrected', (_label, value) => {
  const strategy = makeStrategy([makeControl({ initValue: 'initial' })])
  const externalValues: Record<string, unknown> = { FIX_OrderQty: value }
  const { result, rerender } = renderHook(({ externalValues }: { externalValues: Record<string, unknown> }) => useAtdlFormState(strategy, { externalValues }), { initialProps: { externalValues } })
  expect(result.current.strategyErrors).toContain('FIX_OrderQty: external FIX values must be strings, finite numbers, booleans, or null.')
  expect(result.current.hasErrors).toBe(true)
  act(() => result.current.setValue('ctrl1', 'edited'))
  expect(result.current.values.ctrl1).toBe('edited')
  rerender({ externalValues: { FIX_OrderQty: '12' } })
  expect(result.current.hasErrors).toBe(false)
  expect(result.current.values.ctrl1).toBe('edited')
})

it.each(['01', 12, true, false, null])('accepts supported external FIX scalar %s', value => {
  const strategy = makeStrategy([])
  const { result } = renderHook(() => useAtdlFormState(strategy, { externalValues: { FIX_Value: value } }))
  expect(result.current.hasErrors).toBe(false)
})

it.each([
  ['==', 'Business rule failed.'], ['unsupported', 'Invalid or unsupported strategy rule.'],
])('distinguishes a failed business condition from invalid strategy operator %s', (operator, expected) => {
  const parameter = makeParam()
  const strategy = makeStrategy([makeControl({ parameter, initValue: 'actual' })])
  strategy.parameters = [parameter]
  strategy.strategyEdits = [{ errorMessage: 'Business rule failed.', expression: { ...makeEqExpression('P1', 'expected'), operator } }]
  const { result } = renderHook(() => useAtdlFormState(strategy))
  expect(result.current.strategyErrors).toEqual([expected])
  expect(result.current.hasErrors).toBe(true)
})

it('reads the clock once for an edit when StrictMode replays state updaters', () => {
  const clock = vi.fn(() => new Date('2026-09-12T12:00:00Z'))
  const strategy = makeStrategy([makeControl({ type: 'Clock_t', localMktTz: 'UTC' })])
  const { result } = renderHook(() => useAtdlFormState(strategy, { clock }), { wrapper: StrictMode })
  clock.mockClear()
  act(() => result.current.setValue('ctrl1', '10:00:00'))
  expect(clock).toHaveBeenCalledTimes(1)
  expect(result.current.values.ctrl1).toMatchObject({ instant: '20260912-10:00:00' })
})

it('keeps linked percentage controls in whole-percent units', () => {
  const parameter = makeParam({ type: 'Percentage_t' })
  const strategy = makeStrategy([makeControl({ id: 'a', parameter, type: 'SingleSpinner_t' }), makeControl({ id: 'b', parameter, type: 'TextField_t' })])
  const { result } = renderHook(() => useAtdlFormState(strategy))
  act(() => result.current.setValue('a', 75))
  expect(Number(result.current.values.b)).toBe(75)
})

it('converts shared clock instants into each control timezone', () => {
  const parameter = makeParam({ type: 'UTCTimestamp_t' })
  const strategy = makeStrategy([makeControl({ id: 'london', parameter, type: 'Clock_t', localMktTz: 'Europe/London' }), makeControl({ id: 'newYork', parameter, type: 'Clock_t', localMktTz: 'America/New_York' })])
  const { result } = renderHook(() => useAtdlFormState(strategy, { clock: () => new Date('2026-09-12T12:00:00Z') }))
  act(() => result.current.setValue('london', '10:00:00'))
  expect(result.current.values.newYork).toMatchObject({ instant: '20260912-09:00:00', localDateTime: '20260912-05:00:00' })
})

it('resets hook state when the strategy document changes', () => {
  const first = makeStrategy([makeControl({ initValue: 'first' })])
  const second = makeStrategy([makeControl({ initValue: 'second' })])
  const { result, rerender } = renderHook(({ strategy }) => useAtdlFormState(strategy), { initialProps: { strategy: first } })
  act(() => result.current.setValue('ctrl1', 'edited'))
  rerender({ strategy: second })
  expect(result.current.values.ctrl1).toBe('second')
})

it('refreshes amendment defaults and visibility after in-place strategy edits', () => {
  const parameter = makeParam()
  const strategy = makeStrategy([makeControl({ parameter, initValue: 'first' })])
  const { result, rerender } = renderHook(() => useAtdlFormState(strategy, { isAmendment: true }))
  act(() => result.current.setValue('ctrl1', 'edited'))
  rerender()
  expect(result.current.values.ctrl1).toBe('edited')

  const control = strategy.panel.children[0] as AtdlControlDto
  control.initValue = 'second'
  control.stateRules.push({ effect: 'visible', targetValue: false, targetStringValue: null, expression: makeEqExpression('ctrl1', 'second') })
  parameter.mutableOnCxlRpl = false
  rerender()
  expect(result.current.values.ctrl1).toBe('second')
  expect(result.current.controlState.ctrl1).toMatchObject({ enabled: false, visible: false })
})

it('blocks edits to an amended control after it becomes immutable', () => {
  const parameter = makeParam({ mutableOnCxlRpl: false })
  const strategy = makeStrategy([makeControl({ parameter, initValue: 'value' })])
  const { result } = renderHook(() => useAtdlFormState(strategy, { isAmendment: true }))
  act(() => result.current.setValue('ctrl1', 'blocked'))
  expect(result.current.values.ctrl1).toBe('value')
  expect(result.current.values.ctrl1).not.toBe('blocked')
})

it('allows edits again when an amended control becomes mutable', () => {
  const parameter = makeParam({ mutableOnCxlRpl: false })
  const strategy = makeStrategy([makeControl({ parameter, initValue: 'value' })])
  const { result, rerender } = renderHook(() => useAtdlFormState(strategy, { isAmendment: true }))
  parameter.mutableOnCxlRpl = true
  rerender()
  act(() => result.current.setValue('ctrl1', 'allowed'))
  expect(result.current.values.ctrl1).toBe('allowed')
  expect(result.current.controlState.ctrl1).toMatchObject({ enabled: true, visible: true })
})

it('treats a control DTO missing stateRules as having no rules', () => {
  const malformed = makeControl({ id: 'broken' })
  delete (malformed as Partial<AtdlControlDto>).stateRules
  const strategy = makeStrategy([malformed])
  const { result } = renderHook(() => useAtdlFormState(strategy))
  expect(result.current.controlState.broken).toMatchObject({ enabled: true, visible: true })
  expect(result.current.hasErrors).toBe(false)
})

it('keeps a failed value-rule conversion invalid across unrelated edits', () => {
  const strategy = makeStrategy([makeControl({ id: 'trigger', initValue: 'on' }), makeControl({ id: 'clock', type: 'Clock_t', localMktTz: 'UTC', stateRules: [{ effect: 'value', targetValue: false, targetStringValue: 'bad-time', expression: makeEqExpression('trigger', 'on') }] }), makeControl({ id: 'other' })])
  const { result } = renderHook(() => useAtdlFormState(strategy, { clock: () => new Date('2026-09-12T12:00:00Z') }))
  expect(result.current.hasErrors).toBe(true)
  act(() => result.current.setValue('other', 'changed'))
  expect(result.current.hasErrors).toBe(true)
})

it('surfaces a non-cloneable value-rule snapshot as a form error', () => {
  const strategy = makeStrategy([
    makeControl({ id: 'trigger', initValue: 'on' }),
    makeControl({ id: 'target', initValue: null, stateRules: [{
      effect: 'value', targetValue: false, targetStringValue: 'changed', expression: makeEqExpression('trigger', 'on'),
    }] }),
  ])
  const { result } = renderHook(() => useAtdlFormState(strategy, { initialValues: { target: () => {} } }))
  expect(result.current.hasErrors).toBe(true)
  expect(result.current.strategyErrors).toContain('target: Value could not be copied safely.')
})

it('discards the whole working copy when a sibling assignment throws mid-update', () => {
  // WHY: assignControlValue writes shared-parameter siblings into a working copy
  // one by one; a throw part-way through must not commit the earlier writes.
  // normalizeControlValue itself has no throw path, so the throw is driven by a
  // circular value reaching the loop's JSON.stringify array-equality check - the
  // only mid-loop throw constructible through the public surface today.
  const parameter = makeParam()
  const strategy = makeStrategy([
    makeControl({ id: 'sibling1', parameter, initValue: 'bee' }),
    makeControl({ id: 'sibling2', parameter, initValue: 'see' }),
    makeControl({ id: 'edited', parameter }),
  ])
  const { result } = renderHook(() => useAtdlFormState(strategy, { initialValues: { edited: ['old'] } }))
  const circular: unknown[] = []
  circular.push(circular)

  act(() => result.current.setValue('edited', circular))

  // The siblings were written into the copy BEFORE the edited control's own
  // equality check threw; committed state must show none of it.
  expect(result.current.values['sibling1']).toBe('bee')
  expect(result.current.values['sibling2']).toBe('see')
  expect(result.current.values['edited']).toEqual(['old'])
  expect(result.current.controlState['edited'].errors.join(' ')).toContain('circular')
  expect(result.current.hasErrors).toBe(true)
})

it.each([false, true])('rejects unknown loaded list tokens, with initValue fallback only on new orders: %s', isAmendment => {
  const parameter = makeParam({ type: 'MultipleStringValue_t', enumValues: [{ enumId: 'buy', wireValue: '1' }] })
  const strategy = makeStrategy([makeControl({ type: 'MultiSelectList_t', parameter, initValue: 'buy', initPolicy: 'UseFixField', initFixField: 9001 })])
  const { result } = renderHook(() => useAtdlFormState(strategy, { isAmendment, initialFixValues: { 9001: '1 UNKNOWN' } }))
  expect(result.current.hasErrors).toBe(isAmendment)
  if (!isAmendment) expect(result.current.values.ctrl1).toEqual(['buy'])
})

it.each(['SingleSpinner_t', 'CheckBox_t'])('falls back from an unparsable FIX initialization value for %s', type => {
  const binary = type === 'CheckBox_t'
  const parameter = makeParam({ type: binary ? 'Boolean_t' : 'Float_t' })
  const strategy = makeStrategy([makeControl({ type, parameter, initValue: binary ? true : 5, initPolicy: 'UseFixField', initFixField: 44 })])
  const { result } = renderHook(() => useAtdlFormState(strategy, { initialFixValues: { 44: 'invalid' } }))
  expect(result.current.values.ctrl1).toBe(binary ? true : 5)
  expect(result.current.hasErrors).toBe(false)
})

it('preserves a UTC clock constant when displaying it in a market timezone', () => {
  const parameter = makeParam({ type: 'UTCTimestamp_t', constValue: '20260912-09:00:00' })
  const strategy = makeStrategy([makeControl({ type: 'Clock_t', parameter, localMktTz: 'Europe/London' })])
  const { result } = renderHook(() => useAtdlFormState(strategy))
  expect(result.current.values.ctrl1).toMatchObject({ instant: '20260912-09:00:00', localDateTime: '20260912-10:00:00' })
  expect(result.current.controlState.ctrl1.enabled).toBe(false)
})
