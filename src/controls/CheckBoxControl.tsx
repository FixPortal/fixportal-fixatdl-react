import { useId } from 'react'
import type { ControlProps } from './controlRegistry'

/**
 * Renders a FIXatdl CheckBox_t as a checkbox input wrapped in a clickable
 * label so the whole label row is the hit target.
 */
export function CheckBoxControl({ control, value, onChange, state }: ControlProps) {
  const errorId = useId()
  if (!state.visible) return null

  const hasError = state.errors.length > 0

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={value === true || value === 'true' || value === 'Y'}
          onChange={(e) => onChange(e.target.checked)}
          disabled={!state.enabled}
          aria-disabled={!state.enabled}
          aria-label={control.label == null ? control.id : undefined}
          aria-required={state.required}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          title={control.tooltip ?? undefined}
          // WHY: accent-brand keeps the checkbox teal-branded (interaction colour)
          // without reaching for a raw hex or a non-token class.
          className="accent-brand disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {control.label != null && (
          <span className="text-sm text-text">
            {control.label}
            {state.required && (
              <span className="text-bad-text ml-1" aria-hidden="true">*</span>
            )}
          </span>
        )}
      </label>
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
