import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { ClockControl } from './ClockControl'
import type { AtdlControlDto } from '../types'
import type { ControlFormState } from '../useAtdlFormState'

afterEach(cleanup)

const BASE_CONTROL: AtdlControlDto = {
  id: 'ctrl_clock',
  type: 'Clock_t',
  label: 'Start Time',
  parameterRef: null,
  parameter: null,
  listItems: null,
  initValue: null,
  stateRules: [],
  tooltip: null,
}

const ENABLED: ControlFormState = { enabled: true, visible: true, required: false, errors: [] }

describe('ClockControl', () => {
  it('emits onChange with the time string when changed', () => {
    const onChange = vi.fn()
    render(
      <ClockControl control={BASE_CONTROL} value="09:30" onChange={onChange} state={ENABLED} />,
    )
    // input[type="time"] has no ARIA textbox role - query it directly
    const input = document.querySelector('input[type="time"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '14:45' } })
    expect(onChange).toHaveBeenCalledWith('14:45')
  })

  it('renders with the current value', () => {
    render(
      <ClockControl
        control={BASE_CONTROL}
        value="09:30"
        onChange={vi.fn()}
        state={ENABLED}
      />,
    )
    const input = document.querySelector('input[type="time"]') as HTMLInputElement
    expect(input.value).toBe('09:30')
  })

  it('renders the local time while retaining the loaded instant in form state', () => {
    const value = { kind: 'atdl-clock', instant: '20261025-01:30:00.1234567', localDateTime: '20261025-01:30:00.1234567' }
    render(<ClockControl control={BASE_CONTROL} value={value} onChange={vi.fn()} state={ENABLED} />)
    const input = document.querySelector('input[type="time"]') as HTMLInputElement
    expect(input.value).toBe('01:30:00.123')
    expect(input.step).toBe('any')
    expect(value.instant).toBe('20261025-01:30:00.1234567')
  })

  it('applies error border class when state.errors is non-empty', () => {
    render(
      <ClockControl
        control={BASE_CONTROL}
        value=""
        onChange={vi.fn()}
        state={{ ...ENABLED, errors: ['Invalid time.'] }}
      />,
    )
    const input = document.querySelector('input[type="time"]') as HTMLInputElement
    expect(input.className).toContain('border-bad-border')
  })

  it('coerces a non-string value to string via String()', () => {
    const onChange = vi.fn()
    render(
      <ClockControl control={BASE_CONTROL} value={0} onChange={onChange} state={ENABLED} />,
    )
    // jsdom validates time inputs - the component passes String(value) which
    // is well-formed ('0' is not a valid HH:mm so the DOM sanitises it to '').
    // The typed string must reach onChange intact, not just as any string.
    const input = document.querySelector('input[type="time"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '10:00' } })
    expect(onChange.mock.calls[0][0]).toBe('10:00')
  })
})
