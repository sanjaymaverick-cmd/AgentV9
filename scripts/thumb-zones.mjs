/**
 * Tablet thumb-zone check. Boots the production build at the two tablet
 * CSS sizes (landscape play lock + portrait) and measures control boxes
 * against easy / stretch arcs from each bottom corner.
 *
 * Easy  = 280 CSS px (~47 mm on the 1600×2560 @ 2× panel)
 * Stretch = 400 CSS px (~68 mm)
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(process.argv[2] ?? join(ROOT, 'dist'));
const PORT = Number(process.env.THUMB_PORT ?? 4331);
const SHOT = existsSync('/workspace/screenshots') ? '/workspace/screenshots' : join(ROOT, 'docs');

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('Need a production build first.');
  process.exit(1);
}
mkdirSync(SHOT, { recursive: true });

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
  let file = join(DIST, decodeURIComponent((req.url || '/').split('?')[0]));
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  try {
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(PORT, r));

const CHROME =
  process.env.CHROME_PATH ??
  '/opt/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
const launchOpts = { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] };
if (existsSync(CHROME)) launchOpts.executablePath = CHROME;

const IDS = [
  'virtual-joystick-base',
  'look-joystick-base',
  'touch-boost-btn',
  'touch-jump-btn',
  'touch-gadget-btn',
  'gadget-cycle-btn',
  'touch-horn-btn',
  'touch-drift-btn',
  'touch-interact-btn',
];
const VIEWPORTS = [
  { name: 'tablet-landscape', width: 1280, height: 800, dpr: 2, note: 'play lock (2560×1600 @ 2×)' },
  { name: 'tablet-portrait', width: 800, height: 1280, dpr: 2, note: 'if rotated (1600×2560 @ 2×)' },
];
const EASY = 280;
const STRETCH = 400;

function zone(dist) {
  if (dist <= EASY) return 'easy';
  if (dist <= STRETCH) return 'stretch';
  return 'out';
}

const browser = await chromium.launch(launchOpts);
const rows = [];

for (const vp of VIEWPORTS) {
  process.stderr.write(`thumb ${vp.name}\n`);
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    hasTouch: true,
    isMobile: true,
  });
  page.setDefaultTimeout(8000);
  await page.addInitScript(() => {
    localStorage.setItem(
      'agent_v9_settings_v1',
      JSON.stringify({ qualityLevel: 'low', touchControls: true, touchControlMode: 'joystick', showPerfHud: true })
    );
  });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.locator('#tap-to-start').click({ force: true, timeout: 8000 });
  } catch {
    await page.evaluate(() => document.querySelector('#tap-to-start')?.click());
  }
  await page.waitForFunction(() => window.__agentV9?.ready === true, null, { timeout: 45000 });
  await page.waitForTimeout(400);

  const measured = await page.evaluate(
    ({ ids, easy, stretch, w, h }) => {
      const bl = { x: 16, y: h - 16 };
      const br = { x: w - 16, y: h - 16 };
      const out = [];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) {
          out.push({ id, missing: true });
          continue;
        }
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const distL = Math.hypot(cx - bl.x, cy - bl.y);
        const distR = Math.hypot(cx - br.x, cy - br.y);
        const hand = distL <= distR ? 'left' : 'right';
        const dist = Math.min(distL, distR);
        const band = dist <= easy ? 'easy' : dist <= stretch ? 'stretch' : 'out';
        out.push({
          id,
          x: Math.round(cx),
          y: Math.round(cy),
          w: Math.round(r.width),
          h: Math.round(r.height),
          bottom: Math.round(h - r.bottom),
          right: Math.round(w - r.right),
          left: Math.round(r.left),
          dist: Math.round(dist),
          distL: Math.round(distL),
          distR: Math.round(distR),
          hand,
          band,
        });
      }
      return out;
    },
    { ids: IDS, easy: EASY, stretch: STRETCH, w: vp.width, h: vp.height }
  );

  try {
    await page.evaluate(() => {
      document.querySelectorAll('canvas').forEach((c) => {
        c.style.visibility = 'hidden';
      });
    });
    await page.screenshot({ path: join(SHOT, `thumb-${vp.name}.png`), timeout: 4000 });
  } catch {
    /* skip */
  }
  await page.close();
  rows.push({ vp, measured });
}

await browser.close();
server.close();

const lines = [];
lines.push('# Tablet thumb zones');
lines.push('');
lines.push('Panel: 1600×2560 @ 2×. Play lock is landscape (1280×800 CSS). Easy arc 280 CSS (~47 mm) from each bottom corner; stretch 400 CSS (~68 mm).');
lines.push('');
for (const { vp, measured } of rows) {
  lines.push(`## ${vp.name} — ${vp.width}×${vp.height} (${vp.note})`);
  lines.push('');
  lines.push('| Control | Hand | Band | Dist | From bottom | From right | Size |');
  lines.push('| --- | --- | --- | ---: | ---: | ---: | --- |');
  for (const m of measured) {
    if (m.missing) {
      lines.push(`| ${m.id} | — | missing | | | | |`);
      continue;
    }
    lines.push(
      `| ${m.id} | ${m.hand} | **${m.band}** | ${m.dist} | ${m.bottom} | ${m.right} | ${m.w}×${m.h} |`
    );
  }
  lines.push('');
}

const ride = ['virtual-joystick-base', 'look-joystick-base', 'touch-boost-btn', 'touch-jump-btn', 'touch-gadget-btn'];
let worst = 'easy';
for (const { measured } of rows) {
  for (const m of measured) {
    if (!ride.includes(m.id) || m.missing) continue;
    if (m.band === 'out') worst = 'out';
    else if (m.band === 'stretch' && worst === 'easy') worst = 'stretch';
  }
}
lines.push(`Ride controls (stick, look, fire, jump, boost): **${worst}**.`);
lines.push('');
writeFileSync(join(ROOT, 'docs/THUMB-ZONES.md'), lines.join('\n'));
console.log(lines.join('\n'));
process.exit(worst === 'out' ? 1 : 0);
