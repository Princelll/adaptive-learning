# Adaptive Learning

Every spaced repetition app schedules your next review based on how well you remembered a card last time. None of them ask whether your brain is actually ready to learn right now.

Your memory encoding capacity isn't constant. It fluctuates hour by hour based on sleep quality, autonomic nervous system state, and stress load — all of which can be measured non-invasively through heart rate variability. This project listens to those signals and adjusts accordingly.

---

## How it works

**Biometric scheduling**
Heart rate variability (specifically RMSSD — the millisecond variation between heartbeats) is one of the most sensitive non-invasive markers of autonomic nervous system recovery. When your RMSSD falls more than two standard deviations below your personal 7-day baseline, your prefrontal cortex is under load: working memory shrinks, consolidation is impaired, and cramming actively wastes time. The scheduler reads this signal, shortens review intervals, and caps session length. When HRV is elevated — well-rested, low cortisol — it extends intervals and increases challenge.

**Style prediction**
The same concept lands differently depending on how it's presented and what state you're in. A ridge-regularized OLS regression model learns, over time, which of 11 presentation styles (analogy, Socratic, mnemonic, clinical example, step-by-step, contrast, story, and more) produces the best recall for *this person* in *this physiological state*. The model includes a stress × complexity interaction term: under high stress, complex material benefits from concrete examples; under low stress, Socratic questioning builds deeper schema.

**Online adaptation**
Between sessions, a bandit learner (learning rate α = 0.3/√n, clamped to [0.05, 0.3]) updates style preferences after every card based on recall speed and accuracy. Styles tried fewer than three times get an exploration bonus so the model doesn't converge prematurely on early preferences.

---

## The ML stack

- **Scheduler**: SM-2+ with biometric z-score interval modifier (0.5–1.05×), latency modifier, and ±5% jitter
- **Regression**: OLS with ridge regularization (λ=0.1), 75-feature design matrix, 14-day temporal decay half-life
- **Features**: 10 style dummies, stress, energy, time-of-day, session position, response latency, stress × complexity interaction
- **Confounders**: SSRIs (~10–15ms RMSSD suppression), BMI category, smoking — adjusted in baseline calculation
- **Significance**: T-distribution p-values computed from scratch for coefficient testing
- **Bandit**: Per-style observation tracking, gradient reward signal (correct + fast = 1.0, incorrect = −0.3)
- **Dependencies**: Zero ML libraries — all matrix math in pure TypeScript (LU decomposition, ridge solve, t-distribution CDF)

The model progresses through four stages as observations accumulate: `collecting_data` → `initial_model` (15+ obs) → `refined` (30+) → `mature` (50+). R² and per-style coefficients are visible on the glasses dashboard and companion app.

---

## AI card generation

```typescript
import { generateDeck, generateDeckFromContent } from './src/api/cardGen';

// Generate a deck from a topic
const { deck, cards } = await generateDeck({
  topic: 'Contract Law',
  course: 'Legal Studies 101',
  numCards: 10,
});

// Generate from pasted notes or an article
const { deck, cards } = await generateDeckFromContent(
  myLectureNotes,
  'Lecture 7 — Consideration',
  'Legal Studies 101',
);
```

Each generated card includes the canonical front/back plus alternative presentations (analogy, mnemonic, example, etc.) so the ML model has styles to choose from from the first review.

Set `VITE_ANTHROPIC_API_KEY` in a `.env` file to enable generation. Without it, the functions return template-based fallback cards so sessions always work offline.

---

## Hardware

Runs on **Even G2 smart glasses** (576×288 display, gesture input). The Even G2 SDK provides RMSSD, resting heart rate, and SpO2 readings. Stress level, sleep quality, and cognitive load are self-reported at session start via a three-screen check-in flow on the glasses.

A companion web app (`companion/index.html`) runs in a phone browser and shows the full ML insights dashboard — style preference rankings, R², observation progress, and deck management — using the same localStorage the glasses app writes to.

---

## Architecture

```
src/core/     — models, OLS regression, SM-2+ scheduler, session state machine, localStorage
src/g2/       — Even G2 SDK bridge, screen renderer, gesture event dispatch, keep-alive
src/api/      — Claude card generation (generateDeck, generateDeckFromContent)
src/data/     — sample decks (medical genetics, bioinformatics, ML health tech)
companion/    — phone web app: ML insights, style preference chart, deck list
docs/         — app flow diagram (Mermaid)
```

---

## Running

```bash
npm install
npm run dev
```

Open `localhost:5173` for the glasses simulator. Open `localhost:5173/companion/` on your phone (same network) for the ML dashboard.

For AI card generation, create a `.env` file:
```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

---

## Status

**Built**: biometric z-score computation, SM-2+ scheduler, OLS regression with bandit adaptation, G2 glasses UI (9 screens), companion web app, Claude card generation, sample decks with multi-mode presentations, localStorage persistence, connection recovery with exponential backoff.

**Not yet built**: confounder collection UI (SSRI/BMI/smoking fields exist in the model but no input screen), cloud sync, multi-user support, deck import/export from file.

---

## Author

Jose Eduardo Praiz Mendez — MIT License
