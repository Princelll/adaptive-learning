// ============================================================
// Adaptive Learning G2 — Event Handling
// Normalizes SDK events and dispatches to app actions
// ============================================================

import { OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk';
import { state, RATING_OPTIONS } from './state';
import { safeShowScreen } from './connection';
import { log } from './log';

// Forward declarations — set by app.ts to avoid circular imports
let startSessionFn: () => Promise<void> = async () => {};
let revealAnswerFn: () => void = () => {};
let rateCardFn: (idx: number) => Promise<void> = async () => {};
let returnToDashboardFn: () => Promise<void> = async () => {};
let selectDeckFn: (idx: number) => Promise<void> = async () => {};
let startPlannedStudyFn: () => Promise<void> = async () => {};
let startProgrammedStudyFn: () => void = () => {};
let goToDeckSelectFn: () => void = () => {};
let showModelInsightsFn: () => void = () => {};
let submitSleepCheckinFn: () => Promise<void> = async () => {};
let skipSleepCheckinFn: () => Promise<void> = async () => {};

export function setAppActions(actions: {
  startSession: () => Promise<void>;
  revealAnswer: () => void;
  rateCard: (idx: number) => Promise<void>;
  returnToDashboard: () => Promise<void>;
  selectDeck: (idx: number) => Promise<void>;
  startPlannedStudy: () => Promise<void>;
  startProgrammedStudy: () => void;
  goToDeckSelect: () => void;
  showModelInsights: () => void;
  submitSleepCheckin: () => Promise<void>;
  skipSleepCheckin: () => Promise<void>;
}): void {
  startSessionFn = actions.startSession;
  revealAnswerFn = actions.revealAnswer;
  rateCardFn = actions.rateCard;
  returnToDashboardFn = actions.returnToDashboard;
  selectDeckFn = actions.selectDeck;
  startPlannedStudyFn = actions.startPlannedStudy;
  startProgrammedStudyFn = actions.startProgrammedStudy;
  goToDeckSelectFn = actions.goToDeckSelect;
  showModelInsightsFn = actions.showModelInsights;
  submitSleepCheckinFn = actions.submitSleepCheckin;
  skipSleepCheckinFn = actions.skipSleepCheckin;
}

// ── Gesture debouncing (tuned for G2 hardware per even-toolkit) ──

const SCROLL_COOLDOWN_MS = 250;
const TAP_COOLDOWN_MS = 400;
const DOUBLE_TAP_COOLDOWN_MS = 600;
let lastScrollTime = 0;
let lastTapTime = 0;
let lastDoubleTapTime = 0;

function scrollThrottled(): boolean {
  const now = Date.now();
  if (now - lastScrollTime < SCROLL_COOLDOWN_MS) return true;
  lastScrollTime = now;
  return false;
}

function tapThrottled(): boolean {
  const now = Date.now();
  if (now - lastTapTime < TAP_COOLDOWN_MS) return true;
  lastTapTime = now;
  return false;
}

function doubleTapThrottled(): boolean {
  const now = Date.now();
  if (now - lastDoubleTapTime < DOUBLE_TAP_COOLDOWN_MS) return true;
  lastDoubleTapTime = now;
  return false;
}

export function resolveEventType(
  event: EvenHubEvent,
): OsEventTypeList | undefined {
  const raw =
    event.listEvent?.eventType ??
    event.textEvent?.eventType ??
    event.sysEvent?.eventType ??
    ((event.jsonData ?? {}) as Record<string, unknown>).eventType ??
    ((event.jsonData ?? {}) as Record<string, unknown>).event_type ??
    ((event.jsonData ?? {}) as Record<string, unknown>).Event_Type ??
    ((event.jsonData ?? {}) as Record<string, unknown>).type;

  if (typeof raw === 'number') {
    switch (raw) {
      case 0: return OsEventTypeList.CLICK_EVENT;
      case 1: return OsEventTypeList.SCROLL_TOP_EVENT;
      case 2: return OsEventTypeList.SCROLL_BOTTOM_EVENT;
      case 3: return OsEventTypeList.DOUBLE_CLICK_EVENT;
      default: return undefined;
    }
  }

  if (typeof raw === 'string') {
    const v = raw.toUpperCase();
    if (v.includes('DOUBLE')) return OsEventTypeList.DOUBLE_CLICK_EVENT;
    if (v.includes('CLICK')) return OsEventTypeList.CLICK_EVENT;
    if (v.includes('SCROLL_TOP') || v.includes('UP'))
      return OsEventTypeList.SCROLL_TOP_EVENT;
    if (v.includes('SCROLL_BOTTOM') || v.includes('DOWN'))
      return OsEventTypeList.SCROLL_BOTTOM_EVENT;
  }

  // SDK normalizes CLICK_EVENT (0) to undefined — treat as click
  if (event.listEvent || event.textEvent || event.sysEvent)
    return OsEventTypeList.CLICK_EVENT;

  return undefined;
}

// ── Main event dispatcher ────────────────────────────────────

export function onEvenHubEvent(event: EvenHubEvent): void {
  const eventType = resolveEventType(event);

  // Study menu: 0 = Programmed Study, 1 = Select Deck
  if (state.screen === 'study_menu' && event.listEvent) {
    const listIdx = event.listEvent.currentSelectItemIndex ?? 0;
    if (eventType === OsEventTypeList.CLICK_EVENT) {
      log(`Study menu selected: ${listIdx}`);
      if (listIdx === 0) startProgrammedStudyFn();
      else goToDeckSelectFn();
      return;
    }
    return;
  }

  // Welcome menu: 0 = Continue Studying, 1 = View Insights
  if (state.screen === 'welcome' && event.listEvent) {
    const listIdx = event.listEvent.currentSelectItemIndex ?? 0;
    if (eventType === OsEventTypeList.CLICK_EVENT) {
      log(`Welcome menu selected: ${listIdx}`);
      if (listIdx === 0) void startPlannedStudyFn();
      else showModelInsightsFn();
      return;
    }
    return;
  }

  // For rating screen with list, check for list selection
  if (state.screen === 'rating' && event.listEvent) {
    const listIdx = event.listEvent.currentSelectItemIndex ?? 0;
    if (eventType === OsEventTypeList.CLICK_EVENT) {
      log(`Rating selected: ${RATING_OPTIONS[listIdx]}`);
      void rateCardFn(listIdx);
      return;
    }
    return;
  }

  log(`Event: type=${String(eventType)} screen=${state.screen}`);

  switch (eventType) {
    case OsEventTypeList.CLICK_EVENT:
      if (!tapThrottled()) handleClick();
      break;

    case OsEventTypeList.SCROLL_TOP_EVENT:
      if (!scrollThrottled()) handleScrollUp();
      break;

    case OsEventTypeList.SCROLL_BOTTOM_EVENT:
      if (!scrollThrottled()) handleScrollDown();
      break;

    case OsEventTypeList.DOUBLE_CLICK_EVENT:
      if (!doubleTapThrottled()) {
        if (state.screen === 'sleep_checkin') void skipSleepCheckinFn();
        else void returnToDashboardFn();
      }
      break;
  }
}

// ── Click handler ────────────────────────────────────────────

function handleClick(): void {
  switch (state.screen) {
    case 'sleep_checkin':
      void submitSleepCheckinFn();
      break;

    case 'deck_select':
      void selectDeckFn(state.deckSelectIdx);
      break;

    case 'dashboard':
      // Start session directly — no bio check-in
      void startSessionFn();
      break;

    case 'question':
      revealAnswerFn();
      break;

    case 'answer':
      state.screen = 'rating';
      state.ratingIdx = 2;
      void safeShowScreen();
      break;

    case 'model_insights':
      state.screen = 'dashboard';
      void safeShowScreen();
      break;

    case 'summary':
      void returnToDashboardFn();
      break;
  }
}

// ── Scroll handlers ──────────────────────────────────────────

function handleScrollUp(): void {
  switch (state.screen) {
    case 'sleep_checkin':
      // Scroll up = move selection left (toward Bad)
      state.sleepSelectIdx = Math.max(0, state.sleepSelectIdx - 1);
      void safeShowScreen();
      break;

    case 'model_insights':
      state.screen = 'dashboard';
      void safeShowScreen();
      break;

    case 'deck_select':
      state.deckSelectIdx = Math.max(0, state.deckSelectIdx - 1);
      void safeShowScreen();
      break;
  }
}

function handleScrollDown(): void {
  switch (state.screen) {
    case 'sleep_checkin':
      // Scroll down = move selection right (toward Great)
      state.sleepSelectIdx = Math.min(3, state.sleepSelectIdx + 1);
      void safeShowScreen();
      break;

    case 'dashboard':
      showModelInsightsFn();
      break;

    case 'deck_select': {
      const deckMax = state.deckNames.length - 1;
      state.deckSelectIdx = Math.min(deckMax, state.deckSelectIdx + 1);
      void safeShowScreen();
      break;
    }
  }
}
