# Adaptive Learning System — Planning

## Core Concept

A biometric-adaptive learning system built on Even G1/R1 hardware that uses physiological signals to personalize when and how study content is delivered — adjusting difficulty, scheduling, and presentation style in real time based on the user's cognitive readiness.

---

## System Architecture

### 1. Document Ingestion
- Upload PDFs, articles, and personal notes
- App parses and extracts key concepts
- Auto-generates questions for spaced repetition

### 2. PubMed Interface
- Search and pull articles directly from PubMed
- No manual uploading needed for scientific literature
- Keeps content evidence-based and current

### 3. Spaced Repetition Engine
- Core scheduling algorithm (based on Tom's work) — forked at `Princelll/g2-flashcards`
- Determines when to surface each card
- Biometric layer acts as a runtime modifier on top
- `getRetrievability()` added to `scheduler.ts` — returns raw 0.0–1.0 recall probability (this is the RL reward signal)
- `formatRetrievability()` added — human-readable % shown in card UI
- **Status: fork done, retrievability display live, build clean**

### 4. Biometric Layer
- Signals: HRV, sleep quality, SpO2
- Adjusts card timing and difficulty based on physiological state
- Does not pre-define states — lets data define clusters organically

### 5. ML Stack

#### Current implementation (OLS ridge regression)
- Runs as batch job every 5 observations when n ≥ 15
- Target: `masteryGain` (0, 0.5, 1 based on rating)
- Features: explanationStyle (one-hot), stressLevel, energyLevel, timeOfDay, etc.
- Output: beta coefficients per style → stylePreferences ranking
- Online update: `updateStylePreferences()` adjusts weights after each card
- **Limitation**: additive features only — cannot learn "analogy works under stress, definition works when rested"

#### Planned: Two-layer architecture (not yet implemented)

**Layer 1 — Contextual Bandit (LinUCB)** — the decision maker
- One ridge regression per presentation style (11 arms)
- Context vector: `[stressLevel, rmssdZ, sleepHoursActual, metSixHourThreshold, timeOfDay, minutesIntoSession, complexity, ...]`
- At card time: `score_s = θ_s · context + α * uncertainty_s` — picks style with highest UCB score
- Reward: `recalledCorrectly` (binary) or `masteryGain` (0–1)
- Updates online after every rated card
- Replaces `weightedRandomSelect()` in `selectPresentationMode()`
- Implementation: `src/core/bandit.ts` (~120 lines)

**Layer 2 — Global OLS** — the insight reporter (keep existing)
- Batch run every 5 observations as now
- Job: produce interpretable betas for `modelInsights` screen
- Not used for decisions, only for display

**Testing plan for bandit (when implemented)**
- Unit: after 10 synthetic observations where "analogy always wins under stress", analogy arm should score highest when `stressState=0.8`
- Simulation: 100 synthetic obs with conditional correctness — verify model selects right style >80% of time by obs 40
- Offline replay: record a real session fixture, replay through bandit, assert reward accumulates faster than random baseline
- Shadow mode: run both old selector and new bandit in parallel, log both choices, compare accuracy after 50 obs

#### Physiological State Clustering (Phase 2)
- Use **DBSCAN** or **Gaussian Mixture Models (GMM)**
- Why: avoids forcing a fixed number of clusters upfront
- GMM allows soft boundaries (e.g. "mostly recovered with some stress load")
- Continuous dataset — clusters emerge from retention rate outcomes, not assumptions
- Hypothesis: natural groupings will appear (high readiness / moderate / depleted) but data confirms this

#### Content Clustering (Phase 3)
- After RL system matures, cluster content by learning curve difficulty under matched physiological conditions
- Group: slow learners vs fast learners under same state conditions
- Analyze differences to generate hypotheses about why certain content is harder to consolidate

### 6. Display / UI (Even Glasses)
- Ambient, discreet overlay — not intrusive
- Guides user through study sessions
- Shows readiness cues, prompts, and card content
- TBD: exact interaction design

---

## Phases

### Phase 1 — Core Learning App
- [x] Fork Tom's g2-flashcards — `Princelll/g2-flashcards`
- [x] Add retrievability display — recall probability shown per card in UI
- [x] Migrate scheduler from SM-2+ to FSRS (ts-fsrs) — aligns with Tom's fork
- [x] Remove self-reported bio check-ins — biometrics all null until ring data available
- [x] BiometricZScores + DailyBiometric — all fields null-safe, sleepHours/remHours added
- [x] Per-question observation captures: latency, sleep actual+z, REM actual+z, HRV actual+z, RMSSD actual+z, card age, sleep interruption analysis (metSixHourThreshold, longestBlock, difficultReturn)
- [x] Z-score null guards throughout scheduler — no hard stops when all null
- [x] Document upload — Import tab in companion app (file drop + paste + claude-sonnet-4-6 analysis)
- [x] PubMed integration — search NCBI, fetch abstracts/full text, generate cards via Claude
- [x] LinUCB contextual bandit — replaces weightedRandomSelect(), persists per-arm state to localStorage
- [ ] Wire biometrics from Even Ring R1 when pilot data available
- [ ] Unsupervised clustering on accumulated biometric + retention data (Phase 2)

### Phase 2 — Context and Insights
- Accumulate longitudinal data per user
- Surface patterns: "Your retention drops after X condition"
- Content clustering to identify which topics resist consolidation and why
- Hypothesis generation from cross-user patterns

### Phase 3 — Clinical Decision Support (future)
- Extend into professional clinical settings
- Clinician awareness of their own cognitive state during high-stakes decisions
- Adaptive information delivery based on depletion level
- Real-time retrieval of relevant clinical material adjusted to current state

---

## Key Design Principles

- **Let data define the clusters** — no pre-imposed assumptions about what readiness looks like
- **Build the foundation first** — learning app before clinical layer
- **Evidence-based** — grounded in neuroscience of memory consolidation, not intuition
- **Adapt to constraints** — build with what data is currently available, expand as more is exposed

---

## Open Technical Questions

- What biometric data is currently accessible in the Even Hub SDK?
- How to structure the continuous biometric data stream for efficient clustering
- Optimal RL reward shaping for retention signal (immediate recall vs delayed recall) — `getRetrievability()` is the candidate signal
- Storage architecture for longitudinal user data

---

## Stack (TBD / To Decide)

- ML: Python (scikit-learn, stable-baselines3 or custom RL)
- Backend: TBD
- Even Hub: TypeScript SDK
- PubMed integration: E-utilities API (NCBI)
- Document parsing: TBD (PyMuPDF, LangChain, etc.)
