// Asserts the built ESM bundle keeps React external, as AGENTS.md requires.
// Rolldown mangles imported *bindings* (`createContext as e`) but leaves module
// *specifiers* as literal strings, so anchor on the specifier (`from "react"`),
// never on binding names. If an entry is dropped from `rolldownOptions.external`
// in vite.config.ts, or a Vite/Rolldown upgrade changes default externalisation,
// React's source is inlined and its import specifier disappears from the output.
import { readFileSync } from 'node:fs'

const bundle = readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8')

const specifiers = new Set()
for (const match of bundle.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) {
  specifiers.add(match[1])
}

// 'react-dom' and 'react/jsx-dev-runtime' are valid externals but unused by the
// current bundle, so only the two specifiers the build actually emits are required.
const required = ['react', 'react/jsx-runtime']
const allowed = new Set(['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'])

const problems = []
for (const name of required) {
  if (!specifiers.has(name)) {
    problems.push(`no import specifier "${name}" -- React may have been inlined into the bundle`)
  }
}
for (const name of specifiers) {
  if ((name === 'react' || name.startsWith('react/')) && !allowed.has(name)) {
    problems.push(`unexpected React import specifier "${name}"`)
  }
}

if (problems.length > 0) {
  console.error(problems.map(p => `FAIL dist/index.js: ${p}`).join('\n'))
  process.exit(1)
}
console.log(`OK dist/index.js keeps React external (specifiers: ${[...specifiers].sort().join(', ')})`)
