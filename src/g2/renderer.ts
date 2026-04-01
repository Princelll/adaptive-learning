// ============================================================
// BioLoop G2 — Glasses Display Renderer
// Renders to Even G2 576×288 display via SDK containers.
// Follows Even Hub OS 2.0 Guidelines:
//   - Header: centered title + separator line
//   - Body: content in the middle zone
//   - Footer: gesture hints (left) + screen label (right)
//   - Two-column key-value layout for data-dense screens
// ============================================================

import {
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerProperty,
  ListContainerProperty,
  ListItemContainerProperty,
  ImageContainerProperty,
  ImageRawDataUpdate,
} from '@evenrealities/even_hub_sdk';
import { state, getBridge, RATING_OPTIONS } from './state';
import { bedIconBytes, canvasToPngBytes } from './image-utils';
import { WELCOME_BG_DATA_URL } from './welcome-bg-data';
import { log } from './log';
import {
  DISPLAY_WIDTH,
  buildTitleBlock,
  buildFooter,
  buildActionBar,
  truncateLines,
  wordWrap,
  applyScrollIndicators,
  kvRow,
  separator,
  VISIBLE_LINES,
  CHARS_PER_LINE,
} from './display-utils';

// ── Container helpers ────────────────────────────────────────
// Even Hub OS background layer renders content in a rounded-corner card
// with a visible white border (per App Layer dashboard screenshot).
// WHITE = 0xFFFFFF = 16777215 (RGB integer used by SDK).

const BORDER_COLOR_WHITE = 16777215; // 0xFFFFFF
const CARD_BORDER_RADIUS = 6;        // Even OS 2.0 spec: list items and cards use 6px radius

function textContainer(
  id: number,
  name: string,
  content: string,
  x: number,
  y: number,
  w: number,
  h: number,
  isEvt = false,
  card = false,   // true → add white border + radius (background layer card style)
): TextContainerProperty {
  return new TextContainerProperty({
    containerID: id,
    containerName: name,
    content: content.slice(0, 1000),
    xPosition: x,
    yPosition: y,
    width: w,
    height: h,
    isEventCapture: isEvt ? 1 : 0,
    // Card: 16px T/B, 20px L/R per Even OS 2.0 Card margin spec.
    // SDK paddingLength is uniform; use 16 as the balanced value.
    // Non-card (header/footer): 4px minimal padding.
    paddingLength: card ? 16 : 4,
    borderWidth: card ? 1 : 0,
    borderColor: card ? BORDER_COLOR_WHITE : 0,
    borderRadius: card ? CARD_BORDER_RADIUS : 0,
  });
}

function listContainer(
  id: number,
  name: string,
  items: string[],
  x: number,
  y: number,
  w: number,
  h: number,
  isEvt = false,
): ListContainerProperty {
  return new ListContainerProperty({
    containerID: id,
    containerName: name,
    xPosition: x,
    yPosition: y,
    width: w,
    height: h,
    isEventCapture: isEvt ? 1 : 0,
    paddingLength: 4,
    // No outer border on list — per Even OS focus-based navigation:
    // only the selected item (isItemSelectBorderEn) has a focus outline.
    // Two simultaneous borders create visual ambiguity about actionable target.
    borderWidth: 0,
    borderColor: 0,
    borderRadius: 0,
    itemContainer: new ListItemContainerProperty({
      itemCount: items.length,
      itemWidth: 0,
      isItemSelectBorderEn: 1,
      itemName: items,
    }),
  });
}

// ── Page rebuild ─────────────────────────────────────────────

interface PageConfig {
  textObject?: TextContainerProperty[];
  listObject?: ListContainerProperty[];
  imageObject?: ImageContainerProperty[];
  /** Raw pixel data to push after page build, one entry per image container. */
  imageData?: Array<{ id: number; name: string; data: number[] }>;
}

// Wraps a bridge promise and converts DOM Event rejections (from SDK WebSocket
// internals) to proper Error objects so callers get readable messages
// instead of "[object Event]".
function wrapBridgePromise<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((err) => {
    if (err instanceof Event) {
      throw new Error(`SDK bridge error (${(err as Event).type || 'unknown'})`);
    }
    throw err;
  });
}

