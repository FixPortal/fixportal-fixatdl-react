import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { controlRegistry } from './controlRegistry'
import type { AtdlControlDto, AtdlListItemDto } from '../types'
import type { ControlFormState } from '../useAtdlFormState'

afterEach(cleanup)

// Shared per-control rendering contract, consolidated from the "renders
// nothing when invisible" / "renders its error messages" / "renders disabled"
// tests that the per-control test files repeated near-identically (ten files
// each for the first two, ten for the third). Anything beyond this contract
// stays in the control's own test file. HiddenField_t has no rows: it renders
// null by definition and has no visible/disabled/error branches to pin.
// Label_t has no errors row: it renders read-only chrome and shows no errors.

const ENABLED: ControlFormState = { enabled: true, visible: true, required: false, errors: [] }

const LIST_ITEMS: AtdlListItemDto[] = [
  { enumId: 'A', uiRep: 'Option A' },
  { enumId: 'B', uiRep: 'Option B' },
]

function controlOf(type: string, extras: Partial<AtdlControlDto> = {}): AtdlControlDto {
  return {
    id: `ctrl_${type}`, type, label: 'Field', parameterRef: null, parameter: null,
    listItems: null, initValue: null, stateRules: [], tooltip: null, ...extras,
  }
}

const SLIDER_PARAMETER = {
  name: 'P1', fixTag: 9002, type: 'Float_t', enumValues: null, min: 0, max: 100,
  precision: null, mutableOnCxlRpl: true, useValue: 'optional', defaultValue: null,
}

type Editor = { kind: 'role'; role: string } | { kind: 'all'; role: string } | { kind: 'time' } | { kind: 'none' }

interface SharedCase {
  type: string
  control: AtdlControlDto
  value: unknown
  editor: Editor
  showsErrors: boolean
}

const CASES: SharedCase[] = [
  { type: 'TextField_t', control: controlOf('TextField_t'), value: '', editor: { kind: 'role', role: 'textbox' }, showsErrors: true },
  { type: 'DoubleSpinner_t', control: controlOf('DoubleSpinner_t'), value: null, editor: { kind: 'role', role: 'spinbutton' }, showsErrors: true },
  { type: 'DropDownList_t', control: controlOf('DropDownList_t', { listItems: LIST_ITEMS }), value: '', editor: { kind: 'role', role: 'combobox' }, showsErrors: true },
  { type: 'EditableDropDownList_t', control: controlOf('EditableDropDownList_t', { listItems: LIST_ITEMS }), value: '', editor: { kind: 'role', role: 'combobox' }, showsErrors: true },
  { type: 'CheckBox_t', control: controlOf('CheckBox_t'), value: false, editor: { kind: 'role', role: 'checkbox' }, showsErrors: true },
  { type: 'CheckBoxList_t', control: controlOf('CheckBoxList_t', { listItems: LIST_ITEMS }), value: [], editor: { kind: 'all', role: 'checkbox' }, showsErrors: true },
  { type: 'MultiSelectList_t', control: controlOf('MultiSelectList_t', { listItems: LIST_ITEMS }), value: [], editor: { kind: 'all', role: 'checkbox' }, showsErrors: true },
  { type: 'RadioButtonList_t', control: controlOf('RadioButtonList_t', { listItems: LIST_ITEMS }), value: null, editor: { kind: 'all', role: 'radio' }, showsErrors: true },
  { type: 'Clock_t', control: controlOf('Clock_t'), value: '', editor: { kind: 'time' }, showsErrors: true },
  { type: 'Slider_t', control: controlOf('Slider_t', { parameter: SLIDER_PARAMETER }), value: 0, editor: { kind: 'role', role: 'slider' }, showsErrors: true },
  { type: 'Label_t', control: controlOf('Label_t'), value: null, editor: { kind: 'none' }, showsErrors: false },
]

function renderCase(entry: SharedCase, state: ControlFormState) {
  const Component = controlRegistry[entry.type]
  return render(<Component control={entry.control} value={entry.value} onChange={vi.fn()} state={state} />)
}

describe('shared control state rendering', () => {
  it.each(CASES)('$type renders nothing when state.visible is false', entry => {
    const { container } = renderCase(entry, { ...ENABLED, visible: false })
    expect(container.firstChild).toBeNull()
  })

  it.each(CASES.filter(entry => entry.showsErrors))('$type renders every message in state.errors', entry => {
    renderCase(entry, { ...ENABLED, errors: ['First error.', 'Second error.'] })
    expect(screen.getByText('First error.')).toBeInTheDocument()
    expect(screen.getByText('Second error.')).toBeInTheDocument()
  })

  it.each(CASES.filter(entry => entry.editor.kind !== 'none'))('$type disables its editor when state.enabled is false', entry => {
    renderCase(entry, { ...ENABLED, enabled: false })
    if (entry.editor.kind === 'role') {
      expect(screen.getByRole(entry.editor.role)).toBeDisabled()
    } else if (entry.editor.kind === 'all') {
      const editors = screen.getAllByRole(entry.editor.role)
      expect(editors.length).toBeGreaterThan(0)
      editors.forEach(editor => expect(editor).toBeDisabled())
    } else if (entry.editor.kind === 'time') {
      // input[type="time"] has no ARIA textbox role - query it directly.
      const input = document.querySelector('input[type="time"]') as HTMLInputElement
      expect(input).toBeDisabled()
    }
  })
})
