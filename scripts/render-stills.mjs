// Renders the still images used by the shop sections (collections,
// occasions, about, contact) from the same 3D scene as the journey, as
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
  'ramos-temporada': { frame: 0, pos: [0.3, 0.6, D - 1.0], look: [0.95, 0.35, D - 0.4], fov: 36, focus: 0.85, aperture: 0.007 },
  'flores-preservadas': { frame: 0, pos: [0.45, 1.52, 6.3], look: [1.07, 1.6, 7.0], fov: 34, focus: 0.95, aperture: 0.007 },
  'composiciones-especiales': { frame: 0, pos: [-0.1, 1.25, D - 1.3], look: [0.8, 1.05, D - 0.15], fov: 36, focus: 1.4, aperture: 0.006 },
  cumpleanos: { frame: 0, pos: [0, 1.55, 3.9], look: [0.3, 2.2, 4.6], fov: 40, focus: 1.0, aperture: 0.006 },
  aniversarios: { frame: 0, pos: [-0.2, 1.5, D - 1.25], look: [-0.72, 1.95, D - 0.1], fov: 36, focus: 1.2, aperture: 0.006 },
  bodas: { frame: N - 1, pos: [0, 1.45, D - 6], look: [0, 1.3, D], fov: 45, focus: 5, aperture: 0.002 },
  detalles: { frame: 0, pos: [-0.3, 0.55, D - 1.0], look: [-0.9, 0.3, D - 0.4], fov: 36, focus: 0.85, aperture: 0.007 },
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
