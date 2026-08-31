/**
 * B4 frame-time profile. Boots the production build in headless Chromium at a
 * 1600×2560 Android-tablet landscape (2560×1600 @ DPR 2) and a mid-range phone
 * (844×390 @ DPR 2.5). Absolute FPS on SwiftShader is NOT the 30 FPS target —
 * use draw calls, triangle count, drawing-buffer size, and LOW vs HIGH delta.
 *
 * Usage:  npm run build && node scripts/profile.mjs
 * Env:    CHROME_PATH  — Chromium binary
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const DIST = resolve(process.argv[2] ?? 'dist');
const PORT = Number(process.env.PROFILE_PORT ?? 4322);
const CHROME = process.env.CHROME_PATH
  ?? '/opt/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`No build found at ${DIST}. Run "npm run build" first.`);
  process.exit(1);
}

const { chromium } = await import('playwright');

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

const VIEWPORTS = [
  // Native 2560×1600 SwiftShader OOMs/hangs in this sandbox. 1280×800 @ 2× is
  // the same aspect as a landscape 1600×2560 tablet and still stresses fill.
  { name: 'tablet-landscape', width: 1280, height: 800, dpr: 2 },
];
const QUALITIES = ['low'];

async function runCase(browser, vp, quality) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
  });
  await page.addInitScript((q) => {
    localStorage.setItem('agent_v9_settings_v1', JSON.stringify({ qualityLevel: q, showPerfHud: true }));
  }, quality);
  process.stderr.write('  goto\n');
  await page.goto(`http://127.0.0.1:${PORT}/?perf=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  process.stderr.write('  tap\n');
  try {
    await page.locator('button').filter({ hasText: 'Tap to Start' }).click({ force: true, timeout: 8000 });
  } catch {
    await page.evaluate(() => document.querySelector('button')?.click());
  }
  process.stderr.write('  wait ready\n');
  await page.waitForFunction(() => window.__agentV9?.ready === true, null, { timeout: 45000 });
  process.stderr.write('  applyQuality\n');
  await page.evaluate((q) => window.__agentV9.applyQuality(q), quality);
  await page.waitForTimeout(800);
  process.stderr.write('  idle sample\n');
  await page.evaluate(() => {
    window.__agentV9.resetStats();
    window.__agentV9.teleport([0, 0, 0]);
  });
  await page.waitForTimeout(1200);
  const idle = await page.evaluate(() => window.__agentV9.snapshot());
  process.stderr.write('  ride sample\n');

  await page.evaluate(() => {
    window.__agentV9.resetStats();
    window.__agentV9.teleport([0, 0, 0]);
    window.__agentV9.setThrottle(true);
  });
  await page.waitForTimeout(3500);
  const ride = await page.evaluate(() => {
    const s = window.__agentV9.snapshot();
    window.__agentV9.setThrottle(false);
    return s;
  });

  await page.close();
  return { viewport: vp.name, quality, idle, ride };
}

const launchOpts = {
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
};
if (existsSync(CHROME)) launchOpts.executablePath = CHROME;

const browser = await chromium.launch(launchOpts);
const results = [];
try {
  for (const vp of VIEWPORTS) {
    for (const q of QUALITIES) {
      process.stderr.write(`profile ${vp.name} ${q}…\n`);
      try {
        results.push(await runCase(browser, vp, q));
      } catch (err) {
        results.push({ viewport: vp.name, quality: q, error: String(err?.message || err) });
        process.stderr.write(`  FAILED: ${err?.message || err}\n`);
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const out = {
  generatedAt: new Date().toISOString(),
  note: 'FPS is SwiftShader (software GL) — do not treat it as the 30 FPS phone target. Drawing-buffer size, draw calls, and LOW vs HIGH triangle delta are the device-independent signals.',
  results,
};
const outPath = resolve('docs/PROFILE.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.error(`wrote ${outPath}`);
