// Progressive loader for an image sequence.
//
// Frames are requested coarse-to-fine (every 16th, then 8th, 4th, 2nd, all) so
// the whole journey can be scrubbed early at low temporal resolution while the
// in-between frames stream in. Until a frame arrives the nearest loaded one is
// drawn, so the canvas never shows a gap.

const PASSES = [16, 8, 4, 2, 1];

export class FrameSequence {
  constructor({ count, urlFor, concurrency = 6 }) {
    this.count = count;
    this.urlFor = urlFor;
    this.concurrency = concurrency;
    this.images = new Array(count).fill(null);
    this.failed = new Uint8Array(count);
    this.loadedCount = 0;
    this.listeners = new Set();
    this.aborted = false;
    this.order = buildOrder(count);
    // the first coarse pass (every 8th frame + both ends) must load before reveal
    this.essential = new Set(this.order.slice(0, essentialCount(count)));
  }

  onFrame(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /**
   * Starts loading. Resolves once the essential frames are in (or rejects if
   * too many of them failed). Remaining frames keep loading afterwards.
   */
  load(onProgress) {
    let essentialDone = 0, essentialFailed = 0;
    const essentialTotal = this.essential.size;
    let cursor = 0;

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = () => {
        if (settled || essentialDone + essentialFailed < essentialTotal) return;
        settled = true;
        if (essentialFailed > essentialTotal * 0.2 || !this.images[0]) reject(new Error('frame sequence unavailable'));
        else resolve();
      };

      const next = () => {
        if (this.aborted || cursor >= this.order.length) return;
        const i = this.order[cursor++];
        const img = new Image();
        img.decoding = 'async';
        img.src = this.urlFor(i);
        img.decode()
          .then(() => {
            if (this.aborted) return;
            this.images[i] = img;
            this.loadedCount++;
            if (this.essential.has(i)) essentialDone++;
            this.listeners.forEach((fn) => fn(i));
          })
          .catch(() => {
            this.failed[i] = 1;
            if (this.essential.has(i)) essentialFailed++;
          })
          .finally(() => {
            onProgress?.({
              essential: essentialDone / essentialTotal,
              total: this.loadedCount / this.count,
            });
            settle();
            next();
          });
      };
      for (let k = 0; k < this.concurrency; k++) next();
    });
  }

  /** Nearest loaded frame to `i` (prefers the earlier one on ties). */
  nearest(i) {
    if (this.images[i]) return i;
    for (let d = 1; d < this.count; d++) {
      if (i - d >= 0 && this.images[i - d]) return i - d;
      if (i + d < this.count && this.images[i + d]) return i + d;
    }
    return -1;
  }

  dispose() {
    this.aborted = true;
    this.listeners.clear();
    this.images.fill(null);
  }
}

function buildOrder(count) {
  const seen = new Uint8Array(count);
  const order = [];
  const push = (i) => { if (!seen[i]) { seen[i] = 1; order.push(i); } };
  push(0);
  push(count - 1);
  for (const step of PASSES) for (let i = 0; i < count; i += step) push(i);
  return order;
}

function essentialCount(count) {
  // ends + every 8th frame (covers passes 16 and 8)
  const seen = new Set([0, count - 1]);
  for (let i = 0; i < count; i += 8) seen.add(i);
  return seen.size;
}
