// Path-traced bouquet photographs for "Encuentra tu ramo" and the shop cards,
// built from the same local rules as the site (src/lib/bouquets.js).
//
//   node scripts/render-bouquets.mjs [--set=results|collections|specimen|all]
//                                    [--only=amor-romantico,bodas] [--from=gratitud-silvestre]
//                                    [--samples=256] [--size=960x1200] [--out=public/images/ramos]
//                                    [--debug]  (browser logs and progress on stderr)
//
// Needs Edge or Chrome with a GPU; keep the computer from sleeping while it runs, or the
// GPU goes to sleep with it. The published images use --samples=512. Every image is CG.

import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import puppeteer from 'puppeteer-core';
import { EMOTIONS, STYLES, compose, artFor, ART } from '../src/lib/bouquets.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v = 'true'] = a.replace(/^--/, '').split('='); return [k, v]; }));
const SET = args.set ?? 'all';
const ONLY = args.only ? new Set(args.only.split(',')) : null;
const SAMPLES = Number(args.samples ?? 256);
const [W, H] = (args.size ?? '960x1200').split('x').map(Number);
const OUT = path.resolve(args.out ?? 'public/images/ramos');
const QUALITY = Number(args.quality ?? 0.86);

// ------------------------------------------------------------------ photo direction
const BG = { amor: '#efdcd8', gratitud: '#efe3d3', alegria: '#eee6d0', animo: '#dfe4e7', porquesi: '#e8e0e8' };
const TISSUE = { amor: '#f3d5d9', gratitud: '#f5e3d0', alegria: '#f6eacb', animo: '#e5eaef', porquesi: '#ebe1ef' };
const RIBBON = { amor: '#c7737f', gratitud: '#d39b74', alegria: '#e2ad45', animo: '#8ea3bf', porquesi: '#b296cf' };
// believable colours for each flower within the emotion's palette
const TINTS = {
  amor: { rosa: ['#e58fa6', '#b8435a', '#d97d95'], peonia: ['#f4c9d2', '#eeb2c0'], ranunculo: ['#f4c9d2', '#ebbcc4'], cala: ['#f1ebe1', '#8f3047'] },
  gratitud: { ranunculo: ['#f6c4a2', '#f0a882', '#f8d6bd'], margarita: ['#f6f2ea'], cala: ['#f6e7cf', '#f0b48e'] },
  alegria: { gerbera: ['#f2cf5b', '#f08a6b', '#e46f9a'], tulipan: ['#f2cf5b', '#f08a6b', '#e46f9a'], ranunculo: ['#f4c55f', '#f19a78'], cala: ['#f0cc58'] },
  animo: { anemona: ['#9fbcd8', '#f4f1ec', '#8697cf'], ranunculo: ['#f4f1ec', '#d2c6e8'], cala: ['#f4f1ec', '#b4a1d4'] },
  porquesi: { cosmos: ['#f2a3c3', '#c9afe0', '#f6eef2'], tulipan: ['#f2a3c3', '#c9afe0', '#c3d785'], ranunculo: ['#f2a3c3', '#e6c5e6'], cala: ['#c9afe0', '#f2a3c3'] },
};
const VESSEL = { silvestre: 'jar', romantico: 'tissue', minimalista: 'cylinder' };
// wrapped bouquets: a tight product crop with the tie just above the bottom edge
const WRAPPED = { crop: true, elev: 0.24, margin: 0.06 };

function result(e, s) {
  const p = compose({ emotion: e, style: s, size: 'abrazo' });
  const a = artFor(p);
  return {
    // a photographed bouquet shows only its front: a few more heads keep it as full as the real thing
    key: `${e}-${s}`, seed: a.seed, arrangement: a.arrangement, count: { dome: 12, wild: 12, line: 8 }[a.arrangement],
    // the wild style adds the "verdes de campo" its description promises
    flowers: a.flowers, fillers: s === 'silvestre' ? [...a.fillers, 'verde'] : a.fillers,
    colors: p.emotion.palette.map(([, hex]) => hex), tints: TINTS[e],
    vessel: VESSEL[s], bg: BG[e], paper: TISSUE[e], ribbon: RIBBON[e],
    camera: s === 'romantico' ? WRAPPED : {},
  };
}
const RESULTS = EMOTIONS.flatMap((e) => STYLES.map((s) => result(e.id, s.id)));

