import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, act, renderHook } from '@testing-library/react'
import pov from './__fixtures__/contracts-pov-strategy.json'
import type { AtdlStrategyDto } from './types'
import { FormRenderer } from './FormRenderer'
import { useAtdlFormState } from './useAtdlFormState'

afterEach(cleanup)

/**
 * `contracts-pov-strategy.json` is the unedited output of the PUBLISHED .NET package
 * FixPortal.FixAtdl.Contracts 1.3.0 (`AtdlDtoMapper.Map` + `AtdlContractJson.Options`)
 * for the POV strategy in fixportal-fixatdl's `tests/FixPortal.FixAtdl.Tests/Fixtures/pov.xml`,
 * exactly as `docs/getting-a-strategy.md` tells an outside host to produce it. It pins the
 * documented OSS host path end to end: if the package and this renderer drift apart, this
 * fails here rather than in someone's integration.
 */

const strategy = pov as unknown as AtdlStrategyDto

describe('strategy produced by FixPortal.FixAtdl.Contracts', () => {
  it('renders both controls with no unsupported-control placeholder', () => {
    render(<FormRenderer strategy={strategy} />)
    expect(screen.queryByText(/Unsupported control type/)).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Target %' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Aggression' })).toBeInTheDocument()
  })

  it('evaluates the mapped state rule: Target % is disabled only while Aggression is Passive', () => {
    const { result } = renderHook(() => useAtdlFormState(strategy))
    expect(result.current.controlState.c_TargetPercentage.enabled).toBe(true)
    act(() => result.current.setValue('c_Aggression', 'PASSIVE'))
    expect(result.current.controlState.c_TargetPercentage.enabled).toBe(false)
    act(() => result.current.setValue('c_Aggression', 'NEUTRAL'))
    expect(result.current.controlState.c_TargetPercentage.enabled).toBe(true)
  })
})
