// ============================================================
// Adaptive Learning localStorage Storage Layer
// For Even G2 glasses (no IndexedDB available)
// ============================================================

import { createEmptyCard } from 'ts-fsrs';
import {
  Deck,
  CardReviewState,
  ReviewEvent,
  StudySession,
  LearningProfile,
  DailyBiometric,
  Observation,
  createDefaultProfile,
  createDefaultReviewState,
} from './models';
import type { BanditState } from './bandit';

const KEY = 'adaptive_learning_data';

/** One self-reported sleep quality entry per day */
export interface SleepLogEntry {
  /** ISO date YYYY-MM-DD */
  date: string;
  quality: 'bad' | 'regular' | 'good' | 'great' | 'skipped';
  /** 0.25 / 0.5 / 0.75 / 1.0, or null if skipped */
  qualityScore: number | null;
  timestamp: number;
}

interface StoredData {
  decks: Deck[];
  reviewStates: CardReviewState[];
  reviewEvents: ReviewEvent[];
  sessions: StudySession[];
  profile: LearningProfile | null;
  biometricHistory: DailyBiometric[];
  observations: Observation[];
  banditState: BanditState | null;
  sleepLog: SleepLogEntry[];
}

function emptyData(): StoredData {
  return {
    decks: [],
    reviewStates: [],
    reviewEvents: [],
    sessions: [],
    profile: null,
    biometricHistory: [],
    observations: [],
    banditState: null,
    sleepLog: [],
  };
}

export class Storage {
  private data: StoredData;

  constructor() {
    this.data = emptyData();
  }

