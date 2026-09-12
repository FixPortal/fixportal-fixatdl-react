import { useMemo, useState, useCallback } from 'react'
import type { AtdlStrategyDto, AtdlControlDto } from './types'
import { tryEvaluateStateRule } from './StateRuleEvaluator'
import { flattenControls, controlValuesForRules, mapControlValuesToParameters, assignControlValue, isLockedRadio, parameterValueSource } from './atdlControls'
import { isUnfilledAtdlValue, isBinaryControl, normalizeControlValue, controlParameterValue, parameterWireValue, parameterFromWire } from './atdlValue'
import { MAX_STATE_RULE_DEPTH, type StateRuleAstNode } from './stateRuleAst'
import { settleValueRules } from './stateTransitions'
import { compareDecimals } from './decimalValue'
import { createClockValue, editClockValue } from './atdlClock'
import { compareTemporal, parseTemporal, compareTenor, compareMonthYear, normalizeTenor, normalizeMonthYear, normalizeTzTemporal, compareTzTemporal } from './temporalValue'
import { controlRegistry } from './controls/controlRegistry'

export interface ControlFormState {
  enabled: boolean
  visible: boolean
  required: boolean
  errors: string[]
}

export interface AtdlFormOptions {
  /** Mount-only control values. Explicit null suppresses defaults; remount when switching orders. */
  initialValues?: Record<string, unknown>
  /** Mount-only FIX seed values. Give FormRenderer an order-specific React key when switching orders. */
  initialFixValues?: Record<number, unknown>
  /** Named FIX fields as strings, finite numbers, booleans, or null (known absent). */
  externalValues?: Record<string, unknown>
  isAmendment?: boolean
  clock?: () => Date
}

export interface AtdlFormStateApi {
  values: Record<string, unknown>
  setValue(controlId: string, value: unknown): void
  controlState: Record<string, ControlFormState>
  strategyErrors: string[]
  hasErrors: boolean
}

/** One strategy's settled values and validation, including parameter StrategyEdits. */
export function useAtdlFormState(document: AtdlStrategyDto, options: AtdlFormOptions = {}): AtdlFormStateApi {
  const { clock } = options
  const { values: validatedExternalValues, errors: externalErrors } = validateExternalValues(options.externalValues)
  const contextKey = `${JSON.stringify(validatedExternalValues)}`
  const externalValues = useMemo(() => JSON.parse(contextKey) as Record<string, unknown>, [contextKey])
  const documentKey = JSON.stringify(document)
  // Content identity refreshes every derived cache, even when the host reuses its DTO object.
  const strategy = useMemo(() => JSON.parse(documentKey) as AtdlStrategyDto, [documentKey])
  const readonlyIds = useMemo(() => new Set(flattenControls(strategy)
    .filter(control => control.parameter?.constValue != null || (options.isAmendment && control.parameter?.mutableOnCxlRpl === false))
    .map(control => control.id)), [strategy, options.isAmendment])
  const initialize = () => {
    const seeded = seedValues(strategy, options)
    return { ...settleValueRules(strategy, seeded.values, undefined, readonlyIds, seeded.now, externalValues), inputErrors: seeded.errors, documentKey, contextKey }
  }
  const [runtime, setRuntime] = useState(initialize)
  if (runtime.documentKey !== documentKey) setRuntime(initialize())
  else if (runtime.contextKey !== contextKey) {
    const now = clock?.()
    setRuntime(previous => ({ ...previous, ...settleValueRules(strategy, previous.values, previous, readonlyIds, now, externalValues), contextKey }))
  }
  const values = runtime.values
  const setValue = useCallback((controlId: string, value: unknown) => {
    if (readonlyIds.has(controlId)) return
    const controls = flattenControls(strategy)
    const control = controls.find(item => item.id === controlId)
    if (!control) return
    const now = clock?.()
    setRuntime(previous => {
      const inputErrors = { ...previous.inputErrors }
      delete inputErrors[controlId]
      let normalized: unknown
      try {
        normalized = control.type === 'Clock_t'
          ? editClockValue(control, previous.values[controlId], value == null ? '' : String(value), now)
          : normalizeControlValue(control, value)
      } catch (error) {
        inputErrors[controlId] = error instanceof Error ? error.message : String(error)
        return { ...previous, inputErrors }
      }
      const next = { ...previous.values }
      try { assignControlValue(strategy, next, control, normalized, readonlyIds, now) }
      catch (error) {
        inputErrors[controlId] = error instanceof Error ? error.message : String(error)
        return { ...previous, inputErrors }
      }
      return { ...previous, ...settleValueRules(strategy, next, previous, readonlyIds, now, externalValues), inputErrors }
    })
  }, [strategy, readonlyIds, clock, externalValues])
  const controlState = useMemo(() => {
    const state = deriveControlState(strategy, values, readonlyIds, externalValues)
    for (const [id, error] of Object.entries(runtime.inputErrors)) state[id]?.errors.push(error)
    return state
  }, [strategy, values, readonlyIds, runtime.inputErrors, externalValues])
  const strategyErrors = [...externalErrors, ...runtime.errors, ...validateStrategy(strategy, values, externalValues)]
  return { values, setValue, controlState, strategyErrors,
    hasErrors: strategyErrors.length > 0 || Object.values(controlState).some(state => state.errors.length > 0) }
}

