import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import participate from './__fixtures__/participate-strategy.json'
import type { AtdlStrategyDto, AtdlPanelChildDto, AtdlControlDto } from './types'
import { FormRenderer } from './FormRenderer'
import { useAtdlFormState } from './useAtdlFormState'
import { controlRegistry } from './controls/controlRegistry'
import { flattenControls, mapControlValuesToParameters } from './atdlControls'
import { emitStrategyParametersGrp } from './output/fixPreviewEmitter'

afterEach(cleanup)

/**
 * `participate-strategy.json` is the strategy `examples/workbench` renders and the
 * README screenshot shows. Without this file the sample is unpinned: it could stop
 * rendering, lose a control type, or start emitting different wire values, and the
 * first person to notice would be someone evaluating the package.
 *
 * The fixture is deliberately the ONLY one that covers the whole registry, so the
 * first test below fails when a control type is added to the registry and not to the
 * sample - the sample is then no longer the tour of the surface the README claims.
 */

const sample = participate as unknown as AtdlStrategyDto
// Fixed so the Clock control's "current time" initialisation cannot drift the suite.
const options = { clock: () => new Date('2026-09-18T14:30:00Z') }

function renderSample() {
  return render(<FormRenderer strategy={sample} options={options} />)
}

function sampleState() {
  return renderHook(() => useAtdlFormState(sample, options))
}

