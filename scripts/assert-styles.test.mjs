// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { withGuardFixture } from './guardFixture.test-utils.mjs'

const guard = new URL('./assert-styles.mjs', import.meta.url)
// Literal consumer contract, deliberately independent of the guard's token list.
const validCss = `:root {
  --color-text: #111;
  --color-muted: #222;
  --color-card: #fff;
  --color-border-base: #333;
  --color-brand: #444;
  --color-brand-soft: #555;
  --color-bad-text: #600;
  --color-bad-border: #700;
  --color-warn-bg: #ff0;
  --color-warn-border: #880;
}
.flex { display: flex; }
.px-2 { padding-inline: 0.5rem; }
.focus\\:bg-brand:focus { background: var(--color-brand); }
`

function runStyles({ css = validCss, manifest = {}, missingCss = false } = {}, inspect) {
  withGuardFixture(guard, (fixture) => {
    fixture.write(
      'package.json',
      JSON.stringify({
        type: 'module',
        exports: { './styles.css': './dist/styles.css' },
        files: ['dist'],
        sideEffects: ['**/*.css'],
        ...manifest,
      }),
    )
    fixture.write('src/Control.tsx', '<div className="flex px-2 focus:bg-brand" />\n')
    // Tests are outside Tailwind's published-control contract.
    fixture.write('src/Ignored.test.tsx', '<div className="bg-only-in-tests" />\n')
    if (!missingCss) fixture.write('dist/styles.css', css)
    const result = fixture.run()
    expect(result.error).toBeUndefined()
    expect(result.signal).toBeNull()
    inspect(result)
  })
}

function rejects(options, diagnostic) {
  runStyles(options, (result) => {
    expect(result.status).toBe(1)
    expect(result.stderr).not.toMatch(/TypeError|SyntaxError|ReferenceError|ENOENT/)
    expect(result.stderr).toContain('FAIL dist/styles.css:')
    expect(result.stderr).toContain(diagnostic)
  })
}

describe('the actual published stylesheet guard', () => {
  it('accepts complete CSS, escaped utilities and a resolvable side-effect export', () => {
    runStyles({}, (result) => {
      expect(result.status).toBe(0)
      expect(result.stdout).toContain(
        'carries 10 tokens and every emitted utility, with no preflight',
      )
      expect(result.stderr).toBe('')
    })
  })

  it('rejects a missing stylesheet', () => {
    rejects({ missingCss: true }, 'dist/styles.css is missing')
  })

  it('rejects a documented token without a default value', () => {
    rejects(
      { css: validCss.replace('  --color-brand: #444;\n', '') },
      'no default value for the documented token --color-brand',
    )
  })

  it('rejects a source utility absent from compiled CSS', () => {
    rejects(
      { css: validCss.replace('.px-2 { padding-inline: 0.5rem; }\n', '') },
      'src emits 1 class name(s) with no rule in dist/styles.css: px-2',
    )
  })

  it('rejects Tailwind preflight in the optional library stylesheet', () => {
    rejects({ css: validCss + '@layer base { body { margin: 0; } }\n' }, 'contains a base layer')
  })

  it('rejects an exports entry that points away from the built stylesheet', () => {
    rejects(
      { manifest: { exports: { './styles.css': './missing.css' } } },
      'expected "./dist/styles.css"',
    )
  })

  it('rejects a manifest that omits dist from the package', () => {
    rejects({ manifest: { files: ['README.md'] } }, 'files does not include dist')
  })

  it.each([{ value: false }, { value: [] }, { value: ['**/*.js'] }])(
    'rejects sideEffects=$value without a CSS exemption',
    ({ value: sideEffects }) => {
      rejects({ manifest: { sideEffects } }, 'does not exempt CSS')
    },
  )
})
