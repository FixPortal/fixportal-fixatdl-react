import { useId } from 'react'
import type { ControlProps } from './controlRegistry'
import { listOptionsFor } from './listOptions'

/**
 * Renders FIXatdl EditableDropDownList_t as an HTML5 combobox.
 * The user can type freely or pick from the datalist suggestions - both
 * paths call onChange with the current text value. Free-text entry is the
 * key behavioural difference from DropDownList_t (a strict <select>).
 */
export function EditableDropDownControl({ control, value, onChange, state }: ControlProps) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  // WHY: invisible controls consume no layout space - returning null avoids
  // residual aria tree clutter.
  if (!state.visible) return null

  const hasError = state.errors.length > 0

  const items = listOptionsFor(control)

  const baseInput =
    'w-full rounded border px-2 py-1 text-sm bg-card text-text focus:outline-none focus:ring-2'
  const borderClass = hasError
    ? 'border-bad-border focus:ring-bad-border'
    : 'border-border-base focus:ring-brand-soft'

  const listId = `${inputId}-options`

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
        type="text"
        list={listId}
        value={String(value ?? '')}
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
      <datalist id={listId}>
        {items.map((item) => (
          <option key={item.enumId} value={item.enumId}>
            {item.label}
          </option>
        ))}
      </datalist>
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
