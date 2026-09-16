import { describe, it, expect } from 'vitest'
import { emitStrategyParametersGrp, fixTypeCodeName } from './fixPreviewEmitter'
import type { AtdlStrategyDto, AtdlParameterDto } from '../types'
import strategyJson from '../__fixtures__/twap-strategy.json'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeParam(overrides: Partial<AtdlParameterDto> & { name: string; type: string }): AtdlParameterDto {
  return {
    fixTag: null,
    enumValues: null,
    min: null,
    max: null,
    precision: null,
    mutableOnCxlRpl: false,
    useValue: null,
    defaultValue: null,
    ...overrides,
  }
}

function makeStrategy(params: AtdlParameterDto[]): AtdlStrategyDto {
  return {
    name: 'TestStrategy',
    description: null,
    parameters: params,
    panel: { title: null, border: 'None', orientation: 'Vertical', collapsible: false, collapsed: false, children: [] },
    sourceXml: '<Strategy />',
  }
}

// ---------------------------------------------------------------------------
// Core sequence test
// ---------------------------------------------------------------------------

describe('emitStrategyParametersGrp', () => {
  it.each(['constructor', 'toString', '__proto__'])('omits inherited parameter values: %s', name => {
    const strategy = makeStrategy([makeParam({ name, type: 'String_t' })])
    expect(emitStrategyParametersGrp(strategy, {})).toEqual([])
    expect(emitStrategyParametersGrp(strategy, { [name]: 'filled' })).toContainEqual({ tag: 960, value: 'filled' })
  })
  it('emits the shipped fixture char parameters as FIX Char', () => {
    const strategy = strategyJson as unknown as AtdlStrategyDto
    const tags = emitStrategyParametersGrp(strategy, { Side: '1', AlgoType: 'T', EditSide: '1' })
    expect(tags.filter(item => item.tag === 959).map(item => item.value)).toEqual(['12', '12', '12'])
  })
  it('preserves invalid decimal text for inspection instead of changing its numeric meaning', () => {
    const strategy = makeStrategy([makeParam({ name: 'Qty', type: 'Float_t' })])
    expect(emitStrategyParametersGrp(strategy, { Qty: '1,2' })).toContainEqual({ tag: 960, value: '1,2' })
  })
  it('emits (957, count) then (958, name)(959, code)(960, value) for each filled parameter', () => {
    const strategy = makeStrategy([
      makeParam({ name: 'Qty', type: 'Int_t' }),
    ])
    const tags = emitStrategyParametersGrp(strategy, { Qty: 100 })
    expect(tags).toEqual([
      { tag: 957, value: '1' },
      { tag: 958, value: 'Qty' },
      { tag: 959, value: '1' },   // Int_t → 1
      { tag: 960, value: '100' },
    ])
  })

  it('emits parameters in declaration order when multiple are filled', () => {
    const strategy = makeStrategy([
      makeParam({ name: 'Alpha', type: 'String_t' }),
      makeParam({ name: 'Beta', type: 'String_t' }),
    ])
    const tags = emitStrategyParametersGrp(strategy, { Alpha: 'a', Beta: 'b' })
    const names = tags.filter(t => t.tag === 958).map(t => t.value)
    expect(names).toEqual(['Alpha', 'Beta'])
  })

  // ---------------------------------------------------------------------------
  // Null / undefined / empty-string skipping
  // ---------------------------------------------------------------------------

  it('omits parameters with undefined value', () => {
    const strategy = makeStrategy([
      makeParam({ name: 'Present', type: 'String_t' }),
      makeParam({ name: 'Missing', type: 'String_t' }),
    ])
    const tags = emitStrategyParametersGrp(strategy, { Present: 'yes' })
    expect(tags[0]).toEqual({ tag: 957, value: '1' })
    expect(tags.filter(t => t.tag === 958).map(t => t.value)).toEqual(['Present'])
  })

  it('omits parameters with null value', () => {
    const strategy = makeStrategy([makeParam({ name: 'P', type: 'String_t' })])
    const tags = emitStrategyParametersGrp(strategy, { P: null })
    expect(tags).toEqual([])
  })

  it('omits parameters with empty-string value', () => {
    const strategy = makeStrategy([makeParam({ name: 'P', type: 'String_t' })])
    const tags = emitStrategyParametersGrp(strategy, { P: '' })
    expect(tags).toEqual([])
  })

  it('omits tag 957 entirely for strategy with no filled parameters', () => {
    const strategy = makeStrategy([makeParam({ name: 'P', type: 'String_t' })])
    const tags = emitStrategyParametersGrp(strategy, {})
    expect(tags).toEqual([])
  })

  it('omits tag 957 entirely for strategy with empty parameters array', () => {
    const strategy = makeStrategy([])
    const tags = emitStrategyParametersGrp(strategy, {})
    expect(tags).toEqual([])
  })

  // ---------------------------------------------------------------------------
  // Delimiter contract: rejection at the emitter
  // ---------------------------------------------------------------------------
  //
  // This used to pin PASS-THROUGH, on the reasoning that validateControl
  // (src/useAtdlFormState.ts) owns the delimiter at the form-validation boundary.
  // That division does not hold: emitStrategyParametersGrp is a public export in
  // src/index.ts, so a direct caller never reaches validateControl at all, and a
  // value carrying SOH then injects arbitrary FIX fields once the host joins these
  // tags onto the wire. Parameter names are worse again - they come from
  // broker-supplied ATDL and validateControl never inspects them. The C# emitter
  // rejects both at the same point, so this restores cross-stack parity.

  it('rejects a FIX SOH delimiter in a parameter wire value', () => {
    const strategy = makeStrategy([makeParam({ name: 'P', type: 'String_t' })])
    expect(() => emitStrategyParametersGrp(strategy, { P: 'a\u0001b' })).toThrow(/tag 960/)
  })

  it('rejects a FIX SOH delimiter in a parameter name', () => {
    const strategy = makeStrategy([makeParam({ name: 'P\u0001100', type: 'String_t' })])
    expect(() => emitStrategyParametersGrp(strategy, { 'P\u0001100': 'x' })).toThrow(/tag 958/)
  })

  // ---------------------------------------------------------------------------
  // constValue precedence
  // ---------------------------------------------------------------------------

  it('prefers an authored constValue over a differing filled form value', () => {
    // The differing filledValues entry is the load-bearing part: with no entry,
    // both ?? orderings resolve to constValue and the test cannot catch a
    // reversed precedence. The venue-mandated constant must win on the wire.
    const strategy = makeStrategy([makeParam({ name: 'P', type: 'String_t', constValue: 'venue-constant' })])
    const tags = emitStrategyParametersGrp(strategy, { P: 'user-typed' })
    expect(tags).toContainEqual({ tag: 960, value: 'venue-constant' })
  })

  // ---------------------------------------------------------------------------
  // Type-code table
  // ---------------------------------------------------------------------------

  it.each([
    ['Int_t',                 1],
    ['Length_t',              2],
    ['NumInGroup_t',          3],
    ['SeqNum_t',              4],
    ['TagNum_t',              5],
    ['Float_t',               6],
    ['Qty_t',                 7],
    ['Price_t',               8],
    ['PriceOffset_t',         9],
    ['Amt_t',                10],
    ['Percentage_t',         11],
    ['Char_t',               12],
    ['Boolean_t',            13],
    ['String_t',             14],
    ['MultipleCharValue_t',  15],
    ['Currency_t',           16],
    ['Exchange_t',           17],
    ['MonthYear_t',          18],
    ['UTCTimestamp_t',       19],
    ['UTCTimeOnly_t',        20],
    ['LocalMktDate_t',       21],
    ['UTCDateOnly_t',        22],
    ['Data_t',               23],
    ['MultipleStringValue_t',24],
    ['Country_t',            25],
    ['Language_t',           26],
    ['TZTimeOnly_t',         27],
    ['TZTimestamp_t',        28],
    ['Tenor_t',              29],
  ])('maps %s → type code %i', (type, expectedCode) => {
    const strategy = makeStrategy([makeParam({ name: 'P', type })])
    const tags = emitStrategyParametersGrp(strategy, { P: 'x' })
    const codeTag = tags.find(t => t.tag === 959)
    expect(codeTag?.value).toBe(String(expectedCode))
  })

  it('defaults unknown type to 14 (String) per FIX permissive rule', () => {
    const strategy = makeStrategy([makeParam({ name: 'P', type: 'Unknown_t' })])
    const tags = emitStrategyParametersGrp(strategy, { P: 'x' })
    expect(tags.find(t => t.tag === 959)?.value).toBe('14')
  })

  // ---------------------------------------------------------------------------
  // Reverse type-code table (fixTypeCodeName) - hand-maintained mirror of the
  // forward switch; the file's own comment flags 8/Price_t vs 9/PriceOffset_t
  // as the easy-to-miscopy pair. Hardcoded pairs, not a round-trip through the
  // forward direction, so a swap in either table fails here directly.
  // ---------------------------------------------------------------------------

  it.each([
    [1,  'Int_t'],
    [2,  'Length_t'],
    [3,  'NumInGroup_t'],
    [4,  'SeqNum_t'],
    [5,  'TagNum_t'],
    [6,  'Float_t'],
    [7,  'Qty_t'],
    [8,  'Price_t'],
    [9,  'PriceOffset_t'],
    [10, 'Amt_t'],
    [11, 'Percentage_t'],
    [12, 'Char_t'],
    [13, 'Boolean_t'],
    [14, 'String_t'],
    [15, 'MultipleCharValue_t'],
    [16, 'Currency_t'],
    [17, 'Exchange_t'],
    [18, 'MonthYear_t'],
    [19, 'UTCTimestamp_t'],
    [20, 'UTCTimeOnly_t'],
    [21, 'LocalMktDate_t'],
    [22, 'UTCDateOnly_t'],
    [23, 'Data_t'],
    [24, 'MultipleStringValue_t'],
    [25, 'Country_t'],
    [26, 'Language_t'],
    [27, 'TZTimeOnly_t'],
    [28, 'TZTimestamp_t'],
    [29, 'Tenor_t'],
  ])('maps FIX type code %i → %s', (code, expectedType) => {
    expect(fixTypeCodeName(code)).toBe(expectedType)
  })

  it('falls back to String_t for an unmapped type code', () => {
    expect(fixTypeCodeName(999)).toBe('String_t')
  })

  // ---------------------------------------------------------------------------
  // Boolean formatting
  // ---------------------------------------------------------------------------

  it('formats Boolean_t true as "Y"', () => {
    const strategy = makeStrategy([makeParam({ name: 'B', type: 'Boolean_t' })])
    const tags = emitStrategyParametersGrp(strategy, { B: true })
    expect(tags.find(t => t.tag === 960)?.value).toBe('Y')
  })

  it('formats Boolean_t false as "N"', () => {
    const strategy = makeStrategy([makeParam({ name: 'B', type: 'Boolean_t' })])
    const tags = emitStrategyParametersGrp(strategy, { B: false })
    expect(tags.find(t => t.tag === 960)?.value).toBe('N')
  })

  it('formats Boolean_t string "true" as "Y"', () => {
    const strategy = makeStrategy([makeParam({ name: 'B', type: 'Boolean_t' })])
    const tags = emitStrategyParametersGrp(strategy, { B: 'true' })
    expect(tags.find(t => t.tag === 960)?.value).toBe('Y')
  })

  it('formats Boolean_t string "Y" as "Y"', () => {
    const strategy = makeStrategy([makeParam({ name: 'B', type: 'Boolean_t' })])
    const tags = emitStrategyParametersGrp(strategy, { B: 'Y' })
    expect(tags.find(t => t.tag === 960)?.value).toBe('Y')
  })

  // ---------------------------------------------------------------------------
  // Enum WireValue lookup
  // ---------------------------------------------------------------------------

  it('emits enum WireValue not EnumId when parameter has enumValues', () => {
    const strategy = makeStrategy([
      makeParam({
        name: 'Side',
        type: 'Char_t',
        enumValues: [
          { enumId: 'BUY',  wireValue: '1' },
          { enumId: 'SELL', wireValue: '2' },
        ],
      }),
    ])
    const tags = emitStrategyParametersGrp(strategy, { Side: 'BUY' })
    expect(tags.find(t => t.tag === 960)?.value).toBe('1')
  })

  it('emits second enum WireValue correctly', () => {
    const strategy = makeStrategy([
      makeParam({
        name: 'Side',
        type: 'Char_t',
        enumValues: [
          { enumId: 'BUY',  wireValue: '1' },
          { enumId: 'SELL', wireValue: '2' },
        ],
      }),
    ])
    const tags = emitStrategyParametersGrp(strategy, { Side: 'SELL' })
    expect(tags.find(t => t.tag === 960)?.value).toBe('2')
  })

  it('falls back to raw string when filled value does not match any EnumId', () => {
    const strategy = makeStrategy([
      makeParam({
        name: 'P',
        type: 'String_t',
        enumValues: [{ enumId: 'A', wireValue: 'alpha' }],
      }),
    ])
    const tags = emitStrategyParametersGrp(strategy, { P: 'X' })
    expect(tags.find(t => t.tag === 960)?.value).toBe('X')
  })

  it('translates arrays of enum values (multi-select) to space-separated wire values', () => {
    const strategy = makeStrategy([
      makeParam({
        name: 'Venues',
        type: 'MultipleCharValue_t',
        enumValues: [
          { enumId: 'NYSE',   wireValue: 'N' },
          { enumId: 'NASDAQ', wireValue: 'Q' },
          { enumId: 'BATS',   wireValue: 'B' },
        ],
      }),
    ])
    const tags = emitStrategyParametersGrp(strategy, { Venues: ['NYSE', 'BATS'] })
    expect(tags.find(t => t.tag === 960)?.value).toBe('N B')
  })
})
