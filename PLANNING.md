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

#### Physiological State Clustering
- Use **DBSCAN** or **Gaussian Mixture Models (GMM)**
- Why: avoids forcing a fixed number of clusters upfront
- GMM allows soft boundaries (e.g. "mostly recovered with some stress load")
- Continuous dataset — clusters emerge from retention rate outcomes, not assumptions
- Hypothesis: natural groupings will appear (high readiness / moderate / depleted) but data confirms this

#### Reinforcement Learning — Presentation Style
- System tries different presentation styles (analogy, clinical example, step-by-step)
- Learns over time which style produces best recall in each physiological cluster
- Reward signal = retention rate

#### Content Clustering (Phase 2)
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
- [ ] Wire biometrics from Even Hub SDK (HRV, sleep quality, SpO2)
- [ ] Store session data: card reviewed + biometric snapshot + grade + retrievability
- [ ] PubMed integration — search and pull articles directly
- [ ] Document upload — PDF parsing → auto-generate flashcards
- [ ] Unsupervised clustering on accumulated biometric + retention data
- [ ] RL layer — presentation style optimization per physiological state

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