async function rebuildPage(config: PageConfig): Promise<void> {
  const bridge = getBridge();
  const totalContainers =
    (config.textObject?.length ?? 0) +
    (config.listObject?.length ?? 0) +
    (config.imageObject?.length ?? 0);

  const payload = {
    containerTotalNum: totalContainers,
    textObject: config.textObject ?? [],
    listObject: config.listObject ?? [],
    imageObject: config.imageObject ?? [],
  };

  if (!state.startupRendered) {
    await wrapBridgePromise(
      bridge.createStartUpPageContainer(new CreateStartUpPageContainer(payload)),
    );
    state.startupRendered = true;
  } else {
    await wrapBridgePromise(
      bridge.rebuildPageContainer(new RebuildPageContainer(payload)),
    );
  }

  // Push raw pixel data for each image container (must be sequential per SDK docs).
  // Image upload failures are non-fatal: the text/list layers still render.
  if (config.imageData?.length) {
    for (const img of config.imageData) {
      try {
        await wrapBridgePromise(
          bridge.updateImageRawData(
            new ImageRawDataUpdate({ containerID: img.id, containerName: img.name, imageData: img.data }),
          ),
        );
      } catch (err) {
        log(`Image upload failed (${img.name}): ${err instanceof Error ? err.message : String(err)}`);
        // Non-fatal — screen continues to render without this image
      }
    }
  }
}

// ── Layout zones (576×288 display) ───────────────────────────
// Even OS 2.0 card margin spec: L/R 20px, T/B 16px.
// Body container uses paddingLength=16 (uniform, closest approximation).
// Header  y=0   h=44  — title + separator (no card border)
// Body    y=44  h=208 — scrollable content (card border, radius 6px)
// Footer  y=252 h=36  — gesture hints | screen label (no card border)

const ZONE = {
  header: { y: 0,   h: 44  },
  body:   { y: 44,  h: 208 },
  footer: { y: 252, h: 36  },
} as const;

// ── Welcome background template ──────────────────────────────
// Loads the 576×288 template PNG, paints over the [DATE AND TIME]
// and [NAME] placeholders, then splits into two 288×144 halves.
//
// G2 SDK limits: ImageContainerProperty width ≤ 288, height ≤ 144.
// The 576×288 display requires two side-by-side 288×144 image containers.
// Only the top half (y=0–144) is needed as an image — the bottom menu
// area (y=215–288) is rendered by the list container.
//
// Template pixel measurements (from BMP analysis):
//   [DATE AND TIME]  → y=0–17,   x=423–575  (right-aligned, top)
//   Greeting line    → y=51–72,  x=64–357   ("Welcome to StudyHub, [NAME].")
//   Menu area        → y=215–288             (list container sits here)

let welcomeBgImage: HTMLImageElement | null = null;

async function loadWelcomeBg(): Promise<HTMLImageElement> {
  if (welcomeBgImage) return welcomeBgImage;
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => { welcomeBgImage = img; resolve(img); };
    img.onerror = () => reject(new Error('welcome-bg data URL failed to load'));
    // Use embedded data URL — not dependent on Vite file serving
    img.src = WELCOME_BG_DATA_URL;
  });
}

// G2 display green: sampled from the template BMP (#39ff14 peak)
const G2_GREEN = '#39ff14';
// Approximate the Even OS monospace font on canvas (~10px per char at 16px size)
const G2_FONT  = '16px "Courier New", monospace';

// Returns top-left and top-right 288×144 tiles (y=0..143 only).
// Dynamic text areas (date, greeting) are BLACKED OUT in the image —
// text containers render those with G2's actual pixel font.
// "What would you like to do?" and the frame stay in the image.
async function renderWelcomeBg(): Promise<[number[], number[]]> {
  const W = 576, H_FULL = 288, HALF_W = 288, HALF_H = 144;

  const full = document.createElement('canvas');
  full.width  = W;
  full.height = H_FULL;
  const ctx = full.getContext('2d')!;

  const bg = await loadWelcomeBg();
  ctx.drawImage(bg, 0, 0, W, H_FULL);

  // Black out dynamic text regions — text containers draw real values on top
  ctx.fillStyle = '#000';
  ctx.fillRect(0,   0, W,   28);  // entire top row: date/time line
  ctx.fillRect(0,  44, W,   36);  // greeting line "Welcome to StudyHub, [NAME]."

  // Crop to top half only (y=0..143) — bottom is left to the list container
  const tile = (srcX: number) => {
    const c = document.createElement('canvas');
    c.width  = HALF_W;
    c.height = HALF_H;
    c.getContext('2d')!.drawImage(full, srcX, 0, HALF_W, HALF_H, 0, 0, HALF_W, HALF_H);
    return canvasToPngBytes(c);
  };

  return [tile(0), tile(HALF_W)];
}

