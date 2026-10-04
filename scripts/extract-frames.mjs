// Converts the final footage into the frame sequence used by the site.
//
//   npm run frames:extract -- path/to/aerflora.mp4 [options]
//
// Options
//   --frames 144            number of frames to keep (evenly resampled)
//   --portrait path.mp4     optional vertical (9:16) render of the same shot;
//                           otherwise the portrait set is centre-cropped
//   --focus-x 0.5           horizontal focus used for the portrait crop
//   --arrive 95 --open-start 99 --open-end 132
//                           frame indices of the key moments (texts sync to
//                           these). Defaults scale the current manifest.
//
// Writes public/frames/{lg,sm,portrait}/0001.webp…, posters and manifest.json.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';

const argv = process.argv.slice(2);
const input = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
if (!input) {
  console.error('usage: npm run frames:extract -- <video> [--frames 144] [--portrait <video>]');
  process.exit(1);
}

const OUT = path.resolve('public/frames');
const FRAMES = Number(opt('frames', 144));
const focusX = Number(opt('focus-x', 0.5));
const portraitInput = opt('portrait');

function duration(file) {
  try {
    execFileSync(ffmpeg, ['-hide_banner', '-i', file], { stdio: 'pipe' });
  } catch (e) {
    const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(String(e.stderr));
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  throw new Error(`could not read duration of ${file}`);
}

function run(file, filter, dir, quality) {
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', file,
    '-vf', filter, '-frames:v', String(FRAMES),
    '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '6',
    path.join(OUT, dir, '%04d.webp'),
  ], { stdio: 'inherit' });
}

const prev = await fs.readFile(path.join(OUT, 'manifest.json'), 'utf8').then(JSON.parse).catch(() => null);
const scale = (k, d) => Math.round(((prev?.markers?.[k] ?? d * (FRAMES - 1)) / ((prev?.frameCount ?? FRAMES) - 1)) * (FRAMES - 1));
const markers = {
  arrive: Number(opt('arrive', scale('arrive', 0.66))),
  doorOpenStart: Number(opt('open-start', scale('doorOpenStart', 0.69))),
  doorOpenEnd: Number(opt('open-end', scale('doorOpenEnd', 0.92))),
};

await fs.rm(OUT, { recursive: true, force: true });
for (const d of ['lg', 'sm', 'portrait']) await fs.mkdir(path.join(OUT, d), { recursive: true });

const fps = (FRAMES / duration(input)).toFixed(4);
console.log(`resampling to ${FRAMES} frames (${fps} fps)…`);
run(input, `fps=${fps},scale=1600:900:force_original_aspect_ratio=increase,crop=1600:900`, 'lg', 80);
run(input, `fps=${fps},scale=960:540:force_original_aspect_ratio=increase,crop=960:540`, 'sm', 76);
if (portraitInput) {
  const pfps = (FRAMES / duration(portraitInput)).toFixed(4);
  run(portraitInput, `fps=${pfps},scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280`, 'portrait', 78);
} else {
  run(input, `fps=${fps},scale=-2:1280,crop=720:1280:(in_w-720)*${focusX}:0`, 'portrait', 78);
}

const count = (await fs.readdir(path.join(OUT, 'lg'))).length;
const last = String(count).padStart(4, '0');
for (const [name, set, n] of [
  ['poster.webp', 'lg', '0001'], ['poster-end.webp', 'lg', last],
  ['poster-portrait.webp', 'portrait', '0001'], ['poster-end-portrait.webp', 'portrait', last],
]) await fs.copyFile(path.join(OUT, set, `${n}.webp`), path.join(OUT, name));

const manifest = {
  provisional: false,
  frameCount: count,
  pad: 4,
  sets: [
    { name: 'lg', width: 1600, height: 900, path: 'lg/{i}.webp' },
    { name: 'sm', width: 960, height: 540, path: 'sm/{i}.webp' },
    { name: 'portrait', width: 720, height: 1280, path: 'portrait/{i}.webp' },
  ],
  posters: { start: 'poster.webp', end: 'poster-end.webp', startPortrait: 'poster-portrait.webp', endPortrait: 'poster-end-portrait.webp' },
  focus: { x: focusX, y: 0.47 },
  markers,
  rows: prev?.rows ?? [32, 10],
};
await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`done: ${count} frames, markers ${JSON.stringify(markers)}`);
