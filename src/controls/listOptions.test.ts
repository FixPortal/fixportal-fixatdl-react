import { describe, expect, it } from 'vitest'
import { listOptionsFor } from './listOptions'

describe('listOptionsFor', () => {
  it('prefers control list items and preserves their labels', () => {
    expect(listOptionsFor({
      listItems: [{ enumId: 'A', uiRep: 'Alpha' }],
      parameter: { enumValues: [{ enumId: 'B', wireValue: 'B' }] },
    })).toEqual([{ enumId: 'A', label: 'Alpha' }])
  })

  it('falls back to parameter enum identifiers when no list items exist', () => {
    expect(listOptionsFor({
      listItems: null,
      parameter: { enumValues: [{ enumId: 'B', wireValue: 'B' }] },
    })).toEqual([{ enumId: 'B', label: 'B' }])
  })
})
