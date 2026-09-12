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

  it('renders disabled when state.enabled is false', () => {
    render(
      <TextFieldControl
        control={BASE_CONTROL}
        value=""
        onChange={vi.fn()}
        state={{ ...ENABLED, enabled: false }}
      />,
    )
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('renders nothing when state.visible is false', () => {
    const { container } = render(
      <TextFieldControl
        control={BASE_CONTROL}
        value=""
        onChange={vi.fn()}
        state={{ ...ENABLED, visible: false }}
      />,
    )
    expect(container.firstChild).toBeNull()
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

  it('displays error messages when state.errors is non-empty', () => {
    render(
      <TextFieldControl
        control={BASE_CONTROL}
        value=""
        onChange={vi.fn()}
        state={{ ...ENABLED, errors: ['This field is required.', 'Too long.'] }}
      />,
    )
    expect(screen.getByText('This field is required.')).toBeInTheDocument()
    expect(screen.getByText('Too long.')).toBeInTheDocument()
  })
})
