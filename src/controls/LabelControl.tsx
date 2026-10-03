import type { ControlProps } from './controlRegistry'

/**
 * Renders a FIXatdl Label_t as static display text.
 * No value or onChange wiring - a Label is read-only chrome, not a form input.
 */
export function LabelControl({ control, state }: ControlProps) {
  if (!state.visible) return null

  return (
    <div className="text-sm text-muted">{control.label}</div>
  )
}
