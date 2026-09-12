import { useId } from 'react'
import type { ControlProps } from './controlRegistry'
import type { AtdlListItemDto, AtdlEnumPairDto } from '../types'

/**
 * Renders FIXatdl RadioButtonList_t and RadioButton_t as a group of radio
 * inputs. A React instance ID scopes each radio group to its editor.
 */
export function RadioListControl({ control, value, onChange, state }: ControlProps) {
  const errorId = useId()
  if (!state.visible) return null

  const hasError = state.errors.length > 0

  // WHY: same normalisation as DropDownControl - unify listItems and
  // parameter.enumValues into one shape before rendering.
  const options: { enumId: string; label: string }[] = (() => {
    if (control.listItems && control.listItems.length > 0) {
      return (control.listItems as AtdlListItemDto[]).map((item) => ({
        enumId: item.enumId,
        label: item.uiRep ?? item.enumId,
      }))
    }
    if (control.parameter?.enumValues && control.parameter.enumValues.length > 0) {
      return (control.parameter.enumValues as AtdlEnumPairDto[]).map((ev) => ({
        enumId: ev.enumId,
        label: ev.enumId,
      }))
    }
    return []
  })()

  return (
    <div className="space-y-1">
      {control.label != null && (
        <div className="text-xs text-muted font-medium">
          {control.label}
          {state.required && (
            <span className="text-bad-text ml-1" aria-hidden="true">*</span>
          )}
        </div>
      )}
      <div
        role="radiogroup"
        aria-label={control.label ?? control.id}
        aria-required={state.required}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        className="flex flex-col gap-1"
      >
        {options.map((opt) => (
          <label
            key={opt.enumId}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <input
              type="radio"
              name={errorId}
              value={opt.enumId}
              checked={value === opt.enumId}
              onChange={() => onChange(opt.enumId)}
              disabled={!state.enabled}
              aria-disabled={!state.enabled}
              className="accent-brand disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-text">{opt.label}</span>
          </label>
        ))}
      </div>
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
