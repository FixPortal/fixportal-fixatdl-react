/**
 * A FIXatdl control value counts as "unfilled" when it is null, undefined, an
 * empty string, OR an empty array (an emptied multi-select). The array case is
 * easy to miss: without it a required multi-select passes validation once
 * emptied, and the FIX preview emitter writes a spurious empty 958/959/960
 * triplet. Kept in one place so validation and emission agree.
 */
import type { AtdlControlDto, AtdlParameterDto } from './types.js'
import { formatDecimal } from './decimalValue.js'
import { clockWireValue } from './atdlClock.js'
import { parseTemporal, normalizeTenor, normalizeMonthYear, normalizeTzTemporal } from './temporalValue.js'

export function isUnfilledAtdlValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

export function isBinaryControl(control: AtdlControlDto): boolean {
  return control.type === 'CheckBox_t' || control.type === 'RadioButton_t'
}

export function normalizeControlValue(control: AtdlControlDto, value: unknown): unknown {
  if (value == null || value === '{NULL}') return null
  if (isBinaryControl(control)) {
    if (value === true || value === 'true' || value === 'Y' || value === control.checkedEnumRef) return true
    if (value === false || value === 'false' || value === 'N' || value === control.uncheckedEnumRef) return false
    return value // Invalid data remains visible to validation.
  }
  if (control.type === 'MultiSelectList_t' || control.type === 'CheckBoxList_t') {
    return typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : value
  }
  return value
}

/** Logical parameter value: enum IDs stay IDs until the wire boundary. */
export function controlParameterValue(control: AtdlControlDto, value: unknown): unknown {
  if (control.type === 'Clock_t') return clockWireValue(value, control.parameter?.type)
  if (control.parameter?.type === 'Percentage_t' && !control.parameter.enumValues?.length && !isUnfilledAtdlValue(value)) return formatDecimal(value, null, 2) ?? value
  if (isBinaryControl(control) && (control.checkedEnumRef != null || control.uncheckedEnumRef != null)) {
    if (value == null) return null
    return value === true ? control.checkedEnumRef ?? null : value === false ? control.uncheckedEnumRef ?? null : value
  }
  return value
}

const MULTI_VALUE_TYPES = ['MultipleStringValue_t', 'MultipleCharValue_t']

/**
 * Enum ids for one multi-value parameter. A space-separated string is split once
 * here so validation and wire emission see the same tokens. A token that is
 * already a wire value becomes its enum id; anything else is left unchanged.
 */
export function multiValueEnumIds(parameter: AtdlParameterDto, value: unknown): string[] | null {
  if (!MULTI_VALUE_TYPES.includes(parameter.type)) return null
  const enums = parameter.enumValues ?? []
  let tokens: string[] | null
  if (Array.isArray(value)) {
    tokens = value.map(item => String(item))
  } else if (typeof value === 'string' && value !== '') {
    tokens = value.split(/\s+/).filter(Boolean)
  } else {
    tokens = null
  }
  if (!tokens) return null
  return tokens.map(token => {
    const byId = enums.find(item => item.enumId === token)?.enumId
    if (byId !== undefined) return byId
    const byWire = enums.find(item => item.wireValue === token)?.enumId
    return byWire ?? token
  })
}

function wireOfEnumId(enums: { enumId: string; wireValue: string }[], id: string): string {
  return enums.find(item => item.enumId === id)?.wireValue ?? id
}

