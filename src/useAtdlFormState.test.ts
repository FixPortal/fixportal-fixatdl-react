import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAtdlFormState } from './useAtdlFormState'
import type { AtdlStrategyDto, AtdlControlDto, AtdlParameterDto, AtdlStateRuleDto } from './types'
import type { StateRuleAstNodeDto } from './types'

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

    act(() => {
      result.current.setValue('ctrl1', 'newVal')
    })

    expect(result.current.values['ctrl1']).toBe('newVal')
    // controlState is re-derived - the object reference changes on each set
    expect(result.current.controlState['ctrl1']).toBeDefined()
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

it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid integer value %s from a control', value => {
  const control = makeControl({ parameter: makeParam({ type: 'Int_t' }) })
  const { result } = renderHook(() => useAtdlFormState(makeStrategy([control])))
  act(() => result.current.setValue('ctrl1', value))
  expect(result.current.controlState.ctrl1.errors.length).toBeGreaterThan(0)
})

it('accepts finite numeric prices whose string representation uses an exponent', () => {
  const control = makeControl({ parameter: makeParam({ type: 'Price_t' }) })
  const { result } = renderHook(() => useAtdlFormState(makeStrategy([control])))
  act(() => result.current.setValue('ctrl1', 1e-7))
  expect(result.current.controlState.ctrl1.errors).toEqual([])
})
