import { expect, it } from 'vitest'
import { parameterFromWire, parameterWireValue } from './atdlValue'
import { compareDecimals, formatDecimal } from './decimalValue'
import type { AtdlParameterDto } from './types'

const parameter: AtdlParameterDto = { name: 'P', fixTag: 9001, type: 'String_t', enumValues: null, min: null, max: null, precision: null, mutableOnCxlRpl: true, useValue: 'optional', defaultValue: null }

it.each(['a b', 'A B'])('applies enum conversion and inversion to multi-value strings: %s', value => {
  const definition = { ...parameter, type: 'MultipleStringValue_t', invertOnWire: true, enumValues: [{ enumId: 'a', wireValue: 'A' }, { enumId: 'b', wireValue: 'B' }, { enumId: 'c', wireValue: 'C' }] }
  expect(parameterWireValue(definition, value)).toBe('C')
  expect(parameterFromWire(definition, parameterWireValue(definition, value))).toEqual(['a', 'b'])
})

it('keeps core numeric Edit inference separate from ungrouped wire formatting', () => {
  expect(compareDecimals('1,2', 12)).toBe(0)
  expect(formatDecimal('1,2')).toBeNull()
  expect(parameterWireValue({ ...parameter, type: 'Float_t' }, '1,2')).toBe('1,2')
})

it.each([true, false])('round-trips custom Boolean wire values: %s', value => {
  const definition = { ...parameter, type: 'Boolean_t', trueWireValue: 'T', falseWireValue: 'F' }
  expect(parameterWireValue(definition, value)).toBe(value ? 'T' : 'F')
  expect(parameterFromWire(definition, parameterWireValue(definition, value))).toBe(value)
})

it('distinguishes explicit NULL from an empty inverted selection', () => {
  const definition = { ...parameter, type: 'MultipleStringValue_t', invertOnWire: true, enumValues: [{ enumId: 'a', wireValue: 'A' }, { enumId: 'b', wireValue: 'B' }] }
  expect(parameterWireValue(definition, null)).toBeNull()
  expect(parameterWireValue(definition, [])).toBe('A B')
  expect(parameterWireValue(definition, ['a'])).toBe('B')
  expect(parameterFromWire(definition, 'B')).toEqual(['a'])
})

it.each([['1.235', '1.24'], ['-1.235', '-1.24'], ['9007199254740993.125', '9007199254740993.13']])('rounds decimal wire output away from zero: %s', (raw, expected) => {
  expect(parameterWireValue({ ...parameter, type: 'Float_t', precision: 2 }, raw)).toBe(expected)
})

it.each([
  ['UTCDateOnly_t', '20260912-10:00:00', '20260912'],
  ['UTCTimestamp_t', '20260912', '20260912-00:00:00'],
  ['UTCTimeOnly_t', '10:00', '10:00:00'],
  ['UTCTimeOnly_t', '10:00:00.1200000', '10:00:00.12'],
  ['Tenor_t', 'D002', 'D2'],
  ['TZTimeOnly_t', '00:30:00+01', '23:30:00Z'],
  ['TZTimestamp_t', '20260912-00:30:00+01:00', '20260911-23:30:00Z'],
])('formats %s control input as canonical parameter text', (type, raw, expected) => {
  expect(parameterWireValue({ ...parameter, type }, raw)).toBe(expected)
})

it('omits NULL enumeration tokens from a multi-value parameter', () => {
  expect(parameterWireValue({ ...parameter, type: 'MultipleStringValue_t', enumValues: [{ enumId: 'buy', wireValue: '1' }, { enumId: 'none', wireValue: '{NULL}' }] }, ['buy', 'none'])).toBe('1')
})
