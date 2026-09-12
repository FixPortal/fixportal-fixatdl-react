import { describe, expect, it } from 'vitest'
import { compareMonthYear, compareTenor, normalizeMonthYear, normalizeTenor } from './temporalValue'

describe('core domain value parsing', () => {
  it.each(['D0', 'D-1', 'Q2', 'D2147483648', 'd2', '2D'])('rejects invalid tenor %s', value => {
    expect(normalizeTenor(value)).toBeNull()
    expect(compareTenor(value, 'D2')).toBeNull()
  })
  it('normalizes offsets without binary precision loss', () => {
    expect(normalizeTenor('D+0002')).toBe('D2')
    expect(compareTenor('Y2147483647', 'D2147483647')).toBeGreaterThan(0)
  })
  it.each(['20260230', '202613', '202600', '20260900', '20260932', '202609w0', '202609w6'])('rejects invalid MonthYear %s', value => {
    expect(normalizeMonthYear(value)).toBeNull()
    expect(compareMonthYear(value, '202609')).toBeNull()
  })
  it('preserves the core year-zero convention and calendar validation', () => {
    expect(normalizeMonthYear('00000231')).toBe('00000231')
    expect(normalizeMonthYear('20240229')).toBe('20240229')
    expect(normalizeMonthYear('20230229')).toBeNull()
    expect(compareMonthYear('202609w1', '20260907')).toBeLessThan(0)
  })
})
