// ============================================================
// Adaptive Learning G2 — Main App Logic
// Connects SDK bridge, storage, session manager, and renderer
// ============================================================

import { state, RATING_OPTIONS, getBridge } from './state';
import { showScreen, preloadWelcomeIcons } from './renderer';
import { onEvenHubEvent, setAppActions } from './events';
import { log } from './log';
import { separator } from './display-utils';
import {
  connectToGlasses,
  safeShowScreen,
  onConnectionStatusChange,
} from './connection';
import { Storage } from '../core/storage';
import { Scheduler } from '../core/scheduler';
import { SessionManager, SessionEvents } from '../core/session';
import { createSampleDecks } from '../data/sample-decks';
import type { ConfidenceRating, StudySession } from '../core/models';
import { State } from 'ts-fsrs';

let storage: Storage;
let scheduler: Scheduler;
let sessionManager: SessionManager | null = null;
let currentDeckId: string | null = null;

// ── Session event callbacks ──────────────────────────────────

const sessionEvents: SessionEvents = {
  onStateChange: (sessionState) => {
    state.cardNumber = sessionState.cardsReviewed + 1;
    state.cardsCorrect = sessionState.cardsCorrect;
    state.totalCards = sessionState.cardsRemaining + sessionState.cardsReviewed;
    updateBrowserStatus();
  },

  onSessionEnd: (session: StudySession) => {
    const pct = session.cardsReviewed > 0
      ? Math.round((session.cardsCorrect / session.cardsReviewed) * 100)
      : 0;
    state.summaryText = [
      `Cards: ${session.cardsReviewed}`,
      `Correct: ${session.cardsCorrect} (${pct}%)`,
      separator(24),
      `Avg time: ${(session.averageLatencyMs / 1000).toFixed(1)}s`,
    ].join('\n');
    state.screen = 'summary';
    void safeShowScreen();
  },

  onCardDisplay: (text: string, isFront: boolean) => {
    if (isFront) {
      state.questionText = text;
      state.screen = 'question';
    } else {
      state.answerText = text;
      state.screen = 'answer';
    }
    void safeShowScreen();
  },

  onLog: (msg: string) => {
    log(msg);
  },
};

// ── App actions (called by events.ts) ────────────────────────

async function startSession(): Promise<void> {
  if (!currentDeckId || !sessionManager) {
    log('No deck loaded');
    return;
  }

  const profile = await storage.getProfile();

  log('Starting session');

  try {
    await sessionManager.startSession(
      currentDeckId,
      null,
      null,   // zScores — null until ring data available
      profile.confounders,
    );
  } catch (err) {
    log(`Session error: ${err}`);
    state.screen = 'dashboard';
    void safeShowScreen();
  }
}

function revealAnswer(): void {
  if (!sessionManager) return;
  sessionManager.revealAnswer();
}

async function rateCard(idx: number): Promise<void> {
  if (!sessionManager) return;
  const rating = RATING_OPTIONS[idx] as ConfidenceRating;
  log(`Rating: ${rating}`);
  await sessionManager.rateCard(rating, null);
}

function showModelInsights(): void {
  state.screen = 'model_insights';
  void safeShowScreen();
}

async function submitSleepCheckin(): Promise<void> {
  const qualities = ['bad', 'regular', 'good', 'great'] as const;
  const scores    = [0.25,  0.5,      0.75,  1.0];
  await storage.saveSleepEntry({
    date:         new Date().toISOString().slice(0, 10),
    quality:      qualities[state.sleepSelectIdx],
    qualityScore: scores[state.sleepSelectIdx],
    timestamp:    Date.now(),
  });
  log(`Sleep quality logged: ${qualities[state.sleepSelectIdx]}`);
  await refreshDashboard();
  state.screen = state.deckNames.length > 0 ? 'welcome' : 'no_decks';
  void safeShowScreen();
}

async function skipSleepCheckin(): Promise<void> {
  // Record a skipped entry so the screen doesn't reappear today
  await storage.saveSleepEntry({
    date:         new Date().toISOString().slice(0, 10),
    quality:      'skipped',
    qualityScore: null,
    timestamp:    Date.now(),
  });
  log('Sleep check-in skipped for today');
  await refreshDashboard();
  state.screen = state.deckNames.length > 0 ? 'welcome' : 'no_decks';
  void safeShowScreen();
}