const C_TINTS = {
  temporada: { peonia: ['#f2b9a0', '#efc7c9'], ranunculo: ['#f2b48c', '#e9a07c'], margarita: ['#f6f2ea'], tulipan: ['#f2cf5b', '#f3c6b2'] },
  preservadas: { rosa: ['#c99f9c', '#b98f8e', '#d8c3a6'], ranunculo: ['#d8c3a6', '#c9a9a0'] },
  composiciones: { rosa: ['#f4c9d2', '#f3ece4'], peonia: ['#f4d7dc', '#f3ece4'], anemona: ['#f4f1ec'], ranunculo: ['#f6e7cf', '#f2d6d2'] },
  cumpleanos: { gerbera: ['#f2cf5b', '#f08a6b', '#e46f9a'], tulipan: ['#f08a6b', '#f2cf5b'], cosmos: ['#e46f9a', '#c9afe0'] },
  aniversarios: { rosa: ['#b8435a', '#a6344c', '#c95a6f'], peonia: ['#e58fa6', '#f4c9d2'] },
  bodas: { peonia: ['#f6f1ea', '#f4e4e2'], rosa: ['#f6f2ec', '#f3e7e1'], anemona: ['#f6f2ec'], cala: ['#f6f2ec'] },
  detalles: { tulipan: ['#e58fa6'], anemona: ['#f4f1ec'] },
};
const C_SETUP = {
  temporada: { vessel: 'kraft', bg: '#ece3d6', camera: { ...WRAPPED, margin: 0.1, zoom: 1.3 } },
  preservadas: { vessel: 'cloche', bg: '#e6ddd2', count: 11, stemLength: 0.2, camera: { elev: 0.1 } },
  composiciones: { vessel: 'tray', bg: '#ebe4da', count: 18, camera: { elev: 0.34, dist: 1.7, frame: 'heads', margin: 0.04, zoom: 0.62, dy: 0.02 } },
  cumpleanos: { vessel: 'jar', bg: '#efe6d1' },
  aniversarios: { vessel: 'tissue', bg: '#ecdcd8', paper: '#f1d4d8', ribbon: '#9e3a4d', camera: WRAPPED },
  // a round bridal bouquet framed in eucalyptus, with its satin-wrapped handle
  bodas: { vessel: 'ribbon', arrangement: 'dome', bg: '#ece6de', ribbon: '#f1ece2', count: 14, camera: { ...WRAPPED, elev: 0.2, below: 0.13 } },
  detalles: { vessel: 'bud', bg: '#ebe2e2', stemLength: 0.2, fillerCount: 2, camera: { elev: 0.12 } },
};
const COLLECTIONS = Object.entries(ART).map(([key, a]) => ({ key, ...a, tints: C_TINTS[key], ...C_SETUP[key] }));

const SPECIMEN = [
  { key: 'specimen-a', seed: 3, arrangement: 'specimen', count: 5, flowers: ['rosa', 'peonia', 'ranunculo', 'tulipan', 'anemona'], colors: ['#e58fa6', '#f4c9d2', '#f2b48c', '#f2cf5b', '#9fbcd8'], tints: { rosa: ['#e58fa6'], peonia: ['#f4c9d2'], ranunculo: ['#f2b48c'], tulipan: ['#f08a6b'], anemona: ['#9fbcd8'] }, bg: '#ece4d8', y: 0.3, camera: { elev: 0.3, margin: 0.06, fStop: 8 } },
  { key: 'specimen-b', seed: 5, arrangement: 'specimen', count: 4, flowers: ['cosmos', 'gerbera', 'margarita', 'cala'], colors: ['#f2a3c3'], tints: { cosmos: ['#f2a3c3'], gerbera: ['#f2cf5b'], margarita: ['#f6f2ea'], cala: ['#f1ebe1'] }, bg: '#ece4d8', y: 0.3, camera: { elev: 0.3, margin: 0.06, fStop: 8 } },
];

const sets = { results: RESULTS, collections: COLLECTIONS, specimen: SPECIMEN };
let jobs = SET === 'all' ? [...RESULTS, ...COLLECTIONS] : sets[SET] ?? [];
if (ONLY) jobs = [...RESULTS, ...COLLECTIONS, ...SPECIMEN].filter((j) => ONLY.has(j.key));
if (args.from) jobs = jobs.slice(Math.max(0, jobs.findIndex((j) => j.key === args.from))); // resume a long batch
if (!jobs.length) throw new Error('Nothing to render');
if (args.dump) { console.log(JSON.stringify(jobs, null, 1)); process.exit(0); }

// ------------------------------------------------------------------ render
const ROOT = path.resolve('.');
const BROWSERS = [process.env.BROWSER, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const executablePath = BROWSERS.find((p) => p && existsSync(p));
if (!executablePath) throw new Error('No Edge/Chrome found; set BROWSER=/path/to/browser');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] ?? 'application/octet-stream' });
  createReadStream(p).pipe(res);
}).listen(0);

