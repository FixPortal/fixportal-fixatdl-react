import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import cases from '../contracts/state-rule-cases.json'
import transitions from '../contracts/state-transitions.json'

const doc = readFileSync('docs/conformance.md', 'utf8')

it.each([
  ['state-rule-cases.json', cases.length],
  ['state-transitions.json', transitions.length],
])('docs/conformance.md states the real case count for %s', (file, count) => {
  const row = doc
    .split('\n')
    .find((line) => line.startsWith('|') && line.includes(`contracts/${file}`))
  expect(row?.split('|')[2].trim()).toBe(String(count))
})