function validateExternalValues(input: Record<string, unknown> = {}) {
  const errors: string[] = []
  const entries = Object.entries(input).filter(([field, value]) => {
    const supported = value === null || typeof value === 'string' || typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    if (!supported) errors.push(`${field}: external FIX values must be strings, finite numbers, booleans, or null.`)
    return supported
  })
  return { values: Object.fromEntries(entries), errors }
}

function seedValues(strategy: AtdlStrategyDto, options: AtdlFormOptions) {
  const seeded: Record<string, unknown> = {}
  const errors: Record<string, string> = {}
  const now = options.clock?.()
  const controls = flattenControls(strategy)
  for (const control of controls) {
    const parameter = control.parameter
    const fixTag = options.isAmendment ? parameter?.fixTag : control.initPolicy === 'UseFixField' ? control.initFixField : null
    let value: unknown
    let fromWire = false
    if (parameter?.constValue != null) {
      fromWire = true
      try { value = parameter.type === 'Boolean_t' ? parameter.constValue : parameterFromWire(parameter, parameterWireValue(parameter, parameter.constValue)) }
      catch (error) {
        value = parameter.constValue
        errors[control.id] = error instanceof Error ? error.message : String(error)
      }
    }
    else if (options.initialValues && Object.hasOwn(options.initialValues, control.id)) value = options.initialValues[control.id]
    else if (fixTag != null && options.initialFixValues && Object.hasOwn(options.initialFixValues, fixTag)) {
      fromWire = true
      try { value = parameter ? parameterFromWire(parameter, options.initialFixValues[fixTag]) : options.initialFixValues[fixTag] }
      catch (error) {
        if (options.isAmendment) {
          value = options.initialFixValues[fixTag]
          errors[control.id] = error instanceof Error ? error.message : String(error)
        } else {
          value = control.initValue ?? parameter?.defaultValue ?? (isBinaryControl(control) ? false : undefined)
          fromWire = false
        }
      }
      if (fromWire && isBinaryControl(control) && parameter?.enumValues?.length) {
        const siblingSelected = control.type === 'RadioButton_t' && control.radioGroup && controls.some(sibling =>
          sibling.type === 'RadioButton_t' && sibling.radioGroup === control.radioGroup &&
          (sibling.parameterRef ?? sibling.parameter?.name) === (control.parameterRef ?? parameter.name) && sibling.checkedEnumRef === value)
        if (value != null && value !== control.checkedEnumRef && value !== control.uncheckedEnumRef && !siblingSelected) {
          if (!options.isAmendment) { value = control.initValue ?? false; fromWire = false }
          else errors[control.id] = 'Unknown binary enumeration value.'
        } else value = value == null ? null : value === control.checkedEnumRef
      }
    } else if (options.isAmendment && parameter?.fixTag != null && options.initialFixValues) value = null
    else value = control.initValue ?? parameter?.defaultValue ?? (isBinaryControl(control) ? false : undefined)
    if (value !== undefined) {
      try {
        seeded[control.id] = normalizeSeed(control, value, fromWire, now)
      } catch (error) {
        if (fromWire && !options.isAmendment && control.initPolicy === 'UseFixField') {
          try { seeded[control.id] = normalizeSeed(control, control.initValue ?? parameter?.defaultValue ?? (isBinaryControl(control) ? false : null), false, now) }
          catch (fallbackError) { errors[control.id] = fallbackError instanceof Error ? fallbackError.message : String(fallbackError) }
        } else {
          seeded[control.id] = value
          errors[control.id] = error instanceof Error ? error.message : String(error)
        }
      }
    }
  }
  return { values: seeded, errors, now }
}

