import { useImperativeHandle } from 'react'
import type { Ref } from 'react'
import type { AtdlStrategyDto } from './types'
import { PanelRenderer } from './PanelRenderer'
import { useAtdlFormState } from './useAtdlFormState'

// ---------------------------------------------------------------------------
// Imperative handle - lets parent pages pull current values without prop drilling
// ---------------------------------------------------------------------------

export interface FormRendererHandle {
  /** Returns a snapshot of all current control values keyed by controlId. */
  getValues(): Record<string, unknown>
}

// ---------------------------------------------------------------------------
// FormRenderer
// ---------------------------------------------------------------------------

export interface FormRendererProps {
  strategy: AtdlStrategyDto
  ref?: Ref<FormRendererHandle>
}

interface FormRendererInnerProps {
  strategy: AtdlStrategyDto
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
function FormRendererInner({ strategy, forwardedRef }: FormRendererInnerProps) {
  const { values, setValue, controlState } = useAtdlFormState(strategy)

  // WHY [values] dependency: the closure must capture the latest values map
  // so getValues() always returns current state, not a stale snapshot from
  // the render that installed the handle.
  useImperativeHandle(forwardedRef, () => ({ getValues: () => values }), [values])

  return (
    <PanelRenderer
      panel={strategy.panel}
      values={values}
      setValue={setValue}
      state={controlState}
      highlightedControlId={null}
      onHighlightControl={() => {}}
    />
  )
}

export function FormRenderer({ strategy, ref }: FormRendererProps) {
  return (
    <FormRendererInner
      key={`${strategy.name}::${strategy.sourceXml ?? ''}`}
      strategy={strategy}
      forwardedRef={ref}
    />
  )
}
