# Development Notes

This document is for maintainers and contributors. It records implementation boundaries and local development conventions that do not belong in the player-facing README or in the in-app changelog.

## Architecture
 
 The tracker is a static application with classic JavaScript files. Scripts share the global scope and are loaded synchronously in the order listed near the end of `index.html`. Script order is load-bearing because later files use functions and state created by earlier files.
 
 The app stores challenges and matches in browser local storage. There is no required backend, account system, build step, or package manager for the client runtime.
 
- Developer tooling (`package.json`) provides local emulation and test execution (`firebase-tools`, `@firebase/rules-unit-testing`) without requiring a bundler or compiler.
- Hosting is configured via `firebase.json` for Firebase Hosting and local emulators.
- Future phases incrementally introduce Cloud Firestore as an offline-first persistence layer behind `persist()`, with Firebase Auth and account linking.
- Cloud architecture and phase breakdown are specified in `docs/superpowers/specs/2026-09-06-cloud-backend-and-accounts-design.md` and `docs/superpowers/plans/2026-09-06-cloud-backend-phases-0-3.md`.
 
 ## Development & Testing

Developer commands available via `package.json`:

- `npm test` - Runs the 76 pure Node.js unit and integration tests (`node --test tests/*.test.js`). Fast, local, offline, with zero external dependencies.
- `npm run test:rules` - Runs the 35 Firestore Security Rules unit tests against the local Firestore emulator (`firebase emulators:exec --only firestore "node --test tests/rules/firestore-rules.test.js"`). Requires a local Java runtime (Microsoft OpenJDK 21).
- `npm run emulators` - Starts local Firebase emulators (Auth, Firestore, Hosting).
- `npm run deploy` - Deploys static files to Firebase Hosting.
- `npm run deploy:rules` - Deploys updated Firestore security rules to Cloud Firestore.

## Source layout

- `js/constants.js` and `js/dom-utils.js` provide shared values, enums, and DOM helpers.
- `js/storage.js`, `js/persistence.js`, and `js/challenge-state.js` own local-first storage, active-challenge state, and normalization.
- `js/cloud/` contains the Phase 1 Cloud Sync engine:
  - `snapshot-model.js` - Computes canonical document snapshot dictionaries from in-memory globals.
  - `snapshot-diff.js` - Pure diff algorithm computing create, update, and delete sets.
  - `cloud-sync.js` - Push/pull synchronization bridge, reconciliation, and tombstone tracking.
  - `cloud-migrate.js` - One-time migration from local storage to Cloud Firestore on first sign-in.
  - `firebase-boot.js` - Modular Firebase SDK loader and authentication bootstrapping.
- `js/challenge-actions.js` owns challenge lifecycle operations (open, archive, unarchive, delete).
- `js/dialogs.js` owns confirmation modals, notice dialogs, toasts, and event delegation.
- `js/match-*.js` files own match entry, validation, saving, importing, filtering, and rendering.
- `js/analytics-*.js`, `js/chart.js`, and `js/overview-panels.js` own analytical views.
- `js/navigation.js` owns page routing and sidebar state.
- `js/challenge-report.js` and `js/export.js` own report and data exports.
- `css/` contains ordered stylesheet partials (`01-tokens.css` through `30-modal-keyboard.css`). See `css/README.md` before changing load order.
- `firestore.rules`, `firestore.indexes.json` manage Cloud Firestore security rules and composite indexes.
- `docs/` contains architectural specs and phase implementation plans.

## Cloud Sync Engine (`js/cloud/`)

The tracker implements a resilient, local-first synchronization model with Cloud Firestore:

### 1. Snapshot Diffing (`snapshot-diff.js`)
- `diffSnapshots(prev, next)` compares the last successfully synchronized snapshot against the newly computed snapshot.
- Diffing isolates discrete sets of `creates`, `updates`, and `deletes` for challenges and matches.
- `sameValue(a, b)` treats `null` and `undefined` as equivalent absence. This ensures optional match metrics (e.g. KAST%, HS%, optional combat stats) remain `null` without generating false update diffs or churning into coerced zeros.

### 2. Operation-Bounded Batch Chunking (`cloud-sync.js`)
- Firestore imposes a strict hard ceiling of 500 operations per write batch.
- `chunkChangesByOperations(changes, deletedChallenges, currentTombstones, 400)` divides pending changes into safe batches of `<= 400` projected operations, providing a 20% safety margin.
- The projection algorithm dynamically computes auxiliary side-effects:
  - Parent challenge `updatedAt` touches: subcollection writes to `/matches` do not trigger listeners on `/challenges`, so parent challenges must be touched to notify listeners across concurrent clients.
  - Suppression logic: if a parent challenge was created, deleted, or tombstoned in the current batch, duplicate touch operations are omitted.
  - Consolidated tombstone write: counted once per batch containing deletions.

