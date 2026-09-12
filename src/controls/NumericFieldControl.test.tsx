import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { NumericFieldControl } from './NumericFieldControl'
import type { AtdlControlDto, AtdlParameterDto } from '../types'
import type { ControlFormState } from '../useAtdlFormState'

afterEach(cleanup)

function makeParam(overrides: Partial<AtdlParameterDto> = {}): AtdlParameterDto {
  return {
    name: 'P1',
    fixTag: 9001,
    type: 'Float_t',
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

const BASE_CONTROL: AtdlControlDto = {
  id: 'ctrl_num',
  type: 'DoubleSpinner_t',
  label: 'Order Qty',
  parameterRef: null,
  parameter: null,
  listItems: null,
  initValue: null,
  stateRules: [],
  tooltip: null,
}

const ENABLED: ControlFormState = { enabled: true, visible: true, required: false, errors: [] }

describe('NumericFieldControl', () => {
  it.each([
    { type: 'Percentage_t', min: '0.07', max: '0.29', value: 8, bound: 'min', expected: '7', direction: 'Decrease' },
    { type: 'Float_t', min: null, max: '9007199254740993', value: '9007199254740992', bound: 'max', expected: '9007199254740993', direction: 'Increase' },
  ])('clamps to the exact decimal bound: %j', ({ type, min, max, value, bound, expected, direction }) => {
    const onChange = vi.fn()
    render(<NumericFieldControl control={{ ...BASE_CONTROL, outerIncrement: 10, parameter: makeParam({ type, min, max }) }} value={value} onChange={onChange} state={ENABLED} />)
    expect(screen.getByRole('spinbutton')).toHaveAttribute(bound, expected)
    fireEvent.click(screen.getByRole('button', { name: `${direction} Order Qty by 10` }))
    expect(String(onChange.mock.calls[0][0])).toBe(expected)
  })
  it('applies the outer increment with exact decimal arithmetic and clamps to bounds', () => {
    const onChange = vi.fn()
    const control = { ...BASE_CONTROL, outerIncrement: 0.2, parameter: makeParam({ max: 0.25 }) }
    render(<NumericFieldControl control={control} value={0.1} onChange={onChange} state={ENABLED} />)
    fireEvent.click(screen.getByRole('button', { name: 'Increase Order Qty by 0.2' }))
    expect(onChange).toHaveBeenCalledWith(0.25)
  })
  it('preserves a decimal that cannot round-trip through a JavaScript number', () => {
    const onChange = vi.fn()
    render(<NumericFieldControl control={BASE_CONTROL} value={null} onChange={onChange} state={ENABLED} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '9007199254740993' } })
    expect(onChange).toHaveBeenCalledWith('9007199254740993')
  })

  it('uses authored increments before display precision', () => {
    const control = { ...BASE_CONTROL, type: 'SingleSpinner_t', increment: 0.25, parameter: makeParam({ precision: 2 }) }
    render(<NumericFieldControl control={control} value={1} onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByRole('spinbutton')).toHaveAttribute('step', '0.25')
  })
  it('emits a number when the user types a numeric value', () => {
    const onChange = vi.fn()
    render(<NumericFieldControl control={BASE_CONTROL} value={null} onChange={onChange} state={ENABLED} />)
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '42' } })
    expect(onChange).toHaveBeenCalledWith(42)
  })

  it('emits null when the input is cleared', () => {
    const onChange = vi.fn()
    render(<NumericFieldControl control={BASE_CONTROL} value={10} onChange={onChange} state={ENABLED} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('renders disabled when state.enabled is false', () => {
    render(
      <NumericFieldControl
        control={BASE_CONTROL}
        value={null}
        onChange={vi.fn()}
        state={{ ...ENABLED, enabled: false }}
      />,
    )
    expect(screen.getByRole('spinbutton')).toBeDisabled()
  })

  it('renders nothing when state.visible is false', () => {
    const { container } = render(
      <NumericFieldControl
        control={BASE_CONTROL}
        value={null}
        onChange={vi.fn()}
        state={{ ...ENABLED, visible: false }}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('sets step based on precision for Float_t parameters', () => {
    const ctrl = { ...BASE_CONTROL, parameter: makeParam({ type: 'Float_t', precision: 2 }) }
    render(<NumericFieldControl control={ctrl} value={null} onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByRole('spinbutton')).toHaveAttribute('step', '0.01')
  })

  it('respects min and max from the parameter', () => {
    const ctrl = { ...BASE_CONTROL, parameter: makeParam({ min: 0, max: 100 }) }
    render(<NumericFieldControl control={ctrl} value={null} onChange={vi.fn()} state={ENABLED} />)
    const input = screen.getByRole('spinbutton')
    expect(input).toHaveAttribute('min', '0')
    expect(input).toHaveAttribute('max', '100')
  })

  it('displays error messages when state.errors is non-empty', () => {
    render(
      <NumericFieldControl
        control={BASE_CONTROL}
        value={null}
        onChange={vi.fn()}
        state={{ ...ENABLED, errors: ['Must be ≥ 0.'] }}
      />,
    )
    expect(screen.getByText('Must be ≥ 0.')).toBeInTheDocument()
  })
})
