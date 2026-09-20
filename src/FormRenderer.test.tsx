import { createRef } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { FormRenderer } from './FormRenderer'
import type { FormRendererHandle } from './FormRenderer'
import strategyJson from './__fixtures__/twap-strategy.json'
import type { AtdlStrategyDto, AtdlControlDto } from './types'
import { flattenControls } from './atdlControls'
import { controlRegistry } from './controls/controlRegistry'

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
  it.each(['TextField_t', 'DoubleSpinner_t', 'DropDownList_t', 'CheckBox_t', 'RadioButtonList_t', 'EditableDropDownList_t', 'Clock_t', 'Slider_t', 'MultiSelectList_t'])('renders duplicate errors without React key collisions: %s', type => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const Component = controlRegistry[type]
      render(<Component control={{ ...control, type }} value={null} onChange={vi.fn()} state={{ visible: true, enabled: true, required: false, errors: ['Invalid rule.', 'Invalid rule.'] }} />)
      expect(screen.getAllByText('Invalid rule.')).toHaveLength(2)
      expect(spy).not.toHaveBeenCalled()
    } finally { spy.mockRestore() }
  })
  it('keeps the shipped percentage slider in whole-percent display units', () => {
    renderForm()
    expect(screen.getByRole('slider')).toHaveAttribute('max', '100')
  })
  const control = flattenControls(strategy)[0]
  function single(overrides: Partial<AtdlControlDto>): AtdlStrategyDto {
    return { ...strategy, parameters: [], panel: { ...strategy.panel, children: [{ ...control, ...overrides, kind: 'control' }] } }
  }
  const hidden = { effect: 'visible', targetValue: false, targetStringValue: null, expression: { kind: 'and', children: [], field: null, operator: null, value: null } }

  it.each(['TextField_t', 'HiddenField_t'])('surfaces a hidden required control error with its label: %s', type => {
    const ref = createRef<FormRendererHandle>()
    const document = single({ type, label: 'Hidden quantity', initValue: null, parameter: { ...strategy.parameters[0], useValue: 'required' }, stateRules: type === 'HiddenField_t' ? [] : [hidden] })
    render(<FormRenderer ref={ref} strategy={document} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Hidden quantity: This field is required.')
    expect(ref.current!.isValid()).toBe(false)
  })
  it('routes why clicks to the host inspector', () => {
    const onHighlightControl = vi.fn()
    render(<FormRenderer strategy={single({ stateRules: [hidden] })} onHighlightControl={onHighlightControl} />)
    fireEvent.click(screen.getByRole('button', { name: 'why?' }))
    expect(onHighlightControl).toHaveBeenCalledWith(control.id)
  })
  it('omits the why button when no inspector is connected', () => {
    render(<FormRenderer strategy={single({ stateRules: [hidden] })} />)
    expect(screen.queryByRole('button', { name: 'why?' })).not.toBeInTheDocument()
  })
  it.each(['constructor', '__proto__'])('renders an unsupported-control placeholder for %s', type => {
    render(<FormRenderer strategy={single({ type })} />)
    expect(screen.getByText(type)).toBeInTheDocument()
  })
  it('fails validation for an unregistered control type, naming the type', () => {
    // The renderer placeholder is only half the contract: a host gating
    // submission on the imperative handle must see the form as invalid, or the
    // order goes through with that control's parameter silently unset.
    const ref = createRef<FormRendererHandle>()
    render(<FormRenderer ref={ref} strategy={single({ type: 'unregisteredType' })} />)
    expect(ref.current!.isValid()).toBe(false)
    expect(ref.current!.getErrors()).toContain('Unsupported control type: unregisteredType')
  })
  it('displays an unmatched required selection without selecting option zero', () => {
    const ref = createRef<FormRendererHandle>()
    render(<FormRenderer ref={ref} strategy={single({ type: 'DropDownList_t', initValue: 'missing', listItems: [{ enumId: 'a', uiRep: 'A' }], parameter: { ...strategy.parameters[0], useValue: 'required' } })} />)
    expect(screen.getByRole('combobox')).toHaveValue('missing')
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a' } })
    expect(ref.current!.getValues()[control.id]).toBe('a')
  })
  it('announces required checkbox groups', () => {
    render(<FormRenderer strategy={single({ type: 'CheckBoxList_t', label: 'Venues', parameter: { ...strategy.parameters[0], useValue: 'required' }, listItems: [{ enumId: 'a', uiRep: 'A' }] })} />)
    expect(screen.getByRole('group', { name: 'Venues (Required)' })).toBeInTheDocument()
  })
  it('exposes strategy validation to both the user and the submit handle', () => {
    const ref = createRef<FormRendererHandle>()
    const invalid = { ...strategy, strategyEdits: [{ errorMessage: 'Choose a valid combination.', expression: { kind: 'compare', operator: '==', field: strategy.parameters[0].name, value: 'impossible', children: null } }] }
    render(<FormRenderer ref={ref} strategy={invalid} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a valid combination.')
    expect(ref.current!.isValid()).toBe(false)
    expect(ref.current!.getErrors()).toContain('Choose a valid combination.')
  })
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

  it.each([false, true])('reseeds form state when the strategy identity changes (in-place: %s)', inPlace => {
    const document = structuredClone(strategy)
    const { rerender } = render(<FormRenderer strategy={document} />)
    const input = screen.getByLabelText('Strategy Name')
    const initialValue = (input as HTMLInputElement).value

    fireEvent.change(input, { target: { value: 'edited-name' } })
    expect(input).toHaveValue('edited-name')

    const updated = cloneStrategyWithSourceXml('<Strategy name="TWAP" version="2" />')
    rerender(<FormRenderer strategy={inPlace ? Object.assign(document, updated) : updated} />)

    expect(screen.getByLabelText('Strategy Name')).toHaveValue(initialValue)
    expect(screen.getByLabelText('Strategy Name')).not.toBe(input)
  })
  it('isolates DOM identities and radio groups between simultaneous editors', () => {
    const { container } = render(<><FormRenderer strategy={strategy} /><FormRenderer strategy={strategy} /></>)
    const ids = [...container.querySelectorAll('[id]')].map(element => element.id)
    expect(new Set(ids).size).toBe(ids.length)
    const groups = screen.getAllByRole('radiogroup', { name: 'Algorithm' })
    expect(groups[0].querySelector('input')?.name).not.toBe(groups[1].querySelector('input')?.name)
  })
})
