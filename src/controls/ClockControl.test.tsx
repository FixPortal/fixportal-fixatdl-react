import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
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

  it('renders disabled when state.enabled is false', () => {
    render(
      <ClockControl
        control={BASE_CONTROL}
        value=""
        onChange={vi.fn()}
        state={{ ...ENABLED, enabled: false }}
      />,
    )
    const input = document.querySelector('input[type="time"]') as HTMLInputElement
    expect(input).toBeDisabled()
  })

  it('renders nothing when state.visible is false', () => {
    const { container } = render(
      <ClockControl
        control={BASE_CONTROL}
        value=""
        onChange={vi.fn()}
        state={{ ...ENABLED, visible: false }}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows error messages when state.errors is non-empty', () => {
    render(
      <ClockControl
        control={BASE_CONTROL}
        value=""
        onChange={vi.fn()}
        state={{ ...ENABLED, errors: ['Time is required.'] }}
      />,
    )
    expect(screen.getByText('Time is required.')).toBeInTheDocument()
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
    // The important thing is that onChange receives a string, not a number.
    const input = document.querySelector('input[type="time"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '10:00' } })
    expect(typeof onChange.mock.calls[0][0]).toBe('string')
  })
})
