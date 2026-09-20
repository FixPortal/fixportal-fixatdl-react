// Asserts the built bundle is import-clean, the honest-reading of the
// `sideEffects` claim in package.json that hosts' tree-shaking relies on. That
// field is `["**/*.css"]` rather than `false`: the published stylesheet IS a side
// effect (importing it applies styles and exports nothing), and a blanket `false`
// lets webpack prune `import '@fix-portal/fixatdl-react/styles.css'` as dead code.
// The JS side of the claim is what this script tests, and it is unchanged - only
// CSS is exempted, so every module below still has to be import-clean.
// Importing dist/index.js evaluates every module in the bundle, so a
// module-level side effect introduced later - a stray console write or a
// global mutation - is observable here. Runs after `npm run build`.
// Deliberately minimal: it catches the two ways a side effect escapes this
// dependency-free library, not every theoretically possible one.
import { strict as assert } from 'node:assert'

const writes = []
const originals = []
for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
  originals.push([method, console[method]])
  console[method] = (...args) => writes.push(`${method}: ${args.join(' ')}`)
}
const globalsBefore = new Set(Object.getOwnPropertyNames(globalThis))

let imported = true
let importError
try {
  await import(new URL('../dist/index.js', import.meta.url).href)
} catch (error) {
  imported = false
  importError = error
} finally {
  for (const [method, original] of originals) console[method] = original
}

assert.ok(imported, `dist/index.js threw on import: ${importError}`)
assert.deepEqual(writes, [], `module-level console output during import: ${writes.join('; ')}`)
const leaked = Object.getOwnPropertyNames(globalThis).filter(name => !globalsBefore.has(name))
assert.deepEqual(leaked, [], `module-level global mutations during import: ${leaked.join(', ')}`)

console.log('OK dist/index.js imports with no console output and no global mutations (the JS side of the sideEffects claim holds)')
