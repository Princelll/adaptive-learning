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
import { bedIconBytes, sleepColumnBytes, userBedIconPngBytes, userBookIconPngBytes, userInsightsIconPngBytes, calendarIconPngBytes, deckIconPngBytes, canvasToPngBytes } from './image-utils';
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
    paddingLength: card ? 16 : 0,
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


// ── Date/time helper ─────────────────────────────────────────
// Right-aligns the date by positioning the container so text lands flush-right.
// Measured: charWidth=5px, paddingLength=4px → container x = 576 - (15chars×5px) - 4px = 440.
function currentDtStr(): string {
  const now = new Date();
  const d = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const t = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${d}  ${t}`;
}

function dtContainer(h: number): TextContainerProperty {
  return textContainer(1, 'dt', currentDtStr(), 410, -9, 166, h);
}

// ── Screen builders ──────────────────────────────────────────

// Sleep check-in screen ("Before biometrics added for the day" mockup).
// Bars are per-column images (with selection ring); labels use SDK text
// containers so they match the G2 built-in font.
function buildSleepCheckin(): PageConfig {
  const name = state.userName || 'there';
  const idx  = state.sleepSelectIdx ?? 0;

  // Columns: x=124…546, gap=14px, each 95px wide, 110px tall.
  const COL_W = 95, COL_H = 110, COL_Y = 110;
  const COL_X = [124, 233, 342, 451];
  const LABELS = ['Bad', 'Regular', 'Good', 'Great'];
  const LBL_Y  = COL_Y + COL_H + 1;  // just below bar images, 5px higher than before
  // Bed: x=0→105, lower border at y=228; 100x80 PNG scales to 105x84
  const BED_W = 105, BED_H = 84;

  return {
    textObject: [
      textContainer(99, 'evt',      ' ',                             0,      0,     1,                   1,   true),
      dtContainer(36),
      textContainer(2,  'greeting', `Welcome to StudyHub, ${name}.`, 60,     42,    DISPLAY_WIDTH - 60,  36),
      textContainer(5,  'subtitle', 'How did you sleep?',             209,    67,    DISPLAY_WIDTH - 209, 36),
      // All 4 labels in one container spanning the full column area (saves 3 containers)
      textContainer(6,  'labels', '     Bad             Regular          Good             Great', COL_X[0], LBL_Y, DISPLAY_WIDTH - COL_X[0], 28),
    ],
    imageObject: [
      new ImageContainerProperty({ containerID: 10, containerName: 'bed',  xPosition: 0,        yPosition: 144, width: BED_W, height: BED_H }),
      new ImageContainerProperty({ containerID: 11, containerName: 'col0', xPosition: COL_X[0], yPosition: COL_Y, width: COL_W, height: COL_H }),
      new ImageContainerProperty({ containerID: 12, containerName: 'col1', xPosition: COL_X[1], yPosition: COL_Y, width: COL_W, height: COL_H }),
      new ImageContainerProperty({ containerID: 13, containerName: 'col2', xPosition: COL_X[2], yPosition: COL_Y, width: COL_W, height: COL_H }),
      new ImageContainerProperty({ containerID: 14, containerName: 'col3', xPosition: COL_X[3], yPosition: COL_Y, width: COL_W, height: COL_H }),
    ],
    imageData: [
      { id: 10, name: 'bed',  data: userBedIconPngBytes() },
      { id: 11, name: 'col0', data: sleepColumnBytes(0, idx === 0, COL_W, COL_H) },
      { id: 12, name: 'col1', data: sleepColumnBytes(1, idx === 1, COL_W, COL_H) },
      { id: 13, name: 'col2', data: sleepColumnBytes(2, idx === 2, COL_W, COL_H) },
      { id: 14, name: 'col3', data: sleepColumnBytes(3, idx === 3, COL_W, COL_H) },
    ],
  };
}

// Welcome screen ("After biometrics added for the day" mockup).
// Pure text layout — image tiles cover text containers in the G2 SDK regardless
// of container ID, so we use text-only which matches the mockup and always works.
function buildWelcome(): PageConfig {
  const name = state.userName || 'Simulator';
  const menuItems = ['Continue Studying     ', 'View Insights     '];

  const BOOK_W = 25, BOOK_H = 20;
  return {
    textObject: [
      dtContainer(36),
      textContainer(2, 'greeting-line1', `Welcome to StudyHub, ${name}.`, 60, 42, DISPLAY_WIDTH - 60, 36),
      textContainer(5, 'greeting-line2', 'What would you like to do?', 209, 67, DISPLAY_WIDTH - 209, 36),
    ],
    listObject: [
      listContainer(3, 'menu', menuItems, 0, 200, DISPLAY_WIDTH, 88, true),
    ],
    imageObject: [
      new ImageContainerProperty({ containerID: 20, containerName: 'book',     xPosition: 180, yPosition: 216, width: BOOK_W,    height: BOOK_H }),
      new ImageContainerProperty({ containerID: 21, containerName: 'insights', xPosition: 140, yPosition: 256, width: 21,        height: 20 }),
    ],
    imageData: [
      { id: 20, name: 'book',     data: userBookIconPngBytes() },
      { id: 21, name: 'insights', data: userInsightsIconPngBytes() },
    ],
  };
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
      textContainer(1, 'header', header, 0, 0, DISPLAY_WIDTH, 45),
      textContainer(2, 'body',   body,   0, 45,   DISPLAY_WIDTH, 208, false, true),
      textContainer(3, 'footer', footer, 0, 252, DISPLAY_WIDTH, 36),
    ],
  };
}

// Study menu screen ("ContinueStudying-Dashboard" mockup).
// Shown after tapping "Continue Studying" from the welcome screen.
// Calendar icon next to "Programmed Study", deck icon next to "Select Deck".
// Same icon-embedding pattern as the welcome screen.
function buildStudyMenu(): PageConfig {
  const name = state.userName || 'Simulator';
  // Trailing spaces widen the selection ring to enclose each icon.
  const menuItems = ['Programmed Study   ', 'Select Deck   '];

  // List matches welcome screen: y=200, h=88. 2 items → each ~44px tall.
  // Item 1 center ≈ y=222, Item 2 center ≈ y=266.
  const CAL_X  = 180; const CAL_Y  = 212;
  const DECK_X = 118; const DECK_Y = 256;

  return {
    textObject: [
      dtContainer(36),
      textContainer(2, 'greeting', `Welcome to StudyHub, ${name}.`,  60,  42, DISPLAY_WIDTH - 60,  36),
      textContainer(5, 'subtitle', 'How would you like to study?',   209,  67, DISPLAY_WIDTH - 209, 36),
    ],
    imageObject: [
      new ImageContainerProperty({ containerID: 10, containerName: 'cal',  xPosition: CAL_X,  yPosition: CAL_Y,  width: 20, height: 20 }),
      new ImageContainerProperty({ containerID: 11, containerName: 'deck', xPosition: DECK_X, yPosition: DECK_Y, width: 25, height: 20 }),
    ],
    imageData: [
      { id: 10, name: 'cal',  data: calendarIconPngBytes() },
      { id: 11, name: 'deck', data: deckIconPngBytes()     },
    ],
    listObject: [
      listContainer(3, 'menu', menuItems, 0, 200, DISPLAY_WIDTH, 88, true),
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
      dtContainer(36),
      textContainer(3,  'footer', footer,         0, 252, DISPLAY_WIDTH, 36),
    ],
    listObject: [
      listContainer(2, 'decks', items, 0, 44, DISPLAY_WIDTH, 200, true),
    ],
  };
}

// Dashboard / pre-study stats ("ProgrammedStudy-Dashboard" mockup).
// Shows ML model stats and biometric recommendation before starting a session.
function buildDashboard(): PageConfig {
  const content = [
    '',
    `Cards Due: ${state.cardsDue}`,
    `Best style: ${state.topStyles[0] ?? '--'}`,
    `Model Status: ${state.modelStatus}`,
    `Biometric Recommendation: ${state.topStyles[0] ?? '--'}`,
  ].join('\n');

  return {
    textObject: [
      textContainer(99, 'evt',     ' ',     0, 0, 1,            1, true),
      dtContainer(36),
      textContainer(2,  'content', content, 0, 36, DISPLAY_WIDTH, 252),
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
      textContainer(1, 'header', header, 0, 0, DISPLAY_WIDTH, 45),
      textContainer(2, 'body',   body,   0, 45,   DISPLAY_WIDTH, 208, false, true),
      textContainer(3, 'footer', footer, 0, 252, DISPLAY_WIDTH, 36),
    ],
  };
}

// Question screen ("Question template" mockup).
// Layout: date/time top-right | "Question N" centered | body text | card counter footer.
// ── Text justification ───────────────────────────────────────
// Full-justify a single wrapped line. Lines shorter than CHARS_PER_LINE - 8
// are treated as paragraph endings and left-aligned.
function justifyLine(line: string): string {
  const trimmed = line.trim();
  if (trimmed.length < CHARS_PER_LINE - 8) return line;
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length <= 1) return line;
  const totalWordChars = words.reduce((s, w) => s + w.length, 0);
  const totalSpaces = CHARS_PER_LINE - totalWordChars;
  if (totalSpaces <= 0) return line;
  const gaps = words.length - 1;
  const base = Math.floor(totalSpaces / gaps);
  const extra = totalSpaces % gaps;
  return words.map((w, i) =>
    i < gaps ? w + ' '.repeat(base + (i < extra ? 1 : 0)) : w
  ).join('');
}

function justifyWrapped(lines: string[]): string[] {
  return lines.map((line, i) =>
    i === lines.length - 1 ? line : justifyLine(line)
  );
}

// Question screen.
function buildQuestion(): PageConfig {
  const qLabel    = `Question ${state.cardNumber}`;
  const pad       = Math.max(0, Math.floor((CHARS_PER_LINE - qLabel.length) / 2));
  const title     = '\u00A0'.repeat(pad) + qLabel;
  const wrapped   = wordWrap(state.questionText);
  const justified = justifyWrapped(wrapped);
  const body      = justified.length > VISIBLE_LINES
    ? applyScrollIndicators(justified, 0, VISIBLE_LINES)
    : justified.join('\n');
  const content  = title + '\n' + body;
  const cardText = `Card ${state.cardNumber}/${state.totalCards}`;

  return {
    textObject: [
      textContainer(99, 'evt',     ' ',      0,   0, 1,                   1,  true),
      // No dtContainer — it reserves x=410→576 and clips text to ~71% width
      textContainer(2,  'content', content,  0,   6, DISPLAY_WIDTH,      244), // y=6→250, avoids zone boundary y=252
      textContainer(4,  'card',    cardText, 28, 254, DISPLAY_WIDTH - 28,  34), // y=254→288
    ],
    imageObject: [
      new ImageContainerProperty({ containerID: 10, containerName: 'card-icon', xPosition: 0, yPosition: 258, width: 25, height: 20 }),
    ],
    imageData: [
      { id: 10, name: 'card-icon', data: Array.from(deckIconPngBytes()) },
    ],
  };
}

// Answer screen.
function buildAnswer(): PageConfig {
  const aLabel    = 'Answer';
  const pad       = Math.max(0, Math.floor((CHARS_PER_LINE - aLabel.length) / 2));
  const title     = '\u00A0'.repeat(pad) + aLabel;
  const wrapped   = wordWrap(state.answerText);
  const justified = justifyWrapped(wrapped);
  const body      = justified.length > VISIBLE_LINES
    ? applyScrollIndicators(justified, 0, VISIBLE_LINES)
    : justified.join('\n');
  const content  = title + '\n' + body;
  const cardText = `Card ${state.cardNumber}/${state.totalCards}`;

  return {
    textObject: [
      textContainer(99, 'evt',     ' ',      0,   0, 1,                   1,  true),
      textContainer(2,  'content', content,  0,   6, DISPLAY_WIDTH,      246),
      textContainer(4,  'card',    cardText, 28, 254, DISPLAY_WIDTH - 28,  34),
    ],
    imageObject: [
      new ImageContainerProperty({ containerID: 10, containerName: 'card-icon', xPosition: 0, yPosition: 258, width: 25, height: 20 }),
    ],
    imageData: [
      { id: 10, name: 'card-icon', data: Array.from(deckIconPngBytes()) },
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
      textContainer(1, 'header', header, 0, 0, DISPLAY_WIDTH, 45),
      textContainer(3, 'footer', footer, 0, 252, DISPLAY_WIDTH, 36),
    ],
    listObject: [
      listContainer(2, 'ratings', items, 0, 45, DISPLAY_WIDTH, 208, true),
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
      textContainer(1,  'header', header, 0, 0, DISPLAY_WIDTH, 45),
      textContainer(2,  'body',   body,   0, 45,   DISPLAY_WIDTH, 208, false, true),
      textContainer(3,  'footer', footer, 0, 252, DISPLAY_WIDTH, 36),
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
