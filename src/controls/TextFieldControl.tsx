import { useId } from 'react'
import type { ControlProps } from './controlRegistry'

/**
 * Renders a FIXatdl TextField_t as a plain text <input>.
 * Validation lives in useAtdlFormState; the renderer is purely presentational.
 */
export function TextFieldControl({ control, value, onChange, state }: ControlProps) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  // WHY: invisible controls consume no layout space - returning null is simpler
  // than display:none because it avoids residual aria tree clutter.
  if (!state.visible) return null

  const hasError = state.errors.length > 0

  const baseInput =
    'w-full rounded border px-2 py-1 text-sm bg-card text-text focus:outline-none focus:ring-2'
  const borderClass = hasError
    ? 'border-bad-border focus:ring-bad-border'
    : 'border-border-base focus:ring-brand-soft'

  return (
    <div className="space-y-1">
      {control.label != null && (
        <label htmlFor={inputId} className="block text-xs text-muted font-medium">
          {control.label}
          {state.required && (
            // WHY: asterisk on the label, not the input, so screen readers
            // pick it up as part of the label text.
            <span className="text-bad-text ml-1" aria-hidden="true">*</span>
          )}
        </label>
      )}
      <input
        id={inputId}
        type="text"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        disabled={!state.enabled}
        aria-disabled={!state.enabled}
        // Bind the visible label via htmlFor; fall back to an explicit name only
        // when there is no label. Link the error list via aria-describedby (M-a11y).
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
