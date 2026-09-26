import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

/** Resolve a browser request inside the built workbench directory. */
export function resolveStaticFile(dist, pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (decoded.split(/[/\\]+/).includes('..')) return null
  const relative = normalize(decoded).replace(/^[/\\]+/, '')
  const file = join(dist, relative || 'index.html')
  return file === dist || file.startsWith(dist + sep) ? file : null
}

/** Create the minimal static server used by the consumer smoke. */
export function createStaticServer(dist) {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const file = resolveStaticFile(dist, url.pathname)
    if (file == null) {
      response.writeHead(403).end('forbidden')
      return
    }
    try {
      const body = readFileSync(file)
      response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(body)
    } catch {
      response.writeHead(404).end('not found')
    }
  })
  return server
}

/** Render the built workbench and exercise one valid and invalid edit. */
export async function runBrowserSmoke() {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const appDist = join(root, 'examples', 'workbench', 'dist')
  if (!existsSync(join(appDist, 'index.html'))) {
    throw new Error('workbench is not built; run npm run build --workspace @fix-portal/fixatdl-react-workbench first')
  }

  const server = createStaticServer(appDist)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
    await page.goto(`http://127.0.0.1:${address.port}/index.html`, { waitUntil: 'networkidle' })
    await expectWorkbench(page)
  } finally {
    await browser.close()
    server.close()
  }
}

/** Assert the representative workbench rendering, preview, and error state. */
async function expectWorkbench(page) {
  await page.getByRole('heading', { name: 'Participate', level: 1 }).waitFor()
  const rate = page.getByRole('spinbutton', { name: 'Participation rate %' })
  await rate.waitFor()
  await page.getByRole('table').waitFor()
  await page.getByText('ParticipationRate').waitFor()

  await rate.fill('40')
  await rate.blur()
  await page.getByText('0.40').waitFor()

  await rate.fill('60')
  await rate.blur()
  await page.getByText('Must be ≤ 0.5.').waitFor()
  await page.getByText('The form has errors. A host must not submit this preview.').waitFor()
}

if (process.argv[1]?.endsWith('browser-smoke.mjs')) {
  await runBrowserSmoke()
  console.log('OK workbench browser smoke')
}
