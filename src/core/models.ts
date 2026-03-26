// ============================================================
// Adaptive Learning Data Models
// ============================================================

import { createEmptyCard } from 'ts-fsrs';
import type { Card as FSRSCard } from 'ts-fsrs';
export type { FSRSCard };

/** Card presentation modes - different ways to display the same content */
export type PresentationMode =
  | 'definition'
  | 'analogy'
  | 'example'
  | 'visual'
  | 'socratic'
  | 'mnemonic'
  | 'step-by-step'
  | 'contrast'
  | 'real_life_example'
  | 'clinical_example'
  | 'story';

// ── Z-Score Biometric Model (Cheng 2022, Schiweck 2018) ────────────

/** Biometric z-scores relative to personal baseline. All fields null until ring data available. */
export interface BiometricZScores {
  /** RMSSD z-score – parasympathetic index. Negative = below personal baseline */
  rmssdZ: number | null;
  /** SpO2 nocturnal dip severity z-score. Positive = worse than usual dipping */
  spo2DipZ: number | null;
  /**
   * SpO2 absolute level z-score vs personal baseline mean.
   * Negative = lower than usual (e.g. personal norm 98%, today 95% → negative z).
   */
  spo2Z: number | null;
  /** Resting HR z-score. Positive = elevated above personal baseline */
  restingHRZ: number | null;
  /** Sleep hours z-score — last night's total sleep vs personal baseline */
  sleepHoursZ: number | null;
  /** REM sleep hours z-score — last night's REM vs personal baseline */
  remHoursZ: number | null;
  /** Sleep quality 0-1 — populated by ring when available, otherwise null */
  sleepQuality: number | null;
  /** Stress state 0-1 — populated by ring when available, otherwise null */
  stressState: number | null;
  /** Cognitive load 0-1 — populated by ring when available, otherwise null */
  cognitiveLoad: number | null;
}

/** Structural confounders – collected once, affect HRV baseline (Licht 2008) */
export interface Confounders {
  /** SSRIs structurally reduce HRV by ~10-15ms RMSSD */
  onSSRI: boolean;
  /** BMI category – obesity associated with lower HRV */
  bmiCategory: 'underweight' | 'normal' | 'overweight' | 'obese';
  /** Smoking reduces HRV structurally */
  smoker: boolean;
}

/** One day of biometric readings for personal baseline calculation */
export interface DailyBiometric {
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Overnight RMSSD in ms — null until ring data available */
  rmssd: number | null;
  /** Resting heart rate in bpm — null until ring data available */
  restingHR: number | null;
  /** SpO2 nocturnal dip severity score 0-1 — null until ring data available */
  spo2Dip: number | null;
  /** Mean SpO2 across hourly readings */
  spo2Avg?: number | null;
  /** Hourly SpO2 readings with timestamps (ISO time string HH:mm) */
  spo2Readings?: { time: string; value: number }[] | null;
  /** Total sleep hours last night — populated from ring or external source */
  sleepHours: number | null;
  /** REM sleep hours last night — populated from ring or external source */
  remHours: number | null;
}

/** Session recommendation from biometric analysis */
export interface SessionRecommendation {
  mode: 'normal' | 'review_only' | 'stop';
  cards: number;
  reason: string | null;
}

/** Calibration status for personal baseline */
export interface CalibrationStatus {
  calibrated: boolean;
  daysRemaining: number;
  totalDays: number;
  message: string;
}

/** Single observation for OLS regression training */
export interface Observation {
  id: string;
  timestamp: number;
  cardId: string;
  sessionId: string;
  features: {
    explanationStyle: string;
    stressLevel: number;
    energyLevel: number;
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    topicPosition: number;
    minutesIntoSession: number;
    daysSinceLastStudy: number;
    priorLevel: number;
    complexity: string;
    course: string;
  };
  confounders: Confounders;
  outcomes: {
    masteryGain: number;
    quickfireCorrect: boolean;
    elaborated: boolean;
    madeOwnConnection: boolean;
    neededReexplanation: boolean;
    recalledCorrectly: boolean;
    latencyMs: number;
  };
}

/** OLS regression analysis result */
export interface RegressionResult {
  status: 'collecting_data' | 'initial_model' | 'refined' | 'mature' | 'error';
  observationsNeeded?: number;
  r_squared?: number;
  adjusted_r_squared?: number;
  n_observations?: number;
  coefficients?: Record<string, {
    beta: number;
    std_error: number;
    t_stat: number;
    p_value: number;
    significant: boolean;
    isConfounder?: boolean;
  }>;
  recommendations?: {
    bestStyle: string;
    styleRanking: { style: string; beta: number; significant: boolean }[];
  };
  message?: string;
}

/** Model dashboard data */
export interface ModelDashboard {
  status: RegressionResult['status'];
  r2: number | null;
  adjR2: number | null;
  nObservations: number;
  styleRanking: { style: string; beta: number; significant: boolean }[];
  significantFactors: string[];
  calibrationDays: number;
  observationsNeeded: number;
}

/** Confidence rating from user input (tap gestures on Frame) */
export type ConfidenceRating = 'again' | 'hard' | 'good' | 'easy';

/** Maps to SM-2 quality scores */
export const CONFIDENCE_QUALITY: Record<ConfidenceRating, number> = {
  again: 0,
  hard: 2,
  good: 4,
  easy: 5,
};