// ── Screen builders ──────────────────────────────────────────

function buildSleepCheckin(): PageConfig {
  // 4 columns × 8 chars = 32 chars (fills the full display width exactly).
  // Bar heights: Bad=1, Regular=2, Good=3, Great=4 rows (MAX_H=4 leaves room for image below).
  const HEIGHTS = [1, 2, 3, 4];
  const MAX_H   = 4;
  const BAR     = ' ██████ '; // 8 chars: 1sp + 6 blocks + 1sp
  const EMPTY   = '        '; // 8 chars: spaces
  const LABELS  = ['Bad', 'Regular', 'Good', 'Great'];

  // Rows generated top-to-bottom. threshold = MAX_H - r.
  // A column shows a bar only when its height >= threshold.
  // This produces the stepped bar-chart shape (tall on the right, short on the left).
  const chartRows: string[] = [];
  for (let r = 0; r < MAX_H; r++) {
    const threshold = MAX_H - r;
    chartRows.push(HEIGHTS.map(h => h >= threshold ? BAR : EMPTY).join(''));
  }

  // Label row: '>' prefix marks the selected column; each column is 8 chars wide.
  // '>Regular' = 8 chars exactly; padEnd(8) handles shorter labels.
  const labelRow = LABELS.map((lbl, i) => {
    const prefix = i === state.sleepSelectIdx ? '>' : ' ';
    return (prefix + lbl).padEnd(8);
  }).join('');

  // Header: "  Welcome to StudyHub." left, date right (e.g. "Mar 30")
  const now     = new Date();
  const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const leftStr = '  Welcome to StudyHub.';
  const gapLen  = CHARS_PER_LINE - leftStr.length - dateStr.length;
  const headerLine = leftStr + ' '.repeat(Math.max(1, gapLen)) + dateStr;
  const header  = headerLine + '\n' + separator(CHARS_PER_LINE);

  // Body: centered question + 4 chart rows + label row = 6 text lines (~120px from y=44 → ~y=164).
  // Bed icon renders below the text at y≈170, centered horizontally.
  const howStr  = 'How did you sleep?';
  const howPad  = Math.floor((CHARS_PER_LINE - howStr.length) / 2);
  const body = [
    ' '.repeat(howPad) + howStr,
    ...chartRows,
    labelRow,
  ].join('\n');

  const footer = buildFooter(
    [{ gesture: 'Scroll', action: 'Select' }, { gesture: 'Tap', action: 'Confirm' }],
    'Sleep',
  );

  // Bed icon: 128×72px, centered horizontally, below bar chart text
  const IMG_W = 128, IMG_H = 72;
  const imgX  = Math.round((DISPLAY_WIDTH - IMG_W) / 2); // 224
  const imgY  = 170; // below 6 text lines (~y=164), above footer (y=252)

  return {
    textObject: [
      textContainer(99, 'evt', ' ', 0, 0, 1, 1, true),
      textContainer(1, 'header', header, 0, ZONE.header.y, DISPLAY_WIDTH, ZONE.header.h),
      textContainer(2, 'body',   body,   0, ZONE.body.y,   DISPLAY_WIDTH, ZONE.body.h, false, true),
      textContainer(3, 'footer', footer, 0, ZONE.footer.y, DISPLAY_WIDTH, ZONE.footer.h),
    ],
    imageObject: [
      new ImageContainerProperty({ containerID: 10, containerName: 'bed', xPosition: imgX, yPosition: imgY, width: IMG_W, height: IMG_H }),
    ],
    imageData: [
      { id: 10, name: 'bed', data: bedIconBytes(IMG_W, IMG_H) },
    ],
  };
}

