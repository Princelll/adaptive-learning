// ============================================================
// Cognitive State Clustering
//
// Discovers distinct biometric–performance states from
// accumulated Observation data using mini-batch k-means.
//
// Feature vector (11 dims):
//   [0] latencyZ          — response latency z-score (Welford online)
//   [1] accuracyRecent5   — rolling 5-card correct rate
//   [2] currentRmssd      — raw RMSSD in ms
//   [3] sleepHoursActual  — raw sleep hours
//   [4] remHoursActual    — raw REM hours
//   [5] longestBlockHours — longest continuous sleep block
//   [6] sleepInterruptions— wake-up count
//   [7] stressLevel       — 0–1
//   [8] energyLevel       — 0–1
//   [9] minutesIntoSession— raw minutes
//  [10] daysSinceLastStudy— raw days
//
// All dims are min-max scaled to [0,1] for distance computation.
// Dim 0 (latencyZ) is clamped to [-3,3] before scaling.
// Biometric dims (2–6) use running median imputation for nulls.
//
// Learning curves per (clusterId × style) are computed from
// outcomes.masteryGain over time — slope is the evaluation metric.
// ============================================================

import type {
  Observation,
  ClusterState,
  CognitiveCluster,
  ClusterStyleCurve,
  LearningCurvePoint,
  RollingStats,
} from './models';

// ── Constants ────────────────────────────────────────────────

export const CLUSTER_K = 4;
export const MIN_CLUSTER_OBS = 20;
const FEATURE_DIM = 11;
const KMEANS_MAX_ITER = 15;
const KMEANS_RESTARTS = 3;
const MAX_STORED_ASSIGNMENTS = 200;
const MEDIAN_RESERVOIR_SIZE = 50;
const LATENCY_WINDOW = 50; // exponential forgetting for Welford

// Indices for nullable biometric dims in the feature vector
const BIOMETRIC_DIMS = [2, 3, 4, 5, 6];

// ── Welford online statistics ────────────────────────────────

/** Update Welford running stats with one new value. */
export function updateWelford(stats: RollingStats, value: number): RollingStats {
  const n = stats.n + 1;
  // Exponential forgetting: gradually downweight old observations
  const effectiveN = Math.min(n, LATENCY_WINDOW);
  const alpha = 2 / (effectiveN + 1); // EMA weight
  const delta = value - stats.mean;
  const newMean = stats.mean + alpha * delta;
  const delta2 = value - newMean;
  // Approximate M2 with exponential decay so variance tracks recent data
  const newM2 = (1 - alpha) * (stats.M2 + alpha * delta * delta2);
  return { n, mean: newMean, M2: newM2 };
}

/** Compute z-score from Welford stats. Returns 0 if variance is negligible. */
function welfordZ(stats: RollingStats, value: number): number {
  if (stats.n < 3) return 0;
  const variance = stats.M2;
  if (variance < 1e-9) return 0;
  return (value - stats.mean) / Math.sqrt(variance);
}

// ── Running median (approximate, sorted reservoir) ───────────

/**
 * Update running medians with values from one observation.
 * medians[i] is maintained for biometric dim (i + 2) — the nullable dims.
 * Uses a fixed-size sorted reservoir; oldest values are evicted.
 */
export function updateRunningMedians(
  medians: number[],
  reservoirs: number[][],
  obs: Observation,
): { medians: number[]; reservoirs: number[][] } {
  const rawVals = extractBiometricRaw(obs);
  const newReservoirs = reservoirs.map((r, i) => {
    const v = rawVals[i];
    if (v === null) return r;
    const updated = [...r, v].sort((a, b) => a - b);
    if (updated.length > MEDIAN_RESERVOIR_SIZE) updated.shift();
    return updated;
  });
  const newMedians = newReservoirs.map((r, i) => {
    if (r.length === 0) return medians[i];
    const mid = Math.floor(r.length / 2);
    return r.length % 2 === 0 ? (r[mid - 1] + r[mid]) / 2 : r[mid];
  });
  return { medians: newMedians, reservoirs: newReservoirs };
}

/** Extract raw values for nullable biometric dims (indices 0–4 → dims 2–6) */
function extractBiometricRaw(obs: Observation): (number | null)[] {
  return [
    obs.features.currentRmssd,
    obs.features.sleepHoursActual,
    obs.features.remHoursActual,
    obs.features.longestContinuousBlockHours,
    obs.features.sleepInterruptionCount,
  ];
}

// ── Feature extraction ───────────────────────────────────────

/**
 * Build an 11-dim raw feature vector from one observation.
 * Nulls are imputed with running medians for biometric dims.
 * latencyZ is computed per-card so card difficulty does not confound the signal.
 */
