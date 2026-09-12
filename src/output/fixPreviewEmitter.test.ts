import { describe, it, expect } from 'vitest'
import { emitStrategyParametersGrp } from './fixPreviewEmitter'
import type { AtdlStrategyDto, AtdlParameterDto } from '../types'

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
    expect(tags).toEqual([{ tag: 957, value: '0' }])
  })

  it('omits parameters with empty-string value', () => {
    const strategy = makeStrategy([makeParam({ name: 'P', type: 'String_t' })])
    const tags = emitStrategyParametersGrp(strategy, { P: '' })
    expect(tags).toEqual([{ tag: 957, value: '0' }])
  })

  it('returns (957, "0") for strategy with no filled parameters', () => {
    const strategy = makeStrategy([makeParam({ name: 'P', type: 'String_t' })])
    const tags = emitStrategyParametersGrp(strategy, {})
    expect(tags).toEqual([{ tag: 957, value: '0' }])
  })

  it('returns (957, "0") for strategy with empty parameters array', () => {
    const strategy = makeStrategy([])
    const tags = emitStrategyParametersGrp(strategy, {})
    expect(tags).toEqual([{ tag: 957, value: '0' }])
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
    ['NumInMsg_t',           26],
    ['TZTimeOnly_t',         27],
    ['TZTimestamp_t',        28],
    ['XMLData_t',            29],
    ['Language_t',           30],
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
