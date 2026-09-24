# Form

A mobile-first workout journal for upper/lower training. Log your sets, adjust weights with a tap, and keep track of your progress without a spreadsheet.

[Open the app](https://form-workout-akn6.web.app)

## Features

- Per-set weight, reps, and completion tracking with large touch controls.
- Configurable weight increments, pounds/kilograms, and load conventions.
- A nine-week, 54-session upper/lower sequence that advances when you finish a workout. Rest days leave the next session waiting.
- Exercise photos, movement guides, tempo notes, supersets, dropsets, and timed sets.
- Editable exercises, set counts, rep targets, and workout order.
- A color-coded training calendar, session review, and JSON export.
- Google sign-in, private Firebase sync, and offline persistence.
- Home-screen installation with cached fonts and exercise references.

## Getting started

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

The personal deployment is restricted to its owner's Google account. Device-only logging is also available. In the app, choose a starting week and session under **Routine**, then enter your own weights as you train.

To use a separate Firebase project, register a web app and replace `src/firebase-config.json` with its web configuration. Update the owner email in `src/store.ts`, `firestore.rules`, and `tests/rules-check.mjs`, along with the Google provider settings in `firebase.json`. Deploy rules before using cloud storage.

## Stack

React, TypeScript, Vite, Firebase Authentication, Cloud Firestore, Lucide, Roboto, and vite-plugin-pwa.

User data is stored under `users/{uid}`. Sessions retain a snapshot of their exercise prescriptions, so later routine edits do not alter previous workouts. Individual sets are updated separately; simultaneous edits to the same set use last-write-wins behavior. Stable cycle/session IDs prevent duplicate records from retried writes.

After an initial online visit, the app caches its shell, routine, fonts, and reference photos. Sign-in requires a connection; workout edits can be saved offline and synchronized later. Let one device finish syncing before starting a different session on another device.

## Tests

```sh
npm test
npm run build
```

The behavior tests cover program order, weekly changes, segmented sets, duration and AMRAP targets, validation, skipped sets, cycle rollover, previous weights, unit changes, and exercise ordering.

Firestore rule tests require Java 21:

```sh
npx firebase-tools emulators:exec --only firestore --project demo-form-workout --config firebase.test.json "node tests/rules-check.mjs"
```

They verify owner access and deny unauthenticated users, other accounts, unverified email addresses, and cross-user writes.

## Deployment

```sh
npm run build
npx firebase-tools deploy --project form-workout-akn6
```

The Firebase web configuration identifies the project; it is not an administrator credential. Firestore rules enforce data access. Keep service-account keys, CLI tokens, and environment secrets out of the repository.

## Credits

Training prescriptions follow Jeff Nippard's Upper/Lower program. The unspecified Upper and Lower weak-point slots default to dumbbell lateral raises and reverse crunches, respectively, and can be changed in the app. Original spreadsheet weights and completion flags are not included.

Exercise photos and reference instructions come from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db), distributed by that project under the Unlicense. The guides identify the pictured base movement separately from any program-specific variation. Video links open a targeted demonstration search.

Third-party program content and assets retain their respective rights and license terms.
