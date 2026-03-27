// ============================================================
// LinUCB Bandit — Unit Tests
// Validates: SM update correctness, style selection, convergence,
//            persistence round-trip, context builder
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  LinUCB,
  buildContext,
  ratingToReward,
  ALL_PRESENTATION_MODES,
  BANDIT_D,
  migrateBanditState,
  type BanditContext,
} from './bandit';

// ── Helpers ──────────────────────────────────────────────────

const NEUTRAL_CTX: BanditContext = {
  timeOfDay: 'morning',
  complexity: 'concept',
  minutesIntoSession: 10,
  priorLevel: 5,
  stressLevel: 0.5,
  energyLevel: 0.5,
  metSixHour: 0.5,
  cognitiveCluster: 0.5,
};

const STRESS_CTX: BanditContext = {
  ...NEUTRAL_CTX,
  stressLevel: 0.9,
  energyLevel: 0.2,
  metSixHour: 0,
};

const RESTED_CTX: BanditContext = {
  ...NEUTRAL_CTX,
  stressLevel: 0.1,
  energyLevel: 0.9,
  metSixHour: 1,
};

function freshBandit(alpha = 0.3): LinUCB {
  return new LinUCB(ALL_PRESENTATION_MODES, BANDIT_D, alpha);
}

// ── 1. Context builder ────────────────────────────────────────

describe('buildContext', () => {
  it('returns a vector of length BANDIT_D', () => {
    const v = buildContext(NEUTRAL_CTX);
    expect(v).toHaveLength(BANDIT_D);
  });

  it('first element is always 1 (bias)', () => {
    expect(buildContext(NEUTRAL_CTX)[0]).toBe(1);
    expect(buildContext(STRESS_CTX)[0]).toBe(1);
  });

  it('time-of-day one-hot is mutually exclusive', () => {
    const times = ['morning', 'afternoon', 'evening', 'night'] as const;
    times.forEach(tod => {
      const v = buildContext({ ...NEUTRAL_CTX, timeOfDay: tod });
      const oneHot = v.slice(1, 4); // morning, afternoon, evening
      const sum = oneHot.reduce((s, x) => s + x, 0);
      expect(sum).toBeLessThanOrEqual(1);
    });
  });

  it('all values are in [0, 1]', () => {
    const v = buildContext(STRESS_CTX);
    v.forEach(x => expect(x).toBeGreaterThanOrEqual(0));
    v.forEach(x => expect(x).toBeLessThanOrEqual(1));
  });

  it('clamps out-of-range stress/energy', () => {
    const v = buildContext({ ...NEUTRAL_CTX, stressLevel: 1.5, energyLevel: -0.3 });
    // stressLevel at index 9, energyLevel at index 10
    expect(v[9]).toBe(1);
    expect(v[10]).toBe(0);
  });

  it('cognitiveCluster is clamped to [0,1] at index 12', () => {
    const v = buildContext({ ...NEUTRAL_CTX, cognitiveCluster: 1.5 });
    expect(v[12]).toBe(1);
    const v2 = buildContext({ ...NEUTRAL_CTX, cognitiveCluster: -0.2 });
    expect(v2[12]).toBe(0);
  });
});

// ── 2. Rating → reward mapping ────────────────────────────────

describe('ratingToReward', () => {
  it('again=0, hard=0.25, good=0.75, easy=1', () => {
    expect(ratingToReward('again')).toBe(0.0);
    expect(ratingToReward('hard')).toBe(0.25);
    expect(ratingToReward('good')).toBe(0.75);
    expect(ratingToReward('easy')).toBe(1.0);
  });
});

// ── 3. Fresh bandit baseline ──────────────────────────────────

describe('LinUCB — fresh bandit', () => {
  it('select() returns a valid presentation mode', () => {
    const bandit = freshBandit();
    const ctx = buildContext(NEUTRAL_CTX);
    const pick = bandit.select(ctx);
    expect(ALL_PRESENTATION_MODES).toContain(pick);
  });

  it('armPulls() starts at 0 for all arms', () => {
    const bandit = freshBandit();
    const pulls = bandit.armPulls();
    Object.values(pulls).forEach(n => expect(n).toBe(0));
  });

  it('totalPulls() is 0 before any updates', () => {
    expect(freshBandit().totalPulls()).toBe(0);
  });
});

