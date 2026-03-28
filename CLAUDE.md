# Adaptive Learning — Project Context for Claude Code

## Repository
- GitHub: https://github.com/Princelll/adaptive-learning
- Active dev branch: `claude/add-bioloop-ml-system-nLfSa`
- Owner: Maria (Jose Eduardo Praiz Mendez)

## What this app is
Adaptive Learning is a biometric-adaptive spaced repetition app for Even Realities G2 smart glasses.
It uses ML (k-means clustering + LinUCB bandit) to adapt flashcard presentation styles
to the user's cognitive state (HRV, sleep, stress). Cards are generated from study material
via the Anthropic API. The companion web app (companion/index.html) handles deck import,
insights, and self-reported sleep/anxiety data.

## How to run the simulator (Windows / Git Bash)

Maria uses the `even-dev` simulator at `C:\Users\maria\even-dev\` (or `~/even-dev/` in Git Bash).
Apps must be copied into `~/even-dev/apps/` for the simulator to find them.

### First time setup (already done)
```bash
cd ~
git clone https://github.com/BxNxM/even-dev.git
cd even-dev
npm install
npm install @evenrealities/evenhub-simulator
npm rebuild @evenrealities/evenhub-simulator
```

### Every time you want to run the app

**Step 1 — Pull latest changes**
```bash
cd ~/OneDrive/Desktop/adaptive-learning
git fetch origin
git checkout claude/add-bioloop-ml-system-nLfSa
git pull origin claude/add-bioloop-ml-system-nLfSa
```

**Step 2 — Sync into even-dev**
```bash
cp -r ~/OneDrive/Desktop/adaptive-learning ~/even-dev/apps/adaptive-learning
```

**Step 3 — Install deps**
```bash
cd ~/even-dev/apps/adaptive-learning
npm install
```

**Step 4 — Start the simulator**
```bash
cd ~/even-dev
./start-even.sh adaptive-learning
```

Keep this Git Bash window open. You will see:
- A black terminal window (Vite server — leave it alone)
- A **Glasses Display** popup (the simulated G2 lenses)

**Step 5 — Open browser**
Go to `http://localhost:5173` in Chrome/Edge.

**Step 6 — Connect**
Click **Connect glasses**. The Glasses Display popup should show the app.

### Simulator controls (simulates R1 ring)
| Button | Action |
|--------|--------|
| Up | Scroll up / move selection up |
| Down | Scroll down / move selection down |
| Click | Single tap — confirm / advance |
| Double Click | Double tap — go back |

### Companion app
Open `http://localhost:5173/companion/index.html` in a separate browser tab
to import decks, view Insights, log sleep/anxiety, and manage the API key.

## Troubleshooting

**Glasses Display blank after connecting**
→ Check browser DevTools console (F12) and Git Bash terminal for errors.

**"inject_input: no active event container"**
→ The current screen is missing the event-capture container (containerID 99, isEventCapture 1).
  Check renderer.ts — every screen's PageConfig must include the `evt` container.

**Boot failed / corrupted localStorage**
→ Open DevTools (F12) → Console, run:
```javascript
localStorage.removeItem('adaptive_learning_data')
location.reload()
```

**Reset card due dates for testing**
```javascript
let p = JSON.parse(localStorage.getItem('adaptive_learning_data'))
p.reviewStates.forEach(s => {
  s.fsrs.due = new Date().toISOString()
  s.fsrs.state = 0
  s.totalReviews = 0
})
localStorage.setItem('adaptive_learning_data', JSON.stringify(p))
location.reload()
```

## Key files
- `src/g2/renderer.ts` — G2 glasses display screens
- `src/g2/events.ts` — Gesture event handling (tap, scroll, double tap)
- `src/g2/display-utils.ts` — Text layout helpers (kvRow, buildFooter, separator)
- `src/core/clustering.ts` — K-means cognitive state clustering
- `src/core/bandit.ts` — LinUCB contextual bandit (presentation style selection)
- `src/core/session.ts` — Study session manager
- `src/core/scheduler.ts` — FSRS spaced repetition scheduler
- `src/core/storage.ts` — IndexedDB persistence
- `public/companion/index.html` — Companion web app (Even Realities design system); in public/ so Vite always serves it at /companion/index.html regardless of even-dev config

## Design system
- Even Realities companion app: light theme, #EEEEEE bg, #232323 text, #FEF991 accent (background only, never text color)
- Even Hub OS G2 display: white border (#FFFFFF = 16777215), 6px radius, 16px card padding, 32 chars/line
- G2 zones: header y=0 h=44, body y=44 h=208, footer y=252 h=36
- Gestures: Single tap (confirm), Double tap (back), Swipe (scroll/select), Long press (system menu only)
