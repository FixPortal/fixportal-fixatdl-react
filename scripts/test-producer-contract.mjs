import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import { scopedTypeDiagnostics } from './assert-consumer-types.mjs'

const source = process.env.FIXATDL_SOURCE_ROOT
if (!source) throw new Error('FIXATDL_SOURCE_ROOT must name the pinned producer checkout')
mkdirSync('node_modules/.cache', { recursive: true })
const owned = mkdtempSync(path.resolve('node_modules/.cache/producer-contract-'))
const output = path.join(owned, 'contracts.json')
function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, PRODUCER_CONTRACT_JSON: output },
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`)
}
try {
  run(process.execPath, ['scripts/assert-shared-corpora.mjs'])
  run('dotnet', [
    'run',
    '--project',
    'contract-tests/producer/Producer.csproj',
    '-c',
    'Release',
    `--property:FixAtdlSourceRoot=${path.resolve(source)}`,
    '--',
    path.resolve(source),
    path.resolve('contract-tests/all-controls.xml'),
    output,
  ])
  const bytes = readFileSync(output)
  const cases = JSON.parse(bytes.toString('utf8'))
  console.log(
    `Fresh C# JSON: ${bytes.length} bytes SHA256 ${createHash('sha256').update(bytes).digest('hex')}`,
  )
  console.log(
    cases
      .map((sample) => `${sample.source}: ${sample.contract.strategies.length} strategies`)
      .join('; '),
  )
  const consumer = path.join(owned, 'consumer.ts')
  writeFileSync(path.join(owned, 'package.json'), '{"type":"module"}')
  writeFileSync(
    consumer,
    "import type { AtdlStrategyDto } from '@fix-portal/fixatdl-react'\n" +
      cases
        .flatMap((sample, i) =>
          sample.contract.strategies.map(
            (strategy, j) =>
              `export const case${i}_${j}: AtdlStrategyDto = ${JSON.stringify(strategy)}`,
          ),
        )
        .join('\n'),
  )
  for (const mode of [
    { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext },
    { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler },
  ]) {
    const errors = scopedTypeDiagnostics(process.cwd(), [consumer], mode)
    if (errors.length) throw new Error(errors.join('\n'))
    console.log(
      `Fresh JSON accepted without casts by ${ts.ModuleKind[mode.module]} built declarations`,
    )
  }
  run(process.execPath, [
    'node_modules/vitest/vitest.mjs',
    'run',
    '--config',
    'producer-contract.config.ts',
  ])
} finally {
  // mkdtemp returned this current run's path. Never delete a stale shared cache directory.
  console.log(`Removing current producer-contract stage ${owned}`)
  rmSync(owned, { recursive: true, force: false })
}
