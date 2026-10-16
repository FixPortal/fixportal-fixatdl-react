// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { emitStrategyParametersGrp } from '@fix-portal/fixatdl-react'
import type { AtdlStrategyDto, FixTag } from '@fix-portal/fixatdl-react'
import { parameterFromWire } from '../src/atdlValue.js'

interface EmissionInput {
  id: string
  wireValues: Record<string, string>
}
const inputs = JSON.parse(
  readFileSync(new URL('./emission-cases.json', import.meta.url), 'utf8'),
) as EmissionInput[]
const output = process.env['PRODUCER_EMISSION_JSON']
if (!output)
  throw new Error('Run npm run test:producer-contract to produce fresh C# emissions first')
interface EmissionSample extends EmissionInput {
  contract: { strategies: AtdlStrategyDto[] }
  tags: FixTag[]
}
const emissions = JSON.parse(readFileSync(output, 'utf8')) as EmissionSample[]

it('requires all eight independent literal wire cases in fresh producer output', () => {
  expect(inputs.map((input) => input.id)).toEqual([
    'empty',
    'text',
    'integer',
    'decimal',
    'boolean-true',
    'boolean-false',
    'enum',
    'declaration-order',
  ])
  expect(emissions.map((sample) => sample.id)).toEqual(inputs.map((input) => input.id))
  expect(emissions.map(({ id, wireValues }) => ({ id, wireValues }))).toEqual(inputs)
})

it.each(inputs)('matches actual .NET ordered FIX tuples for $id', (input) => {
  const sample = emissions.find((entry) => entry.id === input.id)
  expect(sample, `Missing fresh emission ${input.id}`).toBeDefined()
  expect(sample!.wireValues).toEqual(input.wireValues)
  expect(sample!.contract.strategies).toHaveLength(1)
  const strategy = sample!.contract.strategies[0]
  const values: Record<string, unknown> = {}
  for (const [name, wire] of Object.entries(input.wireValues)) {
    const parameter = strategy.parameters.find((entry) => entry.name === name)
    expect(parameter, `Missing mapped parameter ${name}`).toBeDefined()
    values[name] = parameterFromWire(parameter!, wire)
  }
  // No expected tag table: compare the independently executed real emitters in returned order.
  expect(emitStrategyParametersGrp(strategy, values)).toEqual(sample!.tags)
  if (input.id === 'empty') expect(sample!.tags).toEqual([])
  else expect(sample!.tags.length).toBeGreaterThan(0)
})