export function extractFeatures(
  obs: Observation,
  latencyStatsPerCard: Record<string, RollingStats>,
  runningMedians: number[],
): number[] {
  const cardStats = latencyStatsPerCard[obs.cardId] ?? { n: 0, mean: 0, M2: 0 };
  const latencyZ = welfordZ(cardStats, obs.outcomes.latencyMs);

  const biometricRaw = extractBiometricRaw(obs);
  const biometricImputed = biometricRaw.map(
    (v, i) => (v !== null ? v : runningMedians[i] ?? 0),
  );

  // Compute rolling 5-card accuracy from observation outcomes — use recalledCorrectly
  // (passed as a pre-computed value since we don't have the window here; caller
  // pre-computes it via computeRecentAccuracy)
  const recentAcc = (obs as any).__recentAcc__ ?? 0.5;

  return [
    latencyZ,                   // dim 0 — z-scored
    recentAcc,                  // dim 1
    biometricImputed[0],        // dim 2 — currentRmssd
    biometricImputed[1],        // dim 3 — sleepHoursActual
    biometricImputed[2],        // dim 4 — remHoursActual
    biometricImputed[3],        // dim 5 — longestContinuousBlockHours
    biometricImputed[4],        // dim 6 — sleepInterruptionCount
    obs.features.stressLevel,   // dim 7
    obs.features.energyLevel,   // dim 8
    obs.features.minutesIntoSession,  // dim 9
    obs.features.daysSinceLastStudy,  // dim 10
  ];
}

// ── Normalisation ────────────────────────────────────────────

/** Compute per-dim min/max from a set of raw feature vectors. */
export function computeFeatureScales(
  rawVectors: number[][],
): { min: number[]; max: number[] } {
  const min = new Array<number>(FEATURE_DIM).fill(Infinity);
  const max = new Array<number>(FEATURE_DIM).fill(-Infinity);
  for (const v of rawVectors) {
    for (let i = 0; i < FEATURE_DIM; i++) {
      if (v[i] < min[i]) min[i] = v[i];
      if (v[i] > max[i]) max[i] = v[i];
    }
  }
  // Guard degenerate dims (all identical values) to avoid div-by-zero
  for (let i = 0; i < FEATURE_DIM; i++) {
    if (!isFinite(min[i])) min[i] = 0;
    if (!isFinite(max[i])) max[i] = 1;
    if (max[i] === min[i]) max[i] = min[i] + 1;
  }
  return { min, max };
}

/**
 * Map a raw feature vector to [0,1] per dim.
 * Dim 0 (latencyZ) is clamped to [-3, 3] before min-max scaling.
 */
export function normalizeFeatures(
  raw: number[],
  scales: { min: number[]; max: number[] },
): number[] {
  return raw.map((v, i) => {
    let val = v;
    if (i === 0) val = Math.max(-3, Math.min(3, val)); // clamp latencyZ
    return (val - scales.min[i]) / (scales.max[i] - scales.min[i]);
  });
}

// ── K-means ──────────────────────────────────────────────────

function euclideanSq(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return s;
}

function nearestCentroidIdx(point: number[], centroids: number[][]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let k = 0; k < centroids.length; k++) {
    const d = euclideanSq(point, centroids[k]);
    if (d < bestDist) { bestDist = d; best = k; }
  }
  return best;
}

/** k-means++ seeded initialisation. Returns k initial centroids. */
function kMeansPlusPlus(points: number[][], k: number): number[][] {
  const n = points.length;
  const centroids: number[][] = [];
  // First centroid: uniform random
  centroids.push(points[Math.floor(Math.random() * n)]);
  for (let c = 1; c < k; c++) {
    // Squared distances to nearest existing centroid
    const dists = points.map(p =>
      Math.min(...centroids.map(c => euclideanSq(p, c))),
    );
    const total = dists.reduce((s, d) => s + d, 0);
    // Sample proportional to squared distance
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < n - 1; idx++) {
      r -= dists[idx];
      if (r <= 0) break;
    }
    centroids.push(points[idx]);
  }
  return centroids;
}

