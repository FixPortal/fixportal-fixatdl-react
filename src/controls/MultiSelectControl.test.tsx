import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MultiSelectControl } from './MultiSelectControl'
import type { AtdlControlDto, AtdlListItemDto } from '../types'
import type { ControlFormState } from '../useAtdlFormState'

afterEach(cleanup)

const LIST_ITEMS: AtdlListItemDto[] = [
  { enumId: 'DARK', uiRep: 'Dark Pool' },
  { enumId: 'LIT', uiRep: 'Lit Venue' },
  { enumId: 'MTF', uiRep: 'MTF' },
]

const BASE_CONTROL: AtdlControlDto = {
  id: 'ctrl_ms',
  type: 'MultiSelectList_t',
  label: 'Venues',
  parameterRef: null,
  parameter: null,
  listItems: LIST_ITEMS,
  initValue: null,
  stateRules: [],
  tooltip: null,
}

const ENABLED: ControlFormState = { enabled: true, visible: true, required: false, errors: [] }

describe('MultiSelectControl', () => {
  it('emits onChange with the selected item added to the array', () => {
    const onChange = vi.fn()
    render(
      <MultiSelectControl
        control={BASE_CONTROL}
        value={['DARK']}
        onChange={onChange}
        state={ENABLED}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lit Venue' }))
    expect(onChange).toHaveBeenCalledWith(['DARK', 'LIT'])
  })

  it('emits onChange with the item removed when unchecked', () => {
    const onChange = vi.fn()
    render(
      <MultiSelectControl
        control={BASE_CONTROL}
        value={['DARK', 'LIT']}
        onChange={onChange}
        state={ENABLED}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Dark Pool' }))
    expect(onChange).toHaveBeenCalledWith(['LIT'])
  })

  it('clicking a second item adds it to an existing array', () => {
    const onChange = vi.fn()
    render(
      <MultiSelectControl
        control={BASE_CONTROL}
        value={['DARK']}
        onChange={onChange}
        state={ENABLED}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'MTF' }))
    expect(onChange).toHaveBeenCalledWith(['DARK', 'MTF'])
  })

  it('unchecking removes only the target from the array', () => {
    const onChange = vi.fn()
    render(
      <MultiSelectControl
        control={BASE_CONTROL}
        value={['DARK', 'LIT', 'MTF']}
        onChange={onChange}
        state={ENABLED}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lit Venue' }))
    expect(onChange).toHaveBeenCalledWith(['DARK', 'MTF'])
  })

  it('renders all items as checkboxes', () => {
    render(
      <MultiSelectControl
        control={BASE_CONTROL}
        value={[]}
        onChange={vi.fn()}
        state={ENABLED}
      />,
    )
    expect(screen.getByRole('checkbox', { name: 'Dark Pool' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Lit Venue' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'MTF' })).toBeInTheDocument()
  })

  it('renders all checkboxes disabled when state.enabled is false', () => {
    render(
      <MultiSelectControl
        control={BASE_CONTROL}
        value={[]}
        onChange={vi.fn()}
        state={{ ...ENABLED, enabled: false }}
      />,
    )
    const checkboxes = screen.getAllByRole('checkbox')
    checkboxes.forEach((cb) => expect(cb).toBeDisabled())
  })

  it('renders nothing when state.visible is false', () => {
    const { container } = render(
      <MultiSelectControl
        control={BASE_CONTROL}
        value={[]}
        onChange={vi.fn()}
        state={{ ...ENABLED, visible: false }}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows error messages when state.errors is non-empty', () => {
    render(
      <MultiSelectControl
        control={BASE_CONTROL}
        value={[]}
        onChange={vi.fn()}
        state={{ ...ENABLED, errors: ['At least one venue is required.'] }}
      />,
    )
    expect(screen.getByText('At least one venue is required.')).toBeInTheDocument()
  })

  it('applies error border class to the group wrapper when state.errors is non-empty', () => {
    render(
      <MultiSelectControl
        control={BASE_CONTROL}
        value={[]}
        onChange={vi.fn()}
        state={{ ...ENABLED, errors: ['Required.'] }}
      />,
    )
    const group = screen.getByRole('group')
    expect(group.className).toContain('border-bad-border')
  })

  it('falls back to parameter.enumValues when listItems is absent', () => {
    const ctrl: AtdlControlDto = {
      ...BASE_CONTROL,
      listItems: null,
      parameter: {
        name: 'Venues',
        fixTag: 9003,
        type: 'String_t',
        enumValues: [
          { enumId: 'X', wireValue: '1' },
          { enumId: 'Y', wireValue: '2' },
        ],
        min: null,
        max: null,
        precision: null,
        mutableOnCxlRpl: true,
        useValue: 'optional',
        defaultValue: null,
      },
    }
    render(<MultiSelectControl control={ctrl} value={[]} onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByRole('checkbox', { name: 'X' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Y' })).toBeInTheDocument()
  })
})
