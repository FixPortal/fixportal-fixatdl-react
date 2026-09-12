import { useId } from 'react'
import type { ControlProps } from './controlRegistry'

/**
 * Renders FIXatdl Slider_t as an <input type="range"> with a live value pip.
 * Range bounds come from parameter.min / parameter.max; AtdlParameterDto does
 * not carry an `increment` field (it was not included in the T7 DTO contract),
 * so the step attribute is omitted and defaults to 1. If increment support is
 * added to AtdlParameterDto in a future task, wire it via parameter.increment.
 */
export function SliderControl({ control, value, onChange, state }: ControlProps) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  // WHY: invisible controls consume no layout space - returning null avoids
  // residual aria tree clutter.
  if (!state.visible) return null

  const hasError = state.errors.length > 0

  const min = Number(control.parameter?.min ?? 0)
  const max = Number(control.parameter?.max ?? 100)
  const current = Number(value ?? min)

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
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={!state.enabled}
          aria-disabled={!state.enabled}
          aria-label={control.label ?? control.id}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={current}
          title={control.tooltip ?? undefined}
          className="flex-1 accent-brand disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <span className="text-sm text-muted min-w-[3ch] text-right">{current}</span>
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
