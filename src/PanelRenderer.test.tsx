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

describe('PanelRenderer why? chip', () => {
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
})
