import type { AtdlStrategyDto, AtdlEnumPairDto } from '../types'
import { isUnfilledAtdlValue } from '../atdlValue'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FixTag { tag: number; value: string }

// ---------------------------------------------------------------------------
// Main emitter - mirrors C# AtdlFixPreviewEmitter.Emit exactly
// ---------------------------------------------------------------------------

/**
 * Produces the FIX StrategyParametersGrp tag sequence (957–960) for the given
 * strategy and filled form values.
 *
 * WHY approximate preview: date/time and numeric formatting here is simplified
 * (String(value)) because this is a client-side *preview* only.  The server's
 * FixValueFormatter is the authoritative wire emitter - it applies round-trip
 * float formatting, locale-invariant decimal separators, and FIX canonical
 * date/time patterns (yyyyMMdd-HH:mm:ss.fff etc.).  For Phase-1 the preview
 * trade-off is deliberate: keep the TS twin simple and trust the server for
 * actual wire encoding.
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
  const filled: { p: (typeof strategy.parameters)[number]; raw: unknown }[] = []
  for (const p of strategy.parameters) {
    const raw = filledValues[p.name]
    // An emptied multi-select is `[]` - isUnfilledAtdlValue treats it as
    // unfilled too, else the emitter writes a spurious empty 958/959/960
    // triplet and bumps 957.
    if (!isUnfilledAtdlValue(raw)) filled.push({ p, raw })
  }

  // 957 always appears first even when count is zero - the counterparty uses
  // it to know the repeating group is present-but-empty vs completely absent.
  const tags: FixTag[] = [{ tag: 957, value: String(filled.length) }]

  for (const { p, raw } of filled) {
    tags.push({ tag: 958, value: p.name })
    tags.push({ tag: 959, value: String(typeToFixCode(p.type)) })
    tags.push({ tag: 960, value: formatValue(raw, p.type, p.enumValues ?? null) })
  }

  return tags
}

// ---------------------------------------------------------------------------
// Type-code table - mirrors FixStrategyParameterTypeCodes.cs exactly
// (including SeqNum_t=4, TagNum_t=5, PriceOffset_t=9, NumInMsg_t=26,
// XMLData_t=29 which are present in the C# table but absent from the task
// spec scaffolding - the server is the source of truth).
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
    case 'NumInMsg_t':            return 26
    case 'TZTimeOnly_t':          return 27
    case 'TZTimestamp_t':         return 28
    case 'XMLData_t':             return 29
    case 'Language_t':            return 30
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
  23: 'Data_t', 24: 'MultipleStringValue_t', 25: 'Country_t', 26: 'NumInMsg_t',
  27: 'TZTimeOnly_t', 28: 'TZTimestamp_t', 29: 'XMLData_t', 30: 'Language_t',
}

/** FIX StrategyParameterType code → ATDL type name (e.g. 11 → "Percentage_t"). */
export function fixTypeCodeName(code: number): string {
  return FIX_CODE_TO_TYPE[code] ?? 'String_t'
}

// ---------------------------------------------------------------------------
// Value formatter - mirrors FixValueFormatter.Format logic at preview fidelity
// ---------------------------------------------------------------------------

function formatValue(raw: unknown, type: string, enums: AtdlEnumPairDto[] | null): string {
  // Enum-bound parameters: map EnumId → WireValue exactly as the C# formatter
  // does.  If the filled value does not match any EnumId fall through to the
  // type-based path and emit the raw string (defensive fallback).
  if (enums && enums.length > 0) {
    if (Array.isArray(raw)) {
      return raw
        .map((item) => {
          const str = String(item)
          const match = enums.find((e) => e.enumId === str)
          return match ? match.wireValue : str
        })
        .join(' ')
    }
    const strValue = String(raw)
    const match = enums.find(e => e.enumId === strValue)
    if (match) return match.wireValue
    return strValue
  }

  // WHY Y/N: FIX Boolean wire format is Y/N, not true/false.  Accept the same
  // three truthy inputs the C# path accepts (bool true, string "true", string "Y").
  if (type === 'Boolean_t') {
    return (raw === true || raw === 'true' || raw === 'Y') ? 'Y' : 'N'
  }

  // WHY String(raw): for all other types (numeric, date/time, string-like) the
  // preview emits the JavaScript coerced string.  This is deliberately simpler
  // than the C# formatter which applies round-trip float format, InvariantCulture
  // decimal separators, and FIX canonical date/time patterns.  The server-side
  // FixValueFormatter is the wire authority; this preview is approximate.
  return String(raw)
}
