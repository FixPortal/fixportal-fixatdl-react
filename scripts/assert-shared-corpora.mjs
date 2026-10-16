import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'

const source = process.env.FIXATDL_SOURCE_ROOT
if (!source) throw new Error('FIXATDL_SOURCE_ROOT must name the pinned producer checkout')

const corpora = [
  ['contracts/state-rule-cases.json', 'contracts/state-rule-cases.json'],
  [
    'contracts/state-transitions.json',
    'tests/FixPortal.FixAtdl.Tests/Fixtures/Conformance/state-transitions.json',
  ],
]

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`Cannot read shared corpus ${file}`, { cause: error })
  }
}

for (const [consumer, producer] of corpora) {
  if (!isDeepStrictEqual(readJson(consumer), readJson(path.join(source, producer)))) {
    throw new Error(`Shared corpus differs from pinned producer: ${consumer}`)
  }
  console.log(`Shared corpus matches pinned producer: ${consumer}`)
}
