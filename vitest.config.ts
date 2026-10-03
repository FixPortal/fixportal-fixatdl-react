import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // scripts/ holds the CI gate scripts. Their tests run in the normal suite so a
    // broken gate fails the same way a broken source file does; coverage `include`
    // below stays scoped to src/** so they do not move the library's thresholds.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.mjs'],
    // NOTE: `globals: true` is deliberately NOT set. Tests import { describe, it,
    // expect } from 'vitest' explicitly, so the suite never depends on ambient
    // test globals leaking into type-checking or other tooling.
    coverage: {
      provider: 'v8',
      // Scope coverage to source. Without an explicit include, v8 counts only
      // the files a test imported, so untested src files sit outside the
      // denominator and the thresholds below pass vacuously. With the include,
      // adding a src file with no test correctly drags coverage down.
      include: ['src/**'],
      reporter: ['text', 'html'],
      // Start realistic for the project's current maturity and ratchet up over
      // time. A failing threshold should fail CI, so keep these honest. Set the
      // floors from a real `--coverage` run over ALL of src (the include above),
      // not the smaller test-touched-only number.
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
})
