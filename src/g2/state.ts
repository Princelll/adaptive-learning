// ============================================================
// Adaptive Learning G2 — Application State
// ============================================================

import type { EvenAppBridge } from '@evenrealities/even_hub_sdk';
import type { ConfidenceRating } from '../core/models';

/** All screens the glasses can show */
export type Screen =
  | 'sleep_checkin'
  | 'welcome'
  | 'no_decks'
  | 'study_menu'
  | 'deck_select'
  | 'dashboard'
  | 'model_insights'
  | 'question'
  | 'answer'
  | 'rating'
  | 'summary';

/** Rating options for the list */
export const RATING_OPTIONS: ConfidenceRating[] = ['again', 'hard', 'good', 'easy'];

export interface AppState {
  screen: Screen;
  startupRendered: boolean;

  // User
  userName: string;

  // Session
  questionText: string;
  answerText: string;
  cardNumber: number;
  totalCards: number;
  cardsCorrect: number;
  ratingIdx: number;

  // Summary
  summaryText: string;

  // Dashboard
  deckName: string;
  cardsDue: number;
  modelStatus: string;
  obsCount: number;
  modelR2: number;
  topStyles: string[];

  // Deck selection
  deckNames: string[];
  deckIds: string[];
  deckSelectIdx: number;

  // Sleep check-in (0=Bad 1=Regular 2=Good 3=Great)
  sleepSelectIdx: number;
}

export const state: AppState = {
  screen: 'welcome',
  startupRendered: false,

  userName: '',

  questionText: '',
  answerText: '',
  cardNumber: 0,
  totalCards: 0,
  cardsCorrect: 0,
  ratingIdx: 2,

  summaryText: '',

  deckName: '',
  cardsDue: 0,
  modelStatus: 'collecting_data',
  obsCount: 0,
  modelR2: 0,
  topStyles: [],

  deckNames: [],
  deckIds: [],
  deckSelectIdx: 0,

  sleepSelectIdx: 1, // default: Regular
};

// Bridge reference — set once at init
let _bridge: EvenAppBridge | null = null;

export function setBridge(b: EvenAppBridge): void {
  _bridge = b;
}

export function getBridge(): EvenAppBridge {
  if (!_bridge) throw new Error('Bridge not initialized');
  return _bridge;
}
