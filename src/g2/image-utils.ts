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

import { ImageContainerProperty } from '@evenrealities/even_hub_sdk';

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

// User-supplied bed icon PNG (100×80) — embedded as base64.
const BED_ICON_PNG_B64 =
  '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';
/** User-supplied bed icon as PNG bytes (40×32, ready for G2 imageData). */
export function userBedIconPngBytes(): number[] {
  return decodeBmpB64(BED_ICON_PNG_B64);
}

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

// ── Sleep column images ───────────────────────────────────────
// One 95×110 image per column (bars + selection ring only).
// Labels are rendered as SDK text containers so they match the G2 font.
// Each image is well within the 288×144 SDK limit.

export function sleepColumnBytes(colIdx: number, selected: boolean, w = 95, h = 110): number[] {
  const nBars = colIdx + 1;
  const barW  = w - 10;   // 5 px margin each side
  const barH  = 18;
  const gap   = 8;
  const barsBottom = h - 4;
  const r     = Math.round(barH * 0.45);

  return renderIcon(w, h, (ctx, w, h) => {
    ctx.fillStyle = '#FFF';

    // Bars — stacked from barsBottom upward
    for (let bar = 0; bar < nBars; bar++) {
      const y = barsBottom - (bar + 1) * (barH + gap) + gap;
      const x = 5;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + barW - r, y);
      ctx.arcTo(x + barW, y,        x + barW, y + r,        r);
      ctx.lineTo(x + barW, y + barH - r);
      ctx.arcTo(x + barW, y + barH, x + barW - r, y + barH, r);
      ctx.lineTo(x + r,   y + barH);
      ctx.arcTo(x,        y + barH, x, y + barH - r,        r);
      ctx.lineTo(x,        y + r);
      ctx.arcTo(x,        y,        x + r, y,               r);
      ctx.closePath();
      ctx.fill();
    }

    // Selection ring — rounded rectangle outline around entire column
    if (selected) {
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      const pad = 2, rr = 8;
      const sx = pad, sy = pad, sw = w - 2 * pad, sh = h - 2 * pad;
      ctx.beginPath();
      ctx.moveTo(sx + rr, sy);
      ctx.lineTo(sx + sw - rr, sy);
      ctx.arcTo(sx + sw, sy,      sx + sw, sy + rr,      rr);
      ctx.lineTo(sx + sw, sy + sh - rr);
      ctx.arcTo(sx + sw, sy + sh, sx + sw - rr, sy + sh, rr);
      ctx.lineTo(sx + rr, sy + sh);
      ctx.arcTo(sx,       sy + sh, sx, sy + sh - rr,     rr);
      ctx.lineTo(sx,       sy + rr);
      ctx.arcTo(sx,       sy,      sx + rr, sy,           rr);
      ctx.closePath();
      ctx.stroke();
    }
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

// User-supplied book icon PNG (25×20, RGBA) — embedded to avoid Vite/even-dev path issues.
const BOOK_ICON_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAABkAAAAUCAYAAAB4d5a9AAAAAXNSR0IArs4c6QAAAARnQU1BAACx' +
  'jwv8YQUAAAAJcEhZcwAADsQAAA7EAZUrDhsAAAOHSURBVEhLrZXLK7xfHMdfh2HGdeSSu2zk9ihS' +
  'k8Q/IZJCiZTUZGFhoVzKhiwUKxslZSNmY6FcSrJwyW3MTJMm8yjKbZSZMcmc7+LL0zwzvptfv3e9' +
  '6zmf8zrncz7n0iMACZCens7MzAyNjY38psXFRY6Ojjg7O6Ouro7a2lp6e3tJTEyMRtnf32dhYQG7' +
  '3Q6AyMrKkmVlZdTU1GC1Wunv7ycUCkWPo6+vD0VRMBqNZGZmoqoqs7Oz3N/fR6O0trZisVgYHR3F' +
  '7/fDxsaGvL6+lk6nUx4fH0uTySS/q4txYWGhdLvd0mKxxPRFur+/X768vMiTkxPp8XikoaKigo6O' +
  'DpKSkpidncVgMNDZ2UlzczMAQgiklMzPz/P8/EwoFMLj8WA2mxkeHiY3N1er4O3tjfHxcQC2trbo' +
  '6upifX2dOCklPwZISUkhNzcXVVVRVRWv14uqqgSDQW0ygNLSUoLBILe3t3i9XrxeL3d3d4TDYQDd' +
  'nHG6kUA4HMbv9/P+/q7z19eXjnM4HNzd3enYQCCgTRwpXRIhBImJiVRVVVFTU6NZURTS09MjUerr' +
  '62lqakJRFM3l5eXEx8cjhNCxhsiGlJLn52esVmtkWFNBQYH2fXh4yOHhoa7/X4rZroyMDFZWVri8' +
  'vNS8t7dHZWWljrNYLBwcHOi4nZ0dzGazjiO6EgCfz8fIyAglJSVa7PX1FafTSX5+vhY7OjpiYGCA' +
  'tLQ07QaGQqG/7yJKMUmys7MZGxsjNTVVF5+enubh4UFrK4rC0NAQycnJWszn8zE8PAzf5/ujmCQf' +
  'Hx/s7u5iNBq1mJSSx8dHHWe327HZbGRlZWmxQCDA5+enjuMnyc+1E0Lg9/tZWVmJ5iDq4MPhMDab' +
  'Tdf/L+kOPvIB/Z+Ki9w7IUTMHf8vil6s7kyqq6txOBxIKbVk4XCY5eVlPB4PNzc3fwcZDLS0tJCR' +
  'kUFPTw/FxcXaHFJKUlNT2d7e1mIGvit4enrCZrOxubnJ6empBggh6O7upr29HUVRyMnJYWdnh6+v' +
  'L87Pz5mcnERVVY03Go0MDg5ydXWlVSRcLpecm5vD7XZr9z1aQghcLhdFRUU0NDRwdXVFIBDAZDLp' +
  'uMixP1s/MTGBWFtbk4WFhTr4B4rU09MTq6urXFxckJCQwNTUFHl5eQSDwV8XF7ndRP9w/uW2tjZ5' +
  'dnYmr6+vpd1ul0tLS9JsNsdwv/kPMonUIuIEPgsAAAAASUVORK5CYII=';
/** User-supplied book icon as PNG bytes (25×20, ready for G2 imageData). */
export function userBookIconPngBytes(): number[] {
  return decodeBmpB64(BOOK_ICON_PNG_B64);
}

/** Globe icon from user BMP (49×40 px). */
export function globeIconBytesFromBmp(): { w: number; h: number; pixels: number[] } {
  return { w: 49, h: 40, pixels: decodeBmpB64(GLOBE_BMP_B64) };
}

// User-supplied insights icon PNG (21×20, RGBA) — embedded as base64.
const INSIGHTS_ICON_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAABUAAAAUCAYAAABiS3YzAAAAAXNSR0IArs4c6QAAAARnQU1BAACx' +
  'jwv8YQUAAAAJcEhZcwAADsQAAA7EAZUrDhsAAAQeSURBVDhPrZRbiJVVFMd/+/Ldzncuc+amM+MN' +
  'xxulNiBTQiiSBN3tAgWVZJD50ksqJGgQ9VZREPQwZY+BQUEQ0UNRJGp3KbELk6GZpTOMzuWcOdfv' +
  '26uHr5nU6q0N+2Ev1vrzX2v//0sBwv981H+BFm60RGsMWEUy7ph8v0X3QwGorKj6ZULtZHp12fyR' +
  '+asRXVDS82ggvY8FogJE+ciCXYGseqcg5W2eYBGdUzJwIJLO+33RMYK6DANknqkKoWd7AALhCsMf' +
  'L9aRFphiRm3ZyzGnHqniZgUUFLdY4iGLawjJpHDp7RaSZCz1HN3C9ZbmGcf4wSbTH7fJD1sWP5dj' +
  '9bsF4utM1jOgC9Bxi4e2Cq9bM/1JgjQhWGnmoDLQ6FpDz44QE4POQXJRqH2fMvNpm7GRBsm0YMua' +
  '0laPRftzDL6eJ60LZ5+u0fgpxTWF/r0h/uKMo9I5pHdnyPjBBigo3eTT/YDPhZEGlWMJ0aBGx5qB' +
  'AxHnX6ijIvC6NK3zjnRaMloOmr87erYHjL3aQOtQ0b7g0IEit9bgL1L4SzRejyZeb0jr2fzmgCqH' +
  'ExqjjsqRBFNSXPNhidyQAQfplKAsaH9AE2+wdN7nUx91VL9IOLN7lpnDbZq/OYqbLf17I3RBzX8E' +
  'gCmBCuDs/lnqP6TEQ4bcOoPXp6FvTyimrMSWlcTDRko3W1ERkt9oBZB42Ehhk5XV7xUlf4OVjjs8' +
  '6dsTSXGTFeUjpoDkh7Ncr1fLwidC0W5GMHlFsFKz7KU8ndt8aIPSEA5qpA7NMw4SSCYc0SrDgl0B' +
  'osCWVSa7LoWOoD3hcDVB66LC5MBfqBkbaTBxqEV+o6Xjdp+B/Tm8hZr8BoMpggoVtW8TftlRxVXB' +
  'dmkKmyzLX4npuM1HxwpTUOjZ4wldDwa4mjDxZpPKkYTq1wnKQnJJaJxKqR5PSSYzNzfPOSqfJ5gy' +
  'NE+nzJ5I+XVfDVcTBvZFzBxuAxrp2x2K8jO7BUu1FDZb0VH2zq030nmvL2s/K0n5bn8+z3Yq6X08' +
  'kO6HA8Fmdu57MhQUonEgLfD6NcqHJc/H1E+m6JxCGaidSGn8nOL3a2yXYvGzOfqfinBNoeNWH1MA' +
  'EvAXayTNTK8AMUXo2x1ROZqQTAq2DMmEECw31L7LdLTqUJEf75whnXHoWBGtMZhI0R532F5NPGQY' +
  'G2mSTmVjEkB0jJS2erL8tbzYTvWXRJTYbiXhCi3rvuoQr09fsY2CpVoG34glv9GKDv+OG+AZAGlD' +
  '87QDLdhOTeucI62AJNB5l4/Xq0mnhPpomrUYQHGLR+VYQvVocoUx/rGkdQjle3zywxZXB3+RpnK0' +
  'zcW3WvTuDAgHDclkpu2pD1pMf9RG2pcj/AvoXDS33uD1aFxNqH6TrTcdQ37YoqyieTalMequrgTg' +
  'TwKyxRrXW2xNAAAAAElFTkSuQmCC';

/** User-supplied insights icon as PNG bytes (21×20, ready for G2 imageData). */
export function userInsightsIconPngBytes(): number[] {
  return decodeBmpB64(INSIGHTS_ICON_PNG_B64);
}

// ── Calendar icon ─────────────────────────────────────────────────────────────
// Canvas-drawn: rounded rect body, top bar, two column lines, three row lines.
export function calendarIconPngBytes(w = 20, h = 20): number[] {
  return renderIcon(w, h, (ctx, w, h) => {
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 1.5;
    // Outer border
    const r = 2;
    ctx.beginPath();
    ctx.moveTo(r, 3); ctx.lineTo(w - r, 3);
    ctx.arcTo(w, 3, w, 3 + r, r);
    ctx.lineTo(w, h - r);
    ctx.arcTo(w, h, w - r, h, r);
    ctx.lineTo(r, h);
    ctx.arcTo(0, h, 0, h - r, r);
    ctx.lineTo(0, 3 + r);
    ctx.arcTo(0, 3, r, 3, r);
    ctx.closePath();
    ctx.stroke();
    // Header bar
    ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(w, 7); ctx.stroke();
    // Two vertical lines (3 columns)
    const col = Math.round(w / 3);
    ctx.beginPath(); ctx.moveTo(col, 7); ctx.lineTo(col, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(col * 2, 7); ctx.lineTo(col * 2, h); ctx.stroke();
    // Two horizontal lines (3 rows)
    const row = Math.round((h - 7) / 3);
    ctx.beginPath(); ctx.moveTo(0, 7 + row); ctx.lineTo(w, 7 + row); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 7 + row * 2); ctx.lineTo(w, 7 + row * 2); ctx.stroke();
  });
}

// ── Deck icon ─────────────────────────────────────────────────────────────────
// Canvas-drawn: three stacked rounded cards (offset upward).
export function deckIconPngBytes(w = 25, h = 20): number[] {
  return renderIcon(w, h, (ctx, w, h) => {
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 1.5;
    const cardW = w - 4, cardH = Math.round(h * 0.45), r = 2;
    const offsets = [8, 4, 0]; // bottom to top
    for (const dy of offsets) {
      const x = 2, y = dy;
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + cardW - r, y);
      ctx.arcTo(x + cardW, y,     x + cardW, y + r,        r);
      ctx.lineTo(x + cardW, y + cardH - r);
      ctx.arcTo(x + cardW, y + cardH, x + cardW - r, y + cardH, r);
      ctx.lineTo(x + r,    y + cardH);
      ctx.arcTo(x,         y + cardH, x, y + cardH - r,    r);
      ctx.lineTo(x,        y + r);
      ctx.arcTo(x,         y,     x + r, y,               r);
      ctx.closePath();
      ctx.stroke();
    }
  });
}

// ── Full-screen BMP → tiled PNG helpers ──────────────────────────────────────
//
// The G2 SDK ImageContainerProperty has hard pixel limits:
//   width:  20–288 px
//   height: 20–144 px
//
// A 576×288 BMP therefore needs 4 tiles (each ≤ 288×144).
// The browser decodes the BMP natively (handles row-reversal, BGR→RGB, padding).
// Each tile is re-encoded as PNG for the Rust image crate on the G2 firmware.
//
// IMPORTANT: image containers always render ON TOP of text/list containers in
// the G2 SDK regardless of containerID ordering. Only use full-screen tiles on
// screens where the entire UI is encoded in the image (no text/list on top).

/** A single tile produced by bmpUrlToTiles(). */
export interface TileData {
  id: number;     // containerID
  name: string;   // containerName
  x: number;      // xPosition for ImageContainerProperty
  y: number;      // yPosition
  w: number;      // width  (≤ 288)
  h: number;      // height (≤ 144)
  data: number[]; // PNG bytes (full file, with header)
}

// Max dimensions per G2 image container.
const TILE_MAX_W = 288;
const TILE_MAX_H = 144;

/** Load a URL as an HTMLImageElement (resolves on load, rejects on error). */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${url} (${e})`));
    img.src = url;
  });
}

/**
 * Apply a luminance threshold to a canvas in-place.
 * Pixels with luminance > 30 become white (#FFF); all others become black (#000).
 * Use this when targeting real G2 hardware (4-bit grayscale) for maximum contrast.
 * Not needed for the browser simulator where colors display as-is.
 */
export function thresholdCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')!;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const v = lum > 30 ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = v;
    // alpha (data[i+3]) unchanged
  }
  ctx.putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0);
}

/**
 * Load a BMP (or PNG/JPEG) from a URL, optionally threshold it, then split into
 * tiles that each fit within the G2 ImageContainerProperty dimension limits.
 * Returns an array of TileData (PNG-encoded, ready for updateImageRawData).
 *
 * @param imageUrl      URL reachable in the browser context (e.g. '/icons/foo.png')
 * @param baseId        Starting containerID for the tiles (default 50)
 * @param applyThreshold Convert to monochrome before encoding — recommended for real G2 hardware
 */
export async function bmpUrlToTiles(
  imageUrl: string,
  baseId = 50,
  applyThreshold = false,
): Promise<TileData[]> {
  const img = await loadImage(imageUrl);

  // Draw full image onto a source canvas.
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width  = img.width;
  srcCanvas.height = img.height;
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.drawImage(img, 0, 0);

  if (applyThreshold) thresholdCanvas(srcCanvas);

  // Slice into tiles.
  const tiles: TileData[] = [];
  let id = baseId;

  for (let ty = 0; ty < Math.ceil(img.height / TILE_MAX_H); ty++) {
    for (let tx = 0; tx < Math.ceil(img.width / TILE_MAX_W); tx++) {
      const sx = tx * TILE_MAX_W;
      const sy = ty * TILE_MAX_H;
      const sw = Math.min(TILE_MAX_W, img.width  - sx);
      const sh = Math.min(TILE_MAX_H, img.height - sy);

      const tileCanvas = document.createElement('canvas');
      tileCanvas.width  = sw;
      tileCanvas.height = sh;
      tileCanvas.getContext('2d')!.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

      tiles.push({
        id,
        name: `tile_${id}`,
        x: sx,
        y: sy,
        w: sw,
        h: sh,
        data: canvasToPngBytes(tileCanvas),
      });
      id++;
    }
  }

  return tiles;
}

/**
 * Convert TileData[] into the imageObject / imageData arrays expected by PageConfig
 * in renderer.ts. Spread the result into your PageConfig:
 *
 *   const tiles = await bmpUrlToTiles('/icons/welcome.png');
 *   return { ...tilesToPageConfig(tiles) };
 */
export function tilesToPageConfig(tiles: TileData[]): {
  imageObject: ImageContainerProperty[];
  imageData: Array<{ id: number; name: string; data: number[] }>;
} {
  return {
    imageObject: tiles.map(
      t => new ImageContainerProperty({
        containerID:   t.id,
        containerName: t.name,
        xPosition:     t.x,
        yPosition:     t.y,
        width:         t.w,
        height:        t.h,
      }),
    ),
    imageData: tiles.map(t => ({ id: t.id, name: t.name, data: t.data })),
  };
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

/**
 * Fetch an image from a URL (PNG, BMP, etc.), draw it scaled to targetW×targetH,
 * and return the result as PNG bytes for the G2 SDK imageData field.
 */
export async function fetchIconPngBytes(url: string, targetW: number, targetH: number): Promise<number[]> {
  const img = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvasToPngBytes(canvas);
}