async function returnToDashboard(): Promise<void> {
  await refreshDashboard();
  state.screen = state.deckNames.length > 0 ? 'welcome' : 'no_decks';
  void safeShowScreen();
}

async function selectDeck(idx: number): Promise<void> {
  if (idx < 0 || idx >= state.deckIds.length) return;
  currentDeckId = state.deckIds[idx];
  state.deckName = state.deckNames[idx];

  // Refresh due count for the selected deck
  const reviewStates = await storage.getReviewStatesForDeck(currentDeckId);
  const now = Date.now();
  state.cardsDue = reviewStates.filter(s => s.fsrs.due.getTime() <= now).length;
  if (state.cardsDue === 0) {
    state.cardsDue = reviewStates.filter(s => s.totalReviews === 0).length;
  }

  log(`Selected deck: ${state.deckName} (${state.cardsDue} due)`);

  // Show dashboard with deck info + ML status before bio checkin
  state.screen = 'dashboard';
  void safeShowScreen();
}

async function startPlannedStudy(): Promise<void> {
  await refreshDashboard();
  if (state.deckNames.length === 0) {
    state.screen = 'no_decks';
    void safeShowScreen();
    return;
  }
  // Show study mode menu (Programmed Study | Select Deck)
  state.screen = 'study_menu';
  void safeShowScreen();
}

function startProgrammedStudy(): void {
  // Use the default (first) deck already loaded by refreshDashboard
  state.screen = 'dashboard';
  void safeShowScreen();
}

function goToDeckSelect(): void {
  state.screen = 'deck_select';
  void safeShowScreen();
}

// ── Dashboard data refresh ───────────────────────────────────

async function refreshDashboard(): Promise<void> {
  const decks = await storage.getAllDecks();

  // Update deck lists for selection screen
  state.deckNames = decks.map(d => d.name);
  state.deckIds = decks.map(d => d.id);
  state.deckSelectIdx = 0;

  if (decks.length > 0) {
    const deck = decks[0];
    currentDeckId = deck.id;
    state.deckName = deck.name;

    const reviewStates = await storage.getReviewStatesForDeck(deck.id);
    const now = Date.now();
    state.cardsDue = reviewStates.filter(s => s.fsrs.due.getTime() <= now).length;
    if (state.cardsDue === 0) {
      state.cardsDue = reviewStates.filter(s => s.fsrs.state === State.New).length;
    }
  }

  const profile = await storage.getProfile();
  state.modelStatus = profile.modelStatus;
  state.modelR2 = profile.modelR2 ?? 0;

  const obs = await storage.getAllObservations();
  state.obsCount = obs.length;

  // Compute top 3 styles from persisted learned preferences
  const prefs = profile.stylePreferences as Record<string, number>;
  state.topStyles = Object.entries(prefs)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([s]) => s);
}

// ── Browser status panel ─────────────────────────────────────

function updateBrowserStatus(): void {
  const el = document.getElementById('status');
  if (el) {
    el.textContent = `Screen: ${state.screen} | Cards: ${state.cardNumber}/${state.totalCards} | Correct: ${state.cardsCorrect}`;
  }
}

// ── Initialization ───────────────────────────────────────────

