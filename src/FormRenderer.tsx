import { useImperativeHandle } from 'react'
import type { Ref } from 'react'
import type { AtdlStrategyDto } from './types'
import { PanelRenderer } from './PanelRenderer'
import { useAtdlFormState } from './useAtdlFormState'
import type { AtdlFormOptions } from './useAtdlFormState'
import { flattenControls } from './atdlControls'

// ---------------------------------------------------------------------------
// Imperative handle - lets parent pages pull current values without prop drilling
// ---------------------------------------------------------------------------

export interface FormRendererHandle {
  /** Returns a snapshot of all current control values keyed by controlId. */
  getValues(): Record<string, unknown>
  isValid(): boolean
  getErrors(): string[]
}

// ---------------------------------------------------------------------------
// FormRenderer
// ---------------------------------------------------------------------------

export interface FormRendererProps {
  strategy: AtdlStrategyDto
  ref?: Ref<FormRendererHandle>
  options?: AtdlFormOptions
  highlightedControlId?: string | null
  onHighlightControl?(id: string | null): void
}

interface FormRendererInnerProps extends Omit<FormRendererProps, 'ref'> {
  forwardedRef?: Ref<FormRendererHandle>
}

/**
 * Root renderer for a single ATDL strategy. Wires useAtdlFormState → PanelRenderer.
 *
 * WHY ref + useImperativeHandle: the FIX-preview pane (T24) and the
 * submit handler need a snapshot of the current form values without coupling
 * to every intermediate re-render. The imperative handle provides a stable
 * `getValues()` escape hatch - callers pull values on demand (e.g. on a
 * "Send Order" click) rather than subscribing to every keystroke.
 *
 * WHY outer/inner split: the key on <FormRendererInner> remounts the form
 * (resetting state) when the strategy changes. A component cannot key itself,
 * so the outer shell applies the key to its child.
 */
function FormRendererInner({ strategy, forwardedRef, options, highlightedControlId, onHighlightControl }: FormRendererInnerProps) {
  const { values, setValue, controlState, hasErrors, strategyErrors } = useAtdlFormState(strategy, options)
  const hiddenErrors = flattenControls(strategy).flatMap(control =>
    control.type === 'HiddenField_t' || !controlState[control.id]?.visible ? controlState[control.id]?.errors.map(error => `${control.label ?? control.id}: ${error}`) ?? [] : [])
  const summaryErrors = [...strategyErrors, ...hiddenErrors]

  // WHY [values] dependency: the closure must capture the latest values map
  // so getValues() always returns current state, not a stale snapshot from
  // the render that installed the handle.
  useImperativeHandle(forwardedRef, () => ({
    getValues: () => structuredClone(values),
    isValid: () => !hasErrors,
    getErrors: () => [...strategyErrors, ...Object.values(controlState).flatMap(state => state.errors)],
  }), [values, hasErrors, strategyErrors, controlState])

  return (
    <>
    {summaryErrors.length > 0 && <ul role="alert">{summaryErrors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
    <PanelRenderer
      panel={strategy.panel}
      values={values}
      setValue={setValue}
      state={controlState}
      highlightedControlId={highlightedControlId ?? null}
      onHighlightControl={onHighlightControl}
    />
    </>
  )
}

export function FormRenderer({ strategy, ref, options, highlightedControlId, onHighlightControl }: FormRendererProps) {
  return (
    <FormRendererInner
      key={JSON.stringify(strategy)}
      strategy={strategy}
      forwardedRef={ref}
      options={options}
      highlightedControlId={highlightedControlId}
      onHighlightControl={onHighlightControl}
    />
  )
}
