// Draws the current frame of a FrameSequence onto a canvas, cover-fitted
// around a focus point (the end of the aisle) so narrow screens crop the sides
// rather than the subject. It only paints when something actually changed and
// never clears the canvas without drawing a replacement, so there is no flash.

export class CanvasPainter {
  constructor(canvas, sequence, focus = { x: 0.5, y: 0.5 }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('canvas 2d unavailable');
    this.sequence = sequence;
    this.focus = focus;
    this.target = 0;
    this.drawn = -1;
    this.raf = 0;
    this.sizeKey = '';
    this.unsub = sequence.onFrame(() => this.request());
    this.resize();
  }

  setFrame(i) {
    this.target = Math.max(0, Math.min(this.sequence.count - 1, i));
    this.request();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { clientWidth: w, clientHeight: h } = this.canvas;
    const key = `${Math.round(w * dpr)}x${Math.round(h * dpr)}`;
    if (key === this.sizeKey) return;
    this.sizeKey = key;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.imageSmoothingQuality = 'high';
    this.drawn = -1; // resizing clears the bitmap: repaint immediately
    this.paint();
  }

  request() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.paint(); });
  }

  paint() {
    const idx = this.sequence.nearest(this.target);
    if (idx < 0 || idx === this.drawn) return;
    const img = this.sequence.images[idx];
    const cw = this.canvas.width, ch = this.canvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(cw / iw, ch / ih);
    const dw = iw * s, dh = ih * s;
    const dx = clamp(cw / 2 - this.focus.x * dw, cw - dw, 0);
    const dy = clamp(ch / 2 - this.focus.y * dh, ch - dh, 0);
    this.ctx.drawImage(img, dx, dy, dw, dh);
    this.drawn = idx;
    this.canvas.dataset.frame = idx; // lets QA scripts read the frame on screen
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.unsub();
  }
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