describe('participate sample strategy', () => {
  it('exercises every control type in the registry', () => {
    const covered = new Set(flattenControls(sample).map(control => control.type))
    expect([...covered].sort()).toEqual(Object.keys(controlRegistry).sort())
  })

  it('renders without a single unsupported-control placeholder', () => {
    renderSample()
    expect(screen.queryByText(/Unsupported control type/)).not.toBeInTheDocument()
  })

  it.each([
    ['Client reference', 'textbox'],
    ['Participation rate %', 'spinbutton'],
    ['Max slice quantity', 'spinbutton'],
    ['Price protection', 'combobox'],
    ['Benchmark', 'combobox'],
    ['Allow dark liquidity', 'checkbox'],
    ['Agency', 'radio'],
    ['Minimum fill %', 'slider'],
    ['Booking desk', 'combobox'],
  ])('renders %s as an accessible %s', (label, role) => {
    renderSample()
    // An EXACT accessible-name match, not a substring one. A required control renders
    // a trailing asterisk, but the control marks that span `aria-hidden`, so it stays
    // out of the computed name - verified by this test passing for the two required
    // controls above. Exact is the stricter assertion: a label that grew a suffix
    // ("Client reference extra") fails here, where a substring pattern would not.
    expect(screen.getByRole(role, { name: label })).toBeInTheDocument()
  })

  it('renders the Label_t copy and renders nothing for the hidden field', () => {
    const { container } = renderSample()
    expect(screen.getByText(/StrategyParametersGrp tags 957-960/)).toBeInTheDocument()
    // HiddenField_t renders null, so its parameter reaches the wire without ever
    // reaching the DOM. Asserting on the label would be vacuous - it has none.
    expect(container.textContent).not.toContain('AlgoVersion')
  })

  it('starts valid with every authored initial value applied', () => {
    const { result } = sampleState()
    expect(result.current.hasErrors).toBe(false)
    expect(result.current.strategyErrors).toEqual([])
    expect(result.current.values.ctrl_client_ref).toBe('DEMO-0001')
    expect(result.current.values.ctrl_venues).toEqual(['DemoLit'])
    // constValue reaches form state even though HiddenField_t renders nothing.
    expect(result.current.values.ctrl_algo_version).toBe('1.4')
  })

  it('disables the slice cap while urgency is High (enabled state rule)', () => {
    const { result } = sampleState()
    expect(result.current.controlState.ctrl_max_slice.enabled).toBe(true)
    act(() => result.current.setValue('ctrl_urgency', 'High'))
    expect(result.current.controlState.ctrl_max_slice.enabled).toBe(false)
    act(() => result.current.setValue('ctrl_urgency', 'Low'))
    expect(result.current.controlState.ctrl_max_slice.enabled).toBe(true)
  })

  it('shows the scheduled start only for the Scheduled benchmark (visible state rule)', () => {
    const { result } = sampleState()
    // The sample opens on the Scheduled benchmark so the Clock control is on screen
    // at rest - otherwise the one control type the README screenshot cannot show is
    // the one the form hides by default.
    expect(result.current.controlState.ctrl_start_time.visible).toBe(true)
    act(() => result.current.setValue('ctrl_benchmark', 'Arrival'))
    expect(result.current.controlState.ctrl_start_time.visible).toBe(false)
    act(() => result.current.setValue('ctrl_benchmark', 'Scheduled'))
    expect(result.current.controlState.ctrl_start_time.visible).toBe(true)
  })

  it('clears and restores the minimum fill around the dark-liquidity toggle (NULL value rule)', () => {
    const { result } = sampleState()
    expect(result.current.values.ctrl_min_fill_pct).toBe(25)
    act(() => result.current.setValue('ctrl_allow_dark', false))
    expect(result.current.values.ctrl_min_fill_pct).toBeNull()
    act(() => result.current.setValue('ctrl_allow_dark', true))
    expect(result.current.values.ctrl_min_fill_pct).toBe(25)
  })

  it('keeps the two capacity radios mutually exclusive on one parameter', () => {
    const { result } = sampleState()
    act(() => result.current.setValue('ctrl_capacity_principal', true))
    expect(result.current.values.ctrl_capacity_agency).toBe(false)
    expect(mapControlValuesToParameters(sample, result.current.values).Capacity).toBe('Principal')
  })

  it('surfaces the StrategyEdit only for the combination it forbids', () => {
    const { result } = sampleState()
    act(() => result.current.setValue('ctrl_urgency', 'High'))
    expect(result.current.strategyErrors).toEqual([])
    act(() => result.current.setValue('ctrl_price_protection', 'None'))
    expect(result.current.strategyErrors).toEqual([
      'High urgency requires a price protection level other than None.',
    ])
    act(() => result.current.setValue('ctrl_urgency', 'Low'))
    expect(result.current.strategyErrors).toEqual([])
  })

  /**
   * The values here are MEASURED from the emitter, not derived by hand, and that is
   * the point of the test. Percentage_t is the trap the sample exists to document:
   * the controls work in percent (10 and 25 in form state) while the wire carries the
   * fraction (0.10 and 0.25) because neither parameter sets multiplyBy100. A change
   * that "fixes" one side without the other reds this.
   */
  it('emits the measured StrategyParametersGrp for the authored initial values', () => {
    const { result } = sampleState()
    const tags = emitStrategyParametersGrp(sample, mapControlValuesToParameters(sample, result.current.values))
    const byName = new Map<string, string>()
    for (let i = 0; i < tags.length; i++) {
      if (tags[i].tag === 958) byName.set(tags[i].value, tags[i + 2].value)
    }
    expect(tags[0]).toEqual({ tag: 957, value: '11' })
    expect(Object.fromEntries(byName)).toEqual({
      ClientRef: 'DEMO-0001',
      ParticipationRate: '0.10',
      MaxSliceQty: '5000',
      PriceProtection: '1',
      Benchmark: 'S',
      AllowDark: 'Y',
      Capacity: 'A',
      Urgency: '2',
      MinFillPct: '0.25',
      Venues: 'L',
      AlgoVersion: '1.4',
    })
  })

  it('bounds the participation rate in the control percent, not the wire fraction', () => {
    const { result } = sampleState()
    // The parameter declares max 0.5; the spinner works in percent, so 50 is the
    // ceiling the user sees and 60 is over it while 40 is not.
    act(() => result.current.setValue('ctrl_participation', 40))
    expect(result.current.controlState.ctrl_participation.errors).toEqual([])
    act(() => result.current.setValue('ctrl_participation', 60))
    expect(result.current.controlState.ctrl_participation.errors).not.toEqual([])
  })
})

describe('participate sample fixture shape', () => {
  it('names no real broker, venue or client', () => {
    const text = JSON.stringify(sample)
    expect(sample.sourceXml).toContain('providerID="DEMO"')
    for (const real of ['NYSE', 'NASDAQ', 'BATS', 'Chi-X', 'Turquoise', 'LSE']) {
      expect(text).not.toContain(real)
    }
  })

  it('embeds each control parameter consistently with the strategy parameter list', () => {
    const declared = new Map(sample.parameters.map(parameter => [parameter.name, parameter]))
    for (const control of flattenControls(sample)) {
      if (control.parameterRef == null) continue
      expect(declared.get(control.parameterRef)).toEqual(control.parameter)
    }
  })

  it('reaches every panel child through a kind discriminator', () => {
    const walk = (children: AtdlPanelChildDto[]): void => {
      for (const child of children) {
        expect(['panel', 'control']).toContain(child.kind)
        if (child.kind === 'panel') walk(child.children)
        else expect((child as AtdlControlDto).id).toMatch(/^ctrl_/)
      }
    }
    walk(sample.panel.children)
  })
})
