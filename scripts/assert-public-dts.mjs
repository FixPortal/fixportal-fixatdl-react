// Asserts the emitted declaration output matches the intended public surface
// and that test/fixture types never leak into it. F1 pins the runtime export
// surface from source; this pins the declaration surface consumers compile
// against. Runs after `npm run build`, locally and in CI - a vitest test cannot
// do this honestly because CI runs the suite before the build exists.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dist = new URL('../dist/', import.meta.url)
const entry = new URL('./index.d.ts', dist)
const problems = []

if (!existsSync(entry)) {
  problems.push('dist/index.d.ts is missing - run npm run build first')
} else {
  const declaration = readFileSync(entry, 'utf8')
  const exported = new Set()
  for (const match of declaration.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g)) {
    for (const name of match[1].split(',')) exported.add(name.trim())
  }

  // The value exports pinned by F1, plus every type-only export the package promises.
  const expected = [
    'PanelRenderer', 'PanelRendererProps', 'PanelRendererText',
    'FormRenderer', 'FormRendererHandle', 'FormRendererProps',
    'useAtdlFormState', 'AtdlFormStateApi', 'AtdlFormOptions', 'ControlFormState',
    'ControlProps', 'ControlState', 'controlRegistry',
    'flattenControls', 'mapControlValuesToParameters', 'isUnfilledAtdlValue',
    'clockDisplayValue', 'clockWireValue', 'ClockValue',
    'evaluateStateRule', 'StateRuleAstNode', 'StateRuleOperator',
    'stateRuleToText', 'stateRuleToTree', 'TreeLine',
    'collectRuleRows', 'RuleRow',
    'emitStrategyParametersGrp', 'fixTypeCodeName', 'FixTag',
  ]
  for (const name of expected) {
    if (!exported.has(name)) problems.push(`dist/index.d.ts does not export ${name}`)
  }
  if (!/export\s+type\s+\*\s+from\s*['"]\.\/types['"]/.test(declaration)) {
    problems.push("dist/index.d.ts lost the `export type * from './types'` re-export")
  }
}

// Leak checks: tsconfig.build.json excludes tests and fixtures; if those
// excludes regress, declaration files for test code ship to consumers.
function* walk(dir) {
  for (const entryName of readdirSync(dir)) {
    const path = `${dir}/${entryName}`
    if (statSync(path).isDirectory()) yield* walk(path)
    else yield path
  }
}
const leakMarkers = [/\.(test|spec)\.d\.ts$/, /(^|\/)test\//, /__fixtures__/]
const contentMarkers = ['twap-strategy', 'optional-fields-strategy', 'from \'vitest\'', '@testing-library']
for (const path of walk(fileURLToPath(dist))) {
  if (!path.endsWith('.d.ts')) continue
  for (const marker of leakMarkers) {
    if (marker.test(path)) problems.push(`test or fixture declaration leaked into the build: ${path}`)
  }
  const text = readFileSync(path, 'utf8')
  for (const marker of contentMarkers) {
    if (text.includes(marker)) problems.push(`${path} references ${marker} - test-only types reached the declarations`)
  }
}

if (problems.length > 0) {
  console.error(problems.map(p => `FAIL dist declarations: ${p}`).join('\n'))
  process.exit(1)
}
console.log('OK dist/index.d.ts matches the intended public declaration surface, no test/fixture leaks')
