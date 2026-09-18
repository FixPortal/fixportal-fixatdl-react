// Regenerates docs/images/sample-light-dark.png from the sample app.
//
//   npm run build
//   npm run build --workspace @fix-portal/fixatdl-react-workbench
//   npx playwright install chromium      # once per machine
//   node scripts/capture-screenshot.mjs
//
// The README image is published, so it has to be reproducible rather than something
// somebody once cropped by hand. Everything the shot depends on is pinned here: the
// viewport, the device scale factor, and the strategy itself (the committed fixture
// the test suite renders).
//
// Both themes are captured in ONE screenshot by loading the built app twice in
// side-by-side iframes, seeded through the `?theme=` parameter the sample reads. That
// avoids stitching two PNGs together, which would need an image library for no gain.
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const appDist = join(root, 'examples', 'workbench', 'dist')
const output = join(root, 'docs', 'images', 'sample-light-dark.png')

// One pane wide enough for the two-column layout, doubled for the pair.
const PANE_WIDTH = 1180
const PANE_HEIGHT = 1420

if (!existsSync(join(appDist, 'index.html'))) {
  console.error(`FAIL: ${appDist} has no index.html - run the two build commands in this file's header first`)
  process.exit(1)
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

const FRAME = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; background: #64748b; }
  .pair { display: flex; gap: 12px; padding: 12px; }
  iframe { width: ${PANE_WIDTH}px; height: ${PANE_HEIGHT}px; border: 0; border-radius: 10px; background: #fff; }
</style></head>
<body><div class="pair">
  <iframe src="/index.html?theme=light" title="Light"></iframe>
  <iframe src="/index.html?theme=dark" title="Dark"></iframe>
</div></body></html>`

// A plain static server rather than `vite preview`: no child process to babysit, and
// the capture cannot race a dev server that is still warming up.
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost')
  if (url.pathname === '/pair.html') {
    response.writeHead(200, { 'content-type': TYPES['.html'] }).end(FRAME)
    return
  }
  // Two independent steps, deliberately. The strip neutralises leading traversal
  // segments after normalize() has hoisted them to the front; the containment check
  // then decides on the RESOLVED path.
  //
  // The check compares against `appDist + sep` rather than `appDist` alone. A bare
  // `startsWith(appDist)` also accepts a sibling whose name merely begins with it -
  // `<appDist>-evil/secret` - which is a real hole in that idiom. Probed against this
  // server, nine crafted requests (`/../dist-evil/secret`, `/%2e%2e/%2e%2e/secret`,
  // `/foo/..%5c..%5cdist-evil%5csecret` and so on) all resolved INSIDE appDist, so the
  // hole was not reachable through it: the strip removed the leading `..` first. That
  // is exactly why the check is tightened anyway. A guard that is safe only because of
  // a separate line's side effect fails silently the moment either line changes, and
  // the correct comparison costs nothing.
  const relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\.]+)/, '')
  const file = join(appDist, relative || 'index.html')
  if (file !== appDist && !file.startsWith(appDist + sep)) {
    response.writeHead(403).end('forbidden')
    return
  }
  try {
    const body = await readFile(file)
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body)
  } catch {
    response.writeHead(404).end('not found')
  }
})

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address()

const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    viewport: { width: PANE_WIDTH * 2 + 36, height: PANE_HEIGHT + 24 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  })
  await page.goto(`http://127.0.0.1:${port}/pair.html`, { waitUntil: 'networkidle' })
  // Gate on the rendered form rather than a timeout: both frames must have painted a
  // control from the strategy before anything is captured.
  for (const name of ['Light', 'Dark']) {
    const frame = page.frameLocator(`iframe[title="${name}"]`)
    await frame.getByRole('spinbutton', { name: /participation rate/i }).waitFor()
    await frame.getByRole('table').waitFor()
  }
  await page.screenshot({ path: output })
  console.log(`wrote ${output}`)
} finally {
  await browser.close()
  server.close()
}
