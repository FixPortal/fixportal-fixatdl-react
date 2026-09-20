import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * There is deliberately no alias pointing at `../../src`. The sample resolves
 * `@fix-portal/fixatdl-react` through the workspace link and the package's own
 * `exports` map, exactly as an installed consumer does -- so its imports are
 * copy-pasteable, and a broken `exports` entry (the JS one or `./styles.css`)
 * breaks the sample instead of hiding behind a path that only works in-repo.
 *
 * The cost is that `dist` has to exist first, which is why the root `dev` script
 * builds the library before starting this server.
 *
 * react, react-dom, vite and typescript are not declared here either: this is an
 * npm workspace of the package repo and they resolve to the ROOT devDependencies.
 * One set of versions, no second list to drift.
 */
export default defineConfig({
  plugins: [react()],
})
