import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SliderControl } from './SliderControl.js'
import type { AtdlControlDto } from '../types.js'
import type { ControlFormState } from '../useAtdlFormState.js'

afterEach(cleanup)

const ENABLED: ControlFormState = { enabled: true, visible: true, required: false, errors: [] }

const PARAM = {
  name: 'P',
  fixTag: 9002,
  type: 'String_t',
  enumValues: null,
  min: 0,
  max: 50,
  precision: null,
  mutableOnCxlRpl: true,
  useValue: 'optional',
  defaultValue: null,
} as const

const CONTROL: AtdlControlDto = {
  id: 's',
  type: 'Slider_t',
  label: 'Rate',
  parameterRef: null,
  parameter: { ...PARAM },
  listItems: null,
  initValue: null,
  stateRules: [],
  tooltip: null,
}

describe('SliderControl parameter-level enums (S3-AR-7)', () => {
  it('treats a slider bound to an enum parameter as discrete', () => {
    const onChange = vi.fn()
    render(
      <SliderControl
        control={{
          ...CONTROL,
          parameter: {
            ...PARAM,
            enumValues: [
              { enumId: 'LOW', wireValue: 'L' },
              { enumId: 'HIGH', wireValue: 'H' },
            ],
          },
        }}
        value="HIGH"
        onChange={onChange}
        state={ENABLED}
      />,
    )
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('max', '1')
    expect(slider).toHaveAttribute('aria-valuetext', 'HIGH')
    fireEvent.change(slider, { target: { value: '0' } })
    expect(onChange).toHaveBeenCalledWith('LOW')
  })
})

describe('SliderControl out-of-range numeric value (S3-AR-8)', () => {
  it('announces the real value, not the clamped thumb', () => {
    render(
      <SliderControl
        control={CONTROL}
        value={60}
        onChange={vi.fn()}
        state={{ ...ENABLED, errors: ['Must be ≤ 50.'] }}
      />,
    )
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '60')
    expect(screen.getByText('60')).toBeInTheDocument()
  })

  it('adds no valuetext for an in-range value', () => {
    render(<SliderControl control={CONTROL} value={20} onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByRole('slider')).not.toHaveAttribute('aria-valuetext')
  })
})
