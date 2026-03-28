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
} from '@evenrealities/even_hub_sdk';
import { state, getBridge, RATING_OPTIONS } from './state';
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
const CARD_BORDER_RADIUS = 8;        // matches G2 background layer card

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
    paddingLength: card ? 8 : 4,
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
    borderWidth: 1,
    borderColor: BORDER_COLOR_WHITE,
    borderRadius: CARD_BORDER_RADIUS,
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
}

async function rebuildPage(config: PageConfig): Promise<void> {
  const bridge = getBridge();
  const totalContainers =
    (config.textObject?.length ?? 0) + (config.listObject?.length ?? 0);

  const payload = {
    containerTotalNum: totalContainers,
    textObject: config.textObject ?? [],
    listObject: config.listObject ?? [],
  };

  if (!state.startupRendered) {
    await bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer(payload),
    );
    state.startupRendered = true;
  } else {
    await bridge.rebuildPageContainer(new RebuildPageContainer(payload));
  }
}

// ── Layout zones (576×288 display) ───────────────────────────
// Header  y=0   h=44  — title + separator
// Body    y=44  h=208 — scrollable content
// Footer  y=252 h=36  — gesture hints | screen label

const ZONE = {
  header: { y: 0,   h: 44  },
  body:   { y: 44,  h: 208 },
  footer: { y: 252, h: 36  },
} as const;

// ── Screen builders ──────────────────────────────────────────

function buildWelcome(): PageConfig {
  const header = buildTitleBlock('BioLoop');
  const body = [
    '',
    'Biometric-adaptive',
    'spaced repetition.',
    '',
    'Click  : Planned session',
    'Scroll : Pick a subject',
  ].join('\n');
  const footer = buildFooter(
    [{ gesture: 'Click', action: 'Start' }],
    'Welcome',
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

function buildNoDecks(): PageConfig {
  const header = buildTitleBlock('BioLoop');
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
    [{ gesture: 'Scroll', action: 'Select' }, { gesture: 'Click', action: 'Start' }],
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
  const header = buildTitleBlock('BioLoop');
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
    [{ gesture: 'Click', action: 'Study' }, { gesture: 'Scroll\u2193', action: 'ML' }],
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
    [{ gesture: 'Click', action: 'Reveal' }],
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
    [{ gesture: 'Click', action: 'Rate' }],
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
    [{ gesture: 'Scroll', action: 'Select' }, { gesture: 'Click', action: 'Confirm' }],
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
    [{ gesture: 'Click', action: 'Dashboard' }],
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
