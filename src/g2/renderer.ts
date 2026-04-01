// ============================================================
// BioLoop G2 — Glasses Display Renderer
// Renders to Even G2 576×288 display via SDK containers.
// Screen designs match the BMP mockups in public/icons/.
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

const BORDER_COLOR_WHITE = 16777215; // 0xFFFFFF
const CARD_BORDER_RADIUS = 6;

function textContainer(
  id: number,
  name: string,
  content: string,
  x: number,
  y: number,
  w: number,
  h: number,
  isEvt = false,
  card = false,
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
  imageData?: Array<{ id: number; name: string; data: number[] }>;
}

// Converts DOM Event rejections from SDK WebSocket internals to readable Errors.
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
      }
    }
  }
}

// ── Layout zones (576×288 display) ───────────────────────────
const ZONE = {
  header: { y: 0,   h: 44  },
  body:   { y: 44,  h: 208 },
  footer: { y: 252, h: 36  },
} as const;

// ── Date/time helper ─────────────────────────────────────────
// Returns right-aligned date+time string (padded to CHARS_PER_LINE).
// Used by all screens that show [DATE AND TIME] in the top-right corner.
function currentDtStr(): string {
  const now = new Date();
  const d = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const t = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${d}  ${t}`.padStart(CHARS_PER_LINE);
}

// ── Welcome background template ──────────────────────────────
// welcome-bg.png is the finished welcome screen design (matches
// "Regular User Dashboard After biometrics added for the day" mockup).
// Dynamic regions ([DATE AND TIME], [NAME]) are blacked out so
// text containers render real values on top.
//
// G2 SDK image limit: width ≤ 288, height ≤ 144.
// 576×288 display → four 288×144 tiles (2 wide × 2 tall).

let welcomeBgImage: HTMLImageElement | null = null;

async function loadWelcomeBg(): Promise<HTMLImageElement> {
  if (welcomeBgImage) return welcomeBgImage;
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => { welcomeBgImage = img; resolve(img); };
    img.onerror = () => reject(new Error('welcome-bg data URL failed to load'));
    img.src = WELCOME_BG_DATA_URL;
  });
}

// Returns all 4 × 288×144 tiles covering the full 576×288 display.
// Dynamic text areas are blacked out — text containers (higher z-order) draw on top.
async function renderWelcomeBg(): Promise<[number[], number[], number[], number[]]> {
  const W = 576, H_FULL = 288, HALF_W = 288, HALF_H = 144;

  const full = document.createElement('canvas');
  full.width  = W;
  full.height = H_FULL;
  const ctx = full.getContext('2d')!;

  const bg = await loadWelcomeBg();
  ctx.drawImage(bg, 0, 0, W, H_FULL);

  // Black out dynamic text regions
  ctx.fillStyle = '#000';
  ctx.fillRect(0,   0, W,   28);  // date/time row
  ctx.fillRect(0,  44, W,   36);  // greeting line "Welcome to StudyHub, [NAME]."
  ctx.fillRect(0, 215, W,   73);  // menu area — list container renders on top

  const tile = (srcX: number, srcY: number) => {
    const c = document.createElement('canvas');
    c.width  = HALF_W;
    c.height = HALF_H;
    c.getContext('2d')!.drawImage(full, srcX, srcY, HALF_W, HALF_H, 0, 0, HALF_W, HALF_H);
    return canvasToPngBytes(c);
  };

  return [tile(0, 0), tile(HALF_W, 0), tile(0, HALF_H), tile(HALF_W, HALF_H)];
}

// ── Screen builders ──────────────────────────────────────────

// Sleep check-in screen ("Before biometrics added for the day" mockup).
// Shows a bar chart for sleep quality selection (Bad / Regular / Good / Great).
function buildSleepCheckin(): PageConfig {
  const HEIGHTS = [1, 2, 3, 4];
  const MAX_H   = 4;
  const BAR     = ' ██████ ';
  const EMPTY   = '        ';
  const LABELS  = ['Bad', 'Regular', 'Good', 'Great'];

  const chartRows: string[] = [];
  for (let r = 0; r < MAX_H; r++) {
    const threshold = MAX_H - r;
    chartRows.push(HEIGHTS.map(h => h >= threshold ? BAR : EMPTY).join(''));
  }

  const labelRow = LABELS.map((lbl, i) => {
    const prefix = i === state.sleepSelectIdx ? '>' : ' ';
    return (prefix + lbl).padEnd(8);
  }).join('');

  const name = state.userName || 'there';
  const greetStr = `Welcome to StudyHub, ${name}.`;
  const howStr   = '         How did you sleep?';
  const body = [greetStr, howStr, ...chartRows, labelRow].join('\n');

  const footer = buildFooter(
    [{ gesture: 'Scroll', action: 'Select' }, { gesture: 'Tap', action: 'Confirm' }],
    'Sleep',
  );

  const IMG_W = 128, IMG_H = 72;
  const imgX  = Math.round((DISPLAY_WIDTH - IMG_W) / 2);
  const imgY  = 185;

  return {
    textObject: [
      textContainer(99, 'evt',    ' ',    0, 0, 1, 1, true),
      textContainer(1,  'dt',     currentDtStr(), 0, 4,   DISPLAY_WIDTH, 20),
      textContainer(2,  'body',   body,           0, 28,  DISPLAY_WIDTH, 200, false, true),
      textContainer(3,  'footer', footer,         0, ZONE.footer.y, DISPLAY_WIDTH, ZONE.footer.h),
    ],
    imageObject: [
      new ImageContainerProperty({ containerID: 10, containerName: 'bed', xPosition: imgX, yPosition: imgY, width: IMG_W, height: IMG_H }),
    ],
    imageData: [
      { id: 10, name: 'bed', data: bedIconBytes(IMG_W, IMG_H) },
    ],
  };
}

// Welcome screen ("After biometrics added for the day" mockup).
// Uses welcome-bg.png as background; falls back to text-only layout if unavailable.
async function buildWelcome(): Promise<PageConfig> {
  const dtStr  = currentDtStr();
  const name   = state.userName || 'Simulator';
  const menuItems = ['Continue Studying', 'View Insights'];

  try {
    const [tl, tr, bl, br] = await renderWelcomeBg();

    const greetStr = `Welcome to StudyHub, ${name}.`;
    const greetPad = ' '.repeat(Math.max(0, Math.floor((CHARS_PER_LINE - greetStr.length) / 2)));

    return {
      textObject: [
        textContainer(30, 'dt',       dtStr,                    0,  4, DISPLAY_WIDTH, 24),
        textContainer(31, 'greeting', greetPad + greetStr,      0, 48, DISPLAY_WIDTH, 32),
      ],
      listObject: [
        listContainer(50, 'menu', menuItems, 0, 215, DISPLAY_WIDTH, 73, true),
      ],
      imageObject: [
        new ImageContainerProperty({ containerID: 20, containerName: 'tl', xPosition:   0, yPosition:   0, width: 288, height: 144 }),
        new ImageContainerProperty({ containerID: 21, containerName: 'tr', xPosition: 288, yPosition:   0, width: 288, height: 144 }),
        new ImageContainerProperty({ containerID: 22, containerName: 'bl', xPosition:   0, yPosition: 144, width: 288, height: 144 }),
        new ImageContainerProperty({ containerID: 23, containerName: 'br', xPosition: 288, yPosition: 144, width: 288, height: 144 }),
      ],
      imageData: [
        { id: 20, name: 'tl', data: tl },
        { id: 21, name: 'tr', data: tr },
        { id: 22, name: 'bl', data: bl },
        { id: 23, name: 'br', data: br },
      ],
    };
  } catch (err) {
    log(`Welcome image unavailable, using text layout: ${err}`);
    const center = (s: string) =>
      ' '.repeat(Math.max(0, Math.floor((CHARS_PER_LINE - s.length) / 2))) + s;
    const greeting = [
      center(`Welcome to StudyHub, ${name}.`),
      center('What would you like to do?'),
    ].join('\n');
    return {
      textObject: [
        textContainer(1, 'dt',       dtStr,    0, 4,   DISPLAY_WIDTH, 36),
        textContainer(2, 'greeting', greeting, 0, 100, DISPLAY_WIDTH, 80),
      ],
      listObject: [
        listContainer(3, 'menu', menuItems, 0, 200, DISPLAY_WIDTH, 88, true),
      ],
    };
  }
}

// No-decks placeholder screen.
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

// Study menu screen ("ContinueStudying-Dashboard" mockup).
// Shown after tapping "Continue Studying" from the welcome screen.
// Lists the two study modes: Programmed Study (uses first deck) and Select Deck.
function buildStudyMenu(): PageConfig {
  return {
    textObject: [
      textContainer(1, 'dt', currentDtStr(), 0, 4, DISPLAY_WIDTH, 36),
    ],
    listObject: [
      listContainer(2, 'menu', ['Programmed Study', 'Select Deck'], 0, 215, DISPLAY_WIDTH, 73, true),
    ],
  };
}

// Deck select screen ("SelectDeck" mockup).
// Shows deck names as a scrollable list; first item is selected by default.
function buildDeckSelect(): PageConfig {
  const items = state.deckNames.length > 0
    ? state.deckNames
    : ['(no decks available)'];

  const footer = buildFooter(
    [{ gesture: 'Scroll', action: 'Select' }, { gesture: 'Tap', action: 'Start' }],
    'Select Deck',
  );

  return {
    textObject: [
      textContainer(99, 'evt',    ' ',            0, 0, 1, 1, true),
      textContainer(1,  'dt',     currentDtStr(), 0, 4,   DISPLAY_WIDTH, 36),
      textContainer(3,  'footer', footer,         0, ZONE.footer.y, DISPLAY_WIDTH, ZONE.footer.h),
    ],
    listObject: [
      listContainer(2, 'decks', items, 0, 44, DISPLAY_WIDTH, 200, true),
    ],
  };
}

// Dashboard / pre-study stats ("ProgrammedStudy-Dashboard" mockup).
// Shows ML model stats and biometric recommendation before starting a session.
function buildDashboard(): PageConfig {
  const rec = state.topStyles[0] ?? '--';

  const body = [
    kvRow('Cards Due',    String(state.cardsDue)),
    kvRow('Best style',   state.topStyles[0] ?? '--'),
    kvRow('Model Status', state.modelStatus),
    kvRow('Biometric Rec.', rec),
  ].join('\n');

  const footer = buildFooter(
    [{ gesture: 'Tap', action: 'Study' }, { gesture: 'Scroll\u2193', action: 'ML' }],
    'Dashboard',
  );

  return {
    textObject: [
      textContainer(99, 'evt',    ' ',            0, 0, 1, 1, true),
      textContainer(1,  'dt',     currentDtStr(), 0, 4,   DISPLAY_WIDTH, 36),
      textContainer(2,  'body',   body,           0, ZONE.body.y, DISPLAY_WIDTH, ZONE.body.h, false, true),
      textContainer(3,  'footer', footer,         0, ZONE.footer.y, DISPLAY_WIDTH, ZONE.footer.h),
    ],
  };
}

// ML insights screen (unchanged from original design).
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

// Question screen ("Question template" mockup).
// Layout: date/time top-right | "Question N" centered | body text | card counter footer.
function buildQuestion(): PageConfig {
  const qLabel  = `Question ${state.cardNumber}`;
  const qPad    = ' '.repeat(Math.max(0, Math.floor((CHARS_PER_LINE - qLabel.length) / 2)));
  const title   = qPad + qLabel;

  const wrapped = wordWrap(state.questionText);
  const body    = wrapped.length > VISIBLE_LINES
    ? applyScrollIndicators(wrapped, 0, VISIBLE_LINES)
    : wrapped.join('\n');

  const cardLine = `\u25A0 Card ${state.cardNumber}/${state.totalCards}`;

  return {
    textObject: [
      textContainer(99, 'evt',   ' ',            0, 0,  1,            1,            true),
      textContainer(1,  'dt',    currentDtStr(), 0, 4,  DISPLAY_WIDTH, 20),
      textContainer(2,  'title', title,          0, 28, DISPLAY_WIDTH, 20),
      textContainer(3,  'body',  body,           0, 52, DISPLAY_WIDTH, 196,         false, true),
      textContainer(4,  'card',  cardLine,       0, ZONE.footer.y, DISPLAY_WIDTH, ZONE.footer.h),
    ],
  };
}

// Answer screen ("Answer template" mockup).
// Same layout as question but header reads "Answer" (not numbered).
function buildAnswer(): PageConfig {
  const aLabel = 'Answer';
  const aPad   = ' '.repeat(Math.max(0, Math.floor((CHARS_PER_LINE - aLabel.length) / 2)));
  const title  = aPad + aLabel;

  const wrapped = wordWrap(state.answerText);
  const body    = wrapped.length > VISIBLE_LINES
    ? applyScrollIndicators(wrapped, 0, VISIBLE_LINES)
    : wrapped.join('\n');

  const cardLine = `\u25A0 Card ${state.cardNumber}/${state.totalCards}`;

  return {
    textObject: [
      textContainer(99, 'evt',   ' ',            0, 0,  1,            1,            true),
      textContainer(1,  'dt',    currentDtStr(), 0, 4,  DISPLAY_WIDTH, 20),
      textContainer(2,  'title', title,          0, 28, DISPLAY_WIDTH, 20),
      textContainer(3,  'body',  body,           0, 52, DISPLAY_WIDTH, 196,         false, true),
      textContainer(4,  'card',  cardLine,       0, ZONE.footer.y, DISPLAY_WIDTH, ZONE.footer.h),
    ],
  };
}

// Rating screen — list of recall ratings (unchanged).
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

// Session summary screen (unchanged).
function buildSummary(): PageConfig {
  const header = buildTitleBlock('Session Complete');
  const body   = state.summaryText;
  const footer = buildFooter(
    [{ gesture: 'Tap', action: 'Dashboard' }],
    'Summary',
  );

  return {
    textObject: [
      textContainer(99, 'evt',    ' ',    0, 0, 1, 1, true),
      textContainer(1,  'header', header, 0, ZONE.header.y, DISPLAY_WIDTH, ZONE.header.h),
      textContainer(2,  'body',   body,   0, ZONE.body.y,   DISPLAY_WIDTH, ZONE.body.h, false, true),
      textContainer(3,  'footer', footer, 0, ZONE.footer.y, DISPLAY_WIDTH, ZONE.footer.h),
    ],
  };
}

// ── Screen builder registry ──────────────────────────────────

const SCREEN_BUILDERS: Record<string, () => PageConfig | Promise<PageConfig>> = {
  sleep_checkin:  buildSleepCheckin,
  welcome:        buildWelcome,
  no_decks:       buildNoDecks,
  study_menu:     buildStudyMenu,
  deck_select:    buildDeckSelect,
  dashboard:      buildDashboard,
  model_insights: buildModelInsights,
  question:       buildQuestion,
  answer:         buildAnswer,
  rating:         buildRating,
  summary:        buildSummary,
};

export async function showScreen(): Promise<void> {
  const builder = SCREEN_BUILDERS[state.screen];
  if (!builder) {
    log(`No builder for screen: ${state.screen}`);
    return;
  }
  log(`Rendering: ${state.screen}`);
  const config = await Promise.resolve(builder());
  await rebuildPage(config);
}
