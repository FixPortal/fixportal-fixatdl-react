import { createRef } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { FormRenderer } from './FormRenderer'
import type { FormRendererHandle } from './FormRenderer'
import strategyJson from './__fixtures__/twap-strategy.json'
import type { AtdlStrategyDto } from './types'

afterEach(cleanup)

// WHY: cast through unknown so the JSON literal satisfies the interface without
// needing `resolveJsonModule` in tsconfig - Vite handles JSON imports natively
// and TypeScript's bundler mode accepts the result.
const strategy = strategyJson as unknown as AtdlStrategyDto

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderForm(ref?: ReturnType<typeof createRef<FormRendererHandle>>) {
  return render(<FormRenderer ref={ref ?? null} strategy={strategy} />)
}

function cloneStrategyWithSourceXml(nextSourceXml: string): AtdlStrategyDto {
  return {
    ...structuredClone(strategy),
    sourceXml: nextSourceXml,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FormRenderer', () => {
  it('returns detached snapshots, including selected-value arrays', () => {
    const ref = createRef<FormRendererHandle>()
    renderForm(ref)
    fireEvent.click(screen.getByRole('checkbox', { name: 'NYSE' }))
    const expected = structuredClone(ref.current!.getValues())
    const snapshot = ref.current!.getValues()
    snapshot.ctrl_name = 'external mutation'
    const selections = Object.values(snapshot).find(Array.isArray)
    expect(selections).toBeDefined()
    selections!.push('external venue')
    fireEvent.change(screen.getByLabelText('Participation %'), { target: { value: '20' } })
    expect(ref.current!.getValues().ctrl_name).toBe(expected.ctrl_name)
    expect(Object.values(ref.current!.getValues()).find(Array.isArray)).toEqual(Object.values(expected).find(Array.isArray))
  })
  it('renders every major control type from the fixture DTO', () => {
    renderForm()

    // TextField_t - Strategy Name
    expect(screen.getByLabelText('Strategy Name')).toBeInTheDocument()

    // DoubleSpinner_t - Participation %
    expect(screen.getByLabelText('Participation %')).toBeInTheDocument()

    // DropDownList_t - Side (rendered as <select>)
    expect(screen.getByRole('combobox', { name: 'Side' })).toBeInTheDocument()

    // CheckBox_t - Aggressive
    expect(screen.getByRole('checkbox', { name: /Aggressive/i })).toBeInTheDocument()

    // RadioButtonList_t - Algorithm (rendered as radiogroup)
    expect(screen.getByRole('radiogroup', { name: 'Algorithm' })).toBeInTheDocument()

    // Clock_t - Start Time (inside collapsed details, still in DOM)
    expect(screen.getByLabelText('Start Time')).toBeInTheDocument()

    // Slider_t - % Complete
    expect(screen.getByRole('slider', { name: '% Complete' })).toBeInTheDocument()

    // MultiSelectList_t - Venues (rendered as group of checkboxes)
    expect(screen.getByRole('group', { name: 'Venues' })).toBeInTheDocument()

    // CheckBoxList_t - Features (same MultiSelect renderer)
    expect(screen.getByRole('group', { name: 'Features' })).toBeInTheDocument()

    // Label_t - static text
    expect(
      screen.getByText('Strategy parameters above will be included in the FIX order.'),
    ).toBeInTheDocument()

    // EditableDropDownList_t - Override Side (rendered as combobox)
    expect(screen.getByRole('combobox', { name: 'Override Side' })).toBeInTheDocument()
  })

  it('updates value on a TextField when the user types', () => {
    renderForm()
    const input = screen.getByLabelText('Strategy Name')
    fireEvent.change(input, { target: { value: 'MY_TWAP' } })
    // WHY: check the DOM value directly rather than a mock - FormRenderer owns
    // the state and the controlled input must reflect it after the change event.
    expect(input).toHaveValue('MY_TWAP')
  })

  it('disables ctrl_aggressive when ctrl_side is changed to "Sell" (StateRule enabled=false)', () => {
    renderForm()
    const sideSelect = screen.getByRole('combobox', { name: 'Side' })
    const aggressiveCheckbox = screen.getByRole('checkbox', { name: /Aggressive/i })

    // Before: Aggressive is enabled (no side selected → rule expression is false)
    expect(aggressiveCheckbox).not.toBeDisabled()

    // Act: change side to Sell - triggers the StateRule effect="enabled" targetValue=false
    fireEvent.change(sideSelect, { target: { value: 'Sell' } })

    // Assert: Aggressive checkbox must now be disabled
    expect(aggressiveCheckbox).toBeDisabled()
  })

  it('hides ctrl_start_time when ctrl_algo_type is set to "IS" (StateRule visible=false)', () => {
    renderForm()

    // Before: Start Time input is visible (initValue="TWAP", rule evaluates to false)
    expect(screen.getByLabelText('Start Time')).toBeInTheDocument()

    // Act: change AlgoType radio to IS
    // WHY: click the IS radio rather than fireEvent.change so the radio group
    // updates its checked state, matching how the user interacts.
    const isRadio = screen.getByRole('radio', { name: 'IS' })
    fireEvent.click(isRadio)

    // Assert: Start Time clock input must be removed from DOM (visible=false → null render)
    expect(screen.queryByLabelText('Start Time')).not.toBeInTheDocument()
  })

  it('reflects validation errors on a control when state.errors is populated', () => {
    // WHY: the Participation spinner has min=0, max=100. NumericFieldControl
    // converts the input to a Number before calling onChange, so the validator
    // receives a numeric 150 and fires "Must be ≤ 100." via the max range check.
    renderForm()
    const participationInput = screen.getByLabelText('Participation %')

    // Typing 150 exceeds max=100 → validator produces a range error
    fireEvent.change(participationInput, { target: { value: '150' } })

    expect(screen.getByText('Must be ≤ 100.')).toBeInTheDocument()
  })

  it('exposes current values via imperative handle getValues()', () => {
    const ref = createRef<FormRendererHandle>()
    renderForm(ref)

    // Type a value into the strategy name field
    const input = screen.getByLabelText('Strategy Name')
    fireEvent.change(input, { target: { value: 'handle-test' } })

    // Pull values via the handle
    const values = ref.current?.getValues()
    expect(values).toBeDefined()
    expect(values?.['ctrl_name']).toBe('handle-test')
  })

  it('reseeds form state when the strategy identity changes', () => {
    const { rerender } = render(<FormRenderer strategy={strategy} />)
    const input = screen.getByLabelText('Strategy Name')
    const initialValue = (input as HTMLInputElement).value

    fireEvent.change(input, { target: { value: 'edited-name' } })
    expect(input).toHaveValue('edited-name')

    rerender(<FormRenderer strategy={cloneStrategyWithSourceXml('<Strategy name="TWAP" version="2" />')} />)

    expect(screen.getByLabelText('Strategy Name')).toHaveValue(initialValue)
  })
})

 it('isolates DOM identities and radio groups between simultaneous editors', () => {
  const { container } = render(<><FormRenderer strategy={strategy} /><FormRenderer strategy={strategy} /></>)
  const ids = [...container.querySelectorAll('[id]')].map(element => element.id)
  expect(new Set(ids).size).toBe(ids.length)
  const groups = screen.getAllByRole('radiogroup', { name: 'Algorithm' })
  expect(groups[0].querySelector('input')?.name).not.toBe(groups[1].querySelector('input')?.name)
 })
