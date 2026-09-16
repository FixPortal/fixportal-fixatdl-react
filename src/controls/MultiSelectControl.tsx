import { useId } from 'react'
import type { ControlProps } from './controlRegistry'
import type { AtdlListItemDto, AtdlEnumPairDto } from '../types'

/**
 * Renders FIXatdl MultiSelectList_t (and, via re-export, CheckBoxList_t) as an
 * ordered list of checkboxes. The wire value is an array of selected enumId
 * strings. Checkbox lists are preferred over <select multiple> here for
 * usability on touch devices and because the existing FixPortal UI uses checkbox
 * groups for all multi-selection patterns.
 */
export function MultiSelectControl({ control, value, onChange, state }: ControlProps) {
  const inputId = useId()
  // WHY: invisible controls consume no layout space - returning null avoids
  // residual aria tree clutter.
  if (!state.visible) return null

  const hasError = state.errors.length > 0

  // WHY: normalise both source shapes into a unified list so the render loop
  // is source-agnostic - mirrors DropDownControl's fallback strategy.
  const items: { enumId: string; uiRep: string }[] = (() => {
    if (control.listItems && control.listItems.length > 0) {
      return (control.listItems as AtdlListItemDto[]).map((item) => ({
        enumId: item.enumId,
        uiRep: item.uiRep ?? item.enumId,
      }))
    }
    if (control.parameter?.enumValues && control.parameter.enumValues.length > 0) {
      return (control.parameter.enumValues as AtdlEnumPairDto[]).map((ev) => ({
        enumId: ev.enumId,
        uiRep: ev.enumId,
      }))
    }
    return []
  })()

  const selected: string[] = Array.isArray(value) ? (value as string[]) : []
  // Set, not repeated Array.includes: the membership test runs once per item.
  const selectedSet = new Set(selected)

  const borderClass = hasError ? 'border-bad-border' : 'border-border-base'

  return (
    <div className="space-y-1">
      {control.label != null && (
        <span className="block text-xs text-muted font-medium">
          {control.label}
          {state.required && (
            <span className="text-bad-text ml-1" aria-hidden="true">*</span>
          )}
        </span>
      )}
      {/* WHY: role="group" + aria-label gives assistive technology a named
          boundary for the checkbox cluster, matching ARIA checkbox group best
          practice without requiring a <fieldset>/<legend> layout.
          WHY "(Required)" in the name rather than aria-required, unlike
          RadioListControl: aria-required is not a supported attribute of role
          "group" (ARIA 1.2 lists it for combobox, gridcell, listbox, radiogroup,
          spinbutton, textbox and tree). RadioListControl can use it because its
          element is a radiogroup. Folding the state into the accessible name is
          the group equivalent. aria-invalid IS valid here and was missing, so
          error state now surfaces the same way the radio group's does. */}
      <fieldset
        aria-label={`${control.label ?? control.id}${state.required ? ' (Required)' : ''}`}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${inputId}-errors` : undefined}
        className={`space-y-1 rounded border px-2 py-1 min-w-0 ${borderClass}`}
      >
        {items.map((item) => {
          const checked = selectedSet.has(item.enumId)
          return (
            <label key={item.enumId} className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={checked}
                disabled={!state.enabled}
                aria-disabled={!state.enabled}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...selected, item.enumId]
                    : selected.filter((id) => id !== item.enumId)
                  onChange(next)
                }}
                className="accent-brand disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {item.uiRep}
            </label>
          )
        })}
      </fieldset>
      {hasError && (
        <ul id={`${inputId}-errors`} className="space-y-0.5">
          {state.errors.map((err, index) => (
            <li key={index} className="text-xs text-bad-text">{err}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
