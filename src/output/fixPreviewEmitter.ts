import type { AtdlStrategyDto } from '../types'
import { parameterWireValue } from '../atdlValue'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FixTag { tag: number; value: string }

/** The FIX field delimiter. A tag value containing it would frame as two fields on the wire. */
const SOH = ''

// ---------------------------------------------------------------------------
// StrategyParametersGrp preview
// ---------------------------------------------------------------------------

/**
 * Produces the FIX StrategyParametersGrp tag sequence (957–960) for the given
 * strategy and filled form values.
 *
 * Applies parameter enum, Boolean, percentage, decimal and temporal formatting.
 * This group preview does not encode direct parameter tags or a complete order;
 * the host remains responsible for final validation and wire serialization.
 */
export function emitStrategyParametersGrp(
  strategy: AtdlStrategyDto,
  filledValues: Record<string, unknown>,
): FixTag[] {
  // Pre-collect filled entries in parameter declaration order so the 957 count
  // is known before emission - mirrors the C# pre-collect pass exactly.
  // WHY triple guard: C# treats missing key, null, and empty-string as all
  // "unfilled" - absent parameters are omitted from the group entirely. Single
  // pass in declaration order so the 957 count is exact before emission.
  const filled: { p: (typeof strategy.parameters)[number]; wire: string }[] = []
  for (const p of strategy.parameters) {
    const raw = p.constValue ?? (Object.hasOwn(filledValues, p.name) ? filledValues[p.name] : undefined)
    // Formatting handles NULL suppression and complements inverted selections.
    const wire = parameterWireValue(p, raw)
    if (wire !== null) filled.push({ p, wire })
  }

  // Omit 957 entirely when no parameters are filled - an empty repeating
  // group should not appear on the wire at all. Mirrors the backend's
  // AtdlFixPreviewEmitter exactly.
  const tags: FixTag[] = filled.length > 0 ? [{ tag: 957, value: String(filled.length) }] : []

  for (const { p, wire } of filled) {
    // WHY the emitter guards rather than relying on validateControl: this function is a public
    // export (src/index.ts), so a direct caller never passes through form validation at all. A name
    // or wire value carrying SOH splits one field into two and injects arbitrary FIX fields once
    // the host joins these tags onto the wire. Parameter names in particular come from
    // broker-supplied ATDL and validateControl never inspects them. Mirrors the C# emitter, which
    // rejects both at the same single emission chokepoint.
    if (p.name.includes(SOH)) throw new Error(`StrategyParameterName (tag 958) cannot contain the FIX field delimiter: ${p.name}`)
    if (wire.includes(SOH)) throw new Error(`StrategyParameterValue (tag 960) for '${p.name}' cannot contain the FIX field delimiter.`)
    tags.push({ tag: 958, value: p.name })
    tags.push({ tag: 959, value: String(typeToFixCode(p.type)) })
    tags.push({ tag: 960, value: wire })
  }

  return tags
}

// ---------------------------------------------------------------------------
// Type-code table - mirrors FixStrategyParameterTypeCodes.cs exactly. The core
// library is the source of truth and its codes 25-29 are read off the FIX 5.0
// SP2 enumeration for tag 959 (QuickFIX/n FIX50SP2.xml field 959); FIX 5.0/SP1
// stop at 24 and FIX 4.4 has no tag 959 at all.
//
// This table had drifted: it carried Language_t=30, NumInMsg_t=26 and
// XMLData_t=29 and no Tenor_t, so the same strategy emitted a different tag 959
// from this adapter than from the WPF one. Core corrected Language_t and Tenor_t
// and this copy was never updated. NumInMsg_t and XMLData_t name no type in the
// FIXatdl model, so their arms were dead and collided with the SP2 codes for
// LANGUAGE and TENOR; they now fall through to the String default as in core.
// ---------------------------------------------------------------------------

function typeToFixCode(t: string): number {
  switch (t) {
    case 'Int_t':                 return 1
    case 'Length_t':              return 2
    case 'NumInGroup_t':          return 3
    case 'SeqNum_t':              return 4
    case 'TagNum_t':              return 5
    case 'Float_t':               return 6
    case 'Qty_t':                 return 7
    case 'Price_t':               return 8
    case 'PriceOffset_t':         return 9
    case 'Amt_t':                 return 10
    case 'Percentage_t':          return 11
    case 'Char_t':                return 12
    case 'Boolean_t':             return 13
    case 'String_t':              return 14
    case 'MultipleCharValue_t':   return 15
    case 'Currency_t':            return 16
    case 'Exchange_t':            return 17
    case 'MonthYear_t':           return 18
    case 'UTCTimestamp_t':        return 19
    case 'UTCTimeOnly_t':         return 20
    case 'LocalMktDate_t':        return 21
    case 'UTCDateOnly_t':         return 22
    case 'Data_t':                return 23
    case 'MultipleStringValue_t': return 24
    case 'Country_t':             return 25
    case 'Language_t':            return 26
    case 'TZTimeOnly_t':          return 27
    case 'TZTimestamp_t':         return 28
    case 'Tenor_t':               return 29
    // WHY default=14: unknown types fall back to String per FIX permissive rule
    // - string carries any value and lets the counterparty interpret the content
    // without a parse error (identical to the C# Resolve() fallback).
    default:                      return 14
  }
}

// ---------------------------------------------------------------------------
// Reverse table - FIX type code → ATDL type name, for the preview annotation.
// Derived from typeToFixCode above; keep the two in sync.
// ---------------------------------------------------------------------------

const FIX_CODE_TO_TYPE: Record<number, string> = {
  1: 'Int_t', 2: 'Length_t', 3: 'NumInGroup_t', 4: 'SeqNum_t', 5: 'TagNum_t',
  6: 'Float_t', 7: 'Qty_t', 8: 'Price_t', 9: 'PriceOffset_t', 10: 'Amt_t',
  11: 'Percentage_t', 12: 'Char_t', 13: 'Boolean_t', 14: 'String_t',
  15: 'MultipleCharValue_t', 16: 'Currency_t', 17: 'Exchange_t', 18: 'MonthYear_t',
  19: 'UTCTimestamp_t', 20: 'UTCTimeOnly_t', 21: 'LocalMktDate_t', 22: 'UTCDateOnly_t',
  23: 'Data_t', 24: 'MultipleStringValue_t', 25: 'Country_t', 26: 'Language_t',
  27: 'TZTimeOnly_t', 28: 'TZTimestamp_t', 29: 'Tenor_t',
}

/** FIX StrategyParameterType code → ATDL type name (e.g. 11 → "Percentage_t"). */
export function fixTypeCodeName(code: number): string {
  return FIX_CODE_TO_TYPE[code] ?? 'String_t'
}
