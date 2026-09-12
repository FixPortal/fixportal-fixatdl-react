import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CheckBoxControl } from './CheckBoxControl'
import type { AtdlControlDto } from '../types'
import type { ControlFormState } from '../useAtdlFormState'

afterEach(cleanup)

const BASE_CONTROL: AtdlControlDto = {
  id: 'ctrl_cb',
  type: 'CheckBox_t',
  label: 'Enable dark pool',
  parameterRef: null,
  parameter: null,
  listItems: null,
  initValue: null,
  stateRules: [],
  tooltip: null,
}

const ENABLED: ControlFormState = { enabled: true, visible: true, required: false, errors: [] }

describe('CheckBoxControl', () => {
  it('renders unchecked when value is false', () => {
    render(<CheckBoxControl control={BASE_CONTROL} value={false} onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('renders checked when value is true', () => {
    render(<CheckBoxControl control={BASE_CONTROL} value={true} onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('emits onChange with true when checked', () => {
    const onChange = vi.fn()
    render(<CheckBoxControl control={BASE_CONTROL} value={false} onChange={onChange} state={ENABLED} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('emits onChange with false when unchecked', () => {
    const onChange = vi.fn()
    render(<CheckBoxControl control={BASE_CONTROL} value={true} onChange={onChange} state={ENABLED} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('renders disabled when state.enabled is false', () => {
    render(
      <CheckBoxControl
        control={BASE_CONTROL}
        value={false}
        onChange={vi.fn()}
        state={{ ...ENABLED, enabled: false }}
      />,
    )
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('renders nothing when state.visible is false', () => {
    const { container } = render(
      <CheckBoxControl
        control={BASE_CONTROL}
        value={false}
        onChange={vi.fn()}
        state={{ ...ENABLED, visible: false }}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('displays the label text', () => {
    render(<CheckBoxControl control={BASE_CONTROL} value={false} onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByText('Enable dark pool')).toBeInTheDocument()
  })

  it('shows error messages when state.errors is non-empty', () => {
    render(
      <CheckBoxControl
        control={BASE_CONTROL}
        value={false}
        onChange={vi.fn()}
        state={{ ...ENABLED, errors: ['Required.'] }}
      />,
    )
    expect(screen.getByText('Required.')).toBeInTheDocument()
  })
})

 it.each(['false', 'N', '0', '', null, undefined])('does not treat %s as a checked default', value => {
  render(<CheckBoxControl control={BASE_CONTROL} value={value} onChange={vi.fn()} state={ENABLED} />)
  expect(screen.getByRole('checkbox')).not.toBeChecked()
 })
