// ============================================================
// LinUCB Contextual Bandit — Presentation Style Selection
//
// One ridge regression per presentation style (arm).
// At each card, selects the style with highest UCB score given
// the current physiological + session context.
// Updates online after every rated card.
//
// Li et al. (2010) "A Contextual-Bandit Approach to Personalized
// News Article Recommendation", WWW 2010.
// ============================================================

import type { PresentationMode } from './models';

// ── Context ─────────────────────────────────────────────────

/**
 * Features available at card-presentation time.
 * All nullable biometric fields default to a neutral mid-point
 * so the bandit runs without ring data.
 */
export interface BanditContext {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  complexity: string;
  /** Minutes elapsed in session (0–30+) */
  minutesIntoSession: number;
  /** FSRS difficulty 0–10 */
  priorLevel: number;
  /** 0–1, defaults to 0.5 when null */
  stressLevel: number;
  /** 0–1, defaults to 0.5 when null */
  energyLevel: number;
  /** 1 if last night had ≥6h continuous sleep, 0 if not, 0.5 if unknown */
  metSixHour: number;
  /**
   * Cognitive cluster index normalised to [0, 1]: clusterId / (CLUSTER_K - 1).
   * 0.5 when unknown (collecting phase or ring not connected).
   */
  cognitiveCluster: number;
}

/**
 * Build a fixed-length context vector from session features.
 * d = 13 — must stay in sync with BANDIT_D.
 */
export function buildContext(ctx: BanditContext): number[] {
  return [
    1.0,                                                        // bias
    ctx.timeOfDay === 'morning'    ? 1 : 0,                    // time of day (one-hot, night is baseline)
    ctx.timeOfDay === 'afternoon'  ? 1 : 0,
    ctx.timeOfDay === 'evening'    ? 1 : 0,
    ctx.complexity === 'vocabulary' ? 1 : 0,                   // complexity (one-hot, analysis is baseline)
    ctx.complexity === 'concept'    ? 1 : 0,
    ctx.complexity === 'procedure'  ? 1 : 0,
    Math.min(ctx.minutesIntoSession / 30, 1),                  // session position, capped at 1
    Math.min(ctx.priorLevel / 10, 1),                          // difficulty, normalised 0–1
    Math.max(0, Math.min(1, ctx.stressLevel)),
    Math.max(0, Math.min(1, ctx.energyLevel)),
    Math.max(0, Math.min(1, ctx.metSixHour)),
    Math.max(0, Math.min(1, ctx.cognitiveCluster)),            // cluster index, normalised 0–1
  ];
}

/** Context vector dimension — must equal buildContext() output length */
export const BANDIT_D = 13;

// ── Serialisable state ───────────────────────────────────────

export interface BanditArmState {
  /** d×d inverse covariance matrix, row-major */
  Ainv: number[][];
  /** d-dim reward-weighted context accumulator */
  b: number[];
  /** Total pulls on this arm */
  pulls: number;
}

export interface BanditState {
  arms: Record<string, BanditArmState>;
  alpha: number;
  d: number;
}

// ── Linear algebra helpers ───────────────────────────────────

function identity(d: number): number[][] {
  return Array.from({ length: d }, (_, i) =>
    Array.from({ length: d }, (_, j) => (i === j ? 1.0 : 0.0)),
  );
}

function matVec(A: number[][], x: number[]): number[] {
  return A.map(row => row.reduce((s, v, j) => s + v * x[j], 0));
}

