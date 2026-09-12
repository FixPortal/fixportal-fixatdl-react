import { useId } from 'react'
import type { ControlProps } from './controlRegistry'

/**
 * Renders FIXatdl Slider_t as an <input type="range"> with a live value pip.
 * Numeric bounds come from the parameter and step from control.increment.
 * Enumerated sliders use list positions while retaining enum IDs in form state.
 */
export function SliderControl({ control, value, onChange, state }: ControlProps) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  // WHY: invisible controls consume no layout space - returning null avoids
  // residual aria tree clutter.
  if (!state.visible) return null

  const hasError = state.errors.length > 0

  const items = control.listItems ?? []
  const discrete = items.length > 0
  const scale = control.parameter?.type === 'Percentage_t' ? 100 : 1
  const declaredMin = control.parameter?.min == null ? null : Number(control.parameter.min) * scale
  const declaredMax = control.parameter?.max == null ? null : Number(control.parameter.max) * scale
  const min = discrete ? 0 : declaredMin ?? (declaredMax != null && declaredMax < 0 ? declaredMax - 100 : 0)
  const max = discrete ? items.length - 1 : declaredMax ?? (declaredMin != null && declaredMin > 100 ? declaredMin + 100 : 100)
  const current = discrete ? Math.max(0, items.findIndex(item => item.enumId === value)) : Number(value ?? min)
  const display = discrete ? (items[current]?.uiRep ?? items[current]?.enumId ?? '') : current

  const borderClass = hasError ? 'border-bad-border' : 'border-border-base'

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
      {/* WHY: border wrapper gives the slider a visible error indicator matching
          the text/select pattern - range inputs have no native border styling. */}
      <div
        className={`flex items-center gap-2 rounded border px-2 py-1 ${borderClass}`}
      >
        <input
          id={inputId}
          type="range"
          min={min}
          max={max}
          value={current}
          step={discrete ? 1 : control.increment ?? 'any'}
          onChange={(e) => onChange(discrete ? items[Number(e.target.value)]?.enumId : Number(e.target.value))}
          disabled={!state.enabled}
          aria-disabled={!state.enabled}
          aria-label={control.label ?? control.id}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={current}
          aria-valuetext={discrete ? String(display) : undefined}
          title={control.tooltip ?? undefined}
          className="flex-1 accent-brand disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <span className="text-sm text-muted min-w-[3ch] text-right">{display}</span>
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