/** Subject complexity tags */
export type ComplexityTag = 'vocabulary' | 'concept' | 'procedure' | 'application' | 'analysis';

/** A single flashcard */
export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  /** Alternative presentation formats */
  presentations?: Partial<Record<PresentationMode, { front: string; back: string }>>;
  complexity: ComplexityTag;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/** A deck of flashcards */
export interface Deck {
  id: string;
  name: string;
  description: string;
  cards: Card[];
  createdAt: number;
  updatedAt: number;
}

/** FSRS-based review state for a single card */
export interface CardReviewState {
  cardId: string;
  deckId: string;
  /** FSRS owns all scheduling state (stability, difficulty, due, reps, lapses, state) */
  fsrs: FSRSCard;
  /** Running count for analytics */
  totalReviews: number;
  /** Consecutive correct streak */
  streak: number;
  bestPresentationMode: PresentationMode | null;
  modePerformance: Partial<Record<PresentationMode, { correct: number; total: number }>>;
}

/** A single review event (for analytics) */
export interface ReviewEvent {
  id: string;
  cardId: string;
  deckId: string;
  timestamp: number;
  rating: ConfidenceRating;
  responseLatencyMs: number;
  presentationMode: PresentationMode;
  biometricSnapshot: BiometricSnapshot | null;
  sessionId: string;
  correct: boolean;
}

/**
 * Biometric data snapshot from R1 PPG — captured at session start, mid-point, and end.
 * Each reading is a short 15–30s processed window, transmitted on-device.
 */
export interface BiometricSnapshot {
  timestamp: number;
  heartRate: number | null;
  /** RMSSD in ms from R1 PPG (replaces legacy hrv field) */
  rmssd: number | null;
  /** Legacy alias kept for backwards compat */
  hrv: number | null;
  spo2: number | null;
  imu: { x: number; y: number; z: number } | null;
  selfReportedState: 'good' | 'tired' | 'stressed' | null;
  /** Z-scores computed from personal baseline, null if not calibrated */
  zScores: BiometricZScores | null;
}

/** Study session */
export interface StudySession {
  id: string;
  deckId: string;
  startTime: number;
  endTime: number | null;
  cardsReviewed: number;
  cardsCorrect: number;
  averageLatencyMs: number;
  preSessionState: 'good' | 'tired' | 'stressed' | null;
  postSessionEffort: 'easy' | 'moderate' | 'hard' | null;
  biometricSummary: {
    avgHeartRate: number | null;
    avgHrv: number | null;
    avgSpo2: number | null;
  };
  /**
   * HRV snapshots from R1 PPG at three session points.
   * Each is a 15–30s processed RMSSD window captured on-device.
   */
  hrvSnapshots?: {
    phase: 'start' | 'mid' | 'end';
    rmssd: number;
    timestamp: number;
  }[];
  reviewEvents: string[];
}

/** User learning profile – extended with z-score fields */
export interface LearningProfile {
  userId: string;
  globalModePreferences: Record<PresentationMode, number>;
  complexityModePreferences: Record<ComplexityTag, Partial<Record<PresentationMode, number>>>;
  optimalStudyWindows: { hourStart: number; hourEnd: number; score: number }[];
  optimalSessionDuration: number;
  totalCards: number;
  totalSessions: number;
  totalReviewEvents: number;
  longestStreak: number;
  /** Legacy absolute threshold – kept for compat, prefer z-scores */
  hrvThreshold: number | null;
  /** Structural confounders collected from user */
  confounders: Confounders;
  /** Rolling 14-day biometric history for z-score calibration */
  biometricHistory: DailyBiometric[];
  /** Per-style preference scores 0-1 from online learning */
  stylePreferences: Record<string, number>;
  /** OLS model status string */
  modelStatus: string;
  /** Last known OLS R² – persisted so dashboard can display without re-running regression */
  modelR2?: number;
  createdAt: number;
  updatedAt: number;
}

/** Generate a UUID */
export function generateId(): string {
  return crypto.randomUUID();
}

/** Create a default CardReviewState for a new card */
export function createDefaultReviewState(cardId: string, deckId: string): CardReviewState {
  return {
    cardId,
    deckId,
    fsrs: createEmptyCard(),
    totalReviews: 0,
    streak: 0,
    bestPresentationMode: null,
    modePerformance: {},
  };
}

/** Create a default LearningProfile */
export function createDefaultProfile(): LearningProfile {
  const modes: PresentationMode[] = [
    'definition', 'analogy', 'example', 'visual',
    'socratic', 'mnemonic', 'step-by-step', 'contrast',
    'real_life_example', 'clinical_example', 'story',
  ];
  const globalModePreferences = {} as Record<PresentationMode, number>;
  modes.forEach(m => (globalModePreferences[m] = 1.0));

  const stylePreferences: Record<string, number> = {};
  modes.forEach(m => (stylePreferences[m] = 0.5));

  return {
    userId: generateId(),
    globalModePreferences,
    complexityModePreferences: {
      vocabulary: {},
      concept: {},
      procedure: {},
      application: {},
      analysis: {},
    },
    optimalStudyWindows: [],
    optimalSessionDuration: 15,
    totalCards: 0,
    totalSessions: 0,
    totalReviewEvents: 0,
    longestStreak: 0,
    hrvThreshold: null,
    confounders: {
      onSSRI: false,
      bmiCategory: 'normal',
      smoker: false,
    },
    biometricHistory: [],
    stylePreferences,
    modelStatus: 'collecting_data',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
