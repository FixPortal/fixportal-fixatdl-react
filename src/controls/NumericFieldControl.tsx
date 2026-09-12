import { useId } from 'react'
import type { ControlProps } from './controlRegistry'

/**
 * Renders FIXatdl DoubleSpinner_t and SingleSpinner_t as a numeric <input>.
 * String-to-number conversion happens here at the onChange boundary so that
 * useAtdlFormState receives a number (or null for blank) to validate against
 * parameter min/max constraints.
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
  const step =
    isFloat && param?.precision != null
      ? Math.pow(10, -param.precision)
      : isFloat ? 'any' : undefined

  const baseInput =
    'w-full rounded border px-2 py-1 text-sm bg-card text-text font-mono focus:outline-none focus:ring-2'
  const borderClass = hasError
    ? 'border-bad-border focus:ring-bad-border'
    : 'border-border-base focus:ring-brand-soft'

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
          onChange(e.target.value === '' ? null : Number(e.target.value))
        }
        step={step}
        min={param?.min != null ? Number(param.min) : undefined}
        max={param?.max != null ? Number(param.max) : undefined}
        disabled={!state.enabled}
        aria-disabled={!state.enabled}
        aria-label={control.label == null ? control.id : undefined}
        aria-required={state.required}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        title={control.tooltip ?? undefined}
        className={`${baseInput} ${borderClass} disabled:opacity-50 disabled:cursor-not-allowed`}
      />
      {hasError && (
        <ul id={errorId} className="space-y-0.5">
          {state.errors.map((err) => (
            <li key={err} className="text-xs text-bad-text">{err}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