async function buildWelcome(): Promise<PageConfig> {
  const now     = new Date();
  const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dtStr   = `${dateStr}  ${timeStr}`;
  const name    = state.userName || 'Simulator';

  const menuItems = ['Continue Studying', 'View Insights'];

  // Try image-based layout; fall back to plain text if the PNG isn't available.
  try {
    // renderWelcomeBg() returns 2 tiles (top half only, y=0..143).
    // Bottom half (y=144–288) is left to the list container — no image tiles overlap it.
    const [tl, tr] = await renderWelcomeBg();

    // Date/time: right-aligned in the blacked-out top row (y=0..28 in template).
    const dtPadded = dtStr.padStart(CHARS_PER_LINE);
    // Greeting: centered in the blacked-out greeting row (y=44..80 in template).
    const greetStr = `Welcome to StudyHub, ${name}.`;
    const greetPad = ' '.repeat(Math.max(0, Math.floor((CHARS_PER_LINE - greetStr.length) / 2)));
    const greeting = greetPad + greetStr;

    return {
      // Text containers (IDs 30, 31) render above the image tiles (IDs 20, 21).
      // Higher containerID = higher z-order in the G2 SDK.
      textObject: [
        textContainer(30, 'dt',       dtPadded, 0,  4, DISPLAY_WIDTH, 24),
        textContainer(31, 'greeting', greeting,  0, 48, DISPLAY_WIDTH, 32),
      ],
      // List at y=215 — no image tile covers this area; navigation works normally.
      listObject: [
        listContainer(3, 'menu', menuItems, 0, 215, DISPLAY_WIDTH, 73, true),
      ],
      imageObject: [
        new ImageContainerProperty({ containerID: 20, containerName: 'tl', xPosition:   0, yPosition: 0, width: 288, height: 144 }),
        new ImageContainerProperty({ containerID: 21, containerName: 'tr', xPosition: 288, yPosition: 0, width: 288, height: 144 }),
      ],
      imageData: [
        { id: 20, name: 'tl', data: tl },
        { id: 21, name: 'tr', data: tr },
      ],
    };
  } catch (err) {
    // Template PNG unavailable — render text-only welcome screen
    log(`Welcome image unavailable, using text layout: ${err}`);
    const centerOf = (s: string) =>
      ' '.repeat(Math.max(0, Math.floor((CHARS_PER_LINE - s.length) / 2))) + s;
    const greeting = [
      centerOf(`Welcome to StudyHub, ${name}.`),
      centerOf('What would you like to do?'),
    ].join('\n');
    return {
      textObject: [
        textContainer(1, 'dt',       dtStr.padStart(CHARS_PER_LINE), 0, 4,   DISPLAY_WIDTH, 36),
        textContainer(2, 'greeting', greeting,                        0, 100, DISPLAY_WIDTH, 80),
      ],
      listObject: [
        listContainer(3, 'menu', menuItems, 0, 200, DISPLAY_WIDTH, 88, true),
      ],
    };
  }
}

function buildNoDecks(): PageConfig {
  const header = buildTitleBlock('Adaptive Learning');
  const body = [
    '',
    'No study material found.',
    '',
    'Open the companion app',
    'on your phone to import',
    'a deck.',
  ].join('\n');
  const footer = buildFooter(
    [{ gesture: 'Click', action: 'Retry' }],
    'Setup',
  );

  return {
    textObject: [
      textContainer(99, 'evt', ' ', 0, 0, 1, 1, true),
      textContainer(1, 'header', header, 0, ZONE.header.y, DISPLAY_WIDTH, ZONE.header.h),
      textContainer(2, 'body',   body,   0, ZONE.body.y,   DISPLAY_WIDTH, ZONE.body.h, false, true),
      textContainer(3, 'footer', footer, 0, ZONE.footer.y, DISPLAY_WIDTH, ZONE.footer.h),
    ],
  };
}