/** Run k-means with KMEANS_RESTARTS restarts; return best result by inertia. */
export function runKMeans(
  points: number[][],
  k: number,
): { centroids: number[][]; assignments: number[]; inertia: number } {
  if (points.length === 0) {
    return { centroids: [], assignments: [], inertia: 0 };
  }

  let best: { centroids: number[][]; assignments: number[]; inertia: number } | null = null;

  for (let restart = 0; restart < KMEANS_RESTARTS; restart++) {
    let centroids = kMeansPlusPlus(points, k);
    let assignments = new Array<number>(points.length).fill(0);

    for (let iter = 0; iter < KMEANS_MAX_ITER; iter++) {
      // Assignment step
      const newAssignments = points.map(p => nearestCentroidIdx(p, centroids));

      // Check convergence
      const changed = newAssignments.some((a, i) => a !== assignments[i]);
      assignments = newAssignments;
      if (!changed) break;

      // Update step — recompute centroids
      const sums = Array.from({ length: k }, () => new Array<number>(points[0].length).fill(0));
      const counts = new Array<number>(k).fill(0);
      for (let i = 0; i < points.length; i++) {
        const a = assignments[i];
        counts[a]++;
        for (let d = 0; d < points[0].length; d++) sums[a][d] += points[i][d];
      }

      // Empty cluster protection: re-seed to the point farthest from all centroids
      for (let c = 0; c < k; c++) {
        if (counts[c] === 0) {
          let farthestIdx = 0;
          let farthestDist = -Infinity;
          for (let i = 0; i < points.length; i++) {
            const d = Math.min(...centroids.map(c => euclideanSq(points[i], c)));
            if (d > farthestDist) { farthestDist = d; farthestIdx = i; }
          }
          sums[c] = [...points[farthestIdx]];
          counts[c] = 1;
        }
        centroids[c] = sums[c].map(s => s / counts[c]);
      }
    }

    // Compute inertia
    const inertia = points.reduce((s, p, i) => s + euclideanSq(p, centroids[assignments[i]]), 0);
    if (best === null || inertia < best.inertia) {
      best = { centroids, assignments, inertia };
    }
  }

  return best!;
}

// ── Cluster id stability ─────────────────────────────────────

/**
 * Match new centroids to old cluster ids by greedy nearest-centroid.
 * Preserves ids across re-clusterings so bandit reward signals stay valid.
 */
export function anchorClusters(
  newCentroids: number[][],
  newSizes: number[],
  oldClusters: CognitiveCluster[],
): CognitiveCluster[] {
  if (oldClusters.length === 0) {
    // First run — assign ids in order of decreasing size
    const order = newSizes
      .map((s, i) => ({ i, s }))
      .sort((a, b) => b.s - a.s)
      .map(x => x.i);
    return order.map((origIdx, newId) => ({
      id: newId,
      centroid: newCentroids[origIdx],
      size: newSizes[origIdx],
    }));
  }

  const k = newCentroids.length;
  const usedOldIds = new Set<number>();
  const result: CognitiveCluster[] = new Array(k);

  // For each new centroid, find the closest old centroid not yet matched
  for (let i = 0; i < k; i++) {
    let bestOldId = -1;
    let bestDist = Infinity;
    for (const old of oldClusters) {
      if (!usedOldIds.has(old.id)) {
        const d = euclideanSq(newCentroids[i], old.centroid);
        if (d < bestDist) { bestDist = d; bestOldId = old.id; }
      }
    }
    if (bestOldId === -1) {
      // Fallback: use first available id
      for (let id = 0; id < k; id++) {
        if (!usedOldIds.has(id)) { bestOldId = id; break; }
      }
    }
    usedOldIds.add(bestOldId);
    result[i] = { id: bestOldId, centroid: newCentroids[i], size: newSizes[i] };
  }

  return result;
}

// ── 1-NN assignment ──────────────────────────────────────────

/**
 * Assign a normalised feature vector to the nearest cluster centroid.
 * Used between full re-cluster runs for cheap per-observation assignment.
 */
export function assignToNearest(
  normalised: number[],
  clusters: CognitiveCluster[],
): number {
  let bestId = clusters[0]?.id ?? 0;
  let bestDist = Infinity;
  for (const c of clusters) {
    const d = euclideanSq(normalised, c.centroid);
    if (d < bestDist) { bestDist = d; bestId = c.id; }
  }
  return bestId;
}

// ── Learning curves ──────────────────────────────────────────

/**
 * Compute per-cluster × per-style learning curves from observations.
 * Only includes cells with ≥ 3 observations.
 */
