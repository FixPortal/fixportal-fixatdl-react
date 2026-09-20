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
  it.each([null, 'unknown'])('lets an unset or unmatched enum choose the first position: %s', value => {
    const onChange = vi.fn()
    render(<SliderControl control={{ ...BASE_CONTROL, listItems: [{ enumId: 'a', uiRep: 'First' }] }} value={value} onChange={onChange} state={ENABLED} />)
    expect(screen.getByText('Not selected')).toBeInTheDocument()
    // An unset thumb parks at the minimum because a range input has no "no position". Without
    // aria-valuetext a screen reader announced that raw position, which reads as a selection the
    // order does not carry, so it now announces the same text the visible pip shows.
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Not selected')
    fireEvent.click(screen.getByRole('button', { name: 'Use First' }))
    expect(onChange).toHaveBeenCalledWith('a')
  })
  it.each([{ min: null, max: 0, expectedMin: '-100', expectedMax: '0' }, { min: 100, max: null, expectedMin: '100', expectedMax: '200' }])('keeps a nonzero range at default endpoints: %j', bounds => {
    render(<SliderControl control={{ ...BASE_CONTROL, parameter: { ...BASE_CONTROL.parameter!, min: bounds.min, max: bounds.max } }} value={null} onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByRole('slider')).toHaveAttribute('min', bounds.expectedMin)
    expect(screen.getByRole('slider')).toHaveAttribute('max', bounds.expectedMax)
  })
  it('keeps percentage bounds exact', () => {
    render(<SliderControl control={{ ...BASE_CONTROL, parameter: { ...BASE_CONTROL.parameter!, type: 'Percentage_t', min: '0.07', max: '0.29' } }} value={10} onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByRole('slider')).toHaveAttribute('min', '7')
    expect(screen.getByRole('slider')).toHaveAttribute('max', '29')
  })
  it.each([{ min: null, max: -1, expectedMin: '-101', expectedMax: '-1' }, { min: 150, max: null, expectedMin: '150', expectedMax: '250' }])('keeps a useful range with only one declared bound: %j', bounds => {
    const control = { ...BASE_CONTROL, parameter: { ...BASE_CONTROL.parameter!, min: bounds.min, max: bounds.max } }
    render(<SliderControl control={control} value={null} onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByRole('slider')).toHaveAttribute('min', bounds.expectedMin)
    expect(screen.getByRole('slider')).toHaveAttribute('max', bounds.expectedMax)
  })
  it.each([{ uiRep: 'Low', label: 'Low' }, { uiRep: undefined, label: 'low' }])('maps discrete slider positions to enum IDs and labels: %j', ({ uiRep, label }) => {
    const onChange = vi.fn()
    const control = { ...BASE_CONTROL, listItems: [{ enumId: 'low', uiRep }, { enumId: 'high', uiRep: 'High' }] } as AtdlControlDto
    render(<SliderControl control={control} value="low" onChange={onChange} state={ENABLED} />)
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', label)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '1' } })
    expect(onChange).toHaveBeenCalledWith('high')
  })
  it('shows an unset value and lets the user select the current thumb position', () => {
    const control = { ...BASE_CONTROL, parameter: { ...BASE_CONTROL.parameter!, min: 10 } }
    const onChange = vi.fn()
    render(<SliderControl control={control} value={undefined} onChange={onChange} state={ENABLED} />)
    expect(screen.getByRole('slider')).toHaveValue('10')
    expect(screen.getByText('Not selected')).toBeInTheDocument()
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Not selected')
    fireEvent.click(screen.getByRole('button', { name: 'Use 10' }))
    expect(onChange).toHaveBeenCalledWith(10)
  })
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
    expect(screen.getByRole('slider')).toHaveAttribute('aria-required', 'true')
  })
})
