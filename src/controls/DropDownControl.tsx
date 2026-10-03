import { useId } from 'react'
import type { ControlProps } from './controlRegistry'
import { listOptionsFor } from './listOptions'

/**
 * Renders FIXatdl DropDownList_t and SingleSelectList_t as a <select>.
 * Options come from control.listItems (direct Control-level list) with a
 * fallback to parameter.enumValues (Parameter-level enum). FIXatdl puts list
 * items on the Control in most cases, but the Parameter fallback is needed
 * when the control inherits enums from its bound Parameter without an
 * explicit ListItem override.
 */
export function DropDownControl({ control, value, onChange, state }: ControlProps) {
  const selectId = useId()
  const errorId = `${selectId}-error`
  if (!state.visible) return null

  const hasError = state.errors.length > 0

  const options = listOptionsFor(control)

  const baseSelect =
    'w-full rounded border px-2 py-1 text-sm bg-card text-text focus:outline-none focus:ring-2'
  const borderClass = hasError
    ? 'border-bad-border focus:ring-bad-border'
    : 'border-border-base focus:ring-brand-soft'

  const currentValue = String(value ?? '')

  return (
    <div className="space-y-1">
      {control.label != null && (
        <label htmlFor={selectId} className="block text-xs text-muted font-medium">
          {control.label}
          {state.required && (
            <span className="text-bad-text ml-1" aria-hidden="true">*</span>
          )}
        </label>
      )}
      <select
        id={selectId}
        value={currentValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={!state.enabled}
        aria-disabled={!state.enabled}
        aria-label={control.label == null ? control.id : undefined}
        aria-required={state.required}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        title={control.tooltip ?? undefined}
        className={`${baseSelect} ${borderClass} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {currentValue !== '' && !options.some(option => option.enumId === currentValue) && (
          <option value={currentValue} disabled>Unknown selection: {currentValue}</option>
        )}
        {/* Optional fields can be cleared; an empty required field must stay visibly empty. */}
        {(!state.required || currentValue === '') && (
          <option value="">-</option>
        )}
        {options.map((opt) => (
          <option key={opt.enumId} value={opt.enumId}>
            {opt.label}
          </option>
        ))}
      </select>
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
