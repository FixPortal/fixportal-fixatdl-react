import { it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { controlRegistry } from './controlRegistry'
import type { AtdlControlDto } from '../types'

it.each(['CheckBox_t', 'Clock_t', 'EditableDropDownList_t', 'Slider_t'])('%s associates each editor with its own errors', type => {
  const control: AtdlControlDto = { id: 'value', type, label: 'Value', parameterRef: null,
    parameter: null, listItems: null, initValue: null, stateRules: [], tooltip: null }
  const Component = controlRegistry[type]
  const state = { enabled: true, visible: true, required: false, errors: ['First error'] }
  render(<><Component control={control} value={undefined} onChange={() => {}} state={state} />
    <Component control={control} value={undefined} onChange={() => {}} state={{ ...state, errors: ['Second error'] }} /></>)
  const inputs = screen.getAllByLabelText('Value')
  const prefix = type === 'Slider_t' ? 'Not selected ' : ''
  expect(inputs[0]).toHaveAccessibleDescription(`${prefix}First error`)
  expect(inputs[1]).toHaveAccessibleDescription(`${prefix}Second error`)
})
