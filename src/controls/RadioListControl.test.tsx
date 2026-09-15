import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { RadioListControl } from './RadioListControl'
import type { AtdlControlDto, AtdlListItemDto } from '../types'
import type { ControlFormState } from '../useAtdlFormState'

afterEach(cleanup)

const LIST_ITEMS: AtdlListItemDto[] = [
  { enumId: 'LOW', uiRep: 'Low' },
  { enumId: 'MED', uiRep: 'Medium' },
  { enumId: 'HIGH', uiRep: 'High' },
]

const BASE_CONTROL: AtdlControlDto = {
  id: 'ctrl_radio',
  type: 'RadioButtonList_t',
  label: 'Urgency',
  parameterRef: null,
  parameter: null,
  listItems: LIST_ITEMS,
  initValue: null,
  stateRules: [],
  tooltip: null,
}

const ENABLED: ControlFormState = { enabled: true, visible: true, required: false, errors: [] }

describe('RadioListControl', () => {
  it('renders one radio button per list item', () => {
    render(<RadioListControl control={BASE_CONTROL} value={null} onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('checks the radio whose enumId matches the current value', () => {
    render(<RadioListControl control={BASE_CONTROL} value="MED" onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Low' })).not.toBeChecked()
  })

  it('emits onChange with the enumId when a radio is selected', () => {
    const onChange = vi.fn()
    render(<RadioListControl control={BASE_CONTROL} value={null} onChange={onChange} state={ENABLED} />)
    fireEvent.click(screen.getByRole('radio', { name: 'High' }))
    expect(onChange).toHaveBeenCalledWith('HIGH')
  })



  it('shows the group label', () => {
    render(<RadioListControl control={BASE_CONTROL} value={null} onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByText('Urgency')).toBeInTheDocument()
  })

})
