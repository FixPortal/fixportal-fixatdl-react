import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const versions = {
  '@stryker-mutator/core': '10.1.1',
  '@stryker-mutator/vitest-runner': '10.1.1',
  '@stryker-mutator/typescript-checker': '10.1.1',
  vitest: '5.1.0',
  typescript: '6.0.3',
}
function contained(root, candidate) {
  const relative = path.relative(root, candidate)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw new Error(`Path escapes project: ${candidate}`)
  return candidate
}
export function ensureCompatibility(project) {
  const root = fs.realpathSync(project)
  const modules = contained(root, fs.realpathSync(path.join(root, 'node_modules')))
  const local = (relative) => contained(modules, fs.realpathSync(path.join(modules, relative)))
  for (const [name, expected] of Object.entries(versions)) {
    const actual = JSON.parse(fs.readFileSync(local(`${name}/package.json`), 'utf8')).version
    if (actual !== expected)
      throw new Error(
        `Unsupported ${name} ${actual}; expected ${expected}. Review upstream fix and canary before updating.`,
      )
  }
}

// Linux CI only: each owned child gets its own process group, including descendants.
export function boundedRun(args, cwd, env, milliseconds, cap = 1024 * 1024) {
  if (process.platform !== 'linux')
    throw new Error('Mutation compatibility qualification requires Linux')
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let bytes = 0
    let failure
    const chunks = []
    const kill = (reason) => {
      failure ??= new Error(reason)
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch (error) {
        if (error.code !== 'ESRCH') failure = error
      }
    }
    const timer = setTimeout(() => kill('Canary deadline exceeded'), milliseconds)
    for (const stream of [child.stdout, child.stderr])
      stream.on('data', (data) => {
        bytes += data.length
        if (bytes > cap) kill('Canary output cap exceeded')
        else chunks.push(data)
      })
    child.on('error', (error) => {
      failure = error
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const output = Buffer.concat(chunks)
      if (failure) reject(Object.assign(failure, { output }))
      else resolve({ code, output })
    })
  })
}
export function assertCanary(report, events) {
  const file = report.files['src/required.ts']
  const mutants = file?.mutants ?? []
  if (mutants.length > 6) throw new Error('Canary mutation scope expanded')
  const target = mutants.filter(
    (m) =>
      m.mutatorName === 'ConditionalExpression' &&
      m.replacement === 'false' &&
      m.location.start.line === 3 &&
      m.location.start.column === 5 &&
      m.location.end.line === 4 &&
      m.location.end.column === 24,
  )
  if (target.length !== 1 || target[0].status !== 'Killed')
    throw new Error(`Nested canary target must be Killed: ${JSON.stringify(target)}`)
  const names = Object.values(report.testFiles ?? {})
    .flatMap((f) => f.tests ?? [])
    .filter((t) => target[0].killedBy?.includes(t.id))
    .map((t) => t.name)
  if (!names.some((name) => name.includes('reports the literal required error for null')))
    throw new Error('Canary killedBy must identify nested literal assertion')
  const witnessed = events.some(
    (e) =>
      e.phase === 'afterEach' &&
      e.name === 'reports the literal required error for null' &&
      e.state === 'fail' &&
      e.providedMode === 'mutant' &&
      String(e.providedId) === target[0].id &&
      [e.stryker, e.stryker2].some(
        (ns) => String(ns?.activeMutant) === target[0].id && ns.hitCount > 0,
      ),
  )
  if (!witnessed) throw new Error('Missing active nested failing-assertion witness')
  return { target: target[0], killedBy: names }
}
export function ownedDirectory(root, relative) {
  let current = fs.realpathSync(root)
  for (const segment of relative.split('/')) {
    if (!segment || segment === '.' || segment === '..')
      throw new Error('Invalid owned directory segment')
    current = path.join(current, segment)
    if (!fs.existsSync(current)) fs.mkdirSync(current)
    current = contained(root, fs.realpathSync(current))
  }
  return current
}
function removeOwnedCanary(owned, resolved, cache) {
  // The exact path returned by this invocation's mkdtemp is the ownership witness.
  if (fs.realpathSync(owned) !== resolved || path.dirname(resolved) !== fs.realpathSync(cache))
    throw new Error('Canary cleanup ownership mismatch')
  console.log(`Removing current-run canary fixture: ${resolved}`)
  fs.rmSync(resolved, { recursive: true })
}
export async function runCanary(project) {
  const root = fs.realpathSync(project)
  const cache = ownedDirectory(root, '.mutation-canary-tmp')
  const outputParent = ownedDirectory(root, 'reports/mutation-canary')
  const owned = fs.mkdtempSync(path.join(cache, 'stryker-canary-'))
  const resolved = fs.realpathSync(owned)
  const output = ownedDirectory(root, `reports/mutation-canary/${path.basename(owned)}`)
  if (path.dirname(output) !== outputParent) throw new Error('Canary output ownership mismatch')
  try {
    fs.cpSync(path.join(root, 'scripts/fixtures/stryker-canary'), owned, { recursive: true })
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(owned, 'node_modules'), 'dir')
    const sink = path.join(output, 'events.jsonl')
    const result = await boundedRun(
      [
        path.join(root, 'node_modules/@stryker-mutator/core/bin/stryker.js'),
        'run',
        'stryker.config.json',
      ],
      owned,
      { ...process.env, STRYKER_CANARY_EVENTS: sink },
      60_000,
    )
    fs.writeFileSync(path.join(output, 'console.log'), result.output)
    const reportPath = path.join(owned, 'reports/mutation.json')
    if (!fs.existsSync(reportPath))
      throw new Error(
        `Canary setup produced no report (exit ${result.code}); inspect ${output}/console.log`,
      )
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
    fs.copyFileSync(reportPath, path.join(output, 'mutation.json'))
    const events = fs
      .readFileSync(sink, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    const receipt = assertCanary(report, events)
    if (result.code !== 0) throw new Error(`Canary runner exit ${result.code}`)
    fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2))
    console.log(`Nested mutation canary PASS: ${output}`)
  } catch (error) {
    if (error.output) fs.writeFileSync(path.join(output, 'console.log'), error.output)
    throw error
  } finally {
    removeOwnedCanary(owned, resolved, cache)
  }
}
export function runMutation(project, cli) {
  const root = fs.realpathSync(project)
  const executable = contained(
    root,
    fs.realpathSync(cli ?? path.join(root, 'node_modules/@stryker-mutator/core/bin/stryker.js')),
  )
  const child = spawn(process.execPath, [executable, 'run'], { cwd: root, stdio: 'inherit' })
  return new Promise((resolve, reject) => {
    child.on('error', reject)
    // Signals have no numeric code; they must never become successful wrapper exits.
    child.on('close', (code) => resolve(code ?? 1))
  })
}
async function main() {
  const root = fs.realpathSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'))
  const mode = process.argv[2]
  if (!['--canary', '--run'].includes(mode) || process.argv.length !== 3)
    throw new Error('Expected --canary or --run')
  ensureCompatibility(root)
  await runCanary(root)
  if (mode === '--run') {
    process.exitCode = await runMutation(root)
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
