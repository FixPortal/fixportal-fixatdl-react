import { readFileSync } from 'node:fs'
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen, renderHook } from '@testing-library/react'
import type { AtdlPanelDto, AtdlStrategyDto } from '../src/types.js'
import { FormRenderer } from '../src/FormRenderer.js'
import { flattenControls } from '../src/atdlControls.js'
import { controlRegistry } from '../src/controls/controlRegistry.js'
import { useAtdlFormState } from '../src/useAtdlFormState.js'

const input = process.env['PRODUCER_CONTRACT_JSON']
if (!input) throw new Error('Run npm run test:producer-contract to produce fresh C# JSON first')
const cases = JSON.parse(readFileSync(input, 'utf8')) as {
  source: string
  contract: { strategies: AtdlStrategyDto[] }
}[]
const strategy = cases[0].contract.strategies[0]
const options = { clock: () => new Date('2026-01-15T12:00:00Z') }
afterEach(cleanup)

function checkDiscriminators(panel: AtdlPanelDto) {
  for (const child of panel.children) {
    if ('children' in child) {
      expect(child.kind).toBe('panel')
      checkDiscriminators(child)
    } else {
      expect(child.kind).toBe('control')
    }
  }
}

it('consumes the complete mapped control surface and exact polymorphic wire discriminators', () => {
  const controls = flattenControls(strategy)
  expect(controls.map((control) => control.type).sort((a, b) => a.localeCompare(b))).toEqual(
    Object.keys(controlRegistry).sort((a, b) => a.localeCompare(b)),
  )
  expect(controls).toHaveLength(15)
  for (const sample of cases) {
    expect(sample.contract.strategies.length).toBeGreaterThan(0)
    for (const entry of sample.contract.strategies) checkDiscriminators(entry.panel)
  }
})

it('renders all authored C# controls with specific labels, values and enum options', () => {
  render(<FormRenderer strategy={strategy} options={options} />)
  expect(screen.queryByText(/Unsupported control type/)).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Producer TextField' })).toHaveValue('Producer text')
  expect(screen.getByRole('spinbutton', { name: 'Producer SingleSpinner' })).toHaveValue(7)
  expect(screen.getByRole('spinbutton', { name: 'Producer DoubleSpinner' })).toHaveValue(8)
  expect(
    screen.getByRole('button', { name: 'Increase Producer DoubleSpinner by 5' }),
  ).toBeInTheDocument()
  for (const name of ['DropDownList', 'SingleSelectList', 'EditableDropDownList']) {
    expect(screen.getByRole('combobox', { name: `Producer ${name}` })).toBeInTheDocument()
  }
  expect(screen.getByRole('checkbox', { name: 'Producer CheckBox' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Producer RadioButton' })).toBeInTheDocument()
  expect(screen.getByRole('radiogroup', { name: 'Producer RadioButtonList' })).toBeInTheDocument()
  for (const name of ['MultiSelectList', 'CheckBoxList']) {
    expect(screen.getByRole('group', { name: `Producer ${name}` })).toBeInTheDocument()
  }
  expect(screen.getByText('Producer Label')).toBeInTheDocument()
  expect(screen.queryByText('Producer HiddenField')).not.toBeInTheDocument()
  expect(screen.getByRole('slider', { name: 'Producer Slider' })).toBeInTheDocument()
  expect(screen.getByLabelText('Producer Clock')).toHaveValue('08:15:30')
  expect(screen.getAllByText('Alpha option').length).toBeGreaterThanOrEqual(5)
  const controls = flattenControls(strategy)
  expect(controls.find((c) => c.id === 'c_SingleSpinner')?.increment).toBe(2)
  expect(controls.find((c) => c.id === 'c_Clock')?.localMktTz).toBe('Europe/Berlin')
  expect(controls.find((c) => c.id === 'c_DropDownList')?.parameter?.enumValues).toEqual([
    { enumId: 'A', wireValue: 'ALPHA' },
    { enumId: 'B', wireValue: 'BETA' },
  ])
  const { result } = renderHook(() => useAtdlFormState(strategy, options))
  expect(result.current.values['c_Clock']).toEqual({
    kind: 'atdl-clock',
    instant: '20260115-07:15:30',
    localDateTime: '20260115-08:15:30',
  })
  expect(result.current.values['c_HiddenField']).toBe('producer-hidden')
  expect(Object.keys(result.current.controlState)).toHaveLength(15)
})

it('unwraps real multi-strategy clock/enums documents and renders their nested controls', () => {
  const clock = cases
    .find((sample) => sample.source === 'tz-clock.xml')!
    .contract.strategies.find((entry) => entry.name === 'VWAP')!
  expect(clock.parameters).toHaveLength(17)
  expect(clock.strategyEdits).toHaveLength(1)
  expect(flattenControls(clock).find((control) => control.id === 'i_StartTime')?.initValue).toBe(
    '08:00:00',
  )
  render(<FormRenderer strategy={clock} options={options} />)
  expect(screen.getByLabelText('Start Time')).toBeInTheDocument()
  expect(screen.getAllByRole('combobox', { name: 'Benchmark' })).toHaveLength(2)
  cleanup()
  const enums = cases
    .find((sample) => sample.source === 'regions-enums.xml')!
    .contract.strategies.find((entry) => entry.name === 'LADDER_NA')!
  expect(enums.parameters).toHaveLength(15)
  expect(enums.strategyEdits).toHaveLength(7)
  render(<FormRenderer strategy={enums} options={options} />)
  expect(screen.getByRole('spinbutton', { name: 'Base Rate:*' })).toBeInTheDocument()
  expect(screen.queryByText(/Unsupported control type/)).not.toBeInTheDocument()
})