export function parameterWireValue(parameter: AtdlParameterDto, value: unknown, applyPrecision = true): string | null {
  if (value == null || value === '{NULL}') return null
  const enums = parameter.enumValues ?? []
  const selections = multiValueEnumIds(parameter, value)
  if (selections) {
    const unknown = enums.length > 0 && selections.some(id => !enums.some(item => item.enumId === id))
    // An unknown token stays on the wire as typed. Complementing the known ones
    // would hide that free text, which an editable dropdown is allowed to keep.
    if (unknown) {
      const wire = selections.map(id => wireOfEnumId(enums, id)).filter(item => item !== '{NULL}' && item !== '').join(' ')
      return wire || null
    }
    value = selections
  }
  if (Array.isArray(value)) {
    const selected = parameter.invertOnWire ? enums.filter(item => !value.includes(item.enumId)).map(item => item.enumId) : value
    const wire = selected.map(id => enums.find(item => item.enumId === id)?.wireValue ?? String(id)).filter(item => item !== '{NULL}' && item !== '').join(' ')
    return wire || null
  }
  if (value === '') return null
  const enumWire = enums.find(item => item.enumId === value)?.wireValue
  if (enumWire !== undefined) return enumWire === '{NULL}' ? null : enumWire || null
  if (parameter.type === 'Boolean_t') {
    if (value === true || value === 'true' || value === 'Y') return parameter.trueWireValue === '{NULL}' ? null : parameter.trueWireValue ?? 'Y'
    if (value === false || value === 'false' || value === 'N') return parameter.falseWireValue === '{NULL}' ? null : parameter.falseWireValue ?? 'N'
  }
  if (parameter.type === 'Tenor_t') return normalizeTenor(value) ?? String(value)
  if (parameter.type === 'MonthYear_t') return normalizeMonthYear(value) ?? String(value)
  if (parameter.type === 'TZTimeOnly_t' || parameter.type === 'TZTimestamp_t') return normalizeTzTemporal(value, parameter.type) ?? String(value)
  if (['UTCTimestamp_t', 'UTCTimeOnly_t', 'UTCDateOnly_t', 'LocalMktDate_t'].includes(parameter.type)) {
    const temporal = parseTemporal(value)
    if (temporal) {
      let time = temporal.time
      while (time.endsWith('0')) time = time.slice(0, -1)
      if (time.endsWith('.')) time = time.slice(0, -1)
      if (parameter.type === 'UTCTimeOnly_t') return time
      if (temporal.date) return parameter.type === 'UTCTimestamp_t' ? `${temporal.date}-${time}` : temporal.date
    }
  }
  if (['Float_t', 'Qty_t', 'Price_t', 'PriceOffset_t', 'Amt_t', 'Percentage_t'].includes(parameter.type)) {
    let precision = applyPrecision ? parameter.precision : null
    if (parameter.type === 'Percentage_t' && !parameter.multiplyBy100 && precision != null) precision = Math.min(28, precision + 2)
    const shift = parameter.type === 'Percentage_t' && parameter.multiplyBy100 ? -2 : 0
    return formatDecimal(value, precision, shift) ?? String(value)
  }
  return String(value)
}

/** Decode loaded FIX values before any initValue or StateRule is applied. */
export function parameterFromWire(parameter: AtdlParameterDto, value: unknown): unknown {
  if (value == null || value === '') return null
  const enums = parameter.enumValues ?? []
  if (parameter.type === 'MultipleStringValue_t' || parameter.type === 'MultipleCharValue_t') {
    const wires = String(value).split(/\s+/)
    if (enums.length && wires.some(wire => !enums.some(item => item.wireValue === wire))) throw new Error(`Unknown enumeration wire value for ${parameter.name}: ${value}`)
    return enums.length ? enums.filter(item => parameter.invertOnWire ? !wires.includes(item.wireValue) : wires.includes(item.wireValue)).map(item => item.enumId) : wires
  }
  const enumId = enums.find(item => item.wireValue === String(value))?.enumId
  if (enumId !== undefined) return enumId
  if (parameter.type === 'Percentage_t') return formatDecimal(value, null, parameter.multiplyBy100 ? 0 : -2) ?? value
  if (parameter.type === 'Boolean_t') {
    if (value === (parameter.trueWireValue ?? 'Y')) return true
    if (value === (parameter.falseWireValue ?? 'N')) return false
  }
  return value
}