function normalizeSeed(control: AtdlControlDto, value: unknown, fromWire: boolean, now?: Date): unknown {
  if (control.type === 'Clock_t') return createClockValue(control, value, now, fromWire ? 'wire' : 'init')
  const normalized = normalizeControlValue(control, value)
  if (fromWire && !isUnfilledAtdlValue(normalized)) {
    const numeric = control.type === 'SingleSpinner_t' || control.type === 'DoubleSpinner_t' || (control.type === 'Slider_t' && !control.listItems?.length)
    if (numeric && compareDecimals(normalized, normalized) === null) throw new Error('Invalid numeric FIX initialization value.')
    if (isBinaryControl(control) && typeof normalized !== 'boolean') throw new Error('Invalid Boolean FIX initialization value.')
    const list = ['DropDownList_t', 'SingleSelectList_t', 'RadioButtonList_t', 'Slider_t'].includes(control.type)
    if (list && control.listItems?.length && !control.listItems.some(item => item.enumId === normalized)) throw new Error('Unknown list FIX initialization value.')
  }
  return structuredClone(normalized)
}

function deriveControlState(strategy: AtdlStrategyDto, values: Record<string, unknown>, readonlyIds: Set<string>, externalValues: Record<string, unknown> = {}): Record<string, ControlFormState> {
  const result: Record<string, ControlFormState> = {}
  const ruleValues = { ...externalValues, ...controlValuesForRules(strategy, values) }
  for (const control of flattenControls(strategy)) {
    const state = { enabled: true, visible: true, required: control.parameter?.useValue === 'required', errors: [] as string[] }
    for (const rule of control.stateRules) {
      // False conditions apply the inverse enabled/visible attribute, including at initialization.
      const active = tryEvaluateStateRule(rule.expression as StateRuleAstNode, ruleValues)
      if (active === null) { state.errors.push('Invalid or unsupported state rule.'); continue }
      if (rule.effect === 'enabled') state.enabled = active ? rule.targetValue : !rule.targetValue
      if (rule.effect === 'visible') state.visible = active ? rule.targetValue : !rule.targetValue
    }
    if (readonlyIds.has(control.id) || isLockedRadio(control, flattenControls(strategy), values, readonlyIds)) state.enabled = false
    const source = parameterValueSource(strategy, values, control)
    state.errors.push(...validateControl(source, values[source.id], state.required))
    if (!Object.hasOwn(controlRegistry, control.type)) state.errors.push(`Unsupported control type: ${control.type}`)
    result[control.id] = state
  }
  return result
}

