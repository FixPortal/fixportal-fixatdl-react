import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SliderControl } from './SliderControl'
import type { AtdlControlDto } from '../types'
import type { ControlFormState } from '../useAtdlFormState'

afterEach(cleanup)

const BASE_CONTROL: AtdlControlDto = {
  id: 'ctrl_slider',
  type: 'Slider_t',
  label: 'Participation Rate',
  parameterRef: null,
  parameter: {
    name: 'ParticRate',
    fixTag: 9002,
    type: 'Float_t',
    enumValues: null,
    min: 0,
    max: 100,
    precision: null,
    mutableOnCxlRpl: true,
    useValue: 'optional',
    defaultValue: null,
  },
  listItems: null,
  initValue: null,
  stateRules: [],
  tooltip: null,
}

const ENABLED: ControlFormState = { enabled: true, visible: true, required: false, errors: [] }

describe('SliderControl', () => {
  it('emits onChange with a numeric value when moved', () => {
    const onChange = vi.fn()
    render(
      <SliderControl control={BASE_CONTROL} value={50} onChange={onChange} state={ENABLED} />,
    )
    fireEvent.change(screen.getByRole('slider'), { target: { value: '75' } })
    expect(onChange).toHaveBeenCalledWith(75)
  })

  it('displays the current value as a text pip', () => {
    render(
      <SliderControl control={BASE_CONTROL} value={42} onChange={vi.fn()} state={ENABLED} />,
    )
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders disabled when state.enabled is false', () => {
    render(
      <SliderControl
        control={BASE_CONTROL}
        value={0}
        onChange={vi.fn()}
        state={{ ...ENABLED, enabled: false }}
      />,
    )
    expect(screen.getByRole('slider')).toBeDisabled()
  })

  it('renders nothing when state.visible is false', () => {
    const { container } = render(
      <SliderControl
        control={BASE_CONTROL}
        value={0}
        onChange={vi.fn()}
        state={{ ...ENABLED, visible: false }}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows error messages when state.errors is non-empty', () => {
    render(
      <SliderControl
        control={BASE_CONTROL}
        value={0}
        onChange={vi.fn()}
        state={{ ...ENABLED, errors: ['Value out of range.'] }}
      />,
    )
    expect(screen.getByText('Value out of range.')).toBeInTheDocument()
  })

  it('applies error border class to the wrapper when state.errors is non-empty', () => {
    const { container } = render(
      <SliderControl
        control={BASE_CONTROL}
        value={0}
        onChange={vi.fn()}
        state={{ ...ENABLED, errors: ['Required.'] }}
      />,
    )
    // The flex wrapper carries the border class
    const wrapper = container.querySelector('.flex')
    expect(wrapper?.className).toContain('border-bad-border')
  })

  it('uses parameter.min and parameter.max as range bounds', () => {
    render(
      <SliderControl control={BASE_CONTROL} value={50} onChange={vi.fn()} state={ENABLED} />,
    )
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.min).toBe('0')
    expect(slider.max).toBe('100')
  })

  it('falls back to 0/100 when parameter is null', () => {
    const ctrl = { ...BASE_CONTROL, parameter: null }
    render(<SliderControl control={ctrl} value={0} onChange={vi.fn()} state={ENABLED} />)
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.min).toBe('0')
    expect(slider.max).toBe('100')
  })

  it('shows required asterisk when state.required is true', () => {
    render(
      <SliderControl
        control={BASE_CONTROL}
        value={0}
        onChange={vi.fn()}
        state={{ ...ENABLED, required: true }}
      />,
    )
    expect(screen.getByText('*')).toBeInTheDocument()
  })
})
