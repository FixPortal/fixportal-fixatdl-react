import type { AtdlPanelDto, AtdlControlDto, AtdlPanelChildDto } from './types.js'
import type { ControlFormState } from './useAtdlFormState.js'
import { controlRegistry } from './controls/controlRegistry.js'
import { createContext, useContext, useId } from 'react'

const FormInstance = createContext<string | null>(null)
export interface PanelRendererText {
  unsupportedControlType?: { value: string; attrs?: Record<string, string> }
  whyRule?: { value: string; attrs?: Record<string, string> }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PanelRendererProps {
  panel: AtdlPanelDto
  text?: PanelRendererText
  values: Record<string, unknown>
  setValue(controlId: string, next: unknown): void
  state: Record<string, ControlFormState>
  highlightedControlId: string | null
  onHighlightControl?(id: string | null): void
  /** Position path of this panel in the tree ("0" for the root, "0/2" for its third child). */
  panelPath?: string
  /** Called with a collapsible panel's path whenever the user opens or closes it. */
  onPanelToggle?(path: string, open: boolean): void
}

// ---------------------------------------------------------------------------
// PanelRenderer
// ---------------------------------------------------------------------------

/**
 * Recursively renders a FIXatdl StrategyPanel tree. Handles three visual
 * modes driven by the panel's metadata:
 *   - collapsible → <details>/<summary> with open/closed state seeded from panel.collapsed
 *   - titled (non-collapsible) → <section> with an <h3> header
 *   - untitled → bare layout div (anonymous grouping panel)
 *
 * Orientation controls the flex axis; border="Line" adds a visible frame.
 */
export function PanelRenderer({
  panel,
  values,
  setValue,
  state,
  highlightedControlId,
  onHighlightControl,
  text,
  panelPath = '0',
  onPanelToggle,
}: PanelRendererProps) {
  const parentInstance = useContext(FormInstance)
  const instanceId = useId()
  // WHY: FIXatdl orientation is HORIZONTAL/VERTICAL (uppercase in the XML),
  // but the C# AtdlDtoMapper calls enum.ToString() which yields PascalCase
  // ("Horizontal" / "Vertical"). We normalise to uppercase before comparing
  // so both wire forms are handled without a separate fallback branch.
  const orientation = panel.orientation?.toUpperCase()
  const layout =
    orientation === 'HORIZONTAL' ? 'flex flex-row gap-3 flex-wrap' : 'flex flex-col gap-2'

  // WHY: "Line" is the only non-None border value the mapper produces (mirrors
  // the FIXatdl Border enum: None | Line). Compare case-insensitively for safety.
  const hasBorder = panel.border?.toLowerCase() === 'line'
  const borderClass = hasBorder ? 'border border-border-base rounded-md p-3' : ''

  const body = (
    <FormInstance value={parentInstance ?? instanceId}>
      <div className={`${layout} ${borderClass}`}>
        {(panel.children ?? []).map((child, i) => (
          <PanelChild
            key={child.kind === 'control' ? child.id : `${child.title ?? 'panel'}-${i}`}
            child={child}
            values={values}
            setValue={setValue}
            state={state}
            highlightedControlId={highlightedControlId}
            onHighlightControl={onHighlightControl}
            text={text}
            path={`${panelPath}/${i}`}
            onPanelToggle={onPanelToggle}
          />
        ))}
      </div>
    </FormInstance>
  )

  if (panel.collapsible) {
    return (
      // WHY: <details> open attribute seeds the initial collapsed state from
      // the DTO. The browser manages toggling from there; the toggle event only
      // reports it, so the host can keep the error summary in step with the screen.
      <details
        open={!panel.collapsed}
        onToggle={(event) => onPanelToggle?.(panelPath, event.currentTarget.open)}
      >
        {/* An untitled panel renders an empty <summary>, which is focusable but
            has no accessible name. Only then do we supply a generic one - a
            titled panel keeps its visible title AS its accessible name, so a
            re-worded title can never drift from what assistive tech announces. */}
        <summary
          aria-label={panel.title ? undefined : 'Panel'}
          className="cursor-pointer text-sm font-medium text-text mb-2"
        >
          {panel.title ?? ''}
        </summary>
        {body}
      </details>
    )
  }

  if (panel.title) {
    return (
      <section>
        <h3 className="text-sm font-medium text-text mb-2">{panel.title}</h3>
        {body}
      </section>
    )
  }

  return body
}

// ---------------------------------------------------------------------------
// PanelChild - discriminates panel vs control children
// ---------------------------------------------------------------------------

interface PanelChildProps {
  child: AtdlPanelChildDto
  text?: PanelRendererText
  values: Record<string, unknown>
  setValue(controlId: string, next: unknown): void
  state: Record<string, ControlFormState>
  highlightedControlId: string | null
  onHighlightControl?(id: string | null): void
  path: string
  onPanelToggle?(path: string, open: boolean): void
}

function PanelChild({
  child,
  values,
  setValue,
  state,
  highlightedControlId,
  onHighlightControl,
  text,
  path,
  onPanelToggle,
}: PanelChildProps) {
  const instanceId = useContext(FormInstance)
  const unsupportedT = text?.unsupportedControlType ?? {
    value: 'Unsupported control type:',
    attrs: {},
  }
  const whyT = text?.whyRule ?? { value: 'why?', attrs: {} }

  // WHY: AtdlPanelChildDto is a discriminated union keyed on `kind`. The `kind`
  // property is emitted by the C# JsonPolymorphic serializer when the declared
  // type is the abstract base. If `kind` is somehow absent (e.g. when a panel
  // child is deserialized without the discriminator), fall back to structural
  // discrimination: only AtdlPanelDto carries `children`, so its presence
  // unambiguously identifies a panel.
  const isPanel = child.kind === 'panel' || 'children' in child

  if (isPanel) {
    return (
      <PanelRenderer
        panel={child}
        values={values}
        setValue={setValue}
        state={state}
        highlightedControlId={highlightedControlId}
        onHighlightControl={onHighlightControl}
        text={text}
        panelPath={path}
        onPanelToggle={onPanelToggle}
      />
    )
  }

  const control = child as AtdlControlDto
  const Component = Object.hasOwn(controlRegistry, control.type)
    ? controlRegistry[control.type]
    : undefined

  // WHY: fall back to a permissive default rather than crashing when a control
  // has no state entry - this can happen during the first render tick before
  // useAtdlFormState finishes its initial derivation. Own-property only, so an id
  // such as "constructor" cannot resolve an inherited Object.prototype member.
  const controlState = (Object.hasOwn(state, control.id) ? state[control.id] : undefined) ?? {
    enabled: true,
    visible: true,
    required: false,
    errors: [],
  }

  if (!Component) {
    // A rule-hidden unknown control stays hidden; the form summary carries its error.
    if (!controlState.visible) return null
    // WHY: unknown control types must not silently vanish - they indicate an
    // ATDL version mismatch or an unimplemented extension. Surface a visible
    // placeholder so the strategy still renders partially rather than crashing.
    return (
      <div className="text-xs text-bad-text border border-bad-border rounded px-2 py-1">
        <span {...unsupportedT.attrs}>{unsupportedT.value}</span> {control.type}
      </div>
    )
  }

  // WHY: a control that a state rule has currently disabled or hidden is the one
  // worth explaining. The "why?" chip lets the user cross-highlight its rule rows
  // in the Rules inspector. Only offer it when the control actually carries rules.
  const ruleDisabledOrHidden =
    (!controlState.enabled || !controlState.visible) && (control.stateRules?.length ?? 0) > 0
  const isHighlighted = highlightedControlId === control.id

  return (
    <div
      className={
        isHighlighted ? 'rounded outline outline-2 outline-warn-border bg-warn-bg/40 p-1' : ''
      }
    >
      <Component
        control={control}
        value={Object.hasOwn(values, control.id) ? values[control.id] : undefined}
        onChange={(next) => {
          setValue(control.id, next)
        }}
        state={controlState}
        radioGroupName={control.radioGroup ? `${instanceId}:${control.radioGroup}` : undefined}
      />
      {ruleDisabledOrHidden && onHighlightControl && (
        <button
          {...whyT.attrs}
          type="button"
          onClick={() => {
            onHighlightControl(control.id)
          }}
          className="ml-2 text-xs text-bad-text border border-bad-border rounded px-1"
        >
          {whyT.value}
        </button>
      )}
    </div>
  )
}
