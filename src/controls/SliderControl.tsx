import { useId } from 'react'
import type { ControlProps } from './controlRegistry'
import { addDecimals, compareDecimals, decimalInputValue, formatDecimal } from '../decimalValue'
import { isUnfilledAtdlValue } from '../atdlValue'

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
  const shift = control.parameter?.type === 'Percentage_t' && !discrete ? -2 : 0
  const declaredMin = formatDecimal(control.parameter?.min, null, shift)
  const declaredMax = formatDecimal(control.parameter?.max, null, shift)
  const min = discrete ? '0' : declaredMin ?? (declaredMax != null && compareDecimals(declaredMax, 0)! <= 0 ? addDecimals(declaredMax, -100)! : '0')
  const max = discrete ? String(items.length - 1) : declaredMax ?? (declaredMin != null && compareDecimals(declaredMin, 100)! >= 0 ? addDecimals(declaredMin, 100)! : '100')
  const index = items.findIndex(item => item.enumId === value)
  const unset = isUnfilledAtdlValue(value) || (discrete && index < 0)
  const current = discrete ? String(Math.max(0, index)) : unset ? min : String(value)
  const display = discrete ? (items[Number(current)]?.uiRep ?? items[Number(current)]?.enumId ?? '') : current
  const choose = (position: string) => onChange(discrete ? items[Number(position)]?.enumId : decimalInputValue(position))

  const borderClass = hasError ? 'border-bad-border' : 'border-border-base'

  return (
    <div className="space-y-1">
      {control.label != null && (
        <label className="block text-xs text-muted font-medium" htmlFor={inputId}>
          {control.label}
          {state.required && (
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
          onChange={(e) => choose(e.target.value)}
          disabled={!state.enabled}
          aria-disabled={!state.enabled}
          aria-label={control.label ?? control.id}
          aria-invalid={hasError}
          aria-required={state.required}
          aria-describedby={[unset ? `${inputId}-unset` : '', hasError ? errorId : ''].filter(Boolean).join(' ') || undefined}
          aria-valuetext={discrete && !unset ? String(display) : undefined}
          title={control.tooltip ?? undefined}
          className="flex-1 accent-brand disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <span id={`${inputId}-unset`} className="text-sm text-muted min-w-[3ch] text-right">{unset ? 'Not selected' : display}</span>
        {unset && <button type="button" disabled={!state.enabled} onClick={() => choose(current)}>Use {display}</button>}
      </div>
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
