// ============================================================
// Adaptive Learning G2 — Glasses Display Renderer
// Renders to Even G2 576×288 display via SDK containers
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
  buildActionBar,
  buildHeaderLine,
  truncateLines,
  wordWrap,
  applyScrollIndicators,
  VISIBLE_LINES,
  separator,
} from './display-utils';

// ── Container helpers ────────────────────────────────────────

function textContainer(
  id: number,
  name: string,
  content: string,
  x: number,
  y: number,
  w: number,
  h: number,
  isEvt = false,
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
    paddingLength: 4,
    borderWidth: 0,
    borderColor: 0,
    borderRdaius: 0,
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
    borderRdaius: 0,
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

// ── Screen builders ──────────────────────────────────────────

function buildWelcome(): PageConfig {
  const title = buildHeaderLine('Welcome to StudyHub');
  const body = [
    '',
    'Click: Planned Study',
    'Scroll: Pick a Subject',
  ].join('\n');

  return {
    textObject: [
      textContainer(99, 'evt', ' ', 0, 0, 1, 1, true),
      textContainer(1, 'title', title, 0, 100, DISPLAY_WIDTH, 64),
      textContainer(2, 'body', body, 0, 170, DISPLAY_WIDTH, 100),
    ],
  };
}

function buildNoDecks(): PageConfig {
  const title = buildHeaderLine('Welcome to StudyHub');
  const body = [
    'No study material found.',
    '',
    'Open the app on your phone',
    'to upload what you want',
    'to study.',
  ].join('\n');

  return {
    textObject: [
      textContainer(99, 'evt', ' ', 0, 0, 1, 1, true),
      textContainer(1, 'title', title, 0, 50, DISPLAY_WIDTH, 64),
      textContainer(2, 'body', body, 0, 120, DISPLAY_WIDTH, 160),
    ],
  };
}

function buildDeckSelect(): PageConfig {
  const title = 'Pick a Subject';
  const lines = state.deckNames.map(
    (name, i) => (i === state.deckSelectIdx ? '> ' : '  ') + name,
  );
  // Apply scroll indicators if many decks
  const body = lines.length > VISIBLE_LINES
    ? applyScrollIndicators(lines, Math.max(0, state.deckSelectIdx - 4), VISIBLE_LINES)
    : lines.join('\n');
  const hint = buildActionBar([
    { gesture: 'Up/Down', action: 'select' },
    { gesture: 'Click', action: 'start' },
  ]);

  return {
    textObject: [
      textContainer(99, 'evt', ' ', 0, 0, 1, 1, true),
      textContainer(1, 'title', title, 0, 6, DISPLAY_WIDTH, 36),
      textContainer(2, 'body', body, 0, 44, DISPLAY_WIDTH, 200),
      textContainer(3, 'hint', hint, 0, 252, DISPLAY_WIDTH, 32),
    ],
  };
}

function buildDashboard(): PageConfig {
  const title = 'Adaptive Learning';
  const hasModel = state.modelStatus !== 'collecting_data' && state.modelStatus !== 'error';
  const r2Suffix = hasModel ? ` | R²: ${state.modelR2.toFixed(2)}` : '';
  const topStyle = state.topStyles[0] ?? '—';
  const body = [
    state.deckName || 'No deck loaded',
    separator(24),
    `Cards due: ${state.cardsDue}`,
    `Model: ${state.modelStatus}${r2Suffix}`,
    `Best style: ${topStyle}`,
    `Observations: ${state.obsCount}`,
  ].join('\n');
  const hint = buildActionBar([
    { gesture: 'Click', action: 'Start' },
    { gesture: 'Scroll↓', action: 'ML info' },
  ]);

  return {
    textObject: [
      textContainer(99, 'evt', ' ', 0, 0, 1, 1, true),
      textContainer(1, 'title', title, 0, 6, DISPLAY_WIDTH, 36),
      textContainer(2, 'body', body, 0, 44, DISPLAY_WIDTH, 200),
      textContainer(3, 'hint', hint, 0, 252, DISPLAY_WIDTH, 32),
    ],
  };
}

function buildModelInsights(): PageConfig {
  const title = 'ML Model Insights';
  const hasModel = state.modelStatus !== 'collecting_data' && state.modelStatus !== 'error';
  const r2Text = hasModel ? `R²: ${state.modelR2.toFixed(2)}` : 'R²: pending';
  const obsNeeded = state.obsCount < 15 ? ` (${15 - state.obsCount} more needed)` : '';
  const styleLines = state.topStyles.length > 0
    ? state.topStyles.map((s, i) => `${i + 1}. ${s}`)
    : ['(collect 15+ obs to train)'];
  const body = [
    `Status: ${state.modelStatus}`,
    `${r2Text} | Obs: ${state.obsCount}${obsNeeded}`,
    separator(24),
    'Top styles:',
    ...styleLines,
  ].join('\n');
  const hint = buildActionBar([
    { gesture: 'Scroll↑', action: 'Back' },
    { gesture: 'Dbl-tap', action: 'Home' },
  ]);

  return {
    textObject: [
      textContainer(99, 'evt', ' ', 0, 0, 1, 1, true),
      textContainer(1, 'title', title, 0, 6, DISPLAY_WIDTH, 36),
      textContainer(2, 'body', body, 0, 44, DISPLAY_WIDTH, 200),
      textContainer(3, 'hint', hint, 0, 252, DISPLAY_WIDTH, 32),
    ],
  };
}

function buildQuestion(): PageConfig {
  const title = `Card ${state.cardNumber}/${state.totalCards}`;
  // Word-wrap and apply scroll indicators for long questions
  const wrapped = wordWrap(state.questionText);
  const body = wrapped.length > VISIBLE_LINES
    ? applyScrollIndicators(wrapped, 0, VISIBLE_LINES)
    : truncateLines(state.questionText);
  const hint = buildActionBar([{ gesture: 'Click', action: 'Show answer' }]);

  return {
    textObject: [
      textContainer(99, 'evt', ' ', 0, 0, 1, 1, true),
      textContainer(1, 'title', title, 0, 6, DISPLAY_WIDTH, 36),
      textContainer(2, 'body', body, 0, 44, DISPLAY_WIDTH, 200),
      textContainer(3, 'hint', hint, 0, 252, DISPLAY_WIDTH, 32),
    ],
  };
}

function buildAnswer(): PageConfig {
  const title = `Answer ${state.cardNumber}/${state.totalCards}`;
  // Word-wrap and apply scroll indicators for long answers
  const wrapped = wordWrap(state.answerText);
  const body = wrapped.length > VISIBLE_LINES
    ? applyScrollIndicators(wrapped, 0, VISIBLE_LINES)
    : truncateLines(state.answerText);
  const hint = buildActionBar([{ gesture: 'Click', action: 'Rate' }]);

  return {
    textObject: [
      textContainer(99, 'evt', ' ', 0, 0, 1, 1, true),
      textContainer(1, 'title', title, 0, 6, DISPLAY_WIDTH, 36),
      textContainer(2, 'body', body, 0, 44, DISPLAY_WIDTH, 200),
      textContainer(3, 'hint', hint, 0, 252, DISPLAY_WIDTH, 32),
    ],
  };
}

function buildRating(): PageConfig {
  const title = 'Rate your recall';
  const items = RATING_OPTIONS.map(
    (r) => r.charAt(0).toUpperCase() + r.slice(1),
  );
  const hint = buildActionBar([
    { gesture: 'Scroll', action: 'select' },
    { gesture: 'Click', action: 'confirm' },
  ]);

  return {
    textObject: [
      textContainer(1, 'title', title, 0, 6, DISPLAY_WIDTH, 36),
      textContainer(3, 'hint', hint, 0, 252, DISPLAY_WIDTH, 32),
    ],
    listObject: [
      listContainer(2, 'ratings', items, 0, 44, DISPLAY_WIDTH, 200, true),
    ],
  };
}

function buildSummary(): PageConfig {
  const title = 'Session Complete';
  const body = state.summaryText;
  const hint = buildActionBar([{ gesture: 'Click', action: 'Dashboard' }]);

  return {
    textObject: [
      textContainer(99, 'evt', ' ', 0, 0, 1, 1, true),
      textContainer(1, 'title', title, 0, 6, DISPLAY_WIDTH, 36),
      textContainer(2, 'body', body, 0, 44, DISPLAY_WIDTH, 200),
      textContainer(3, 'hint', hint, 0, 252, DISPLAY_WIDTH, 32),
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
