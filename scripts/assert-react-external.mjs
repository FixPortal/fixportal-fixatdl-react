// Asserts the built ESM bundle keeps React external, as AGENTS.md requires.
// Rolldown mangles imported *bindings* (`createContext as e`) but leaves module
// *specifiers* as literal strings, so anchor on the specifier (`from "react"`),
// never on binding names. If an entry is dropped from `rolldownOptions.external`
// in vite.config.ts, or a Vite/Rolldown upgrade changes default externalisation,
// React's source is inlined and its import specifier disappears from the output.
import { readFileSync } from 'node:fs'

const bundle = readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8')
const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')

const specifiers = new Set()
for (const match of bundle.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) {
  specifiers.add(match[1])
}

// 'react-dom' and 'react/jsx-dev-runtime' are valid externals but unused by the
// current bundle, so only the two specifiers the build actually emits are required.
const required = ['react', 'react/jsx-runtime']
const allowed = new Set(['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'])

const isReactFamily = name =>
  name === 'react' || name === 'react-dom' ||
  name.startsWith('react/') || name.startsWith('react-dom/')

const problems = []
for (const name of required) {
  if (!specifiers.has(name)) {
    problems.push(`no import specifier "${name}" -- React may have been inlined into the bundle`)
  }
}
for (const name of specifiers) {
  // The predicate has to cover the react-dom family too. Anchored on
  // `startsWith('react/')` alone, nothing under react-dom/ was ever examined.
  if (isReactFamily(name) && !allowed.has(name)) {
    problems.push(`unexpected React import specifier "${name}"`)
  }
}

// The bundle check alone only catches a dropped external for a package the build
// ALREADY imports: react-dom is externalised but currently unused, so removing it
// from vite.config.ts today changes no output and the gate above stays green --
// right up until someone adds a react-dom/client import and it silently inlines.
// Assert the config's own list instead, so the guard does not depend on which
// entries happen to be exercised.
const externalBlock = /external\s*:\s*\[([^\]]*)\]/.exec(viteConfig)
if (!externalBlock) {
  problems.push('vite.config.ts has no rolldownOptions.external array -- React externalisation is no longer configured')
} else {
  const configured = new Set([...externalBlock[1].matchAll(/["']([^"']+)["']/g)].map(m => m[1]))
  for (const name of allowed) {
    if (!configured.has(name)) {
      problems.push(`vite.config.ts no longer lists "${name}" in rolldownOptions.external -- it would be inlined as soon as anything imports it`)
    }
  }
}

if (problems.length > 0) {
  console.error(problems.map(p => `FAIL dist/index.js: ${p}`).join('\n'))
  process.exit(1)
}
console.log(`OK dist/index.js keeps React external (specifiers: ${[...specifiers].sort().join(', ')})`)
