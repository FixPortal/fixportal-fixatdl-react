import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TextFieldControl } from './TextFieldControl'
import type { AtdlControlDto } from '../types'
import type { ControlFormState } from '../useAtdlFormState'

afterEach(cleanup)

const BASE_CONTROL: AtdlControlDto = {
  id: 'ctrl_text',
  type: 'TextField_t',
  label: 'Strategy Name',
  parameterRef: null,
  parameter: null,
  listItems: null,
  initValue: null,
  stateRules: [],
  tooltip: null,
}

const ENABLED: ControlFormState = { enabled: true, visible: true, required: false, errors: [] }

describe('TextFieldControl', () => {
  it('renders the label', () => {
    render(<TextFieldControl control={BASE_CONTROL} value="" onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByText('Strategy Name')).toBeInTheDocument()
  })

  it('emits onChange with the typed string', () => {
    const onChange = vi.fn()
    render(<TextFieldControl control={BASE_CONTROL} value="" onChange={onChange} state={ENABLED} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'TWAP' } })
    expect(onChange).toHaveBeenCalledWith('TWAP')
  })

  it('displays the current value', () => {
    render(<TextFieldControl control={BASE_CONTROL} value="VWAP" onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByRole('textbox')).toHaveValue('VWAP')
  })

  it('shows required asterisk when state.required is true', () => {
    render(
      <TextFieldControl
        control={BASE_CONTROL}
        value=""
        onChange={vi.fn()}
        state={{ ...ENABLED, required: true }}
      />,
    )
    expect(screen.getByText('*')).toBeInTheDocument()
  })

})
