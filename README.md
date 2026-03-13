# Chinese Flashcards

Offline-first Chinese flashcards app built with Next.js + Capacitor.

## Highlights

- Local flashcard storage in IndexedDB
- Local CC-CEDICT search and segmentation
- AI-assisted word card authoring with a strict clipboard-driven parser flow
- Word-focused study cards with hover inspection, TTS, and handwriting practice
- Static export compatible (`output: "export"`)
- Android-ready via Capacitor

## Tech Notes

- Dictionary source: `public/data/cedict.txt`
- AI parser pipeline: `src/lib/ai`
- CEDICT utilities: `src/lib/cedict.ts`
- Local persistence: `src/lib/flashcard-db.ts`
- SRS logic: `src/lib/srs.ts`

## Development

```sh
npm install
npm run dev
```

## Quality Checks

```sh
npm run lint
npm run typecheck
npm run test
```

## Static Export / Android Sync

```sh
npm run build:web
npx cap sync android
```

## Data Backup

Use the in-app **Settings** tab:

- **Export Data** downloads schema version 3 deck/card JSON
- **Import Data** restores version 3 backups only

## Constraints Kept By Design

- Fully client-side
- Offline-first study flow preserved
- Hover inspection and TTS preserved
- No external AI API integration inside the app
- Compatible with Next.js static export and Capacitor Android