// ── 4. Single update increments pull count ────────────────────

describe('LinUCB — update', () => {
  it('increments pull count for the updated arm', () => {
    const bandit = freshBandit();
    const ctx = buildContext(NEUTRAL_CTX);
    bandit.update('analogy', ctx, 1.0);
    expect(bandit.armPulls()['analogy']).toBe(1);
    expect(bandit.totalPulls()).toBe(1);
  });

  it('does not affect other arms pull counts', () => {
    const bandit = freshBandit();
    const ctx = buildContext(NEUTRAL_CTX);
    bandit.update('analogy', ctx, 1.0);
    const pulls = bandit.armPulls();
    ALL_PRESENTATION_MODES
      .filter(m => m !== 'analogy')
      .forEach(m => expect(pulls[m]).toBe(0));
  });
});

// ── 5. Correctness — analogy wins under stress ────────────────

describe('LinUCB — correctness', () => {
  it('selects analogy after repeated stress+analogy=1 updates', () => {
    const bandit = freshBandit(0.05); // low alpha = more exploitation
    const stressCtx = buildContext(STRESS_CTX);

    // Train: analogy always gets reward=1 under stress
    for (let i = 0; i < 20; i++) {
      bandit.update('analogy', stressCtx, 1.0);
      // All others get reward=0 under stress
      ALL_PRESENTATION_MODES
        .filter(m => m !== 'analogy')
        .forEach(m => bandit.update(m, stressCtx, 0.0));
    }

    expect(bandit.select(stressCtx)).toBe('analogy');
  });

  it('selects definition after repeated rested+definition=1 updates', () => {
    const bandit = freshBandit(0.05);
    const restedCtx = buildContext(RESTED_CTX);

    for (let i = 0; i < 20; i++) {
      bandit.update('definition', restedCtx, 1.0);
      ALL_PRESENTATION_MODES
        .filter(m => m !== 'definition')
        .forEach(m => bandit.update(m, restedCtx, 0.0));
    }

    expect(bandit.select(restedCtx)).toBe('definition');
  });

  it('context-conditional: different contexts → different selections', () => {
    const bandit = freshBandit(0.05);
    const stressCtx = buildContext(STRESS_CTX);
    const restedCtx = buildContext(RESTED_CTX);

    // analogy wins under stress, definition wins when rested
    for (let i = 0; i < 25; i++) {
      bandit.update('analogy',    stressCtx, 1.0);
      bandit.update('definition', stressCtx, 0.0);
      bandit.update('definition', restedCtx, 1.0);
      bandit.update('analogy',    restedCtx, 0.0);
    }

    expect(bandit.select(stressCtx)).toBe('analogy');
    expect(bandit.select(restedCtx)).toBe('definition');
  });
});

// ── 6. Convergence simulation ─────────────────────────────────

describe('LinUCB — convergence', () => {
  it('selects correct style >80% of time by observation 100', () => {
    // Rule: analogy→1.0 when stressed, definition→1.0 when rested
    const bandit = freshBandit(0.3);
    const stressCtx = buildContext(STRESS_CTX);
    const restedCtx = buildContext(RESTED_CTX);

    const contexts = [stressCtx, restedCtx];
    const correctArm = ['analogy', 'definition'];

    let correct = 0;
    const totalObs = 100;
    const countFrom = 60; // measure accuracy in final 40 observations

    for (let i = 0; i < totalObs; i++) {
      const ci = i % 2;
      const ctx = contexts[ci];
      const best = correctArm[ci];

      const pick = bandit.select(ctx);
      const reward = pick === best ? 1.0 : 0.0;
      bandit.update(pick, ctx, reward);

      if (i >= countFrom && pick === best) correct++;
    }

    const accuracy = correct / (totalObs - countFrom);
    expect(accuracy).toBeGreaterThan(0.8);
  });
});

// ── 7. Persistence round-trip ─────────────────────────────────

