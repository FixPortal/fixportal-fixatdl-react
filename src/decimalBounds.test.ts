import { describe, expect, it } from 'vitest'
import { compareDecimals, formatDecimal } from './decimalValue.js'

describe('decimal work bounds at the direct parser boundary', () => {
  it('accepts 128 characters but rejects a valid 129-character decimal', () => {
    const atLimit = `${'0'.repeat(127)}1`
    const overLimit = `${'0'.repeat(128)}1`
    expect(formatDecimal(atLimit)).toBe('1')
    expect(compareDecimals(atLimit, '1')).toBe(0)
    expect(formatDecimal(overLimit)).toBeNull()
    expect(compareDecimals(overLimit, '1')).toBeNull()
    expect(compareDecimals('1', overLimit)).toBeNull()
  })

  it.each([100, -100])('accepts exponent %s at the work limit', (exponent) => {
    const expected = exponent > 0 ? `1${'0'.repeat(100)}` : `0.${'0'.repeat(99)}1`
    expect(formatDecimal(`1e${exponent}`)).toBe(expected)
    expect(compareDecimals(`1e${exponent}`, expected)).toBe(0)
  })

  it.each([101, -101])('rejects exponent %s before expanding its coefficient', (exponent) => {
    const text = `1e${exponent}`
    expect(formatDecimal(text)).toBeNull()
    expect(compareDecimals(text, '1')).toBeNull()
    expect(compareDecimals('1', text)).toBeNull()
  })

  it('rounds at precision 28 and leaves unsupported precision 29 unrounded', () => {
    const text = `0.${'1'.repeat(29)}9`
    expect(formatDecimal(text, 28)).toBe(`0.${'1'.repeat(28)}`)
    expect(formatDecimal(text, 29)).toBe(text)
  })
})
