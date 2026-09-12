import type { AtdlControlDto, AtdlPanelDto, AtdlStrategyDto } from './types'

// ---------------------------------------------------------------------------
// Control-graph utilities shared by the form-state hook and the FIX preview.
// ---------------------------------------------------------------------------

/** Depth-first list of every Control in a strategy's panel tree, in document order. */
export function flattenControls(strategy: AtdlStrategyDto): AtdlControlDto[] {
  const out: AtdlControlDto[] = []
  walkPanel(strategy.panel, out)
  return out
}

function walkPanel(panel: AtdlPanelDto, out: AtdlControlDto[]): void {
  for (const child of panel.children ?? []) {
    if ('children' in child) {
      // WHY: AtdlPanelChildDto is a discriminated union; 'children' is the panel
      // discriminator property (only AtdlPanelDto carries it).
      walkPanel(child as AtdlPanelDto, out)
    } else {
      out.push(child as AtdlControlDto)
    }
  }
}

/**
 * Translate the workbench's control-id-keyed value map (as produced by
 * useAtdlFormState, keyed by control.id e.g. "c_StartTime") into the
 * parameter-name-keyed map the FIX emitter expects (keyed by parameter name
 * e.g. "StartTime").
 *
 * WHY this bridge exists: form state is keyed by control because that is the
 * unit the UI mutates, while the FIX StrategyParametersGrp emitter - mirroring
 * the C# AtdlFixPreviewEmitter - looks parameters up by name. Each control
 * carries `parameterRef` (the name of the parameter it feeds). Without this
 * translation every emitter lookup misses and the group count is always
 * 957=0 regardless of input (ISSUE-002).
 *
 * Controls with no bound parameter (labels, decorative panels) are skipped.
 * If two controls reference the same parameter the later one wins, matching
 * the document-order semantics of the rest of the evaluator.
 */
export function mapControlValuesToParameters(
  strategy: AtdlStrategyDto,
  controlValues: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const control of flattenControls(strategy)) {
    const paramName = control.parameterRef ?? control.parameter?.name
    if (paramName == null) continue
    if (Object.prototype.hasOwnProperty.call(controlValues, control.id)) {
      out[paramName] = controlValues[control.id]
    }
  }
  return out
}
