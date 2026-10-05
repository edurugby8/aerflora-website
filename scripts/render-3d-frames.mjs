// Renders the 3D cabin (scripts/scene3d) into the frame sequence used by the
// site: public/frames/{lg,sm,portrait}/NNNN.webp, posters and manifest.json.
//
//   node scripts/render-3d-frames.mjs [--frames 192] [--only 0,60,128] [--out dir]
//
// Needs Microsoft Edge or Chrome (set BROWSER=path to override) with WebGL.
// The result is still CG made from procedural materials, so the manifest stays
// flagged as provisional until real footage replaces it (see ASSETS.md).

import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const N = Number(opt('frames', 192));
const only = opt('only') ? opt('only').split(',').map(Number) : null;
const OUT = path.resolve(opt('out', only ? 'frames-preview' : 'public/frames'));
const ROOT = path.resolve('.');
const markers = { arrive: Math.round(N * 0.66), doorOpenStart: Math.round(N * 0.69), doorOpenEnd: Math.round(N * 0.92) };

const BROWSERS = [process.env.BROWSER, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const executablePath = BROWSERS.find((p) => p && existsSync(p));
if (!executablePath) throw new Error('No Edge/Chrome found; set BROWSER=/path/to/browser');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] ?? 'application/octet-stream' });
  createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath, headless: 'new', protocolTimeout: 600000, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });

async function pass({ name, width, height, portrait, outputs }) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.setViewport({ width, height });
  await page.goto(`http://localhost:${port}/scripts/scene3d/index.html`);
  await page.waitForFunction('window.AER && window.AER.ready', { timeout: 60000 });
  const t0 = Date.now();
  await page.evaluate((cfg) => window.AER.setup(cfg), { width, height, portrait, frameCount: N, markers });
  console.log(`${name}: scene built in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const list = only ?? Array.from({ length: N }, (_, i) => i);
  for (const i of list) {
    const shots = await page.evaluate((i, outputs) => {
      window.AER.renderFrame(i);
      return outputs.map((o) => window.AER.snapshot('image/webp', o.q, o.w, o.h));
    }, i, outputs);
    for (let k = 0; k < outputs.length; k++) {
      const file = path.join(OUT, outputs[k].dir, `${String(i + 1).padStart(4, '0')}.webp`);
      await fs.writeFile(file, Buffer.from(shots[k].split(',')[1], 'base64'));
    }
    process.stdout.write(`\r${name} ${i + 1}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  process.stdout.write('\n');
  await page.close();
}

if (!only) await fs.rm(OUT, { recursive: true, force: true });
for (const d of ['lg', 'sm', 'portrait']) await fs.mkdir(path.join(OUT, d), { recursive: true });
await pass({ name: 'landscape', width: 1600, height: 900, portrait: false, outputs: [{ dir: 'lg', q: 0.74 }, { dir: 'sm', q: 0.74, w: 960, h: 540 }] });
await pass({ name: 'portrait', width: 720, height: 1280, portrait: true, outputs: [{ dir: 'portrait', q: 0.7 }] });
await browser.close();
server.close();

if (!only) {
  const pad = (i) => String(i).padStart(4, '0');
  for (const [name, dir, n] of [['poster.webp', 'lg', 1], ['poster-end.webp', 'lg', N], ['poster-portrait.webp', 'portrait', 1], ['poster-end-portrait.webp', 'portrait', N]]) {
    await fs.copyFile(path.join(OUT, dir, `${pad(n)}.webp`), path.join(OUT, name));
  }
  const manifest = {
    provisional: true,
    note: '3D render from procedural geometry and materials (scripts/scene3d). Not photographic: replace with real footage when available (see ASSETS.md).',
    frameCount: N,
    pad: 4,
    sets: [
      { name: 'lg', width: 1600, height: 900, path: 'lg/{i}.webp' },
      { name: 'sm', width: 960, height: 540, path: 'sm/{i}.webp' },
      { name: 'portrait', width: 720, height: 1280, path: 'portrait/{i}.webp' },
    ],
    posters: { start: 'poster.webp', end: 'poster-end.webp', startPortrait: 'poster-portrait.webp', endPortrait: 'poster-end-portrait.webp' },
    focus: { x: 0.5, y: 0.47 },
    markers,
    rows: [32, 10],
  };
  await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`wrote ${N} frames to ${OUT}`);
}
