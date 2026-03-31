// ============================================================
// G2 Image Utilities
// Draws icons on an offscreen HTML Canvas and converts them
// to the grayscale byte format the G2 display uses.
//
// Format: row-major, 1 byte per pixel (R channel, 0–255).
// The G2 firmware converts this to 4-bit grayscale internally.
// Use 0 = black (off), 255 = white (lit/green on glasses).
// Total bytes = width × height.
// ============================================================

/**
 * Convert an already-drawn canvas to grayscale bytes (1 byte per pixel).
 * Pixels with R > 127 are treated as "lit" (255); others as 0.
 */
export function canvasToGrayscale(canvas: HTMLCanvasElement): number[] {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const bytes: number[] = new Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = imageData.data[i * 4]; // R channel
    bytes[i] = r > 127 ? 255 : 0;
  }
  return bytes;
}

/**
 * Render a function onto an offscreen canvas and return grayscale bytes.
 * drawFn should use ctx.fillStyle = '#FFF' for lit pixels.
 * Background is automatically cleared to black first.
 */
export function renderIcon(
  width: number,
  height: number,
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): number[] {
  const canvas = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  drawFn(ctx, width, height);
  return canvasToGrayscale(canvas);
}

// ── Bed icon ─────────────────────────────────────────────────
// Used on the sleep check-in screen.
// Designed for 128 × 80 pixels (scalable).

export function bedIconBytes(w = 128, h = 80): number[] {
  return renderIcon(w, h, (ctx, w, h) => {
    ctx.fillStyle = '#FFF';

    const lw = Math.max(2, Math.round(w / 40)); // line width scales with icon size

    // ── Bed frame (outline rectangle) ────────────────────
    const bx = Math.round(w * 0.22), by = Math.round(h * 0.42);
    const bw = w - Math.round(w * 0.22) - Math.round(w * 0.03);
    const bh = Math.round(h * 0.42);
    ctx.fillRect(bx, by, bw, lw);              // top rail
    ctx.fillRect(bx, by + bh - lw, bw, lw);   // bottom rail
    ctx.fillRect(bx, by, lw, bh);              // left leg
    ctx.fillRect(bx + bw - lw, by, lw, bh);   // right leg

    // ── Headboard (left side, taller than bed frame) ─────
    const hbx = Math.round(w * 0.03);
    const hby = Math.round(h * 0.22);
    const hbw = Math.round(w * 0.20);
    const hbh = h - hby - Math.round(h * 0.05);
    ctx.fillRect(hbx, hby, hbw, lw);          // top of headboard
    ctx.fillRect(hbx, hby, lw, hbh);          // left edge
    ctx.fillRect(hbx + hbw - lw, hby, lw, hbh); // right edge
    ctx.fillRect(hbx, hby + hbh - lw, hbw, lw); // bottom

    // ── Pillow ────────────────────────────────────────────
    const px = bx + lw + Math.round(w * 0.03);
    const py = by + Math.round(h * 0.06);
    const pw = Math.round(w * 0.18);
    const ph = Math.round(h * 0.16);
    ctx.fillRect(px, py, pw, ph);

    // ── Sleeping person ───────────────────────────────────
    // Head (circle)
    const headR = Math.round(w * 0.07);
    const headX = px + pw + headR + Math.round(w * 0.03);
    const headY = by + Math.round(bh * 0.35);
    ctx.beginPath();
    ctx.arc(headX, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Body (rect under blanket line)
    const bodyX = px + pw + Math.round(w * 0.02);
    const bodyY = headY + Math.round(h * 0.05);
    const bodyW = w - bodyX - Math.round(w * 0.05);
    const bodyH = Math.round(h * 0.12);
    ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

    // Blanket fold line
    ctx.fillRect(bx + Math.round(w * 0.03), by + Math.round(bh * 0.45), bw - Math.round(w * 0.06), lw);
  });
}

// ── Book icon ─────────────────────────────────────────────────
// Used on the welcome screen "Continue Studying" item.

export function bookIconBytes(w = 24, h = 20): number[] {
  return renderIcon(w, h, (ctx, w, h) => {
    ctx.fillStyle = '#FFF';
    const lw = 2;

    // Spine (left edge)
    ctx.fillRect(0, 0, lw, h);

    // Cover (outline)
    ctx.fillRect(0, 0, w, lw);          // top
    ctx.fillRect(0, h - lw, w, lw);     // bottom
    ctx.fillRect(w - lw, 0, lw, h);     // right

    // Pages (two lines inside)
    ctx.fillRect(4, Math.round(h * 0.3), w - 6, lw);
    ctx.fillRect(4, Math.round(h * 0.6), w - 6, lw);
  });
}
