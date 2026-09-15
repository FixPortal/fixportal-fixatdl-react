import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import { FormRenderer } from './FormRenderer'
import { useAtdlFormState } from './useAtdlFormState'
import { emitStrategyParametersGrp } from './output/fixPreviewEmitter'
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
    render(<FormRenderer strategy={strategy} />)
    expect(screen.getByLabelText('Account')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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
    const tags = emitStrategyParametersGrp(strategy, { Exchanges: ['xnys', 'xnas'] })
    expect(tags).toContainEqual({ tag: 960, value: 'B' })
  })

  it('emits a multiplyBy100 percentage in multiplied wire units', () => {
    // multiplyBy100 puts percent-times-100 (basis points) on the wire:
    // formatDecimal shift is negative, so a logical '12' becomes '1200'.
    const tags = emitStrategyParametersGrp(strategy, { Participation: '12' })
    expect(tags).toContainEqual({ tag: 960, value: '1200' })
  })

  it('seeds a localMktTz clock to the matching instant and market wall time', () => {
    const { result } = renderHook(() => useAtdlFormState(strategy))
    expect(result.current.values['expire']).toMatchObject({
      instant: '20260912-08:00:00',
      localDateTime: '20260912-09:00:00',
    })
  })
})