### 3. Durable Tombstones (`users/{uid}/meta/tombstones`)
- To avoid "zombie" resurrections across concurrent clients or offline tabs, deleted challenges and matches write persistent tombstone keys (`c_<id>` and `m_<challengeId>_<matchId>`) with server timestamps into `/users/{uid}/meta/tombstones`.
- Startup ordering: `start(uid)` fetches initial tombstones prior to subscribing to challenges, eliminating startup race conditions.
- Real-time updates: `onSnapshot` on the tombstones document detects out-of-band deletions made by other tabs/devices and immediately evicts affected entities from local memory.

### 4. `getAfter()` Delete-Tombstone Atomic Invariants
- `firestore.rules` enforces that document deletions MUST be accompanied by the corresponding tombstone write in the exact same batch.
- Rules check `isTombstonedChallengeAfter` and `isTombstonedMatchAfter` using `existsAfter()` and `getAfter()` on `/users/{uid}/meta/tombstones`.
- Any delete attempted without its corresponding tombstone key is rejected by the server.

## Data Boundaries & Runtime Invariants

### ID-Based Challenge Lifecycle (`js/challenge-actions.js`)
- Challenge operations (`openActiveChallenge`, `archiveActiveChallenge`, `deleteActiveById`, `deleteArchivedChallenge`, `unarchiveChallenge`) target challenges strictly by immutable unique ID, not array index.
- Operations employ copy-on-write modifications and state rollback if `safePersist()` fails or throws, preserving memory and local storage integrity.

### Deterministic Match Number Reconciliation
- Concurrency or multi-device imports may yield duplicate match numbers or numbering gaps.
- `reconcileMatchNumbers(challenge)` in `js/cloud/cloud-sync.js` sorts matches deterministically by `Number(a.no) - Number(b.no) || String(a.matchId).localeCompare(String(b.matchId))`.
- Duplicate or non-positive match numbers are detected and reassigned to the lowest available positive integer gaps without shifting existing clean match numbers.
- When reassignments occur, the player is notified via non-blocking toast/notice.

### Event Delegation for Dialogs (`js/dialogs.js`)
- Notice modals and confirmation dialogs utilize document-level event delegation for `[data-notice-close]` and `[data-confirm-cancel]`.
- Delegated event handling guarantees that dynamically generated, re-rendered, or restored modal elements respond to close and dismissal actions without risk of memory leaks or dead event listeners.

### Match Dataset Independence
- Match History pagination, sorting, and filtering are presentation concerns. The canonical challenge match dataset remains independent from the table view.
- Overview charts and Analytics consume the canonical or range-scoped dataset; only the Match History renderer consumes the paginated slice.
- Challenge membership is independent of the target match count. Matches recorded beyond the target continue to feed analytics and display progress without corruption.

## Rank and RR progression

Rank/RR progression uses the centralized runtime normalizer `rebuildChallengeRankProgression(challenge)`. Existing match fields (`rankStatus`, `rankAfter`, `rrAfter`, `rrChange`) remain persisted user or import facts; derived states are not written back to storage.

- Recorded values take priority over safely derived values, which take priority over unknown values.
- Missing RR remains unknown rather than becoming zero.
- Same-rank RR is derived only when the arithmetic is unambiguous.
- Missing links stop the derivation chain; a later recorded RR-after value starts a new anchor.
- Placement and rank-boundary transitions do not guess RR arithmetic.
- Runtime values record `recorded`, `derived`, or `unknown` provenance.
- Progression is rebuilt after challenge mutations and when current rank state is requested.

## Navigation state

The setup form and its restore panel live outside the routed `#app` container because they are also used when no challenge is active. Any route change must explicitly control their visibility. In particular, the Changelog route must hide both setup sections, while the no-challenge Overview state must hide routed app pages and mark Overview active in the sidebar.

## Documentation boundaries

- `README.md` is the public project overview and front door for GitHub visitors.
- The Changelog tab in `index.html` contains player-facing release notes explaining gameplay improvements.
- `CONTRIBUTING.md` contains contribution guidelines, PR checklists, and non-negotiable architectural invariants.
- `CODE_OF_CONDUCT.md` contains community standards, pledge, and enforcement procedures.
- `DEVELOPMENT.md` contains technical architecture, maintainer guidance, and engineering invariants.
- `SECURITY.md` contains the security policy, server-enforced architecture details, and vulnerability reporting procedures.
- `docs/` contains planning specs and design documents (reserved for design history; do not edit during routine chores).

Keep these boundaries strictly intact when updating documentation or adding future release notes.