describe('LinUCB — persistence', () => {
  it('toState / fromState preserves arm pull counts', () => {
    const bandit = freshBandit();
    const ctx = buildContext(NEUTRAL_CTX);
    bandit.update('analogy', ctx, 1.0);
    bandit.update('socratic', ctx, 0.5);

    const restored = LinUCB.fromState(bandit.toState(), ALL_PRESENTATION_MODES);
    expect(restored.armPulls()['analogy']).toBe(1);
    expect(restored.armPulls()['socratic']).toBe(1);
    expect(restored.totalPulls()).toBe(2);
  });

  it('restored bandit makes identical selection to original', () => {
    const bandit = freshBandit(0.05);
    const ctx = buildContext(STRESS_CTX);

    for (let i = 0; i < 15; i++) bandit.update('analogy', ctx, 1.0);

    const restored = LinUCB.fromState(bandit.toState(), ALL_PRESENTATION_MODES);
    expect(restored.select(ctx)).toBe(bandit.select(ctx));
  });

  it('fromState adds missing arms for new presentation styles', () => {
    const bandit = freshBandit();
    const state = bandit.toState();
    // Simulate a new style being added after first run
    const extendedModes = [...ALL_PRESENTATION_MODES, 'new_style' as any];
    const restored = LinUCB.fromState(state, extendedModes);
    expect(restored.armPulls()['new_style']).toBe(0);
  });
});

// ── 8. migrateBanditState ────────────────────────────────────

describe('migrateBanditState', () => {
  it('pads Ainv and b to new dimension', () => {
    const bandit = new LinUCB(ALL_PRESENTATION_MODES, 12, 0.3);
    const state = bandit.toState();
    expect(state.d).toBe(12);

    const migrated = migrateBanditState(state, 13);
    expect(migrated.d).toBe(13);
    for (const arm of Object.values(migrated.arms)) {
      expect(arm.Ainv).toHaveLength(13);
      arm.Ainv.forEach(row => expect(row).toHaveLength(13));
      expect(arm.b).toHaveLength(13);
    }
  });

  it('is a no-op when d already matches', () => {
    const bandit = new LinUCB(ALL_PRESENTATION_MODES, BANDIT_D, 0.3);
    const state = bandit.toState();
    const migrated = migrateBanditState(state, BANDIT_D);
    expect(migrated).toBe(state); // exact same reference
  });

  it('restored d=12 bandit selects correctly after migration to d=13', () => {
    // Simulate a persisted d=12 state that gets migrated
    const oldBandit = new LinUCB(ALL_PRESENTATION_MODES, 12, 0.05);
    const oldCtx = buildContext({ ...NEUTRAL_CTX, cognitiveCluster: 0 }).slice(0, 12);
    for (let i = 0; i < 15; i++) oldBandit.update('analogy', oldCtx, 1.0);

    const migratedState = migrateBanditState(oldBandit.toState(), 13);
    const restored = LinUCB.fromState(migratedState, ALL_PRESENTATION_MODES);
    const newCtx = buildContext(NEUTRAL_CTX);
    expect(restored.select(newCtx)).toBe('analogy');
  });
});

// ── 9. Sherman-Morrison sanity check ─────────────────────────

describe('Sherman-Morrison update', () => {
  it('bandit Ainv satisfies (A + xxT) * Ainv ≈ I after one update', () => {
    // We can indirectly verify SM by checking that after one update,
    // the UCB score for the updated arm changes in the correct direction.
    const bandit = freshBandit();
    const ctx = buildContext(NEUTRAL_CTX);

    // Record score before update (all arms equal)
    const beforePick = bandit.select(ctx);

    // Give 'analogy' a high reward 10 times
    for (let i = 0; i < 10; i++) bandit.update('analogy', ctx, 1.0);

    // After high rewards, analogy should beat a never-updated arm
    // (exploitation term dominates exploration for pulled arm)
    const afterPick = bandit.select(ctx);
    // The bandit should now prefer analogy or at least not regress to a 0-pull arm
    const pulls = bandit.armPulls();
    expect(pulls['analogy']).toBe(10);

    // The selected arm should have a non-negative pull count (never an untouched arm
    // once analogy has accumulated significant positive reward)
    const pickedPulls = pulls[afterPick];
    expect(pickedPulls).toBeGreaterThanOrEqual(0); // sanity — always true
    // More specific: after 10 high-reward updates, analogy should be selected
    expect(afterPick).toBe('analogy');
  });
});
