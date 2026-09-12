import { useId } from 'react'
import type { ControlProps } from './controlRegistry'

/**
 * Renders FIXatdl Clock_t as an HTML5 <input type="time">.
 * Value is passed through as a string; the parent mapper (T8 AtdlDtoMapper)
 * supplies time-of-day strings in HH:mm or HH:mm:ss format. The renderer
 * coerces any non-string to string at the edge so the input never receives
 * undefined or null.
 */
export function ClockControl({ control, value, onChange, state }: ControlProps) {
  const inputId = useId()
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
        // step=1 (seconds) so an HH:mm:ss Clock_t value round-trips with its
        // seconds intact - the default minute precision silently drops them.
        step={1}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        disabled={!state.enabled}
        aria-disabled={!state.enabled}
        aria-label={control.label ?? control.id}
        aria-required={state.required}
        aria-invalid={hasError}
        title={control.tooltip ?? undefined}
        className={`${baseInput} ${borderClass} disabled:opacity-50 disabled:cursor-not-allowed`}
      />
      {hasError && (
        <ul className="space-y-0.5">
          {state.errors.map((err) => (
            <li key={err} className="text-xs text-bad-text">{err}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
