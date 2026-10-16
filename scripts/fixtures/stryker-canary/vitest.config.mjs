export default {
  cacheDir: '.vite-cache',
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'], setupFiles: ['./observer.mjs'] },
}
