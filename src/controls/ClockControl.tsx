import { useId } from 'react'
import type { ControlProps } from './controlRegistry'
import { clockDisplayValue } from '../atdlClock'

/** Renders market-local clock time; the form preserves its UTC instant through the clock boundary. */
export function ClockControl({ control, value, onChange, state }: ControlProps) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  // WHY: invisible controls consume no layout space - returning null avoids
  // residual aria tree clutter.
  if (!state.visible) return null

  const hasError = state.errors.length > 0

  const baseInput =
    'rounded border px-2 py-1 text-sm bg-card text-text focus:outline-none focus:ring-2'
  const borderClass = hasError
    ? 'border-bad-border focus:ring-bad-border'
    : 'border-border-base focus:ring-brand-soft'

  return (
    <div className="space-y-1">
      {control.label != null && (
        <label className="block text-xs text-muted font-medium" htmlFor={inputId}>
          {control.label}
          {state.required && (
            // WHY: asterisk on the label so screen readers pick it up as part
            // of the label text, not as a standalone punctuation character.
            <span className="text-bad-text ml-1" aria-hidden="true">*</span>
          )}
        </label>
      )}
      <input
        id={inputId}
        type="time"
        // Fractional seconds remain intact when the control is left unchanged.
        step="any"
        value={clockDisplayValue(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={!state.enabled}
        aria-disabled={!state.enabled}
        aria-label={control.label ?? control.id}
        aria-required={state.required}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        title={control.tooltip ?? undefined}
        className={`${baseInput} ${borderClass} disabled:opacity-50 disabled:cursor-not-allowed`}
      />
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