function validateStrategy(strategy: AtdlStrategyDto, values: Record<string, unknown>, externalValues: Record<string, unknown> = {}): string[] {
  const parameters = mapControlValuesToParameters(strategy, values)
  const wireValues: Record<string, unknown> = Object.assign(Object.create(null), externalValues)
  const errors: string[] = []
  for (const parameter of strategy.parameters) {
    const logical = parameter.constValue ?? (Object.hasOwn(parameters, parameter.name) ? parameters[parameter.name] : undefined)
    const wire = parameterWireValue(parameter, logical)
    wireValues[parameter.name] = wire
    if (parameter.type === 'Boolean_t') {
      if (typeof logical === 'boolean') wireValues[parameter.name] = logical
      else if (wire === (parameter.trueWireValue ?? 'Y')) wireValues[parameter.name] = true
      else if (wire === (parameter.falseWireValue ?? 'N')) wireValues[parameter.name] = false
    }
  }
  for (const edit of strategy.strategyEdits ?? []) {
    const satisfied = tryEvaluateStateRule(edit.expression as StateRuleAstNode, wireValues)
    if (satisfied === null) errors.push('Invalid or unsupported strategy rule.')
    else if (!satisfied) errors.push(edit.errorMessage || 'Invalid or unsupported strategy rule.')
  }
  const missing = new Set<string>()
  const collectMissing = (node: StateRuleAstNode, depth = 0) => {
    if (!node || depth > MAX_STATE_RULE_DEPTH) return
    if (node.kind === 'compare') {
      for (const field of [node.field, node.field2]) {
        if (field?.startsWith('FIX_') && !Object.hasOwn(externalValues, field)) missing.add(field)
      }
    } else if (Array.isArray(node.children)) node.children.forEach(child => collectMissing(child, depth + 1))
  }
  for (const edit of strategy.strategyEdits ?? []) collectMissing(edit.expression as StateRuleAstNode)
  for (const control of flattenControls(strategy)) for (const rule of control.stateRules) collectMissing(rule.expression as StateRuleAstNode)
  for (const field of missing) errors.push(`The host must supply ${field} for rule evaluation.`)
  return errors
}

const INTEGER_TYPES = new Set(['Int_t', 'NumInGroup_t', 'Length_t', 'SeqNum_t', 'TagNum_t', 'NumInMsg_t'])
const FLOAT_TYPES = new Set(['Float_t', 'Qty_t', 'Price_t', 'PriceOffset_t', 'Amt_t', 'Percentage_t'])
const INTEGER_PATTERN = /^[+-]?\d+$/
const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/

