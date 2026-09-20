import { describe, expect, it } from 'vitest'
import { checkDocumentation } from './assert-docs.mjs'

describe('public documentation contract', () => {
  it('matches the package version, public exports, registry count, and local links', () => {
    expect(checkDocumentation()).toEqual([])
  })
})