export async function initApp(): Promise<void> {
  log('Initializing Adaptive Learning...');

  // Preload welcome screen icons (falls back to programmatic if file missing).
  await preloadWelcomeIcons();

  // Open storage and load/create sample decks
  storage = new Storage();
  await storage.open();

  const existingDecks = await storage.getAllDecks();
  if (existingDecks.length === 0) {
    log('Loading sample decks...');
    const decks = createSampleDecks();
    for (const deck of decks) {
      await storage.saveDeck(deck);
      await storage.ensureReviewStates(deck);
    }
    log(`Loaded ${decks.length} decks`);
  }

  // Init scheduler + session manager
  scheduler = new Scheduler();
  sessionManager = new SessionManager(scheduler, storage, sessionEvents);

  // Wire up event actions
  setAppActions({
    startSession,
    revealAnswer,
    rateCard,
    returnToDashboard,
    selectDeck,
    startPlannedStudy,
    startProgrammedStudy,
    goToDeckSelect,
    showModelInsights,
    submitSleepCheckin,
    skipSleepCheckin,
  });

  // Connect to glasses bridge with error recovery
  onConnectionStatusChange((status) => {
    const el = document.getElementById('status');
    if (el) {
      if (status === 'reconnecting') {
        el.textContent = 'Reconnecting to glasses...';
      } else if (status === 'failed') {
        el.textContent = 'Connection lost. Refresh to retry.';
      } else if (status === 'connected') {
        updateBrowserStatus();
      }
    }
  });

  log('Waiting for glasses bridge...');
  await connectToGlasses(onEvenHubEvent);
  log('Bridge connected with error recovery');

  // Fetch the logged-in Even user's name for the welcome greeting
  try {
    const userInfo = await getBridge().getUserInfo();
    if (userInfo?.name) state.userName = userInfo.name;
  } catch {
    // name stays '' — welcome screen falls back to generic greeting
  }

  // Load deck list for selection screen and dashboard data
  await refreshDashboard();
  const allDecks = await storage.getAllDecks();
  state.deckNames = allDecks.map(d => d.name);
  state.deckIds = allDecks.map(d => d.id);

  // Show sleep check-in once per day on first open, otherwise go to welcome
  const needsSleepCheckin = await storage.needsSleepCheckin();
  if (needsSleepCheckin) {
    state.sleepSelectIdx = 1; // default: Regular
    state.screen = 'sleep_checkin';
  } else {
    state.screen = state.deckNames.length > 0 ? 'welcome' : 'no_decks';
  }
  await showScreen();

  log('StudyHub ready');
  updateBrowserStatus();

  // ── Deck sync: storage event + polling fallback ──────────────
  //
  // The storage event only fires when localStorage is changed by a DIFFERENT
  // browsing context (tab/window). If the companion and G2 app are on different
  // origins (e.g. localhost vs 127.0.0.1) or in the same window, the event may
  // not fire. The 2-second poll below catches all cases.

  let lastStorageHash = localStorage.getItem('adaptive_learning_data') ?? '';

  async function syncDecksFromStorage(): Promise<void> {
    await storage.open();
    const allDecks = await storage.getAllDecks();
    state.deckNames = allDecks.map(d => d.name);
    state.deckIds = allDecks.map(d => d.id);
    state.deckSelectIdx = 0;
    if (allDecks.length > 0) {
      currentDeckId = allDecks[0].id;
      state.deckName = allDecks[0].name;
      const reviewStates = await storage.getReviewStatesForDeck(allDecks[0].id);
      const now = Date.now();
      state.cardsDue = reviewStates.filter(s => s.fsrs.due.getTime() <= now).length;
      if (state.cardsDue === 0) {
        state.cardsDue = reviewStates.filter(s => s.fsrs.state === State.New).length;
      }
    }
    if (state.screen === 'welcome' || state.screen === 'deck_select' || state.screen === 'no_decks') {
      state.screen = state.deckNames.length > 0 ? 'welcome' : 'no_decks';
      void safeShowScreen();
    }
    updateBrowserStatus();
    log(`Decks reloaded: ${allDecks.length} total`);
  }

  // storage event — fires immediately when another tab on the same origin writes
  window.addEventListener('storage', async (e: StorageEvent) => {
    if (e.key === 'adaptive_learning_data') {
      log('Storage event: companion updated data');
      lastStorageHash = localStorage.getItem('adaptive_learning_data') ?? '';
      await syncDecksFromStorage();
    }
  });

  // Polling fallback — catches changes the storage event misses (cross-origin,
  // same-window writes, or race conditions). Runs every 2 s, only on idle screens.
  setInterval(() => {
    const current = localStorage.getItem('adaptive_learning_data') ?? '';
    if (current !== lastStorageHash) {
      lastStorageHash = current;
      log('Poll detected storage change — reloading decks');
      void syncDecksFromStorage();
    }
  }, 2000);
}
