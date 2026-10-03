import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import scenarios from '../contracts/state-transitions.json'
import type { AtdlControlDto, AtdlStateRuleDto, AtdlStrategyDto } from './types'
import { useAtdlFormState } from './useAtdlFormState'

interface Scenario {
  name: string
  controls: { id: string; type: string; initValue: unknown; stateRules: AtdlStateRuleDto[] }[]
  steps: {
    set?: { id: string; value: unknown }
    expected: {
      values?: Record<string, unknown>
      states?: Record<string, { enabled?: boolean; visible?: boolean }>
      hasErrors?: boolean
    }
  }[]
}

describe('FIXatdl 1.1 shared state transitions', () => {
  it.each(scenarios as Scenario[])('$name', scenario => {
    const controls: AtdlControlDto[] = scenario.controls.map(control => ({
      label: null, parameterRef: null, parameter: null, listItems: null, tooltip: null,
      ...control,
    }))
    const strategy: AtdlStrategyDto = {
      name: scenario.name, description: null, sourceXml: '', parameters: [],
      panel: {
        title: null, border: 'None', orientation: 'Vertical', collapsible: false, collapsed: false,
        children: controls.map(control => ({ kind: 'control', ...control })),
      },
    }
    const { result } = renderHook(() => useAtdlFormState(strategy))
    for (const step of scenario.steps) {
      const edit = step.set
      if (edit) act(() => result.current.setValue(edit.id, edit.value))
      for (const [id, value] of Object.entries(step.expected.values ?? {})) {
        expect(result.current.values[id] ?? null, id).toEqual(value)
      }
      for (const [id, state] of Object.entries(step.expected.states ?? {})) {
        expect(result.current.controlState[id], id).toMatchObject(state)
      }
      if (step.expected.hasErrors !== undefined) {
        expect(result.current).toMatchObject({ hasErrors: step.expected.hasErrors })
      }
    }
  })
})