function buildDeckSelect(): PageConfig {
  const header = buildTitleBlock('Pick a Subject');
  const lines = state.deckNames.map(
    (name, i) => (i === state.deckSelectIdx ? '> ' : '  ') + name,
  );
  const body = lines.length > VISIBLE_LINES
    ? applyScrollIndicators(lines, Math.max(0, state.deckSelectIdx - 4), VISIBLE_LINES)
    : lines.join('\n');
  const footer = buildFooter(
    [{ gesture: 'Scroll', action: 'Select' }, { gesture: 'Tap', action: 'Start' }],
    'Subjects',
  );

  return {
    textObject: [
      textContainer(99, 'evt', ' ', 0, 0, 1, 1, true),
      textContainer(1, 'header', header, 0, ZONE.header.y, DISPLAY_WIDTH, ZONE.header.h),
      textContainer(2, 'body',   body,   0, ZONE.body.y,   DISPLAY_WIDTH, ZONE.body.h, false, true),
      textContainer(3, 'footer', footer, 0, ZONE.footer.y, DISPLAY_WIDTH, ZONE.footer.h),
    ],
  };
}

function buildDashboard(): PageConfig {
  const header = buildTitleBlock('Adaptive Learning');
  const hasModel = state.modelStatus !== 'collecting_data' && state.modelStatus !== 'error';
  const deckLabel = state.deckName || 'No deck loaded';

  // Two-column key-value layout — Even G2 data display pattern
  const body = [
    truncateLines(deckLabel, CHARS_PER_LINE),
    separator(CHARS_PER_LINE),
    kvRow('Cards due',    String(state.cardsDue)),
    kvRow('Observations', String(state.obsCount)),
    kvRow('Best style',   state.topStyles[0] ?? '--'),
    kvRow('Model',        state.modelStatus),
    hasModel ? kvRow('R\u00B2', state.modelR2.toFixed(2)) : '',
  ].filter(Boolean).join('\n');

  const footer = buildFooter(
    [{ gesture: 'Tap', action: 'Study' }, { gesture: 'Scroll\u2193', action: 'ML' }],
    'Dashboard',
  );

  return {
    textObject: [
      textContainer(99, 'evt', ' ', 0, 0, 1, 1, true),
      textContainer(1, 'header', header, 0, ZONE.header.y, DISPLAY_WIDTH, ZONE.header.h),
      textContainer(2, 'body',   body,   0, ZONE.body.y,   DISPLAY_WIDTH, ZONE.body.h, false, true),
      textContainer(3, 'footer', footer, 0, ZONE.footer.y, DISPLAY_WIDTH, ZONE.footer.h),
    ],
  };
}

function buildModelInsights(): PageConfig {
  const header = buildTitleBlock('ML Insights');
  const hasModel = state.modelStatus !== 'collecting_data' && state.modelStatus !== 'error';
  const obsNeeded = state.obsCount < 15 ? ` (${15 - state.obsCount} more)` : '';
  const styleLines = state.topStyles.length > 0
    ? state.topStyles.map((s, i) => `  ${i + 1}. ${s}`)
    : ['  (collect 15+ obs to train)'];

  const body = [
    kvRow('Status',       state.modelStatus),
    kvRow('Observations', `${state.obsCount}${obsNeeded}`),
    hasModel ? kvRow('R\u00B2', state.modelR2.toFixed(3)) : '',
    separator(CHARS_PER_LINE),
    'Top study styles:',
    ...styleLines,
  ].filter(s => s !== undefined && s !== null).join('\n');

  const footer = buildFooter(
    [{ gesture: 'Scroll\u2191', action: 'Back' }, { gesture: 'Dbl-tap', action: 'Home' }],
    'ML Insights',
  );

  return {
    textObject: [
      textContainer(99, 'evt', ' ', 0, 0, 1, 1, true),
      textContainer(1, 'header', header, 0, ZONE.header.y, DISPLAY_WIDTH, ZONE.header.h),
      textContainer(2, 'body',   body,   0, ZONE.body.y,   DISPLAY_WIDTH, ZONE.body.h, false, true),
      textContainer(3, 'footer', footer, 0, ZONE.footer.y, DISPLAY_WIDTH, ZONE.footer.h),
    ],
  };
}

