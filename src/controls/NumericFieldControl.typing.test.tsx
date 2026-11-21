import { useState } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NumericFieldControl } from './NumericFieldControl.js'
import type { AtdlControlDto } from '../types.js'

afterEach(cleanup)

const CONTROL: AtdlControlDto = {
  id: 'ctrl_num',
  type: 'DoubleSpinner_t',
  label: 'Rate',
  parameterRef: null,
  parameter: null,
  listItems: null,
  initValue: null,
  stateRules: [],
  tooltip: null,
}

function Harness() {
  const [value, setValue] = useState<unknown>(null)
  return (
    <NumericFieldControl
      control={CONTROL}
      value={value}
      onChange={setValue}
      state={{ enabled: true, visible: true, required: false, errors: [] }}
    />
  )
}

describe('NumericFieldControl in-progress decimal text', () => {
  // Raw input.value, not toHaveValue: jest-dom coerces number inputs, so it passes on the bug.
  it.each(['1.0', '0.0', '-0', '05', '1.5'])('leaves %s in the field', (text) => {
    render(<Harness />)
    const input = screen.getByLabelText('Rate') as HTMLInputElement
    fireEvent.change(input, { target: { value: text } })
    expect(input.value).toBe(text)
  })

  it('types 1.05 key by key', async () => {
    render(<Harness />)
    const input = screen.getByLabelText('Rate') as HTMLInputElement
    await userEvent.type(input, '1.05')
    expect(input.value).toBe('1.05')
  })

  it('types -0.05 key by key', async () => {
    render(<Harness />)
    const input = screen.getByLabelText('Rate') as HTMLInputElement
    await userEvent.type(input, '-0.05')
    expect(input.value).toBe('-0.05')
  })
})
