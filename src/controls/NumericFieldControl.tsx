import { useId } from 'react'
import type { ControlProps } from './controlRegistry'
import { compareDecimals, decimalInputValue, addDecimals, formatDecimal } from '../decimalValue'

/**
 * Renders FIXatdl DoubleSpinner_t and SingleSpinner_t as a numeric <input>.
 * Values stay decimal strings when conversion to Number would lose precision;
 * blank input produces null. DoubleSpinner also exposes the outer increment.
 */
export function NumericFieldControl({ control, value, onChange, state }: ControlProps) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  if (!state.visible) return null

  const hasError = state.errors.length > 0
  const param = control.parameter

  // WHY: step drives browser increment buttons and HTML5 validity. For float
  // types with a precision, derive step from the decimal places (e.g. precision=2
  // → step=0.01). Omit step for integers so the browser defaults to 1.
  const paramType = param?.type
  const isFloatPrice = paramType === 'Float_t' || paramType === 'Price_t' || paramType === 'PriceOffset_t'
  const isFloatQtyAmt = paramType === 'Qty_t' || paramType === 'Amt_t' || paramType === 'Percentage_t'
  const isFloat = isFloatPrice || isFloatQtyAmt
  const step = control.increment ?? control.innerIncrement ?? (
    isFloat && param?.precision != null
      ? Math.pow(10, -param.precision)
      : isFloat ? 'any' : undefined)

  const baseInput =
    'w-full rounded border px-2 py-1 text-sm bg-card text-text font-mono focus:outline-none focus:ring-2'
  const borderClass = hasError
    ? 'border-bad-border focus:ring-bad-border'
    : 'border-border-base focus:ring-brand-soft'
  const shift = param?.type === 'Percentage_t' ? -2 : 0
  const min = formatDecimal(param?.min, null, shift) ?? undefined
  const max = formatDecimal(param?.max, null, shift) ?? undefined
  const outerStep = (direction: number) => {
    let next = addDecimals(value ?? min ?? 0, direction * (control.outerIncrement ?? 1))
    if (next === null) return
    if (min !== undefined && compareDecimals(next, min) === -1) next = String(min)
    if (max !== undefined && compareDecimals(next, max) === 1) next = String(max)
    onChange(decimalInputValue(next))
  }

  return (
    <div className="space-y-1">
      {control.label != null && (
        <label htmlFor={inputId} className="block text-xs text-muted font-medium">
          {control.label}
          {state.required && (
            <span className="text-bad-text ml-1" aria-hidden="true">*</span>
          )}
        </label>
      )}
      <input
        id={inputId}
        type="number"
        value={value == null ? '' : String(value)}
        onChange={(e) =>
          onChange(decimalInputValue(e.target.value))
        }
        step={step}
        min={min}
        max={max}
        disabled={!state.enabled}
        aria-disabled={!state.enabled}
        aria-label={control.label == null ? control.id : undefined}
        aria-required={state.required}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        title={control.tooltip ?? undefined}
        className={`${baseInput} ${borderClass} disabled:opacity-50 disabled:cursor-not-allowed`}
      />
      {control.type === 'DoubleSpinner_t' && control.outerIncrement != null && (
        <div className="flex gap-1">
          <button type="button" disabled={!state.enabled} aria-label={`Decrease ${control.label ?? control.id} by ${control.outerIncrement}`} onClick={() => outerStep(-1)}>−{control.outerIncrement}</button>
          <button type="button" disabled={!state.enabled} aria-label={`Increase ${control.label ?? control.id} by ${control.outerIncrement}`} onClick={() => outerStep(1)}>+{control.outerIncrement}</button>
        </div>
      )}
      {hasError && (
        <ul id={errorId} className="space-y-0.5">
          {state.errors.map((err, index) => (
            <li key={index} className="text-xs text-bad-text">{err}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