function validateControl(control: AtdlControlDto, raw: unknown, required: boolean): string[] {
  const errors: string[] = []
  const parameter = control.parameter
  const logical = controlParameterValue(control, raw)
  const value = parameter ? parameterWireValue(parameter, logical, false) : logical
  const requiredValue = parameter?.type === 'Boolean_t' ? logical : value
  if (required && isUnfilledAtdlValue(requiredValue)) errors.push('This field is required.')
  if (isUnfilledAtdlValue(value)) return errors
  if (isBinaryControl(control) && typeof raw !== 'boolean') errors.push('Must be checked or unchecked.')
  if (parameter?.enumValues?.length && control.type !== 'EditableDropDownList_t') {
    const selections = Array.isArray(logical) ? logical : [logical]
    if (selections.some(id => !parameter.enumValues?.some(item => item.enumId === id))) errors.push('Must be a declared enumeration value.')
  }
  const type = parameter?.type ?? ''
  const text = String(value)
  if (text.includes('\u0001')) errors.push('A value cannot contain the FIX field delimiter.')
  if (type === 'Char_t' && text.length !== 1) errors.push('Must be exactly one character.')
  if (parameter?.minLength != null && text.length < parameter.minLength) errors.push(`Must contain at least ${parameter.minLength} characters.`)
  if (parameter?.maxLength != null && text.length > parameter.maxLength) errors.push(`Must contain at most ${parameter.maxLength} characters.`)
  if (type === 'Boolean_t' && value !== (parameter?.trueWireValue ?? 'Y') && value !== (parameter?.falseWireValue ?? 'N')) errors.push('Must be a declared Boolean value.')
  if (type === 'Tenor_t' || type === 'MonthYear_t') {
    const normalized = type === 'Tenor_t' ? normalizeTenor(value) : normalizeMonthYear(value)
    const compare = type === 'Tenor_t' ? compareTenor : compareMonthYear
    if (normalized === null) errors.push(`Must be a valid ${type} value.`)
    if (parameter?.min != null && (compare(value, parameter.min) ?? 0) < 0) errors.push(`Must be ≥ ${parameter.min}.`)
    if (parameter?.max != null && (compare(value, parameter.max) ?? 0) > 0) errors.push(`Must be ≤ ${parameter.max}.`)
  }
  if (type === 'TZTimeOnly_t' || type === 'TZTimestamp_t') {
    if (normalizeTzTemporal(value, type) === null) errors.push(`Must be a valid FIX ${type} value.`)
    if (parameter?.min != null && compareTzTemporal(value, parameter.min) === -1) errors.push(`Must be ≥ ${parameter.min}.`)
    if (parameter?.max != null && compareTzTemporal(value, parameter.max) === 1) errors.push(`Must be ≤ ${parameter.max}.`)
  }
  if (INTEGER_TYPES.has(type) && !INTEGER_PATTERN.test(text)) errors.push('Must be a whole number.')
  if (FLOAT_TYPES.has(type) && !(typeof raw === 'number' && Number.isFinite(raw)) && !DECIMAL_PATTERN.test(text)) errors.push('Must be a number.')
  if (typeof raw === 'number' && !Number.isFinite(raw)) errors.push('Must be a finite number.')
  if (INTEGER_TYPES.has(type) || FLOAT_TYPES.has(type)) {
    const boundedValue = type === 'Percentage_t' ? logical : value
    const defaultMin = ['Qty_t', 'Price_t', 'PriceOffset_t', 'Amt_t', 'Percentage_t'].includes(type) ? 0 : null
    const min = parameter?.min ?? defaultMin
    if (min != null && compareDecimals(boundedValue, min) === -1) errors.push(`Must be ≥ ${min}.`)
    if (parameter?.max != null && compareDecimals(boundedValue, parameter.max) === 1) errors.push(`Must be ≤ ${parameter.max}.`)
    const typeMin = INTEGER_TYPES.has(type) ? (type === 'Int_t' ? '-2147483648' : '1') : '-79228162514264337593543950335'
    const typeMax = INTEGER_TYPES.has(type) ? (type === 'Int_t' ? '2147483647' : '4294967295') : '79228162514264337593543950335'
    if (compareDecimals(boundedValue, typeMin) === -1 || compareDecimals(boundedValue, typeMax) === 1) errors.push(`Value is outside the ${type} range.`)
  }
  if (['UTCTimestamp_t', 'UTCTimeOnly_t', 'UTCDateOnly_t', 'LocalMktDate_t'].includes(type)) {
    const temporal = parseTemporal(value)
    const expectsDate = type !== 'UTCTimeOnly_t'
    if (!temporal || (expectsDate && !temporal.date) || (!expectsDate && temporal.date)) errors.push(`Must be a valid FIX ${type} value.`)
    let boundedValue = value
    if (type === 'UTCTimestamp_t' && parameter?.localMktTz && temporal) {
      try { boundedValue = createClockValue({ ...control, localMktTz: parameter.localMktTz }, value, undefined, 'wire')?.localDateTime }
      catch (error) { errors.push(error instanceof Error ? error.message : String(error)) }
    }
    if (parameter?.min != null && compareTemporal(parseTemporal(parameter.min)?.date ? value : boundedValue, parameter.min) === -1) errors.push(`Must be ≥ ${parameter.min}.`)
    if (parameter?.max != null && compareTemporal(parseTemporal(parameter.max)?.date ? value : boundedValue, parameter.max) === 1) errors.push(`Must be ≤ ${parameter.max}.`)
  }
  return errors
}
