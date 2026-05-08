# FarmRPG Mastery Tracker

Local-first static webapp scaffold for tracking FarmRPG mastery progress.

## Stack

- Vite
- React
- TypeScript
- React Router
- Vitest
- ESLint

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the local dev server:

```bash
npm run dev
```

3. Build the app:

```bash
npm run build
```

4. Run tests:

```bash
npm run test
```

5. Run linting:

```bash
npm run lint
```

## Routes

- `/` Dashboard
- `/import` Import Mastery Snapshot
- `/sorted` Sorted Mastery Progress
- `/history` Snapshot History
- `/compare` Snapshot Comparison
- `/settings` Settings

## Data Notes

- Reference data lives in [`/data/mastery_difficulty.csv`](/C:/Users/liqui/Documents/farmrpg-tools/data/mastery_difficulty.csv).
- User data should remain local and untracked.
- User snapshots are stored locally in IndexedDB.

## Hosted Use

The Vercel-hosted app remains local-first. Reference CSVs are served as static files, but mastery snapshots and app settings stay in the current browser/device. Use the Settings backup export and restore flow to move or recover local app state.
