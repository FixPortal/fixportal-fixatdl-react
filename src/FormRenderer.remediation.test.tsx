import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FormRenderer } from './FormRenderer.js'
import { PanelRenderer } from './PanelRenderer.js'
import type { AtdlControlDto, AtdlPanelDto, AtdlStrategyDto } from './types.js'

afterEach(cleanup)

const PARAM = {
  name: 'P',
  fixTag: 9001,
  type: 'String_t',
  enumValues: null,
  min: null,
  max: null,
  precision: null,
  mutableOnCxlRpl: true,
  useValue: 'required',
  defaultValue: null,
}

const hideRule = {
  effect: 'visible',
  targetValue: false,
  targetStringValue: null,
  expression: { kind: 'and', children: [], field: null, operator: null, value: null },
}

function control(overrides: Partial<AtdlControlDto>): AtdlControlDto & { kind: 'control' } {
  return {
    kind: 'control',
    id: 'c1',
    type: 'TextField_t',
    label: 'Name',
    parameterRef: null,
    parameter: null,
    listItems: null,
    initValue: null,
    stateRules: [],
    tooltip: null,
    ...overrides,
  }
}

function panelOf(children: AtdlPanelDto['children'], collapsed = false): AtdlPanelDto {
  return {
    children,
    collapsed,
    collapsible: collapsed,
    orientation: 'Vertical',
    border: 'None',
    title: collapsed ? 'Section' : null,
  }
}

function strategyOf(panel: AtdlPanelDto, parameters = [PARAM]): AtdlStrategyDto {
  return { name: 'S', parameters, panel, sourceXml: '<Strategy />' }
}

describe('FormRenderer summary reaches errors the user cannot see', () => {
  it('lists a required control inside a collapsed panel (S3-AR-2)', () => {
    const required = control({ parameter: PARAM, parameterRef: 'P' })
    render(<FormRenderer strategy={strategyOf(panelOf([required], true))} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Name: This field is required.')
  })

  it('does not list a collapsed-panel error twice once the panel is open', () => {
    const required = control({ parameter: PARAM, parameterRef: 'P' })
    render(<FormRenderer strategy={strategyOf(panelOf([required], false))} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lists a Label_t state-rule error (S3-AR-6)', () => {
    const label = control({
      id: 'l1',
      type: 'Label_t',
      label: 'Note',
      stateRules: [{ ...hideRule, effect: 'enabled', expression: { kind: 'bogus' } }] as never,
    })
    render(<FormRenderer strategy={strategyOf(panelOf([label]), [])} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Note: Invalid or unsupported state rule.')
  })
})

describe('PanelRenderer own-property lookups', () => {
  const none = { highlightedControlId: null, setValue: vi.fn() }

  it('falls back to the default state and value for a prototype-named id (S3-AR-3)', () => {
    render(
      <PanelRenderer
        {...none}
        panel={panelOf([control({ id: 'constructor' })])}
        values={{}}
        state={{}}
      />,
    )
    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('')
  })

  it('hides a rule-hidden unsupported-control placeholder (S3-AR-9)', () => {
    const unknown = control({ id: 'u1', type: 'NoSuchControl_t' })
    const { rerender } = render(
      <PanelRenderer {...none} panel={panelOf([unknown])} values={{}} state={{}} />,
    )
    expect(screen.getByText('NoSuchControl_t')).toBeInTheDocument()
    rerender(
      <PanelRenderer
        {...none}
        panel={panelOf([unknown])}
        values={{}}
        state={{ u1: { enabled: true, visible: false, required: false, errors: [] } }}
      />,
    )
    expect(screen.queryByText('NoSuchControl_t')).not.toBeInTheDocument()
  })
})
