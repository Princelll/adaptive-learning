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
import { bedIconBytes, userBookIconPngBytes, userInsightsIconPngBytes, canvasToPngBytes } from './image-utils';
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
      dtContainer(20),
      textContainer(2,  'body',   body,           0, 28,  DISPLAY_WIDTH, 200, false, true),
      textContainer(3,  'footer', footer,         0, 252, DISPLAY_WIDTH, 36),
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
// Lists the two study modes: Programmed Study (uses first deck) and Select Deck.
function buildStudyMenu(): PageConfig {
  return {
    textObject: [
      dtContainer(36),
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
      dtContainer(36),
      textContainer(2,  'body',   body,           0, 45, DISPLAY_WIDTH, 208, false, true),
      textContainer(3,  'footer', footer,         0, 252, DISPLAY_WIDTH, 36),
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
      dtContainer(20),
      textContainer(2,  'title', title,          0, 28, DISPLAY_WIDTH, 20),
      textContainer(3,  'body',  body,           0, 52, DISPLAY_WIDTH, 196,         false, true),
      textContainer(4,  'card',  cardLine,       0, 252, DISPLAY_WIDTH, 36),
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
      dtContainer(20),
      textContainer(2,  'title', title,          0, 28, DISPLAY_WIDTH, 20),
      textContainer(3,  'body',  body,           0, 52, DISPLAY_WIDTH, 196,         false, true),
      textContainer(4,  'card',  cardLine,       0, 252, DISPLAY_WIDTH, 36),
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
