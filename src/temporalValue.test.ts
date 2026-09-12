import { describe, expect, it } from 'vitest'
import { compareMonthYear, compareTenor, normalizeMonthYear, normalizeTenor, normalizeTzTemporal } from './temporalValue'

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


describe('FIX timezone values', () => {
  it.each(['20260912-13:00', '20260912-15:00'])('rejects seconds-less timestamps without a designator: %s', raw => {
    expect(normalizeTzTemporal(raw, 'TZTimestamp_t')).toBeNull()
  })
  it.each([
    ['15:39+08', '07:39:00Z'],
    ['10:00:00.123', '10:00:00.123Z'],
    ['00:15+01', '23:15:00Z'],
    ['20260101-00:15:00.1234567+01:00', '20251231-23:15:00.1234567Z'],
    ['00990601-10:00Z', '00990601-10:00:00Z'],
  ])('normalizes %s without a host clock', (raw, expected) => {
    expect(normalizeTzTemporal(raw)).toBe(expected)
  })
  it.each(['10:00+14:01', '10:00+15', '25:00Z', '20260230-10:00Z', '00010101-00:00+01'])('rejects invalid %s', raw => {
    expect(normalizeTzTemporal(raw)).toBeNull()
  })
  it('checks the parameter date/time shape', () => {
    expect(normalizeTzTemporal('10:00Z', 'TZTimestamp_t')).toBeNull()
    expect(normalizeTzTemporal('20260101-10:00Z', 'TZTimeOnly_t')).toBeNull()
  })
})
