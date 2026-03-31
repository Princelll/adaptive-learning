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

// Open book: two pages, spine in center, horizontal lines for text rows.
export function bookIconBytes(w = 40, h = 40): number[] {
  return renderIcon(w, h, (ctx, w, h) => {
    ctx.fillStyle = '#FFF';
    const lw   = Math.max(2, Math.round(w / 20));
    const cx   = Math.round(w / 2); // center spine x
    const padT = Math.round(h * 0.10);
    const padB = Math.round(h * 0.10);
    const padL = Math.round(w * 0.05);
    const padR = Math.round(w * 0.05);

    // Left page outline
    ctx.fillRect(padL, padT, cx - padL, lw);           // top
    ctx.fillRect(padL, padT, lw, h - padT - padB);     // left edge
    ctx.fillRect(padL, h - padB - lw, cx - padL, lw);  // bottom

    // Right page outline
    ctx.fillRect(cx, padT, w - cx - padR, lw);         // top
    ctx.fillRect(w - padR - lw, padT, lw, h - padT - padB); // right edge
    ctx.fillRect(cx, h - padB - lw, w - cx - padR, lw); // bottom

    // Spine (center line)
    ctx.fillRect(cx - lw, padT, lw * 2, h - padT - padB);

    // Text lines — left page
    const lineGap = Math.round((h - padT - padB) / 4);
    for (let i = 1; i <= 2; i++) {
      const ly = padT + lineGap * i;
      ctx.fillRect(padL + lw + 2, ly, cx - padL - lw - 4, lw);
    }
    // Text lines — right page
    for (let i = 1; i <= 2; i++) {
      const ly = padT + lineGap * i;
      ctx.fillRect(cx + lw + 2, ly, w - cx - padR - lw - 4, lw);
    }

    // Curved bottom (page curl) — two small arcs at bottom center
    ctx.beginPath();
    ctx.arc(cx, h - padB, Math.round(w * 0.08), 0, Math.PI);
    ctx.fill();
  });
}

// Globe / compass icon for "View Insights" list item.
export function globeIconBytes(w = 40, h = 40): number[] {
  return renderIcon(w, h, (ctx, w, h) => {
    ctx.fillStyle = '#FFF';
    const lw = Math.max(2, Math.round(w / 20));
    const cx = Math.round(w / 2);
    const cy = Math.round(h / 2);
    const r  = Math.round(Math.min(w, h) / 2) - lw;

    // Outer circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = lw;
    ctx.strokeStyle = '#FFF';
    ctx.stroke();

    // Horizontal equator line
    ctx.fillRect(cx - r, cy - Math.round(lw / 2), r * 2, lw);

    // Vertical meridian line
    ctx.fillRect(cx - Math.round(lw / 2), cy - r, lw, r * 2);

    // Ellipse arcs (longitude lines) using bezier curves
    // Left arc
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.bezierCurveTo(cx - Math.round(r * 0.6), cy - Math.round(r * 0.5),
                      cx - Math.round(r * 0.6), cy + Math.round(r * 0.5),
                      cx, cy + r);
    ctx.lineWidth = lw;
    ctx.stroke();
    // Right arc
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.bezierCurveTo(cx + Math.round(r * 0.6), cy - Math.round(r * 0.5),
                      cx + Math.round(r * 0.6), cy + Math.round(r * 0.5),
                      cx, cy + r);
    ctx.lineWidth = lw;
    ctx.stroke();
  });
}
