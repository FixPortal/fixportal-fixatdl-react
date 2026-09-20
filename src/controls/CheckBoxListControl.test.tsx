import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CheckBoxListControl } from './CheckBoxListControl'
import type { AtdlControlDto, AtdlListItemDto } from '../types'
import type { ControlFormState } from '../useAtdlFormState'

afterEach(cleanup)

const LIST_ITEMS: AtdlListItemDto[] = [
  { enumId: 'OPT_A', uiRep: 'Option A' },
  { enumId: 'OPT_B', uiRep: 'Option B' },
]

const BASE_CONTROL: AtdlControlDto = {
  id: 'ctrl_cbl',
  type: 'CheckBoxList_t',
  label: 'Options',
  parameterRef: null,
  parameter: null,
  listItems: LIST_ITEMS,
  initValue: null,
  stateRules: [],
  tooltip: null,
}

const ENABLED: ControlFormState = { enabled: true, visible: true, required: false, errors: [] }

// CheckBoxListControl re-exports MultiSelectControl. These tests verify the
// alias behaves correctly - any deeper coverage lives in MultiSelectControl.test.tsx.
describe('CheckBoxListControl', () => {
  it('emits onChange with the selected item added when a checkbox is checked', () => {
    const onChange = vi.fn()
    render(
      <CheckBoxListControl
        control={BASE_CONTROL}
        value={[]}
        onChange={onChange}
        state={ENABLED}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Option A' }))
    expect(onChange).toHaveBeenCalledWith(['OPT_A'])
  })

})