function buildQuestion(): PageConfig {
  const header = buildTitleBlock(`Card ${state.cardNumber} / ${state.totalCards}`);
  const wrapped = wordWrap(state.questionText);
  const body = wrapped.length > VISIBLE_LINES
    ? applyScrollIndicators(wrapped, 0, VISIBLE_LINES)
    : wrapped.join('\n');
  const footer = buildFooter(
    [{ gesture: 'Tap', action: 'Reveal' }],
    'Question',
  );

  return {
    textObject: [
      textContainer(99, 'evt', ' ', 0, 0, 1, 1, true),
      textContainer(1, 'header', header, 0, ZONE.header.y, DISPLAY_WIDTH, ZONE.header.h),
      textContainer(2, 'body',   body,   0, ZONE.body.y,   DISPLAY_WIDTH, ZONE.body.h, false, true),
      textContainer(3, 'footer', footer, 0, ZONE.footer.y, DISPLAY_WIDTH, ZONE.footer.h),
    ],
  };
}

function buildAnswer(): PageConfig {
  const header = buildTitleBlock(`Answer ${state.cardNumber} / ${state.totalCards}`);
  const wrapped = wordWrap(state.answerText);
  const body = wrapped.length > VISIBLE_LINES
    ? applyScrollIndicators(wrapped, 0, VISIBLE_LINES)
    : wrapped.join('\n');
  const footer = buildFooter(
    [{ gesture: 'Tap', action: 'Rate' }],
    'Answer',
  );

  return {
    textObject: [
      textContainer(99, 'evt', ' ', 0, 0, 1, 1, true),
      textContainer(1, 'header', header, 0, ZONE.header.y, DISPLAY_WIDTH, ZONE.header.h),
      textContainer(2, 'body',   body,   0, ZONE.body.y,   DISPLAY_WIDTH, ZONE.body.h, false, true),
      textContainer(3, 'footer', footer, 0, ZONE.footer.y, DISPLAY_WIDTH, ZONE.footer.h),
    ],
  };
}

function buildRating(): PageConfig {
  const header = buildTitleBlock('Rate Your Recall');
  const items = RATING_OPTIONS.map(
    (r) => r.charAt(0).toUpperCase() + r.slice(1),
  );
  const footer = buildFooter(
    [{ gesture: 'Scroll', action: 'Select' }, { gesture: 'Tap', action: 'Confirm' }],
    'Rating',
  );

  return {
    textObject: [
      textContainer(1, 'header', header, 0, ZONE.header.y, DISPLAY_WIDTH, ZONE.header.h),
      textContainer(3, 'footer', footer, 0, ZONE.footer.y, DISPLAY_WIDTH, ZONE.footer.h),
    ],
    listObject: [
      listContainer(2, 'ratings', items, 0, ZONE.body.y, DISPLAY_WIDTH, ZONE.body.h, true),
    ],
  };
}

function buildSummary(): PageConfig {
  const header = buildTitleBlock('Session Complete');
  const body = state.summaryText;
  const footer = buildFooter(
    [{ gesture: 'Tap', action: 'Dashboard' }],
    'Summary',
  );

  return {
    textObject: [
      textContainer(99, 'evt', ' ', 0, 0, 1, 1, true),
      textContainer(1, 'header', header, 0, ZONE.header.y, DISPLAY_WIDTH, ZONE.header.h),
      textContainer(2, 'body',   body,   0, ZONE.body.y,   DISPLAY_WIDTH, ZONE.body.h, false, true),
      textContainer(3, 'footer', footer, 0, ZONE.footer.y, DISPLAY_WIDTH, ZONE.footer.h),
    ],
  };
}

// ── Public API ───────────────────────────────────────────────

const SCREEN_BUILDERS: Record<string, () => PageConfig | Promise<PageConfig>> = {
  sleep_checkin: buildSleepCheckin,
  welcome: buildWelcome,
  no_decks: buildNoDecks,
  deck_select: buildDeckSelect,
  dashboard: buildDashboard,
  model_insights: buildModelInsights,
  question: buildQuestion,
  answer: buildAnswer,
  rating: buildRating,
  summary: buildSummary,
};

export async function showScreen(): Promise<void> {
  const builder = SCREEN_BUILDERS[state.screen];
  if (!builder) {
    log(`Unknown screen: ${state.screen}`);
    return;
  }
  const config = await Promise.resolve(builder());
  log(`Rendering: ${state.screen}`);
  await rebuildPage(config);
}
