/**
 * Smoke test: builds are served statically, the game is booted in headless Chromium,
 * and the run fails if anything throws at runtime.
 *
 * Usage:  node scripts/smoke.mjs [distDir]
 * Env:    CHROME_PATH  — explicit Chromium/Chrome binary (otherwise Playwright's own)
 *
 * Requires browsers once:  npx playwright install chromium
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const DIST = resolve(process.argv[2] ?? 'dist');
const PORT = Number(process.env.SMOKE_PORT ?? 4321);
const SETTLE_MS = Number(process.env.SMOKE_SETTLE_MS ?? 6000);

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`No build found at ${DIST}. Run "npm run build" first.`);
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  let file = join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  try {
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(PORT, r));

const launchOpts = {
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
};
if (process.env.CHROME_PATH) launchOpts.executablePath = process.env.CHROME_PATH;

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const failures = [];
page.on('pageerror', (e) => failures.push(`Uncaught: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') failures.push(`console.error: ${m.text()}`);
});
page.on('requestfailed', (r) => failures.push(`Request failed: ${r.url()}`));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(SETTLE_MS);

const probe = await page.evaluate(() => ({
  canvases: document.querySelectorAll('canvas').length,
  hasMissionText: document.body.innerText.includes('MIDNIGHT PROTOTYPE'),
}));

await browser.close();
server.close();

// The game must have rendered a WebGL canvas and started the story mission.
if (probe.canvases < 1) failures.push('No <canvas> rendered — the Three.js scene never mounted.');
if (!probe.hasMissionText) failures.push('Story mission HUD never appeared.');

if (failures.length) {
  console.error('SMOKE FAILED:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`SMOKE PASSED — canvas mounted, story mission active, no runtime errors.`);
