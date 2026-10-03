import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PanelRenderer } from './PanelRenderer'
import type { AtdlPanelDto } from './types'

afterEach(cleanup)

// A single TextField control that carries one state rule, so the "why?" chip
// affordance depends purely on the `state` we pass in.
const panel = {
  title: null,
  border: 'None',
  orientation: 'VERTICAL',
  collapsible: false,
  collapsed: false,
  children: [
    {
      kind: 'control',
      id: 'price',
      type: 'TextField_t',
      label: 'Price',
      parameterRef: null,
      parameter: null,
      listItems: null,
      initValue: null,
      tooltip: null,
      stateRules: [
        {
          effect: 'enabled',
          targetValue: false,
          expression: { kind: 'compare', operator: '==', field: 'OrdType', value: '1', children: null },
        },
      ],
    },
  ],
} as unknown as AtdlPanelDto

const enabled = { price: { enabled: true, visible: true, required: false, errors: [] } }
const disabled = { price: { enabled: false, visible: true, required: false, errors: [] } }

const radioPanel = {
  ...panel,
  children: [{
    kind: 'control', id: 'side', type: 'RadioButton_t', label: 'Buy', parameterRef: null,
    parameter: null, listItems: null, initValue: false, tooltip: null, radioGroup: 'side', stateRules: [],
    checkedEnumRef: 'buy', uncheckedEnumRef: 'sell',
  }],
} as unknown as AtdlPanelDto

describe('PanelRenderer why? chip', () => {
  it('keeps explanation buttons from submitting a host form through text attributes', () => {
    const submit = vi.fn((event: { preventDefault(): void }) => event.preventDefault())
    render(<form onSubmit={submit}><PanelRenderer panel={panel} values={{}} setValue={() => {}}
      state={disabled} highlightedControlId={null} onHighlightControl={() => {}}
      text={{ whyRule: { value: 'Explain', attrs: { type: 'submit' } } }} /></form>)
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    expect(submit).not.toHaveBeenCalled()
  })
  it('shows a why? chip on a rule-disabled control and reports it on click', () => {
    const onHighlight = vi.fn()
    render(
      <PanelRenderer
        panel={panel}
        values={{}}
        setValue={() => {}}
        state={disabled}
        highlightedControlId={null}
        onHighlightControl={onHighlight}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /why\?/i }))
    expect(onHighlight).toHaveBeenCalledWith('price')
  })

  it('shows no why? chip when the control is enabled and visible', () => {
    render(
      <PanelRenderer
        panel={panel}
        values={{}}
        setValue={() => {}}
        state={enabled}
        highlightedControlId={null}
        onHighlightControl={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /why\?/i })).not.toBeInTheDocument()
  })

  it('scopes individual radio controls between simultaneous editors', () => {
    const { container } = render(<><PanelRenderer panel={radioPanel} values={{ side: false }} setValue={() => {}}
      state={{ side: { enabled: true, visible: true, required: false, errors: [] } }} highlightedControlId={null} />
      <PanelRenderer panel={radioPanel} values={{ side: false }} setValue={() => {}}
        state={{ side: { enabled: true, visible: true, required: false, errors: [] } }} highlightedControlId={null} /></>)
    const radios = [...container.querySelectorAll('input[type="radio"]')]
    expect(radios).toHaveLength(2)
    expect(radios[0].getAttribute('name')).not.toBe(radios[1].getAttribute('name'))
  })
})
