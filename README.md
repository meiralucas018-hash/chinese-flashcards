# 中文闪卡 - Chinese Flashcards

Offline-first Chinese flashcards app built with Next.js + Capacitor.

## Highlights

- Local flashcard data flow (IndexedDB + local CC-CEDICT file)
- Local rule-based sentence translation
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

## Translation

The **Analyze Sentence Structure** action now uses a fully local rule-based
translator built on top of sentence segmentation and CEDICT meanings.

Current local coverage focuses on common learner sentence patterns:

- `A 是 B`
- `A 有 B`
- `A 在 B`
- adjective predicates such as `我很好`
- simple negation with `不`, `没`, `没有`
- yes/no questions with `吗`, `?`, `？`
- simple verb-object sentences such as `我喜欢中文`
- time phrases, possessives, and common adverbs

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
