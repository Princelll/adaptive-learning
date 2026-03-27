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

/**
 * A single period of wakefulness during the sleep window.
 * Interruptions are ordered chronologically between sleep segments.
 */
export interface SleepInterruption {
  /** Minutes spent awake during this interruption */
  awakeMin: number;
  /**
   * True if the person took >20 min to fall back asleep (clinical threshold
   * for sleep-onset difficulty — American Academy of Sleep Medicine).
   */
  difficultReturn: boolean;
  /**
   * Minutes of continuous sleep accumulated after returning to sleep,
   * until the next interruption or final wake-up.
   */
  sleepAfterMin: number;
}

/** A single continuous block of uninterrupted sleep */
export interface SleepSegment {
  /** Time of day the person fell asleep, as fractional hour (e.g. 23.5 = 11:30 PM) */
  startHour: number;
  /** Duration of this uninterrupted block in minutes */
  durationMin: number;
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
  /**
   * Ordered list of continuous sleep blocks for the night.
   * Gaps between segments are the interruptions.
   * Null if ring data not available or sleep was uninterrupted (use sleepHours instead).
   */
  sleepSegments: SleepSegment[] | null;
  /**
   * Details for each interruption between sleep segments.
   * Length is always sleepSegments.length - 1 when segments are present.
   */
  sleepInterruptions: SleepInterruption[] | null;
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
    responseLatencyMs: number;
    daysSinceLastStudy: number;
    cardAgeDays: number;
    priorLevel: number;
    complexity: string;
    course: string;
    sleepHoursActual: number | null;
    remHoursActual: number | null;
    sleepHoursZ: number | null;
    remHoursZ: number | null;
    currentHrv: number | null;
    currentRmssd: number | null;
    rmssdZ: number | null;
    restingHRZ: number | null;
    spo2Z: number | null;
    /** Number of wake-ups during the sleep window */
    sleepInterruptionCount: number | null;
    /** Total minutes spent awake across all interruptions */
    totalAwakeMin: number | null;
    /** Longest single unbroken sleep block in hours */
    longestContinuousBlockHours: number | null;
    /** True if any interruption took >20 min to fall back asleep */
    hadDifficultReturn: boolean | null;
    /**
     * True if the longest continuous block was >= 6 hours,
     * or (no interruptions and total sleep >= 6h).
     * The primary restorative threshold.
     */
    metSixHourThreshold: boolean | null;
    /** Hours slept in the final block after the last interruption */
    sleepAfterLastInterruptionHours: number | null;
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

// ── Clustering types ─────────────────────────────────────────

/** Running mean/variance accumulators for Welford's online algorithm */
export interface RollingStats {
  /** Number of values seen */
  n: number;
  /** Running mean */
  mean: number;
  /** Running sum of squared deviations (M2 in Welford's formulation) */
  M2: number;
}

/** One geometric cluster discovered by k-means. No pre-assigned semantic label. */
export interface CognitiveCluster {
  /** Stable index 0–(k-1); preserved across re-clusterings via anchor matching */
  id: number;
  /** 11-dim centroid in min-max normalised feature space */
  centroid: number[];
  /** Number of observations currently assigned to this cluster */
  size: number;
}

/** A single point on a per-cluster × per-style learning curve */
export interface LearningCurvePoint {
  /** Observation index within this cluster×style cell (0-based) */
  obsIndex: number;
  /** Raw masteryGain for this observation (0, 0.5, or 1) */
  masteryGain: number;
  /** Rolling 5-observation mean of masteryGain */
  rollingMean: number;
}

/** Learning curve for one (clusterId, presentationStyle) cell */
export interface ClusterStyleCurve {
  clusterId: number;
  style: string;
  points: LearningCurvePoint[];
  /** OLS slope on rollingMean vs obsIndex — positive = improving, null if n < 3 */
  slope: number | null;
  /** Total observations in this cell */
  n: number;
}

/**
 * Full clustering state — persisted inside LearningProfile.
 * Null until MIN_CLUSTER_OBS (20) observations have been recorded.
 */
export interface ClusterState {
  /** Discovered clusters (k = CLUSTER_K = 4) */
  clusters: CognitiveCluster[];
  /** obsId → clusterId assignment map; capped at 200 most recent entries */
  assignments: Record<string, number>;
  /** Cluster id of the most recently processed observation, or null if collecting */
  currentClusterId: number | null;
  /** Welford stats for latencyZ computation (dim 0 of the feature vector) */
  latencyStats: RollingStats;
  /** Per-dim min/max computed from current observation window for normalisation */
  featureScales: { min: number[]; max: number[] };
  /** Per-dim running medians for null imputation (dims 2–10, biometric fields) */
  runningMedians: number[];
  /** Timestamp of last full k-means re-cluster */
  lastClusteringAt: number;
  /** Observation count at the time of the last full re-cluster */
  clusteringObsCount: number;
  /** 'collecting' while n < MIN_CLUSTER_OBS; 'active' once clustering is running */
  status: 'collecting' | 'active' | 'stale';
  /** Learning curves per cluster×style cell; recomputed on each full re-cluster */
  curves: ClusterStyleCurve[];
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
  /** Cognitive state clustering — null until MIN_CLUSTER_OBS observations recorded */
  clusterState: ClusterState | null;
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
    clusterState: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
