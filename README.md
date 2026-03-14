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
- Future user snapshot storage is planned for IndexedDB.
