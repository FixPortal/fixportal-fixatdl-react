import { useImperativeHandle } from 'react'
import type { Ref } from 'react'
import type { AtdlControlDto, AtdlStrategyDto } from './types.js'
import { PanelRenderer } from './PanelRenderer.js'
import { strategyContentKey, useAtdlFormState } from './useAtdlFormState.js'
import type { AtdlFormOptions, ControlFormState } from './useAtdlFormState.js'
import { flattenControls } from './atdlControls.js'

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
function parameterName(control: AtdlControlDto): string | null {
  return control.parameterRef ?? control.parameter?.name ?? null
}

/** A hidden control repeats a visible sibling's message when they share a parameter.
 * An error only the hidden control has still belongs in the summary: an editable
 * dropdown accepts free text, and the hidden copy of that parameter does not. */
function hiddenSummaryErrors(strategy: AtdlStrategyDto, controlState: Record<string, ControlFormState>): string[] {
  const controls = flattenControls(strategy)
  const visibleErrorsByParameter = new Map<string, Set<string>>()
  for (const control of controls) {
    const state = controlState[control.id]
    const name = parameterName(control)
    if (control.type === 'HiddenField_t' || !state?.visible || !name) continue
    const errors = visibleErrorsByParameter.get(name) ?? new Set<string>()
    for (const error of state.errors) errors.add(error)
    visibleErrorsByParameter.set(name, errors)
  }
  return controls.flatMap(control => {
    const state = controlState[control.id]
    const hidden = control.type === 'HiddenField_t' || !state?.visible
    if (!hidden) return []
    const name = parameterName(control)
    if (!state) return []
    const visibleErrors = name == null ? undefined : visibleErrorsByParameter.get(name)
    return state.errors.filter(error => !visibleErrors?.has(error)).map(error => `${control.label ?? control.id}: ${error}`)
  })
}

function FormRendererInner({ strategy, forwardedRef, options, highlightedControlId, onHighlightControl }: FormRendererInnerProps) {
  const { values, setValue, controlState, hasErrors, strategyErrors } = useAtdlFormState(strategy, options)
  const summaryErrors = [...strategyErrors, ...hiddenSummaryErrors(strategy, controlState)]

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
  const strategyKey = strategyContentKey(strategy)
  return (
    <FormRendererInner
      key={strategyKey}
      strategy={strategy}
      forwardedRef={ref}
      options={options}
      highlightedControlId={highlightedControlId}
      onHighlightControl={onHighlightControl}
    />
  )
}
