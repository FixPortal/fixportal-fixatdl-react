import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { LabelControl } from './LabelControl'
import type { AtdlControlDto } from '../types'
import type { ControlFormState } from '../useAtdlFormState'

afterEach(cleanup)

const BASE_CONTROL: AtdlControlDto = {
  id: 'ctrl_label',
  type: 'Label_t',
  label: 'Read-only note',
  parameterRef: null,
  parameter: null,
  listItems: null,
  initValue: null,
  stateRules: [],
  tooltip: null,
}

const ENABLED: ControlFormState = { enabled: true, visible: true, required: false, errors: [] }

describe('LabelControl', () => {
  it('renders its label text when visible', () => {
    render(<LabelControl control={BASE_CONTROL} value={null} onChange={vi.fn()} state={ENABLED} />)
    expect(screen.getByText('Read-only note')).toBeInTheDocument()
  })

})
