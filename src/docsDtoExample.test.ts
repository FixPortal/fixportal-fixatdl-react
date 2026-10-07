import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import docs from '../docs/getting-a-strategy.md?raw'
import type { AtdlStrategyDto } from './types.js'
import { useAtdlFormState } from './useAtdlFormState.js'

/**
 * The non-.NET example in docs/getting-a-strategy.md is what an outside host copies.
 * It once set the control's inline `parameter` to null, which renders but silently
 * drops required/min/max enforcement. This pins that the documented DTO, exactly as
 * written, enforces the constraints it declares.
 */
const json = docs.slice(docs.indexOf('## Hosts that are not .NET')).match(/```json\n([\s\S]*?)\n```/)?.[1]
const strategy = JSON.parse(json ?? 'null') as AtdlStrategyDto

describe('docs/getting-a-strategy.md non-.NET DTO example', () => {
  it.each([
    { value: null, error: true },
    { value: '0', error: true },
    { value: '1000001', error: true },
    { value: '500', error: false },
  ])('OrderQty $value -> error $error', ({ value, error }) => {
    const { result } = renderHook(() => useAtdlFormState(strategy))
    act(() => result.current.setValue('orderQty', value))
    expect(result.current.controlState.orderQty.required).toBe(true)
    expect(result.current.hasErrors).toBe(error)
  })
})
