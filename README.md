# 中文闪卡 - Chinese Flashcards

Offline-first Chinese flashcards app built with Next.js + Capacitor.

## Highlights

- Fully local data flow (IndexedDB + local CC-CEDICT file)
- No backend, no external API dependency
- Static export compatible (`output: "export"`)
- Android-ready via Capacitor
- SRS review flow with writing practice canvas and keyboard shortcuts
- Sentence-aware word segmentation for richer card breakdowns
- Local import/export with validation and backward-compatible normalization

## Tech notes

- Dictionary source: `public/data/cedict.txt`
- CEDICT utilities: `src/lib/cedict.ts`
- Local persistence: `src/lib/flashcard-db.ts`
- SRS logic: `src/lib/srs.ts`

## Development

```sh
npm install
npm run dev
```

## Quality checks

```sh
npm run lint
npm run typecheck
```

## Static export / Android sync

```sh
npm run build:web
npx cap sync android
```

## Android build flow

1. Run static web build: `npm run build:web`
2. Sync Capacitor Android project: `npx cap sync android`
3. Open `android/` in Android Studio
4. Build APK/AAB from Android Studio

## Data backup

Use the in-app **Settings** tab:

- **Export Data**: download local decks/cards JSON
- **Import Data**: restore JSON backup (validated and normalized)

## Constraints kept by design

- Offline-first behavior preserved
- Client-side CEDICT search/segmentation preserved
- No backend/server APIs introduced
- Compatible with Next.js static export and Capacitor Android
