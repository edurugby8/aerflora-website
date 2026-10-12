// Share preview (1200×630) and home-screen icon (180×180) made from the site's
// own pictures: the open cabin door and the blossom of the favicon.
//
//   node scripts/render-share.mjs
//
// Writes public/og-image.jpg and public/apple-touch-icon.png.

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const BROWSERS = [process.env.BROWSER, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const executablePath = BROWSERS.find((p) => p && existsSync(p));
if (!executablePath) throw new Error('No Edge/Chrome found; set BROWSER=/path/to/browser');

const dataUri = async (file, type) => `data:${type};base64,${(await fs.readFile(path.resolve(file))).toString('base64')}`;
const door = await dataUri('public/frames/poster-end.webp', 'image/webp');
const bouquet = await dataUri('public/images/ramos/amor-romantico-sm.webp', 'image/webp');
const icon = await fs.readFile(path.resolve('public/favicon.svg'), 'utf8');
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@500&display=swap">';

const og = `<!doctype html><html><head>${fonts}<style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#1f271b}
  .bg{position:absolute;inset:0;background:url(${door}) center 46%/cover}
  .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(22,27,18,.86) 0%,rgba(22,27,18,.55) 46%,rgba(22,27,18,.05) 72%)}
  .copy{position:absolute;left:72px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center;color:#f6f0e4}
  .eyebrow{font:500 15px 'IBM Plex Mono',monospace;letter-spacing:.2em;text-transform:uppercase;color:rgba(246,240,228,.8)}
  .brand{font:400 104px/1 'Instrument Serif',Georgia,serif;margin:18px 0 10px;letter-spacing:-.01em}
  .line{font:italic 400 40px/1.15 'Instrument Serif',Georgia,serif;color:#f3d7dd}
  .card{position:absolute;right:80px;top:72px;width:300px;height:375px;border-radius:22px;overflow:hidden;box-shadow:0 30px 60px -20px rgba(0,0,0,.6);border:6px solid #fbf8f2}
  .card img{width:100%;height:100%;object-fit:cover}
</style></head><body><div class="bg"></div><div class="shade"></div>
<div class="copy"><p class="eyebrow">Floristería · Demo</p><p class="brand">Aerflora</p><p class="line">Siempre hay una razón para florecer.</p></div>
<div class="card"><img src="${bouquet}" alt=""></div></body></html>`;

const touch = `<!doctype html><html><body style="margin:0;width:180px;height:180px;overflow:hidden;background:#5e6a46">
${icon.replace('<svg ', '<svg width="180" height="180" ').replace('rx="15"', 'rx="0"')}</body></html>`;

const browser = await puppeteer.launch({ executablePath, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630 });
await page.setContent(og, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'public/og-image.jpg', type: 'jpeg', quality: 86 });
await page.setViewport({ width: 180, height: 180 });
await page.setContent(touch);
await page.screenshot({ path: 'public/apple-touch-icon.png', type: 'png' });
await browser.close();
console.log('wrote public/og-image.jpg and public/apple-touch-icon.png');
