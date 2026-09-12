import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DropDownControl } from './DropDownControl'
import type { AtdlControlDto, AtdlListItemDto } from '../types'
import type { ControlFormState } from '../useAtdlFormState'

afterEach(cleanup)

const LIST_ITEMS: AtdlListItemDto[] = [
  { enumId: 'TWAP', uiRep: 'TWAP' },
  { enumId: 'VWAP', uiRep: 'VWAP' },
  { enumId: 'IS', uiRep: 'Implementation Shortfall' },
]

const BASE_CONTROL: AtdlControlDto = {
  id: 'ctrl_dd',
  type: 'DropDownList_t',
  label: 'Algorithm',
  parameterRef: null,
  parameter: null,
  listItems: LIST_ITEMS,
  initValue: null,
  stateRules: [],
  tooltip: null,
}

const ENABLED: ControlFormState = { enabled: true, visible: true, required: false, errors: [] }

describe('DropDownControl', () => {
  it('renders all list items as options', () => {
    render(<DropDownControl control={BASE_CONTROL} value="" onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByRole('option', { name: 'TWAP' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'VWAP' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Implementation Shortfall' })).toBeInTheDocument()
  })

  it('includes a blank placeholder when initValue is null', () => {
    render(<DropDownControl control={BASE_CONTROL} value="" onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByRole('option', { name: '-' })).toBeInTheDocument()
  })

  it('omits the blank placeholder when initValue is set', () => {
    const ctrl = { ...BASE_CONTROL, initValue: 'TWAP' }
    render(<DropDownControl control={ctrl} value="TWAP" onChange={vi.fn()} state={ENABLED} />)
    expect(screen.queryByRole('option', { name: '-' })).not.toBeInTheDocument()
  })

  it('emits onChange with the selected enumId', () => {
    const onChange = vi.fn()
    render(<DropDownControl control={BASE_CONTROL} value="" onChange={onChange} state={ENABLED} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'VWAP' } })
    expect(onChange).toHaveBeenCalledWith('VWAP')
  })

  it('renders disabled when state.enabled is false', () => {
    render(
      <DropDownControl
        control={BASE_CONTROL}
        value=""
        onChange={vi.fn()}
        state={{ ...ENABLED, enabled: false }}
      />,
    )
    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('renders nothing when state.visible is false', () => {
    const { container } = render(
      <DropDownControl
        control={BASE_CONTROL}
        value=""
        onChange={vi.fn()}
        state={{ ...ENABLED, visible: false }}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('falls back to parameter.enumValues when listItems is absent', () => {
    const ctrl: AtdlControlDto = {
      ...BASE_CONTROL,
      listItems: null,
      parameter: {
        name: 'AlgoType',
        fixTag: 9001,
        type: 'String_t',
        enumValues: [
          { enumId: 'A', wireValue: '1' },
          { enumId: 'B', wireValue: '2' },
        ],
        min: null,
        max: null,
        precision: null,
        mutableOnCxlRpl: true,
        useValue: 'optional',
        defaultValue: null,
      },
    }
    render(<DropDownControl control={ctrl} value="" onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'B' })).toBeInTheDocument()
  })

  it('shows error messages when state.errors is non-empty', () => {
    render(
      <DropDownControl
        control={BASE_CONTROL}
        value=""
        onChange={vi.fn()}
        state={{ ...ENABLED, errors: ['This field is required.'] }}
      />,
    )
    expect(screen.getByText('This field is required.')).toBeInTheDocument()
  })
})