  async open(): Promise<void> {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        this.data = { ...emptyData(), ...JSON.parse(raw) };
        // Revive FSRS Date objects (JSON serializes them as strings)
        for (const state of this.data.reviewStates) {
          if (!state.fsrs) {
            state.fsrs = createEmptyCard(); // heal missing fsrs (corrupted/old data)
          } else {
            state.fsrs.due = new Date(state.fsrs.due);
            if (state.fsrs.last_review) {
              state.fsrs.last_review = new Date(state.fsrs.last_review);
            }
          }
        }
      }
    } catch {
      this.data = emptyData();
    }
  }

  private persist(): void {
    localStorage.setItem(KEY, JSON.stringify(this.data));
  }

  // ── Decks ──────────────────────────────────────────────────

  async saveDeck(deck: Deck): Promise<void> {
    const idx = this.data.decks.findIndex(d => d.id === deck.id);
    if (idx >= 0) this.data.decks[idx] = deck;
    else this.data.decks.push(deck);
    this.persist();
  }

  async getDeck(id: string): Promise<Deck | undefined> {
    return this.data.decks.find(d => d.id === id);
  }

  async getAllDecks(): Promise<Deck[]> {
    return this.data.decks;
  }

  async deleteDeck(id: string): Promise<void> {
    this.data.decks = this.data.decks.filter(d => d.id !== id);
    this.persist();
  }

  // ── Review States ──────────────────────────────────────────

  async saveReviewState(state: CardReviewState): Promise<void> {
    const idx = this.data.reviewStates.findIndex(s => s.cardId === state.cardId);
    if (idx >= 0) this.data.reviewStates[idx] = state;
    else this.data.reviewStates.push(state);
    this.persist();
  }

  async getReviewState(cardId: string): Promise<CardReviewState | undefined> {
    return this.data.reviewStates.find(s => s.cardId === cardId);
  }

  async getReviewStatesForDeck(deckId: string): Promise<CardReviewState[]> {
    return this.data.reviewStates.filter(s => s.deckId === deckId);
  }

  async ensureReviewStates(deck: Deck): Promise<void> {
    for (const card of deck.cards) {
      const existing = await this.getReviewState(card.id);
      if (!existing) {
        await this.saveReviewState(createDefaultReviewState(card.id, deck.id));
      }
    }
  }

  // ── Review Events ──────────────────────────────────────────

  async saveReviewEvent(event: ReviewEvent): Promise<void> {
    this.data.reviewEvents.push(event);
    this.persist();
  }

  async getReviewEventsForSession(sessionId: string): Promise<ReviewEvent[]> {
    return this.data.reviewEvents.filter(e => e.sessionId === sessionId);
  }

  async getReviewEventsForCard(cardId: string): Promise<ReviewEvent[]> {
    return this.data.reviewEvents.filter(e => e.cardId === cardId);
  }

  async getAllReviewEvents(): Promise<ReviewEvent[]> {
    return this.data.reviewEvents;
  }

  // ── Sessions ───────────────────────────────────────────────

  async saveSession(session: StudySession): Promise<void> {
    const idx = this.data.sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) this.data.sessions[idx] = session;
    else this.data.sessions.push(session);
    this.persist();
  }

  async getSession(id: string): Promise<StudySession | undefined> {
    return this.data.sessions.find(s => s.id === id);
  }

  async getAllSessions(): Promise<StudySession[]> {
    return this.data.sessions;
  }

  // ── Profile ────────────────────────────────────────────────

  async getProfile(): Promise<LearningProfile> {
    if (this.data.profile) return this.data.profile;
    const profile = createDefaultProfile();
    this.data.profile = profile;
    this.persist();
    return profile;
  }

  async saveProfile(profile: LearningProfile): Promise<void> {
    this.data.profile = profile;
    this.persist();
  }

  // ── Biometric History ──────────────────────────────────────

  async saveDailyBiometric(entry: DailyBiometric): Promise<void> {
    const idx = this.data.biometricHistory.findIndex(e => e.date === entry.date);
    if (idx >= 0) this.data.biometricHistory[idx] = entry;
    else this.data.biometricHistory.push(entry);
    // Trim to 14
    this.data.biometricHistory.sort((a, b) => a.date.localeCompare(b.date));
    if (this.data.biometricHistory.length > 14) {
      this.data.biometricHistory = this.data.biometricHistory.slice(-14);
    }
    this.persist();
  }

  async getBiometricHistory(): Promise<DailyBiometric[]> {
    return this.data.biometricHistory;
  }

  // ── Observations ───────────────────────────────────────────

  async saveObservation(obs: Observation): Promise<void> {
    this.data.observations.push(obs);
    this.persist();
  }

  async getAllObservations(): Promise<Observation[]> {
    return this.data.observations;
  }

  async getObservationsForCard(cardId: string): Promise<Observation[]> {
    return this.data.observations.filter(o => o.cardId === cardId);
  }

  // ── Bandit State ────────────────────────────────────────────

  async getBanditState(): Promise<BanditState | null> {
    return this.data.banditState ?? null;
  }

  async saveBanditState(state: BanditState): Promise<void> {
    this.data.banditState = state;
    this.persist();
  }

  // ── Sleep Log ───────────────────────────────────────────────

  /** Returns true if no sleep entry has been recorded for today yet */
  async needsSleepCheckin(): Promise<boolean> {
    const today = new Date().toISOString().slice(0, 10);
    if (!Array.isArray(this.data.sleepLog)) this.data.sleepLog = [];
    return !this.data.sleepLog.some(e => e.date === today);
  }

  async saveSleepEntry(entry: SleepLogEntry): Promise<void> {
    if (!Array.isArray(this.data.sleepLog)) this.data.sleepLog = [];
    // Upsert by date
    const idx = this.data.sleepLog.findIndex(e => e.date === entry.date);
    if (idx >= 0) this.data.sleepLog[idx] = entry;
    else this.data.sleepLog.push(entry);
    // Keep last 30 days
    this.data.sleepLog.sort((a, b) => a.date.localeCompare(b.date));
    if (this.data.sleepLog.length > 30) {
      this.data.sleepLog = this.data.sleepLog.slice(-30);
    }
    this.persist();
  }

  /** Returns today's self-reported sleep quality score (0-1), or null if not logged */
  async getTodaySleepQuality(): Promise<number | null> {
    const today = new Date().toISOString().slice(0, 10);
    if (!Array.isArray(this.data.sleepLog)) return null;
    const entry = this.data.sleepLog.find(e => e.date === today);
    return entry?.qualityScore ?? null;
  }

  async getSleepLog(): Promise<SleepLogEntry[]> {
    return this.data.sleepLog ?? [];
  }
}
