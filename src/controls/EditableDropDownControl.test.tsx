import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { EditableDropDownControl } from './EditableDropDownControl'
import type { AtdlControlDto, AtdlListItemDto } from '../types'
import type { ControlFormState } from '../useAtdlFormState'

afterEach(cleanup)

const LIST_ITEMS: AtdlListItemDto[] = [
  { enumId: 'TWAP', uiRep: 'TWAP' },
  { enumId: 'VWAP', uiRep: 'VWAP' },
  { enumId: 'IS', uiRep: 'Implementation Shortfall' },
]

const BASE_CONTROL: AtdlControlDto = {
  id: 'ctrl_edd',
  type: 'EditableDropDownList_t',
  label: 'Algorithm',
  parameterRef: null,
  parameter: null,
  listItems: LIST_ITEMS,
  initValue: null,
  stateRules: [],
  tooltip: null,
}

const ENABLED: ControlFormState = { enabled: true, visible: true, required: false, errors: [] }

describe('EditableDropDownControl', () => {
  it('emits onChange with typed text value', () => {
    const onChange = vi.fn()
    render(
      <EditableDropDownControl
        control={BASE_CONTROL}
        value=""
        onChange={onChange}
        state={ENABLED}
      />,
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CUSTOM_ALGO' } })
    expect(onChange).toHaveBeenCalledWith('CUSTOM_ALGO')
  })

  it('emits onChange with a list item value when selected from datalist', () => {
    const onChange = vi.fn()
    render(
      <EditableDropDownControl
        control={BASE_CONTROL}
        value=""
        onChange={onChange}
        state={ENABLED}
      />,
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'VWAP' } })
    expect(onChange).toHaveBeenCalledWith('VWAP')
  })

  it('renders disabled when state.enabled is false', () => {
    render(
      <EditableDropDownControl
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
      <EditableDropDownControl
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
      <EditableDropDownControl
        control={BASE_CONTROL}
        value=""
        onChange={vi.fn()}
        state={{ ...ENABLED, errors: ['This field is required.'] }}
      />,
    )
    expect(screen.getByText('This field is required.')).toBeInTheDocument()
  })

  it('applies error border class when state.errors is non-empty', () => {
    render(
      <EditableDropDownControl
        control={BASE_CONTROL}
        value=""
        onChange={vi.fn()}
        state={{ ...ENABLED, errors: ['Invalid value.'] }}
      />,
    )
    const input = screen.getByRole('combobox')
    expect(input.className).toContain('border-bad-border')
  })

  it('shows required asterisk when state.required is true', () => {
    render(
      <EditableDropDownControl
        control={BASE_CONTROL}
        value=""
        onChange={vi.fn()}
        state={{ ...ENABLED, required: true }}
      />,
    )
    expect(screen.getByText('*')).toBeInTheDocument()
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
    render(
      <EditableDropDownControl control={ctrl} value="" onChange={vi.fn()} state={ENABLED} />,
    )
    // datalist options are not queryable by role; check they exist in the DOM
    expect(document.querySelector('datalist')).not.toBeNull()
    const options = document.querySelectorAll('datalist option')
    const values = Array.from(options).map((o) => (o as HTMLOptionElement).value)
    expect(values).toContain('A')
    expect(values).toContain('B')
  })
})
