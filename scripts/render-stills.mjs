// Renders the cabin stills used by the About and Contact sections from the same 3D scene as the journey, as
// close-ups with a shallow depth of field.
//
//   node scripts/render-stills.mjs
//
// Writes public/images/<name>.webp (4:5, 900×1125).

import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const D = 19;
const N = 192;
const markers = { arrive: Math.round(N * 0.66), doorOpenStart: Math.round(N * 0.69), doorOpenEnd: Math.round(N * 0.92) };
const STILLS = {
  'sobre-aerflora': { frame: N - 1, pos: [0, 1.45, D - 1.6], look: [0, 1.6, D + 10], fov: 50, focus: 30, aperture: 0.0015 },
  contacto: { frame: 0, pos: [0.2, 1.45, 10.5], look: [1.3, 1.35, 12], fov: 45, focus: 1.8, aperture: 0.004 },
};

const ROOT = path.resolve('.');
const OUT = path.resolve('public/images');
const BROWSERS = [process.env.BROWSER, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const executablePath = BROWSERS.find((p) => p && existsSync(p));
if (!executablePath) throw new Error('No Edge/Chrome found; set BROWSER=/path/to/browser');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] ?? 'application/octet-stream' });
  createReadStream(p).pipe(res);
}).listen(0);

const browser = await puppeteer.launch({ executablePath, headless: 'new', protocolTimeout: 600000, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.setViewport({ width: 900, height: 1125 });
await page.goto(`http://localhost:${server.address().port}/scripts/scene3d/index.html`);
await page.waitForFunction('window.AER && window.AER.ready');
await page.evaluate((cfg) => window.AER.setup(cfg), { width: 900, height: 1125, portrait: false, frameCount: N, markers });
await fs.mkdir(OUT, { recursive: true });
for (const [name, v] of Object.entries(STILLS)) {
  const data = await page.evaluate((v) => { window.AER.renderFrame(v.frame, v); return window.AER.snapshot('image/webp', 0.8); }, v);
  await fs.writeFile(path.join(OUT, `${name}.webp`), Buffer.from(data.split(',')[1], 'base64'));
  console.log('wrote', name);
}
await browser.close();
server.close();
