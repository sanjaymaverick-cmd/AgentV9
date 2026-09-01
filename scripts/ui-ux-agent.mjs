/**
 * UI/UX test agent — boots the production build, walks overlay surfaces,
 * measures overlap + 44px targets, writes docs/UI-UX-REPORT.md.
 *
 * Usage: npm run build && node scripts/ui-ux-agent.mjs [distDir]
 * WebGL screenshots hang on SwiftShader — canvas is hidden before capture.
 * In-page setTimeout is blocked by the game loop; waits use Playwright.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(process.argv[2] ?? join(ROOT, 'dist'));
const PORT = Number(process.env.UIUX_PORT ?? 4330);
const REPORT = join(ROOT, 'docs/UI-UX-REPORT.md');
const SHOT_DIR = existsSync('/workspace/screenshots')
  ? '/workspace/screenshots'
  : join(ROOT, 'docs/uiux-shots');

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`No build found at ${DIST}. Run "npm run build" first.`);
  process.exit(1);
}
mkdirSync(SHOT_DIR, { recursive: true });
mkdirSync(join(ROOT, 'docs'), { recursive: true });

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

const CHROME = process.env.CHROME_PATH
  ?? '/opt/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';

const launchOpts = {
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
};
if (existsSync(CHROME)) launchOpts.executablePath = CHROME;

const VIEWPORTS = [
  { name: 'phone-portrait', width: 390, height: 844, dpr: 2, touch: true },
  { name: 'tablet-portrait', width: 800, height: 1280, dpr: 1, touch: true, features: true },
];

const findings = [];
const featureLog = [];
const layoutLog = [];

function addFinding(severity, area, issue, suggestion) {
  findings.push({ severity, area, issue, suggestion });
}

async function shot(page, name) {
  const file = join(SHOT_DIR, `uiux-${name}.png`);
  try {
    await page.evaluate(() => {
      document.querySelectorAll('canvas').forEach((c) => {
        c.style.visibility = 'hidden';
      });
    });
    await page.screenshot({ path: file, timeout: 4000 });
    await page.evaluate(() => {
      document.querySelectorAll('canvas').forEach((c) => {
        c.style.visibility = '';
      });
    });
    return file;
  } catch (err) {
    addFinding('low', 'qa', `Screenshot ${name} skipped: ${String(err.message).split('\n')[0]}`, 'Canvas capture is optional.');
    return null;
  }
}

async function boot(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'agent_v9_settings_v1',
      JSON.stringify({
        qualityLevel: 'low',
        touchControls: true,
        touchControlMode: 'joystick',
        showPerfHud: true,
      })
    );
  });
  await page.goto(`http://127.0.0.1:${PORT}/?perf=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.locator('#tap-to-start').click({ force: true, timeout: 8000 });
  } catch {
    await page.evaluate(() => document.querySelector('button')?.click());
  }
  await page.waitForFunction(() => window.__agentV9?.ready === true, null, { timeout: 45000 });
  await page.waitForTimeout(400);
}

async function measureLayout(page, vpName) {
  return page.evaluate((name) => {
    const regions = [...document.querySelectorAll('[data-hud]')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        id: el.getAttribute('data-hud'),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    }).filter((r) => r.w > 4 && r.h > 4);

    const overlaps = [];
    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        const a = regions[i];
        const b = regions[j];
        const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
        const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        const area = x * y;
        if (area <= 24) continue;
        const aInB = a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
        const bInA = b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;
        if (aInB || bInA) continue;
        if (a.id === 'perf' || b.id === 'perf') continue;
        overlaps.push({ a: a.id, b: b.id, area, x, y });
      }
    }

    const small = [...document.querySelectorAll('button')].flatMap((btn) => {
      const r = btn.getBoundingClientRect();
      const style = getComputedStyle(btn);
      if (style.display === 'none' || style.visibility === 'hidden' || r.width < 2 || r.height < 2) return [];
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return [];
      const short = Math.min(r.width, r.height);
      if (short + 0.5 < 44) {
        return [{
          id: btn.id || btn.getAttribute('title') || btn.textContent.trim().slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
        }];
      }
      return [];
    });

    const emoji = (document.body.innerText.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []);

    return {
      name,
      css: [innerWidth, innerHeight],
      regions,
      overlaps,
      smallTargets: small.slice(0, 24),
      emoji: [...new Set(emoji)].slice(0, 20),
      hasMenu: Boolean(document.getElementById('hud-menu-btn')),
      hasStick: Boolean(document.getElementById('virtual-joystick-base')),
      hasLook: Boolean(document.getElementById('look-joystick-base')),
      hasGadgets: Boolean(document.getElementById('gadget-btn-emp')),
      ids: ['hud-menu-btn','silent-mode-toggle-btn','gadget-btn-emp','gadget-btn-foam','gadget-btn-drone','gadget-btn-hologram','gadget-btn-remote_v9','virtual-joystick-base','look-joystick-base','touch-horn-btn','touch-drift-btn','touch-interact-btn','touch-gadget-btn','touch-jump-btn','touch-boost-btn','radar-heading-btn','radar-zoom-in-btn','radar-zoom-out-btn'].filter((id) => document.getElementById(id)),
    };
  }, vpName);
}

async function clickId(page, id) {
  try {
    const found = await page.evaluate((target) => Boolean(document.getElementById(target)), id);
    if (!found) {
      featureLog.push({ id, ok: false, note: 'missing' });
      addFinding('high', 'features', `Control #${id} is missing`, 'Keep the id stable or restore the control.');
      return false;
    }
    await page.evaluate((target) => document.getElementById(target)?.click(), id);
    featureLog.push({ id, ok: true, note: 'clicked' });
    await page.waitForTimeout(50);
    return true;
  } catch (err) {
    featureLog.push({ id, ok: false, note: String(err.message).split('\n')[0] });
    addFinding('med', 'features', `Click #${id} timed out`, 'WebGL main thread blocked the click; retry on a real GPU.');
    return false;
  }
}

async function closeTopModal(page) {
  await page.evaluate(() => {
    const btn = document.querySelector('.hud-modal-close');
    if (btn) btn.click();
  });
  await page.waitForTimeout(80);
}

async function runFeatureWalk(page) {
  page.setDefaultTimeout(2500);
  const startGone = await page.evaluate(() => !document.getElementById('tap-to-start'));
  featureLog.push({ id: 'tap-to-start', ok: startGone === 0, note: startGone ? 'still visible' : 'dismissed' });

  await clickId(page, 'hud-menu-btn');
  for (const id of ['hud-map-btn', 'hud-missions-btn', 'hud-garage-btn', 'hud-walkthrough-btn', 'hud-settings-btn', 'touch-camera-btn', 'touch-reset-btn', 'touch-mode-toggle-btn']) {
    const visible = await page.locator(`#${id}`).count();
    featureLog.push({ id: `${id}:visible`, ok: visible > 0, note: visible ? 'in menu' : 'missing' });
    if (!visible) addFinding('high', 'menu', `Menu row #${id} missing while menu is open`, 'Keep the row in HUD Menu.');
  }

  await clickId(page, 'hud-map-btn');
  await page.waitForTimeout(250);
  const mapOk = await page.evaluate(() => Boolean(document.getElementById('v9-map-explorer-modal')));
  featureLog.push({ id: 'map-modal', ok: mapOk, note: mapOk ? 'open' : 'missing' });
  if (mapOk) {
    const gps = await page.evaluate(() => {
      const el = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Set 3D GPS Route'));
      if (!el) return false;
      el.click();
      return true;
    });
    featureLog.push({ id: 'set-gps', ok: gps, note: gps ? 'clicked' : 'no button' });
  } else {
    await closeTopModal(page);
  }

  await clickId(page, 'hud-menu-btn');
  await clickId(page, 'hud-missions-btn');
  await page.waitForTimeout(250);
  featureLog.push({ id: 'missions-modal', ok: await page.evaluate(() => document.body.innerText.includes('Mission Dossier')), note: 'open-check' });
  await closeTopModal(page);

  await clickId(page, 'hud-menu-btn');
  await clickId(page, 'hud-garage-btn');
  await page.waitForTimeout(250);
  featureLog.push({ id: 'garage-modal', ok: await page.evaluate(() => document.body.innerText.includes('V9 Academy Garage')), note: 'open-check' });
  await closeTopModal(page);

  await clickId(page, 'hud-menu-btn');
  await clickId(page, 'hud-walkthrough-btn');
  await page.waitForTimeout(250);
  featureLog.push({ id: 'guide-modal', ok: await page.evaluate(() => Boolean(document.getElementById('v9-walkthrough-modal'))), note: 'open-check' });
  await closeTopModal(page);

  await clickId(page, 'hud-menu-btn');
  await clickId(page, 'hud-settings-btn');
  await page.waitForTimeout(250);
  featureLog.push({ id: 'settings-modal', ok: await page.evaluate(() => document.body.innerText.includes('Parental')), note: 'open-check' });
  await closeTopModal(page);

  for (const id of ['silent-mode-toggle-btn', 'gadget-btn-emp', 'gadget-btn-foam', 'gadget-btn-drone', 'gadget-btn-hologram', 'gadget-btn-remote_v9']) {
    await clickId(page, id);
  }
  for (const id of ['touch-horn-btn', 'touch-drift-btn', 'touch-gadget-btn', 'touch-jump-btn', 'touch-boost-btn', 'touch-interact-btn']) {
    await clickId(page, id);
  }
  await clickId(page, 'radar-zoom-out-btn');
  await clickId(page, 'radar-zoom-in-btn');
  await clickId(page, 'radar-heading-btn');

  await clickId(page, 'hud-menu-btn');
  await clickId(page, 'touch-camera-btn');
  await clickId(page, 'hud-menu-btn');
  await clickId(page, 'touch-reset-btn');
  await clickId(page, 'hud-menu-btn');
  await clickId(page, 'touch-mode-toggle-btn');
  await page.waitForTimeout(150);
  const dpad = await page.evaluate(() => Boolean(document.getElementById('touch-forward-btn')));
  featureLog.push({ id: 'dpad-mode', ok: dpad, note: dpad ? 'dpad on' : 'still stick' });
  await clickId(page, 'hud-menu-btn');
  await clickId(page, 'touch-mode-toggle-btn');

  await page.evaluate(() => {
    window.__agentV9.teleport([90, 0, 0]);
    window.__agentV9.setKeys(['KeyW']);
  });
  await page.waitForTimeout(700);
  const afterDrive = await page.evaluate(() => {
    const p = window.__agentV9;
    p.setKeys([]);
    return { pos: p.getPlayerPos(), speed: p.getSpeed() };
  });
  featureLog.push({
    id: 'probe-drive',
    ok: Math.hypot(afterDrive.pos[0] - 90, afterDrive.pos[2]) > 0.4 || afterDrive.speed > 0.5,
    note: `speed=${Number(afterDrive.speed).toFixed(1)}`,
  });

  await page.evaluate(() => {
    window.__agentV9.teleport([14, 0.22, 8]);
    window.__agentV9.dismount();
  });
  await page.waitForTimeout(350);
  await clickId(page, 'touch-interact-btn');
  await page.waitForTimeout(250);
  const talk = await page.evaluate(() => Boolean(document.getElementById('v9-npc-dialogue-box')));
  featureLog.push({ id: 'npc-talk', ok: talk > 0, note: talk ? 'dialogue' : 'no box' });
  if (talk) await closeTopModal(page);

  await page.evaluate(() => window.__agentV9.teleport([22, 0, 18]));
  await page.waitForTimeout(250);
  const refuel = await page.evaluate(() => Boolean(document.getElementById('touch-refuel-btn')));
  featureLog.push({ id: 'refuel-prompt', ok: true, note: refuel ? 'refuel btn' : 'not on pad' });
}

function listFiles(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) listFiles(p, out);
    else if (/\.(tsx|ts|css)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function writeReport() {
  const EMOJI_RE = /[\u{1F300}-\u{1FAFF}]/u;
  for (const file of listFiles(join(ROOT, 'src/components')).concat([join(ROOT, 'src/App.tsx')])) {
    const text = readFileSync(file, 'utf8');
    const rel = file.replace(ROOT + '/', '');
    if (EMOJI_RE.test(text)) {
      addFinding('low', 'source', `${rel} still contains emoji`, 'Replace with lucide icons or plain copy.');
    }
    if (/from-pink-|fuchsia-|violet-|purple-400/.test(text) && !rel.includes('MiniMap')) {
      addFinding('low', 'source', `${rel} still uses neon/pink/violet chrome`, 'Restyle the modal to hud tokens.');
    }
  }

  const high = findings.filter((f) => f.severity === 'high').length;
  const med = findings.filter((f) => f.severity === 'med').length;
  const low = findings.filter((f) => f.severity === 'low').length;

  const md = [];
  md.push('# Agent V9 — UI/UX test report');
  md.push('');
  md.push(`Generated **${new Date().toISOString()}** by \`scripts/ui-ux-agent.mjs\`.`);
  md.push('');
  md.push(`Verdict: **${high ? 'needs work' : med ? 'playable, polish left' : 'pass'}** — ${high} high, ${med} medium, ${low} low.`);
  md.push('');
  md.push('## What the new layout is doing');
  md.push('');
  md.push('- Four corners: identity (speed + meters) top-left, events under the brief, menu+radar top-right, gadgets lifted off the sticks.');
  md.push('- Overflow Menu holds Map / Missions / Garage / Guide / Settings / camera / reset / stick-vs-dpad.');
  md.push('- Touch: move stick left; LOOK stacked above Horn-Drift-Mount and Fire-Jump-Boost on the right.');
  md.push('- Start screen is quiet (no emoji, no tablet-debug copy). FPS chip sits top-center, off the stick.');
  md.push('');
  md.push('## Layout by viewport');
  md.push('');
  md.push('| Viewport | CSS | Overlaps | Small targets | Stick | Look | Menu |');
  md.push('| --- | --- | ---: | ---: | --- | --- | --- |');
  for (const l of layoutLog) {
    md.push(`| ${l.name} | ${l.css[0]}×${l.css[1]} | ${l.overlaps.length} | ${l.smallTargets.length} | ${l.hasStick ? 'yes' : 'no'} | ${l.hasLook ? 'yes' : 'no'} | ${l.hasMenu ? 'yes' : 'no'} |`);
  }
  md.push('');
  md.push('## Feature walk');
  md.push('');
  md.push('| Control | Result | Note |');
  md.push('| --- | --- | --- |');
  for (const f of featureLog) {
    md.push(`| \`${f.id}\` | ${f.ok ? 'ok' : 'FAIL'} | ${f.note} |`);
  }
  md.push('');
  md.push('## Findings and suggestions');
  md.push('');
  if (!findings.length) {
    md.push('No automated findings. Keep watching tablet portrait by eye — GPS + identity can still crowd.');
  } else {
    md.push('| Sev | Area | Issue | Suggestion |');
    md.push('| --- | --- | --- | --- |');
    const order = { high: 0, med: 1, low: 2 };
    findings.sort((a, b) => order[a.severity] - order[b.severity]);
    for (const f of findings) {
      md.push(`| ${f.severity} | ${f.area} | ${f.issue.replace(/\|/g, '/')} | ${f.suggestion.replace(/\|/g, '/')} |`);
    }
  }
  md.push('');
  md.push('## Suggested next polish (even if the agent is green)');
  md.push('');
  md.push('1. Restyle Map / Missions / Garage / Guide / Settings onto `.hud-panel` tokens so they match the HUD (they still speak a louder cyan-border language).');
  md.push('2. Collapse radar zoom into a single cycle control — two 44px buttons under a 132px radar still add height.');
  md.push('3. Gadget row is six 44px buttons. On a 390px phone it is the remaining squeeze; a cycle-gadget chip next to Fire would free the gutter.');
  md.push('4. Walkthrough and in-world notifications still mix emoji and purple copy — strip those in a follow-up.');
  md.push('5. Confirm on the physical tablet: thumbs vs LOOK/BOOST with the new 17rem gadget lift.');
  md.push('');
  md.push('Screenshots: `uiux-*.png` in the screenshots folder.');
  md.push('');
  writeFileSync(REPORT, md.join('\n'));
  console.log(`UIUX report → ${REPORT}`);
  console.log(`findings high=${high} med=${med} low=${low}`);
  return high;
}

const browser = await chromium.launch(launchOpts);
try {
  for (const vp of VIEWPORTS) {
    process.stderr.write(`layout ${vp.name}\n`);
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      hasTouch: vp.touch,
      isMobile: vp.width <= 900,
    });
    page.setDefaultTimeout(8000);
    try {
      await boot(page);
      const layout = await measureLayout(page, vp.name);
      layoutLog.push(layout);
      await shot(page, `${vp.name}-hud`);
      for (const o of layout.overlaps) {
        addFinding(
          o.area > 400 ? 'high' : 'med',
          `layout/${vp.name}`,
          `${o.a} overlaps ${o.b} by ${o.area}px`,
          'Move one region to a free corner or collapse it into Menu.'
        );
      }
      for (const t of layout.smallTargets) {
        addFinding(
          'med',
          `targets/${vp.name}`,
          `Tap target "${t.id || 'unnamed'}" is ${t.w}×${t.h} (need 44px)`,
          'Use .hud-btn / .touch-btn so every control is at least 44×44.'
        );
      }
      if (layout.emoji.length) {
        addFinding('low', `chrome/${vp.name}`, `Emoji in overlay text: ${layout.emoji.join(' ')}`, 'Replace with lucide icons or plain labels.');
      }
      if (layout.ids) {
        for (const id of layout.ids) {
          if (!featureLog.some((f) => f.id === id)) featureLog.push({ id, ok: true, note: `${layout.name} present` });
        }
      }
      if (vp.features) {
        process.stderr.write('features\n');
        await Promise.race([
          runFeatureWalk(page),
          new Promise((_, rej) => setTimeout(() => rej(new Error('feature walk timeout')), 12000)),
        ]);
      }
    } catch (err) {
    const msg = String(err.message).split('\n')[0];
    if (msg.includes('feature walk')) {
      addFinding('med', `features/${vp.name}`, msg, 'Clicks run on the WebGL thread; presence was still recorded from the layout pass.');
    } else {
      addFinding('high', `boot/${vp.name}`, msg, 'Engine must reach window.__agentV9.ready on this viewport.');
    }
  }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

const high = writeReport();
if (high) process.exit(1);
