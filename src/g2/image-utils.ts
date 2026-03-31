// ============================================================
// G2 Image Utilities
// Draws icons on an offscreen HTML Canvas and encodes them
// as PNG bytes for the G2 simulator's image decoder.
//
// The Even Hub simulator uses Rust's image crate internally,
// which requires a properly-encoded image format (PNG/JPEG/etc.)
// with a file header — raw pixel buffers are not accepted.
// On real G2 hardware the firmware converts to 4-bit grayscale,
// but the toDataURL('image/png') path satisfies both paths.
// ============================================================

/**
 * Convert an already-drawn canvas to PNG bytes.
 * Returns the full PNG file as a number[] (byte values 0-255).
 */
export function canvasToPngBytes(canvas: HTMLCanvasElement): number[] {
  const dataUrl = canvas.toDataURL('image/png');
  const base64  = dataUrl.split(',')[1];
  const binary  = atob(base64);
  const bytes   = new Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** @deprecated Use canvasToPngBytes — raw grayscale bytes are rejected by the simulator. */
export function canvasToGrayscale(canvas: HTMLCanvasElement): number[] {
  return canvasToPngBytes(canvas);
}

/**
 * Render a function onto an offscreen canvas and return PNG bytes.
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
  return canvasToPngBytes(canvas);
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

// ── BMP-derived icons (from user-uploaded public/icons/*.bmp) ────────────
// Pixel data decoded from 49×40 24-bit BMPs at threshold >5 brightness.
// Each byte is 255 (lit) or 0 (off). Width=49, Height=40.

function decodeBmpB64(b64: string): number[] {
  const bin = atob(b64);
  const bytes: number[] = new Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const BOOK_BMP_B64 =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA////////////' +
  '//////8AAAAAAAAA//////////////////8AAAAAAAAAAAAAAAAA////////////////////////' +
  '//////////////////////////8AAAAAAAAAAP///////wAAAAAAAAAAAAAA/////////////wAA' +
  'AAAAAAAAAAAA////////AAAAAP////////8AAAAAAAAAAAAAAAD//////////wAAAAAAAAAAAAAA' +
  'AP////////8AAP//////////AAAAAAAAAAAAAAAAAAD///8AAAAAAAAAAAAAAAAAAAD/////////' +
  '/wD///8AAP///wAAAP//////////AAAA////AAAA////////////AAAA////AAD///8A////AAD/' +
  '//8AAP////////////8AAP///wAA//////////////8AAP///wAA////AP///wAA////AP//////' +
  '////////AAD///8AAP//////////////AAD///8AAP///wD///8AAP///wAAAAAAAAAAAAAAAAAA' +
  '////AAAAAAAAAAAAAAAAAAAA////AAD///8A////AAD///8A//////////////8AAP///wAAAP//' +
  '/////////wAAAP///wAA////AP///wAA////AP//////////////AAD///8AAP//////////////' +
  'AAD///8AAP///wD///8AAP///wD//////////////wAA////AAD//////////////wAA////AAD/' +
  '//8A////AAD///8AAAAAAAAAAAAAAAAAAP///wAAAAAAAAAAAAAAAAAAAP///wAA////AP///wAA' +
  '////AAAAAAAAAAAAAAAAAAD///8AAAAAAAAAAAAAAAAAAAD///8AAP///wD///8AAP///wD/////' +
  '/////////wAA////AAD//////////////wAA////AAD///8A////AAD///8A//////////////8A' +
  'AP///wAA//////////////8AAP///wAA////AP///wAA////AAD///////////8AAAD///8AAAD/' +
  '////////////AAD///8AAP///wD///8AAP///wAAAAAAAAAAAAAAAAAA////AAAAAAAAAAAAAAAA' +
  'AAAA////AAD///8A////AAD///8A//////////////8AAP///wAA//////////////8AAP///wAA' +
  '////AP///wAA////AP//////////////AAD///8AAP//////////////AAD///8AAP///wD///8A' +
  'AP///wD//////////////wAA////AAAA/////////////wAA////AAD///8A////AAD///8AAAAA' +
  'AAAAAAAAAAAAAP///wAAAAAAAAAAAAAAAAAAAP///wAA////AP///wAA////AAAAAAAAAAAAAAAA' +
  'AAD///8AAAAAAAAAAAAAAAAAAAD///8AAP///wD///8AAP///wAAAAAAAAAAAAAAAAAA////AAAA' +
  'AAAAAAAAAAAAAAAA////AAD///8A////AAD///8AAAAAAAAAAAAAAAAAAP///wAAAAAAAAAAAAAAAA' +
  'AAAP///wAA////AP///wAA////AAAAAAAAAAAAAAAAAAD///8AAAAAAAAAAAAAAAAAAAD///8AAP' +
  '///wD///8AAP///wAAAAAAAAAAAAAAAAAA////AAAAAAAAAAAAAAAAAAAA////AAD///8A////AA' +
  'D/////////////////AAAAAP///wAAAAAA/////////////////wAA////AP///wAA///////////' +
  '///////////////8A//////////////////////8AAP///wD///8AAP//////////////////////////' +
  '//////////////////////AAD///8A////AAD/////AAAAAAAAAAD//////////////////wAAAAAAAAAA' +
  '/////wAA////AP///wAAAAAAAAAAAAAAAAAAAAAA//////////8AAAAAAAAAAAAAAAAAAAAAAP///wD/////' +
  '/////////////////////wAAAP//AAD///////////////////////////8A/////////////////////'+
  '////////wAAAAD/////////////////////////////AP///////////////////////////////////////////'+
  '////////////////////wAAAAAAAAAAAAAAAAAAAAAAAAA/////////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAD//////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

const GLOBE_BMP_B64 =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAA//////8AAAAA////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/' +
  '/////////wAA//////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////AAAA////' +
  '/////wAAAP////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////AAAAAAD/////AAAAAAAA' +
  '/////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA////////AAAAAAAAAP///wAAAAAAAP////////8A' +
  'AAAAAAAAAAAAAAAAAAAAAAAA/////////wAAAP//AAD///8AAAAAAAD//////////wAAAAAAAAAA' +
  'AAAAAAAAAAAA////AAAA//////////8A////AAAAAAD//wD//wAA////AAAAAAAAAAAAAAAAAAAA' +
  'AP//AAAAAP///////////////wAAAP//////////AAD//wAAAAAAAAAAAAAAAAAAAP///wAAAAD/' +
  'AAD//////////////////////wD/AAAA////AAAAAAAAAAAAAAAAAP///////wD//wD///8A//8A' +
  '////////////AAAAAAAA//////8AAAAAAAAAAAAAAP///wAA//////////8AAP//AP///wD/////' +
  '////AAAA//8AAP//AAAAAAAAAAAAAAD//wAAAAAA/////wAAAAD//wD//////////wD///8AAP//' +
  'AAD///8AAAAAAAAAAAAA//8AAAAA////////AAAAAP///////wAA//8AAAD//////wAAAP//AAAA' +
  'AAAAAAAAAP//AP///////////////wD//////wAAAP//AAAAAP//////AAD//wAAAAAAAAAAAAD/' +
  '/////wAA/////wAA//////////8AAAD//wAAAP////////////8AAAAAAAAAAAD//////wAAAP//' +
  '//8AAAAA////////AAAA//8AAP///wD/AAAA/////wAAAAAAAAD///8AAP//AP//AAD//wAAAP//' +
  '////////AP//AP//AAAA//8AAAAA////AAAAAAAA//8AAAAA/////wAA//8AAAD//wD/////////' +
  '////AAAAAP//AAAAAAD//wAAAAAAAP//AAAAAP////8AAP//AAD//wAA////AAD/////AAAAAAAA' +
  '/wAAAAAA//8AAAAAAAD//wD/////////AAAA/////wAAAP///wD/////////AAAAAP//AAAAAP//' +
  'AAAAAAAA//8A////////////AP////8AAAD///////////////////////8AAAD//wAAAAAAAP//' +
  'AP//////////////////////////AAD//wD//wAA////////AAAA//8AAAAAAAD///8A//8AAAAA' +
  'AAD/////////AP///wD//wAA//8AAAAA//////8A////AAAAAAAAAP////8AAAAAAAAA//////8A' +
  'AAD///////8AAAD//wAAAP//AP//////AAAAAAAAAAAA////AAAAAAAA////AAD///8A//////8A' +
  'AAAAAP//AP//AAAA////AAAAAAAAAAAAAP//AAAAAAAA//8AAAAAAP////////8AAAAAAAD/////' +
  '/wAAAAD//wAAAAAAAAAAAAD//wAAAAD///8AAAAAAAAAAP///////////wAA/////wAAAAAA//8A' +
  'AAAAAAAAAAAA////AAAA////AAAAAAAAAAAA//////////8AAP////8AAAAA////AAAAAAAAAAAA' +
  'AAD///8AAP//AP////8AAAAAAP///wAA////////////AAAA////AAAAAAAAAAAAAAAAAP///wAA' +
  '/////wD///8AAAD///8AAAAAAAD/////AAD/////AAAAAAAAAAAAAAAAAAAA////////AAAAAP//' +
  '/wAA////AAAAAAAAAAD/////////AAAAAAAAAAAAAAAAAAAAAAD/////AAAAAAAA/wAAAP///wAA' +
  'AAAAAAAAAP////8AAAAAAAAAAAAAAAAAAAAAAAAAAAD///8AAAAAAAAAAAD///8AAAAAAAAAAAD/' +
  '/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//AAAAAAAAAAD//////wAAAAAAAAD///8AAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAD/////AAAAAP//////////AAAAAP////8AAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAP////////////8AAP//////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAP////////8AAAAA//////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA////' +
  '//8AAAAAAAD///////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

/** Book icon from user BMP (49×40 px). */
export function bookIconBytesFromBmp(): { w: number; h: number; pixels: number[] } {
  return { w: 49, h: 40, pixels: decodeBmpB64(BOOK_BMP_B64) };
}

/** Globe icon from user BMP (49×40 px). */
export function globeIconBytesFromBmp(): { w: number; h: number; pixels: number[] } {
  return { w: 49, h: 40, pixels: decodeBmpB64(GLOBE_BMP_B64) };
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
