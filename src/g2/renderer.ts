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
import { bedIconBytes } from './image-utils';
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
    await bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer(payload),
    );
    state.startupRendered = true;
  } else {
    await bridge.rebuildPageContainer(new RebuildPageContainer(payload));
  }

  // Push raw pixel data for each image container (must be sequential per SDK docs)
  if (config.imageData?.length) {
    for (const img of config.imageData) {
      await bridge.updateImageRawData(
        new ImageRawDataUpdate({ containerID: img.id, containerName: img.name, imageData: img.data }),
      );
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

function buildWelcome(): PageConfig {
  // Date/time — right-aligned at top via character padding (monospace font, 32 cols = 576px)
  const now     = new Date();
  const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dtLine  = `${dateStr}  ${timeStr}`.padStart(CHARS_PER_LINE);

  // Greeting — split into shorter lines so each line centers visibly
  // "Welcome to StudyHub," = 20 chars → 6 leading spaces (clear centering)
  // name + "."            = varies   → centered individually
  // "What would you like to do?" = 26 chars → 3 leading spaces
  const name   = state.userName || 'StudyHub';
  const center = (s: string) =>
    ' '.repeat(Math.max(0, Math.floor((CHARS_PER_LINE - s.length) / 2))) + s;
  const greeting = [
    center('Welcome to StudyHub,'),
    center(name + '.'),
    '',
    center('What would you like to do?'),
  ].join('\n');

  // List — lower portion, items right-shifted with leading spaces so they
  // appear in the right half of the display (x-position on list may be ignored by SDK)
  const PAD = ' '.repeat(14); // 14 spaces + 17-char item ≈ right half of 32-col display
  const menuItems = [PAD + 'Continue Studying', PAD + 'View Insights'];

  return {
    textObject: [
      textContainer(1, 'dt',       dtLine,   0, 4,   DISPLAY_WIDTH, 36),
      textContainer(2, 'greeting', greeting, 0, 88,  DISPLAY_WIDTH, 100),
    ],
    listObject: [
      listContainer(3, 'menu', menuItems, 0, 196, DISPLAY_WIDTH, 92, true),
    ],
  };
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

const SCREEN_BUILDERS: Record<string, () => PageConfig> = {
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
  const config = builder();
  log(`Rendering: ${state.screen}`);
  await rebuildPage(config);
}
