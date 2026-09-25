# Form

A mobile-first workout journal for upper/lower training. Log your sets, adjust weights with a tap, and keep track of your progress without a spreadsheet.

[Open the app](https://form-workout-akn6.web.app)

## Features

- Per-set weight, reps, and completion tracking with large touch controls.
- Previous completed weights and reps prefilled when starting a workout, with program targets kept visible.
- Optional progression review and autofill after two successful matching workouts; completed and manually edited sets are preserved.
- Top-of-screen notifications and a separate floating rest timer.
- Configurable weight increments, pounds/kilograms, and load conventions.
- A nine-week, 54-session upper/lower sequence that advances when you finish a workout. Rest days leave the next session waiting.
- Exercise photos, movement guides, tempo notes, supersets, dropsets, and timed sets.
- Editable exercises, set counts, rep targets, and workout order.
- Explicit Start, Pause, Resume, and Finish controls. Finishing never starts another workout.
- Swipeable day cards and a monthly calendar with one upper/lower color per date.
- Full history with view, set editing, date/name editing, and recoverable deletion.
- Five account-synced themes with individual palettes, corner shapes, and light/dark appearances.
- JSON export of your journal and device recovery copies.
- Google sign-in required for logging, private Firebase sync, and offline persistence for signed-in accounts.
- Automatic upload of older device-only workouts, with existing cloud records protected from overwrite.
- Logout waits for pending saves; separate device recovery backups remain available for export.
- Home-screen installation with cached fonts and exercise references.

## Getting started

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

The personal deployment is restricted to its owner's Google account. Sign in before logging. Workouts from the older device-only mode are uploaded automatically when signed in and online; original device copies are retained. Existing cloud records are never replaced by this import. Conflicting program slots are flagged for review and can be exported under **Routine → Export device backups**. In the app, choose a starting week and session under **Routine**, then enter your own weights as you train.

To use a separate Firebase project, register a web app and replace `src/firebase-config.json` with its web configuration. Update the owner email in `src/store.ts`, `firestore.rules`, and `tests/rules-check.mjs`, along with the Google provider settings in `firebase.json`. Deploy rules before using cloud storage.

## Stack

React, TypeScript, Vite, Firebase Authentication, Cloud Firestore, Lucide, Roboto, and vite-plugin-pwa.

User data is stored under `users/{uid}`. Sessions retain a snapshot of their exercise prescriptions, so later routine edits do not alter previous workouts. Individual sets are updated separately; simultaneous edits to the same set use last-write-wins behavior. Each new session gets a unique ID, retained for all subsequent writes. Repeating a program slot never replaces its previous log. Workout dates are stored as local calendar dates with the original start timestamp and timezone; editing a date changes only the calendar assignment. Deleted sessions retain their sets and can be restored from History. Completed sessions, including deleted ones, retain the sequence position; older unfinished sessions stay paused until explicitly resumed.

After an initial online visit, the app caches its shell, routine, fonts, and reference photos. Sign-in requires a connection; signed-in workout edits can be queued offline and synchronized later. **Saved to Firebase** is shown only once the listeners have server data and no writes are pending. Logout waits for acknowledgement and leaves the account signed in if saves fail or take too long. Local caches and recovery copies are not deleted on logout. Let one device finish syncing before starting a different session on another device.

## Tests

```sh
npm test
npm run build
```

The behavior tests cover program order, weekly changes, segmented sets, duration and AMRAP targets, validation, skipped sets, cycle rollover, previous weights and reps, unit changes, exercise ordering, progression eligibility, and protection of edited or completed sets.

Store integration tests use a simulated Firebase adapter to verify signed-out write protection, automatic device import, conflict and race handling, independent recovery backups, logout during pending or failed writes, date editing, deletion/restoration, explicit session lifecycle, and isolated theme updates. They never access production records.

## Progression suggestions

The optional button uses a conservative adaptation of the [AHA's 2-for-2 guideline](https://pmc.ncbi.nlm.nih.gov/articles/PMC11209834/). The last two occurrences of the same workout must have every prescribed set completed at least two reps above the target (or range maximum), at the same per-set weights. Exercise, units, load convention, reps, sets, effort and technique notes must match. Failed or skipped occurrences break eligibility. This is a practical guideline, not a guaranteed timetable; follow the program's effort target rather than forcing extra reps.

Autofill offers one configured weight step, capped at a 10% increase, and returns reps to the target or range minimum. Smaller configured steps are allowed. Percentage-based lifts, timed sets, AMRAP, segmented sets, assistance, bands and bodyweight remain manual. Changes are previewed and only apply to untouched, unfinished sets. Existing active sessions from older releases are preserved without backfilling or migration. Resuming any workout does not regenerate its values.

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