export function computeLearningCurves(
  observations: Observation[],
  assignments: Record<string, number>,
): ClusterStyleCurve[] {
  // Build (clusterId, style) → observations list
  const cells = new Map<string, Observation[]>();
  for (const obs of observations) {
    const clusterId = assignments[obs.id];
    if (clusterId === undefined) continue;
    const key = `${clusterId}::${obs.features.explanationStyle}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(obs);
  }

  const curves: ClusterStyleCurve[] = [];
  for (const [key, obsArr] of cells) {
    if (obsArr.length < 3) continue;
    const [clusterIdStr, style] = key.split('::');
    const clusterId = parseInt(clusterIdStr, 10);

    // Sort by timestamp
    obsArr.sort((a, b) => a.timestamp - b.timestamp);

    // Compute rolling 5-obs mean of masteryGain
    const points: LearningCurvePoint[] = obsArr.map((obs, idx) => {
      const windowStart = Math.max(0, idx - 4);
      const window = obsArr.slice(windowStart, idx + 1);
      const rollingMean = window.reduce((s, o) => s + o.outcomes.masteryGain, 0) / window.length;
      return { obsIndex: idx, masteryGain: obs.outcomes.masteryGain, rollingMean };
    });

    // OLS slope on rollingMean vs obsIndex
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (const p of points) {
      sumX += p.obsIndex;
      sumY += p.rollingMean;
      sumXY += p.obsIndex * p.rollingMean;
      sumX2 += p.obsIndex * p.obsIndex;
    }
    const denom = n * sumX2 - sumX * sumX;
    const slope = denom === 0 ? null : (n * sumXY - sumX * sumY) / denom;

    curves.push({ clusterId, style, points, slope, n });
  }

  return curves;
}

// ── Main entry point ─────────────────────────────────────────

/** Compute rolling 5-card accuracy for an observation given all prior obs */
function computeRecentAccuracy(obs: Observation, allObs: Observation[]): number {
  // Find the 5 observations immediately before this one in the same session
  const priors = allObs
    .filter(o => o.sessionId === obs.sessionId && o.timestamp < obs.timestamp)
    .slice(-4);
  const window = [...priors, obs];
  return window.filter(o => o.outcomes.recalledCorrectly).length / window.length;
}

/** Empty/initial feature scales */
function emptyScales(): { min: number[]; max: number[] } {
  return {
    min: new Array<number>(FEATURE_DIM).fill(0),
    max: new Array<number>(FEATURE_DIM).fill(1),
  };
}

/** Empty/initial running medians (one per nullable biometric dim) */
function emptyMedians(): number[] {
  // Reasonable physiological defaults for imputation before data accumulates
  return [
    40,   // currentRmssd ms
    7,    // sleepHoursActual hours
    1.5,  // remHoursActual hours
    6,    // longestContinuousBlockHours
    1,    // sleepInterruptionCount
  ];
}

/**
 * Main entry point — called after every observation is recorded.
 *
 * Decision tree:
 *   n < MIN_CLUSTER_OBS  → update latency stats + running medians, return 'collecting'
 *   n >= MIN and n%5==0  → full k-means re-cluster
 *   otherwise            → cheap 1-NN assign to existing centroids
 */
export function updateClustering(
  observations: Observation[],
  currentObs: Observation,
  existing: ClusterState | null,
): ClusterState {
  const n = observations.length;

  // Initialise state if this is the first call
  const prevStatsPerCard: Record<string, RollingStats> = existing?.latencyStatsPerCard ?? {};
  const prevMedians: number[] = existing?.runningMedians ?? emptyMedians();
  const prevReservoirs: number[][] = (existing as any)?.__reservoirs__ ?? BIOMETRIC_DIMS.map(() => []);

  // Update per-card Welford stats for latencyZ
  const prevCardStats = prevStatsPerCard[currentObs.cardId] ?? { n: 0, mean: 0, M2: 0 };
  const latencyStatsPerCard: Record<string, RollingStats> = {
    ...prevStatsPerCard,
    [currentObs.cardId]: updateWelford(prevCardStats, currentObs.outcomes.latencyMs),
  };

  // Update running medians
  const { medians: runningMedians, reservoirs } = updateRunningMedians(
    prevMedians,
    prevReservoirs,
    currentObs,
  );

  // Annotate currentObs with recent accuracy (in-memory only, not persisted)
  const recentAcc = computeRecentAccuracy(currentObs, observations);
  (currentObs as any).__recentAcc__ = recentAcc;

  // ── Collecting phase ────────────────────────────────────────
  if (n < MIN_CLUSTER_OBS) {
    const state: ClusterState = {
      clusters: existing?.clusters ?? [],
      assignments: existing?.assignments ?? {},
      currentClusterId: null,
      latencyStatsPerCard,
      featureScales: existing?.featureScales ?? emptyScales(),
      runningMedians,
      lastClusteringAt: existing?.lastClusteringAt ?? 0,
      clusteringObsCount: n,
      status: 'collecting',
      curves: existing?.curves ?? [],
    };
    // Stash reservoirs for next call
    (state as any).__reservoirs__ = reservoirs;
    return state;
  }

  // ── Full re-cluster ─────────────────────────────────────────
  if (n % 5 === 0 || existing?.status === 'collecting') {
    // Annotate all observations with recentAcc and build per-card stats incrementally
    // Process in temporal order so each obs is z-scored against only its own prior history
    const sortedObs = [...observations].sort((a, b) => a.timestamp - b.timestamp);
    const incrementalStats: Record<string, RollingStats> = {};
    const obsWithAcc = sortedObs.map((obs, idx) => {
      // Rolling 5-card accuracy
      const priors = sortedObs.slice(Math.max(0, idx - 4), idx);
      const window = [...priors, obs];
      const acc = window.filter(o => o.outcomes.recalledCorrectly).length / window.length;
      (obs as any).__recentAcc__ = acc;
      // Snapshot per-card stats BEFORE updating with this obs (leave-one-out z-score)
      (obs as any).__latencyStatsSnapshot__ = { ...incrementalStats };
      // Now update stats for this card
      const prev = incrementalStats[obs.cardId] ?? { n: 0, mean: 0, M2: 0 };
      incrementalStats[obs.cardId] = updateWelford(prev, obs.outcomes.latencyMs);
      return obs;
    });

    // Extract raw features using the leave-one-out per-card stats snapshot
    const rawVectors = obsWithAcc.map(obs =>
      extractFeatures(obs, (obs as any).__latencyStatsSnapshot__, runningMedians),
    );

    // Compute scales and normalise
    const featureScales = computeFeatureScales(rawVectors);
    const normalised = rawVectors.map(v => normalizeFeatures(v, featureScales));

    // Run k-means
    const { centroids, assignments: rawAssignments } = runKMeans(normalised, CLUSTER_K);

    // Compute cluster sizes
    const sizes = new Array<number>(CLUSTER_K).fill(0);
    rawAssignments.forEach(a => sizes[a]++);

    // Anchor to old cluster ids
    const clusters = anchorClusters(centroids, sizes, existing?.clusters ?? []);

    // Build assignment map (observation id → cluster id)
    const assignments: Record<string, number> = {};
    // Keep old assignments for any obs not in the current window
    if (existing?.assignments) {
      Object.assign(assignments, existing.assignments);
    }
    obsWithAcc.forEach((obs, i) => {
      const clusterId = clusters.find(c => c.centroid === centroids[rawAssignments[i]])?.id
        ?? rawAssignments[i];
      assignments[obs.id] = clusterId;
    });

    // Prune to most recent MAX_STORED_ASSIGNMENTS
    const allKeys = Object.keys(assignments);
    if (allKeys.length > MAX_STORED_ASSIGNMENTS) {
      const toPrune = allKeys.slice(0, allKeys.length - MAX_STORED_ASSIGNMENTS);
      toPrune.forEach(k => delete assignments[k]);
    }

    // Assign current observation
    const currentNorm = normalizeFeatures(
      extractFeatures(currentObs, latencyStatsPerCard, runningMedians),
      featureScales,
    );
    const currentClusterId = assignToNearest(currentNorm, clusters);
    assignments[currentObs.id] = currentClusterId;

    // Compute learning curves
    const curves = computeLearningCurves(observations, assignments);

    const state: ClusterState = {
      clusters,
      assignments,
      currentClusterId,
      latencyStatsPerCard,
      featureScales,
      runningMedians,
      lastClusteringAt: Date.now(),
      clusteringObsCount: n,
      status: 'active',
      curves,
    };
    (state as any).__reservoirs__ = reservoirs;
    return state;
  }

  // ── Cheap 1-NN assignment ───────────────────────────────────
  const featureScales = existing!.featureScales;
  const currentNorm = normalizeFeatures(
    extractFeatures(currentObs, latencyStatsPerCard, runningMedians),
    featureScales,
  );
  const currentClusterId = assignToNearest(currentNorm, existing!.clusters);

  const assignments = { ...existing!.assignments };
  assignments[currentObs.id] = currentClusterId;

  // Prune if needed
  const allKeys = Object.keys(assignments);
  if (allKeys.length > MAX_STORED_ASSIGNMENTS) {
    const toPrune = allKeys.slice(0, allKeys.length - MAX_STORED_ASSIGNMENTS);
    toPrune.forEach(k => delete assignments[k]);
  }

  const state: ClusterState = {
    ...existing!,
    assignments,
    currentClusterId,
    latencyStatsPerCard,
    runningMedians,
  };
  (state as any).__reservoirs__ = reservoirs;
  return state;
}
