import { createRef } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import { FormRenderer } from './FormRenderer'
import type { FormRendererHandle } from './FormRenderer'
import { useAtdlFormState } from './useAtdlFormState'
import { emitStrategyParametersGrp } from './output/fixPreviewEmitter'
import { mapControlValuesToParameters } from './atdlControls'
import strategyJson from './__fixtures__/optional-fields-strategy.json'
import type { AtdlStrategyDto } from './types'

afterEach(cleanup)

// WHY a second fixture rather than extending twap-strategy.json: the shipped
// fixture backs several tests with assertions on specific controls, and the
// newer optional fields (types.ts:28-35) deserve a document whose entire
// purpose is carrying them - same backend DTO shape, each field observable.
const strategy = strategyJson as unknown as AtdlStrategyDto

describe('optional DTO fields against a realistic backend document', () => {
  it('renders the full document through the FormRenderer stack with no errors', () => {
    // WHY the ref rather than queryByRole('alert'): FormRenderer gives role="alert"
    // only to summaryErrors - strategy-level errors plus errors on hidden or
    // invisible controls. Every control in this fixture is visible, so their
    // validation errors render in each control's own unlabelled <ul>, and an
    // alert-only assertion would pass with all five controls in an error state.
    const ref = createRef<FormRendererHandle>()
    render(<FormRenderer ref={ref} strategy={strategy} />)
    expect(screen.getByLabelText('Account')).toBeInTheDocument()
    expect(ref.current!.getErrors()).toEqual([])
    expect(ref.current!.isValid()).toBe(true)
  })

  it('enforces parameter minLength and maxLength through validation', () => {
    const { result } = renderHook(() => useAtdlFormState(strategy))
    act(() => result.current.setValue('account', 'AB'))
    expect(result.current.controlState['account'].errors).toContain('Must contain at least 3 characters.')
    act(() => result.current.setValue('account', 'ABCDEFG'))
    expect(result.current.controlState['account'].errors).toContain('Must contain at most 6 characters.')
    act(() => result.current.setValue('account', 'ABCD'))
    expect(result.current.controlState['account'].errors).toEqual([])
  })

  it('evaluates strategyEdits against the document and surfaces its message', () => {
    const { result } = renderHook(() => useAtdlFormState(strategy))
    expect(result.current.strategyErrors).toEqual([])
    act(() => result.current.setValue('account', 'FORBIDDEN'))
    expect(result.current.strategyErrors).toContain('Choose another account.')
    expect(result.current.hasErrors).toBe(true)
  })

  it('emits custom Boolean wire values from trueWireValue/falseWireValue', () => {
    expect(emitStrategyParametersGrp(strategy, { Aggressive: true })).toContainEqual({ tag: 960, value: 'T' })
    expect(emitStrategyParametersGrp(strategy, { Aggressive: false })).toContainEqual({ tag: 960, value: 'F' })
  })

  it('emits the inverted selection complement for an invertOnWire parameter', () => {
    // One selected enum leaves a TWO-token complement, so the assertion also
    // pins the space-join of multiple wire values, not just the single-token case.
    const tags = emitStrategyParametersGrp(strategy, { Exchanges: ['xnys'] })
    expect(tags).toContainEqual({ tag: 960, value: 'Q B' })
  })

  it('emits a multiplyBy100 percentage in multiplied wire units', () => {
    // Parameter space for Percentage_t is a FRACTION, not a percent:
    // controlParameterValue applies formatDecimal(value, null, 2), so a user
    // entering 12 (twelve percent) reaches the emitter as '0.12'. multiplyBy100
    // then shifts by -2 on the way to the wire, making the real wire value '12'.
    //
    // WHY this drives the whole path instead of handing the emitter a parameter
    // value directly: a test that starts at the emitter cannot see a regression in
    // controlParameterValue. Drop the shift there and every percentage on the wire
    // moves by 100x while a direct-emit assertion stays green.
    const { result } = renderHook(() => useAtdlFormState(strategy))
    act(() => result.current.setValue('participation', 12))
    const parameters = mapControlValuesToParameters(strategy, result.current.values)
    expect(parameters.Participation).toBe('0.12')
    expect(emitStrategyParametersGrp(strategy, parameters)).toContainEqual({ tag: 960, value: '12' })
  })

  it('seeds a localMktTz clock to the matching instant and market wall time', () => {
    const { result } = renderHook(() => useAtdlFormState(strategy))
    expect(result.current.values['expire']).toMatchObject({
      instant: '20260912-08:00:00',
      localDateTime: '20260912-09:00:00',
    })
  })
})
