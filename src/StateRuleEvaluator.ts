import type { StateRuleAstNode } from './stateRuleAst'
import { MAX_STATE_RULE_DEPTH } from './stateRuleAst'
import { isUnfilledAtdlValue } from './atdlValue'
import { compareDecimals } from './decimalValue'
import { compareTemporal, compareTenor, compareMonthYear, compareTzTemporal } from './temporalValue'

class InvalidRule extends Error {}

/** FIXatdl Edit semantics, shared with the server through the JSON corpus. */
export function evaluateStateRule(node: StateRuleAstNode, state: Record<string, unknown>, depth = 0): boolean {
  return tryEvaluateStateRule(node, state, depth) ?? false
}

/** Null means invalid or unsupported expression, so a host can surface a form error. */
export function tryEvaluateStateRule(node: StateRuleAstNode, state: Record<string, unknown>, depth = 0): boolean | null {
  try {
    return evalNode(node, state, depth)
  } catch (error) {
    if (error instanceof InvalidRule) return null
    throw error
  }
}

function evalNode(node: StateRuleAstNode, state: Record<string, unknown>, depth: number): boolean {
  if (!node || depth > MAX_STATE_RULE_DEPTH) throw new InvalidRule()
  if (node.kind === 'compare') return evalCompare(node, state)
  if (!Array.isArray(node.children)) throw new InvalidRule()
  // Evaluate every operand so malformed data cannot hide behind short circuiting.
  const children = node.children.map(child => evalNode(child, state, depth + 1))
  switch (node.kind) {
    case 'and': return children.every(Boolean)
    case 'or': return children.some(Boolean)
    case 'xor': return children.filter(Boolean).length === 1
    case 'not':
      if (children.length !== 1) throw new InvalidRule()
      return !children[0]
    default: throw new InvalidRule()
  }
}

function evalCompare(node: Extract<StateRuleAstNode, { kind: 'compare' }>, state: Record<string, unknown>): boolean {
  if (typeof node.field !== 'string') throw new InvalidRule()
  if (!['==', '!=', '>', '<', '>=', '<=', 'exists', 'not-exists'].includes(node.operator)) throw new InvalidRule()
  const left = Object.hasOwn(state, node.field) ? state[node.field] : undefined
  const right = node.field2 ? readField(state, node.field2) : node.value
  if (node.operator === 'exists') return !isUnfilledAtdlValue(left)
  if (node.operator === 'not-exists') return isUnfilledAtdlValue(left)
  if (node.comparisonType === 'Data_t' || node.comparisonType === 'data_t') throw new InvalidRule()
  if (node.operator === '==' || node.operator === '!=') {
    const equal = equals(left, right, node.comparisonType)
    return node.operator === '==' ? equal : !equal
  }
  const order = compareValues(left, right, node.comparisonType)
  if (order === null) return false
  switch (node.operator) {
    case '>': return order > 0
    case '<': return order < 0
    case '>=': return order >= 0
    case '<=': return order <= 0
    default: throw new InvalidRule()
  }
}

const isNull = (value: unknown) => value == null || value === '{NULL}' || (Array.isArray(value) && value.length === 0)
const ordinalTypes = new Set(['String_t', 'Char_t', 'MultipleCharValue_t', 'MultipleStringValue_t', 'Boolean_t', 'EnumState'])
const temporalTypes = new Set(['Clock_t', 'UTCTimeOnly_t', 'UTCTimestamp_t', 'UTCDateOnly_t', 'LocalMktDate_t'])

function equals(left: unknown, right: unknown, type?: string | null): boolean {
  if (isNull(left) || isNull(right)) return isNull(left) && isNull(right)
  if (Array.isArray(left)) {
    if (Array.isArray(right)) {
      if (left.length !== right.length) return false
      const remaining = [...right]
      return left.every(value => {
        const index = remaining.indexOf(value)
        if (index < 0) return false
        remaining.splice(index, 1)
        return true
      })
    }
    return left.includes(right)
  }
  if (Array.isArray(right)) return right.includes(left)
  if (!type && typeof left === 'string' && typeof right === 'boolean') return equals(right, left)
  if (!type && typeof left === 'boolean' && typeof right === 'string') {
    if (['Y', 'TRUE'].includes(right.toUpperCase())) return left
    if (['N', 'FALSE'].includes(right.toUpperCase())) return !left
  }
  if (type && temporalTypes.has(type)) {
    const order = compareTemporal(left, right)
    if (order === null) throw new InvalidRule()
    return order === 0
  }
  const order = compareValues(left, right, type)
  return order === null ? Object.is(left, right) : order === 0
}

function readField(state: Record<string, unknown>, field: string): unknown {
  return Object.hasOwn(state, field) ? state[field] : undefined
}

const domainComparers: Record<string, (left: unknown, right: unknown) => number | null> = {
  Tenor_t: compareTenor, MonthYear_t: compareMonthYear,
  TZTimeOnly_t: compareTzTemporal, TZTimestamp_t: compareTzTemporal,
}

function compareValues(left: unknown, right: unknown, type?: string | null): number | null {
  if (isNull(left) || isNull(right) || Array.isArray(left) || Array.isArray(right)) return null
  const domainComparer = type && Object.hasOwn(domainComparers, type) ? domainComparers[type] : undefined
  if (domainComparer) {
    const result = domainComparer(left, right)
    if (result === null) throw new InvalidRule()
    return result
  }
  if (type === 'Boolean_t' && typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right)
  if (type && temporalTypes.has(type)) return compareTemporal(left, right)
  if (type && ordinalTypes.has(type)) return typeof left === 'string' && typeof right === 'string' ? ordinal(left, right) : null
  return compareUntyped(left, right)
}

function compareUntyped(left: unknown, right: unknown): number | null {
  const numeric = compareDecimals(left, right)
  if (numeric !== null) return numeric
  if (typeof left === 'string' && typeof right === 'string' && compareDecimals(left, left) === null && compareDecimals(right, right) === null) {
    return ordinal(left, right)
  }
  return null
}

function ordinal(left: string, right: string): number {
  if (left === right) return 0
  return left < right ? -1 : 1
}