function dot(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

/**
 * Sherman-Morrison rank-1 inverse update.
 * Given A⁻¹, returns (A + x·xᵀ)⁻¹ without a full matrix inversion.
 * Cost: O(d²) instead of O(d³).
 */
function smUpdate(Ainv: number[][], x: number[]): number[][] {
  const Ax = matVec(Ainv, x);
  const denom = 1 + dot(x, Ax);
  return Ainv.map((row, i) =>
    row.map((val, j) => val - (Ax[i] * Ax[j]) / denom),
  );
}

// ── LinUCB ───────────────────────────────────────────────────

export class LinUCB {
  private arms: Map<string, BanditArmState>;
  private alpha: number;
  private d: number;

  /**
   * @param armNames  Presentation style names (one arm per style)
   * @param d         Context dimension (default: BANDIT_D)
   * @param alpha     Exploration coefficient — higher = more exploration.
   *                  0.3 is a good default: enough to avoid premature
   *                  convergence while still learning quickly.
   */
  constructor(armNames: string[], d = BANDIT_D, alpha = 0.3) {
    this.d = d;
    this.alpha = alpha;
    this.arms = new Map(
      armNames.map(name => [name, {
        Ainv: identity(d),
        b: new Array<number>(d).fill(0),
        pulls: 0,
      }]),
    );
  }

  /**
   * Select the arm with the highest UCB score for the given context.
   * score = θᵀx + α·√(xᵀA⁻¹x)
   *          exploitation    exploration bonus
   */
  select(context: number[]): string {
    let bestArm = '';
    let bestScore = -Infinity;

    for (const [name, arm] of this.arms) {
      const theta = matVec(arm.Ainv, arm.b);
      const Ax = matVec(arm.Ainv, context);
      const uncertainty = Math.sqrt(Math.max(0, dot(context, Ax)));
      const score = dot(theta, context) + this.alpha * uncertainty;
      if (score > bestScore) {
        bestScore = score;
        bestArm = name;
      }
    }

    return bestArm || Array.from(this.arms.keys())[0];
  }

  /**
   * Update the selected arm after observing a reward.
   * @param armName  The arm that was pulled
   * @param context  The context vector used at selection time
   * @param reward   0.0 (again) | 0.25 (hard) | 0.75 (good) | 1.0 (easy)
   */
  update(armName: string, context: number[], reward: number): void {
    const arm = this.arms.get(armName);
    if (!arm) return;
    arm.Ainv = smUpdate(arm.Ainv, context);
    arm.b = arm.b.map((v, i) => v + reward * context[i]);
    arm.pulls += 1;
  }

  /** Ensure an arm exists (used when new presentation styles are added) */
  ensureArm(name: string): void {
    if (!this.arms.has(name)) {
      this.arms.set(name, {
        Ainv: identity(this.d),
        b: new Array<number>(this.d).fill(0),
        pulls: 0,
      });
    }
  }

  /** Pull counts per arm — useful for debugging and companion display */
  armPulls(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [name, arm] of this.arms) out[name] = arm.pulls;
    return out;
  }

  /** Total observations across all arms */
  totalPulls(): number {
    let n = 0;
    for (const arm of this.arms.values()) n += arm.pulls;
    return n;
  }

  /** Serialise to a plain object for localStorage persistence */
  toState(): BanditState {
    const arms: Record<string, BanditArmState> = {};
    for (const [name, arm] of this.arms) arms[name] = arm;
    return { arms, alpha: this.alpha, d: this.d };
  }

  /** Restore from a serialised state, migrating dimension if needed */
  static fromState(state: BanditState, armNames: string[]): LinUCB {
    const migrated = state.d !== BANDIT_D ? migrateBanditState(state, BANDIT_D) : state;
    const bandit = new LinUCB([], migrated.d, migrated.alpha);
    // Restore persisted arms
    for (const [name, arm] of Object.entries(migrated.arms)) {
      bandit.arms.set(name, arm);
    }
    // Ensure all current arm names exist (handles new styles added after first run)
    for (const name of armNames) bandit.ensureArm(name);
    return bandit;
  }
}

/**
 * Migrate a persisted BanditState from oldD dimensions to newD.
 * Pads Ainv with an identity block and b with zeros for added dimensions.
 * No-op if state.d already equals newD.
 */
export function migrateBanditState(state: BanditState, newD: number): BanditState {
  if (state.d === newD) return state;
  const oldD = state.d;
  const extra = newD - oldD;
  if (extra <= 0) return state; // downgrade not supported — return as-is

  const newArms: Record<string, BanditArmState> = {};
  for (const [name, arm] of Object.entries(state.arms)) {
    // Pad Ainv: expand each existing row with zeros, then append identity rows
    const newAinv: number[][] = arm.Ainv.map(row => [...row, ...new Array<number>(extra).fill(0)]);
    for (let i = 0; i < extra; i++) {
      const row = new Array<number>(newD).fill(0);
      row[oldD + i] = 1.0; // identity block for new dimensions
      newAinv.push(row);
    }
    const newB = [...arm.b, ...new Array<number>(extra).fill(0)];
    newArms[name] = { Ainv: newAinv, b: newB, pulls: arm.pulls };
  }

  return { arms: newArms, alpha: state.alpha, d: newD };
}

// ── Reward mapping ───────────────────────────────────────────

import type { ConfidenceRating } from './models';

/** Map user rating to a 0–1 reward signal for the bandit */
export function ratingToReward(rating: ConfidenceRating): number {
  switch (rating) {
    case 'again': return 0.0;
    case 'hard':  return 0.25;
    case 'good':  return 0.75;
    case 'easy':  return 1.0;
  }
}

/** All presentation mode names in a stable order */
export const ALL_PRESENTATION_MODES: PresentationMode[] = [
  'definition', 'analogy', 'example', 'visual',
  'socratic', 'mnemonic', 'step-by-step', 'contrast',
  'real_life_example', 'clinical_example', 'story',
];
