import { describe, expect, it } from 'vitest'
import { clockDisplayValue, clockRuleValue, clockWireValue, createClockValue, editClockValue } from './atdlClock'
import type { AtdlControlDto } from './types'

const control: AtdlControlDto = {
  id: 'clock', type: 'Clock_t', label: null, parameterRef: null, parameter: null,
  listItems: null, initValue: null, stateRules: [], tooltip: null, localMktTz: 'Europe/London',
}

describe('FIXatdl clock boundary', () => {
  it.each([
    ['20260329-01:30:00', '20260329-01:30:00', '20260329-02:30:00'],
    ['20261025-01:30:00', '20261025-00:30:00', '20261025-01:30:00'],
  ])('resolves DST gap/overlap %s with core lenient semantics', (raw, utc, local) => {
    const value = createClockValue(control, raw)
    expect(clockWireValue(value)).toBe(utc)
    expect(clockRuleValue(value)).toBe(local)
  })

  it('preserves the loaded later overlap instant and fraction until edited', () => {
    const value = createClockValue(control, '20261025-01:30:00.1234567', undefined, 'wire')
    expect(clockDisplayValue(value)).toBe('01:30:00.1234567')
    expect(clockWireValue(value)).toBe('20261025-01:30:00.1234567')
    expect(clockWireValue(editClockValue(control, value, '01:45:00'))).toBe('20261025-00:45:00')
    expect(clockWireValue(value, 'UTCTimeOnly_t')).toBe('01:30:00.1234567')
    expect(clockWireValue(editClockValue(control, value, '20261026-10:00:00'))).toBe('20261026-10:00:00')
  })

  it.each([
    ['TZTimeOnly_t', '08:00:00.1234567Z'],
    ['TZTimestamp_t', '20260601-08:00:00.1234567Z'],
  ])('emits UTC designators for %s', (type, expected) => {
    const value = createClockValue(control, '20260601-10:00:00.1234567+02:00', undefined, 'wire')
    expect(clockWireValue(value, type)).toBe(expected)
  })

  it('anchors a time-only value on the market date and applies mode 1 using the host clock', () => {
    const now = new Date('2026-06-01T23:30:00Z')
    const value = createClockValue({ ...control, initValueMode: 1 }, '00:15', now)
    expect(clockRuleValue(value)).toBe('20260602-00:30:00')
    expect(clockWireValue(value)).toBe('20260601-23:30:00')
  })

  it('keeps a future initValue and edits its original market date', () => {
    const now = new Date('2026-06-01T08:00:00Z')
    const value = createClockValue({ ...control, initValueMode: 1 }, '10:00', now)
    expect(clockWireValue(value)).toBe('20260601-09:00:00')
    expect(clockWireValue(editClockValue(control, value, '11:00', new Date('2026-06-05T08:00:00Z')))).toBe('20260601-10:00:00')
  })

  it.each(['25:00', '20260230-10:00:00', '20260601-12:60:00'])('rejects invalid time %s', raw => {
    expect(() => createClockValue(control, raw, new Date('2026-06-01T00:00:00Z'))).toThrow('Invalid FIXatdl clock')
  })

  it('can edit a loaded UTC clock without an authored initValue timezone', () => {
    const utc = { ...control, localMktTz: null }
    const value = createClockValue(utc, '20260601-10:00:00', undefined, 'wire')
    expect(clockWireValue(editClockValue(utc, value, '11:00'))).toBe('20260601-11:00:00')
  })

  it('preserves explicit offset instants and years below 100', () => {
    const utc = { ...control, localMktTz: 'UTC' }
    expect(clockWireValue(createClockValue(utc, '2026-06-01T10:00:00+02:00', undefined, 'wire'))).toBe('20260601-08:00:00')
    expect(clockWireValue(createClockValue(utc, '20260601-10:00:00-05:30', undefined, 'wire'))).toBe('20260601-15:30:00')
    expect(clockWireValue(createClockValue(utc, '20260601-15:39+08', undefined, 'wire'))).toBe('20260601-07:39:00')
    expect(clockWireValue(createClockValue(utc, '00990601-10:00:00', undefined, 'wire'))).toBe('00990601-10:00:00')
    expect(() => createClockValue(utc, '20260601-10:00:00+14:01')).toThrow('timezone offset')
    expect(() => createClockValue(utc, '20260601-10:00:00+02:00')).toThrow('local market wall time')
    expect(() => createClockValue(utc, '20260601-10:00:00Z')).toThrow('local market wall time')
  })

  it('keeps the control display zone separate from the parameter bound zone', () => {
    const configured = { ...control, localMktTz: null, parameter: { name: 'Time', fixTag: 126, type: 'UTCTimestamp_t', enumValues: null, min: null, max: null, precision: null, mutableOnCxlRpl: true, useValue: null, defaultValue: null, localMktTz: 'Asia/Tokyo' } }
    expect(() => createClockValue(configured, '20260601-10:00:00')).toThrow('localMktTz')
    expect(clockDisplayValue(createClockValue(configured, '20260601-10:00:00', undefined, 'wire'))).toBe('10:00:00')
  })

  it('requires an injected clock only for date-dependent operations', () => {
    expect(() => createClockValue(control, '10:00')).toThrow('host clock')
    expect(() => createClockValue({ ...control, initValueMode: 1 }, '20260601-10:00:00')).toThrow('host clock')
    expect(() => createClockValue({ ...control, initValueMode: 2 }, '20260601-10:00:00')).toThrow('initValueMode')
    expect(() => createClockValue({ ...control, localMktTz: null }, '20260601-10:00:00')).toThrow('localMktTz')
    expect(() => createClockValue({ ...control, localMktTz: 'Invalid/Zone' }, '20260601-10:00:00')).toThrow()
    expect(createClockValue(control, null)).toBeNull()
    expect(editClockValue(control, null, '')).toBeNull()
  })
})