const saveImages = (key, data, small) => Promise.all([
  fs.writeFile(path.join(OUT, `${key}.webp`), Buffer.from(data.split(',')[1], 'base64')),
  fs.writeFile(path.join(OUT, `${key}-sm.webp`), Buffer.from(small.split(',')[1], 'base64')),
]);
const checkpoints = new Map(); // key → samples already saved to disk

let browser, page;
async function open() {
  browser = await puppeteer.launch({
    executablePath, headless: 'new', protocolTimeout: 0, dumpio: !!args.debug,
    // a persistent profile keeps the compiled path-tracing shader between runs
    userDataDir: path.join(os.tmpdir(), 'aerflora-studio-profile'),
    // on laptops with two GPUs, use the discrete one (several times faster for path tracing)
    args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--force_high_performance_gpu', '--disable-gpu-watchdog', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', ...(args.debug ? ['--enable-logging=stderr', '--v=0'] : [])],
  });
  page = await browser.newPage();
  await page.exposeFunction('saveCheckpoint', async (key, samples, data, small) => { await saveImages(key, data, small); checkpoints.set(key, samples); });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  // tell a renderer crash from the whole browser going away
  page.on('error', (e) => console.error(`${new Date().toTimeString().slice(0, 8)} page crashed: ${e.message}`));
  browser.on('disconnected', () => console.error(`${new Date().toTimeString().slice(0, 8)} browser disconnected`));
  page.on('console', (m) => { if (m.type() === 'error' || args.debug) console.error('console:', m.text().slice(0, 300)); });
  await page.setViewport({ width: W, height: H });
  await page.goto(`http://localhost:${server.address().port}/scripts/scene3d/studio.html`);
  await page.waitForFunction('window.STUDIO && window.STUDIO.ready');
  await page.evaluate((w, h) => window.STUDIO.setup({ width: w, height: h }), W, H);
  if (!gpuName) { gpuName = await page.evaluate(() => window.STUDIO.gpu()); console.log(`GPU: ${gpuName}`); }
}
let gpuName = '';
await open();
await fs.mkdir(OUT, { recursive: true });
for (const [n, job] of jobs.entries()) {
  // a fresh browser every few images keeps GPU memory from piling up
  if (n && n % 3 === 0) { await browser.close().catch(() => {}); await open(); }
  for (let attempt = 1; ; attempt++) {
    const t = Date.now();
    try {
      // a stuck GPU never answers: give up after a generous time and start again with smaller tiles
      const timeout = Math.max(180000, SAMPLES * W * H * 0.004);
      const { info, data, small } = await Promise.race([page.evaluate(async (r, o) => {
        // the full image and a half-size copy for cards and phones
        const grab = () => {
          const src = document.querySelector('canvas'), c = document.createElement('canvas');
          c.width = Math.round(src.width / 2); c.height = Math.round(src.height / 2);
          const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height);
          return { data: window.STUDIO.snapshot('image/webp', o.quality), small: c.toDataURL('image/webp', o.quality) };
        };
        const onCheckpoint = async (s) => { const g = grab(); await window.saveCheckpoint(r.key, s, g.data, g.small); };
        const info = await window.STUDIO.render(r, { ...o, onCheckpoint });
        return { info, ...grab() };
      }, job, { samples: SAMPLES, quality: QUALITY, tile: attempt === 1 ? 240 : 120, every: 64 }), new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${Math.round(timeout / 1000)} s`)), timeout))]);
      await saveImages(job.key, data, small);
      console.log(`${job.key}: ${info.samples} samples, ${((Date.now() - t) / 1000).toFixed(1)} s, fov ${info.fov.toFixed(1)}°, focus ${info.focus.toFixed(2)} m`);
      break;
    } catch (e) {
      // the browser can go down on a long render: start a fresh one; keep a late checkpoint, or try again
      console.error(`${job.key}: ${e.message.split('\n')[0]} (attempt ${attempt})`);
      browser.process()?.kill('SIGKILL');
      await browser.close().catch(() => {});
      await open();
      const kept = checkpoints.get(job.key) ?? 0;
      if (kept >= SAMPLES * 0.75) { console.log(`${job.key}: kept the ${kept}-sample checkpoint`); break; }
      if (attempt >= 3) break;
    }
  }
}
await browser.close().catch(() => {});
server.close();
process.exit(0); // the browser's keep-alive sockets would otherwise hold the process open
