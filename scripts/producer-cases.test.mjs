import { describe, expect, it } from 'vitest'
import { assertProducerCases } from './producer-cases.mjs'

describe('producer corpus guard', () => {
  it('accepts samples that each carry a strategy', () => {
    expect(() =>
      assertProducerCases([{ source: 'a', contract: { strategies: [{}] } }]),
    ).not.toThrow()
  })

  it.each([
    [[], /emitted no samples/],
    [[{ source: 'empty', contract: { strategies: [] } }], /sample empty has no strategies/],
  ])('throws a named cause for %j', (cases, cause) => {
    expect(() => assertProducerCases(cases)).toThrow(cause)
  })
})
