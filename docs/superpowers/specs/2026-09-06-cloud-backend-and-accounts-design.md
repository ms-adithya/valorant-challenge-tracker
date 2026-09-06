# Cloud Storage, Accounts and Riot Sign-On — Design

Date: 2026-09-06
Status: Approved for phases 0–3
Scope: Phases 0, 1, 2, 3. Phases 4 (Riot match fetch) and 5 (scheduled fetch) are
sketched in "Out of scope" for context only and get their own spec.

## 1. Problem

The tracker stores everything in three `localStorage` keys. Data is confined to one
browser profile, disappears when site data is cleared, cannot move between devices,
and has no owner — there is no concept of a user.

Goals, in dependency order:

1. Durable cloud storage that survives cache clears and follows the user across devices.
2. Accounts, so data is separated per user: email/password, Google, and Riot sign-in.
3. Riot Sign-On specifically, because it yields the PUUID needed later for match fetch.
4. (Later spec) Automatic import of recent matches from the Riot API.

## 2. Decisions taken

| Decision | Choice | Rationale |
|---|---|---|
| Audience | Personal now, architected for public | Multi-tenant schema and real migrations from day one; public-facing polish deferred |
| Sync model | Local-first, background sync | Preserves instant offline writes, today's core UX property |
| Platform | Firebase + Node.js Cloud Functions | Firestore's offline persistence supplies the local-first layer as a library feature |
| Database | Cloud Firestore, one document per match | Firestore resolves conflicts last-write-wins per document, so document granularity *is* the conflict strategy |
| Frontend | Stays build-free | Modular SDK loads from gstatic as an ES module; the 41 existing script tags are untouched |
| Match identity | UUID `matchId`; `no` demoted to a display field | Offline multi-device writes cannot preserve globally-unique user-chosen numbers |
| First run | Anonymous auth | The app must keep working with no signup, exactly as it does today |
| `file://` support | Dropped | Firebase Auth requires a real origin; Firebase Hosting replaces it |

### 2.1 Non-goals

- No frontend framework migration. No build step. No bundler.
- No redesign of analytics, charts, reports or any existing UI beyond what sync requires.
- No realtime collaboration. One user, many devices — not many users, one challenge.
- No server-rendered pages. The app stays a static client.

## 3. Architecture

```
Browser — static, no build step
  index.html + 41 existing script tags        unchanged
  firebase-boot.js   <script type="module">   ESM from gstatic, exposes window.VCT
  cloud-sync.js                               Firestore <-> globals, diff-based
  auth-ui.js                                  sign-in / account panel
        |
        +-- Firebase Auth       anonymous -> email/pw, Google, Riot (custom token)
        +-- Cloud Firestore     offline persistence = the local-first layer
        +-- Firebase Hosting    serves the static app, free SSL and domain
        |
Cloud Functions (Node 22, 2nd gen)
        +-- riotAuthStart       builds the RSO authorize URL, sets state cookie
        +-- riotAuthCallback    code exchange -> PUUID -> Firebase custom token
        |
   Riot Games API — RSO. Access is approval-gated (see §8).
```

### 3.1 Why the existing code survives

Two seams carry the whole design.

**`persist()` — [js/persistence.js:8](../../../js/persistence.js).** Every write in the app
funnels through it, and it already returns a boolean that its 13 call sites use for
rollback. It becomes a dispatcher issuing per-document Firestore writes. Its contract is
unchanged, so none of the 13 call sites change.

**`buildImportPreview(objects)` — [js/import-preview.js:71](../../../js/import-preview.js).**
Takes a plain array of raw objects and drives normalization, validation, match-number
assignment, the review UI and commit. This is where phase 4's Riot fetch will attach.
Nothing in phases 0–3 touches it, but the schema must not break it.

### 3.2 The boot-order problem, and why localStorage stays

Several modules do real work at script-parse time against the globals:
`normalizeStoredChallenges()` runs immediately at
[js/challenge-state.js:25](../../../js/challenge-state.js), `setup-form.js` calls
`updateTargetRankOptions()`, `setup-restore.js` calls `renderSetupRestore()`,
`bootstrap.js` calls `render()`. This is safe against synchronous `localStorage` and
breaks the moment hydration becomes asynchronous.

Making 41 files async-aware is not acceptable. Instead:

1. Boot reads `localStorage` exactly as today. Parse-time behavior is byte-identical and
   first paint is instant.
2. Firestore's first snapshot arrives later and calls a single `rehydrate()` that refills
   the globals, re-runs `normalizeStoredChallenges()`, and calls `render()`.
3. After every successful sync, the current state is mirrored back to `localStorage`.

`localStorage` therefore keeps two jobs — migration source, and last-known-good cache for
first paint — and loses its role as the system of record. The three key names (`vct4`,
`vctActiveChallenges`, `vctArchives`) are retained so an old build reading the same
browser still finds valid data during rollout.

### 3.3 How `persist()` becomes a sync dispatcher

There are 13 call sites. The globals are *reassigned*, not only mutated — `data=chosen`
([js/challenge-actions.js:5](../../../js/challenge-actions.js)),
`activeChallenges=activeChallenges.filter(...)`, `archives=p.archives`
([js/app-controls.js:14](../../../js/app-controls.js)). No proxy or observer catches
reassignment, so change detection must be a diff.

`persist()` gains this shape, keeping its existing signature and boolean contract:

1. Build a normalized snapshot of `{data, activeChallenges, archives}`.
2. Diff it against `lastSyncedSnapshot` to produce creates, updates and deletes at
   document granularity.
3. Write the batch to Firestore. Because offline persistence is enabled, this resolves
   from the local cache immediately and queues for the server; it does **not** await the
   network.
4. Mirror to `localStorage` (preserving today's all-or-nothing rollback).
5. Return `true`. Return `false` only on a genuine local failure, matching current
   semantics so the existing rollback paths still fire.

Consequence: a `persist()` return value continues to mean "the write was accepted
locally", never "the server has it". That is the correct contract for local-first, and it
is what every existing call site already assumes.

## 4. Data model

```
users/{uid}
    displayName, email, photoURL, createdAt, updatedAt
    schemaVersion: number
    riot: { puuid, gameName, tagLine, region, source, linkedAt } | null
         source: "rso" | "riot-id"   — how the PUUID was obtained (§6.4)

users/{uid}/challenges/{challengeId}
    name, target, startRank, startRR, targetRank, description
    status: "active" | "archived"
    isOpen: boolean
    archivedAt: timestamp | null
    createdAt, updatedAt

users/{uid}/challenges/{challengeId}/matches/{matchId}
    no: number                       display ordinal, not identity
    date, agent, map, result, rankAfter, rankStatus
    rrAfter, rrChange                nullable, per v9.6
    myScore, enemyScore, rounds
    kills, deaths, assists, ddDelta, hs, acs, adr, kast
    firstKills, firstDeaths, multiKills, notes
    source: "manual" | "import" | "riot"
    riotMatchId: string | null       reserved for phase 4 dedupe
    createdAt, updatedAt

users/{uid}/meta/migration
    completedAt, sourceKeys, challengeCount, matchCount, backupDownloaded

riotAccounts/{puuid}                 top-level, Admin SDK only
    uid, source, linkedAt
```

`riotAccounts` is the PUUID uniqueness index. It sits outside `users/` because
uniqueness must be enforced across all users, which a per-user path cannot express. It
is written only inside the linking transaction in §6.3, and no client may read or write
it.

### 4.1 Mapping from today's shape

- `vct4` (the open challenge) becomes `isOpen: true` on one challenge document. Exactly
  zero or one challenge per user may hold it.
- `vctActiveChallenges` becomes `status: "active"`.
- `vctArchives` becomes `status: "archived"` with `archivedAt` preserved.
- `challenge.matches[]` becomes the `matches` subcollection.

Rehydration reassembles the three globals from these documents, so every downstream
consumer — `render.js`, `match-table.js`, analytics, reports — is unaffected.

### 4.2 Match identity

`matchId` is `crypto.randomUUID()`, assigned client-side at creation. `no` becomes a
stored display field.

This is a deliberate behavior change. Today `no` *is* the identity, and v9.6 hardened
"new matches choose the lowest unused positive number" as a feature. Two devices editing
offline will both allocate the same number; no scheme prevents this without a server
round-trip, which local-first gives up by definition.

The resolution reuses machinery the app already has. `assignImportNumbers()` at
[js/import-preview.js:3](../../../js/import-preview.js) reassigns colliding numbers to
the next free slot and displays the reason (`"#12 -> #13, 12 already exists"`). Sync
reconciliation calls the same function and surfaces the same notice. Collisions are rare,
visible, and user-editable, and require no new UI.

Migration assigns each existing match a fresh UUID while preserving its `no` exactly.

### 4.3 Index-based handlers

`unarchiveChallenge(archiveIndex)` and `deleteArchivedChallenge(i)` take array indices
([js/challenge-actions.js:31](../../../js/challenge-actions.js),
[js/challenge-options.js:22](../../../js/challenge-options.js)). A snapshot arriving
between render and click can shift those indices and act on the wrong challenge.

Every challenge already carries a stable `id`, and `renderArchive()` already looks up
`archives.findIndex(x => x.id === c.id)`. Phase 1 converts these handlers to take `id`
instead of an index. Small change, removes a real class of bug.

## 5. Security rules

Ownership is enforced by path:

```
match /users/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;

  match /challenges/{challengeId} {
    allow read, delete: if request.auth != null && request.auth.uid == uid;
    allow create, update: if request.auth != null && request.auth.uid == uid
                          && validChallenge(request.resource.data);

    match /matches/{matchId} {
      allow read, delete: if request.auth != null && request.auth.uid == uid;
      allow create, update: if request.auth != null && request.auth.uid == uid
                            && validMatch(request.resource.data);
    }
  }
}

match /riotAccounts/{puuid} {
  allow read, write: if false;   // Admin SDK only; it bypasses rules.
}
```

`validMatch()` mirrors the range checks already enforced in
[js/match-validation.js](../../../js/match-validation.js) and
[js/match-save.js](../../../js/match-save.js): `hs` and `kast` within 0–100, `rrAfter`
within 0–100 or null, counters non-negative, `myScore + enemyScore == rounds`, `result`
consistent with the scores. Client validation stays as the UX layer; rules are the
integrity layer. Both must be updated together — this duplication is accepted and noted.

Rules are tested with the Firebase emulator, including negative cases: a user must not
read or write another uid's documents.

## 6. Authentication

### 6.1 Anonymous first

On first load the client calls `signInAnonymously()`. The app works with no signup, as it
does today. All data is written under that uid immediately.

### 6.2 Upgrading to a real account

Signup *links* credentials to the existing anonymous user via `linkWithCredential`
(email/password) or `linkWithPopup` (Google). The uid is preserved, so every document
under `users/{uid}` carries over untouched. No user ever trades their data for an account.

Collision cases requiring explicit handling:

- **`auth/credential-already-in-use`** — the target account already exists. The anonymous
  account's data must be merged into it or explicitly abandoned. The user is shown the
  choice; the default is merge, appending challenges rather than replacing.
- **`auth/account-exists-with-different-credential`** — same email registered under a
  different provider. Resolved by `fetchSignInMethodsForEmail()` and prompting for the
  original provider, then linking.
- **`auth/email-already-in-use`** on plain signup — routed to sign-in.

### 6.3 Riot Sign-On

Riot is not a Firebase provider, so it runs through Cloud Functions and a custom token:

1. `riotAuthStart` builds the RSO authorize URL with `response_type=code`, the registered
   `redirect_uri`, scopes `openid offline_access`, and a signed anti-CSRF `state`.
2. Riot redirects to `riotAuthCallback` with the code.
3. The function validates `state`, exchanges the code for tokens at Riot's token
   endpoint, and reads the account from `/riot/account/v1/accounts/me` to obtain `puuid`,
   `gameName`, `tagLine`.
4. If a signed-in uid was carried through `state`, the function **links**: it writes
   `riot: {...}` onto that user document and returns control to the client. Otherwise it
   resolves the uid by `puuid` lookup, creating a user if none exists, and mints a
   Firebase custom token via `admin.auth().createCustomToken(uid)`.
5. The client calls `signInWithCustomToken()`.

Constraints:

- The `puuid` must be unique across users, enforced by a Firestore transaction over
  `riotAccounts/{puuid}`. A second uid attempting to link an already-linked `puuid` is
  refused with an explanatory message, never silently merged.
- Riot's client secret and any refresh token live only in Secret Manager, never in
  Firestore documents readable by the client.
- The `riot` field is written by the function using the Admin SDK. Security rules deny
  client writes to it.

### 6.4 Riot ID as an alternative PUUID source

RSO and `VAL-MATCH-V1` are gated separately, so RSO may be refused while match access is
granted. Because everything downstream needs only a **PUUID**, not a login, a second
source is specified: the user types their Riot ID (`Name#TAG`) and a Cloud Function
resolves it against the Account API's `by-riot-id` endpoint using the server-held API
key, then claims `riotAccounts/{puuid}` under the same transaction and uniqueness rule as
§6.3.

Both sources write the identical field, `users/{uid}.riot`, distinguished by
`source: "rso" | "riot-id"`. Consumers read `riot.puuid` and need not know which applies.

**The two are not equivalent in trust.** RSO proves the user owns the account. A typed
Riot ID does not — anyone may enter anyone's Riot ID and pull that player's competitive
match history into their own tracker. The data is comparable to what public tracker sites
already expose, which makes this acceptable for personal use and a deliberate decision
for public use. Two honest mitigations: keep signups closed while relying on typed Riot
IDs, or treat it as a bridge and migrate to RSO once approved. `riot.source` preserves
the distinction in the data either way.

## 7. Migration

Migration runs once per uid, guarded by `users/{uid}/meta/migration`.

1. Detect legacy data in `localStorage` (including the `vct2` fallback already handled at
   [js/storage.js:16](../../../js/storage.js)).
2. **Automatically trigger the existing `exportBackupJson()`**
   ([js/export.js:26](../../../js/export.js)) so the user holds a file copy before
   anything moves. Record `backupDownloaded` in the migration document.
3. Assign a UUID to every match, preserving `no`, `date` and all fields.
4. Write challenges and matches in batches (Firestore caps a batch at 500 operations, so
   chunk accordingly).
5. Write the migration record with counts.
6. **Copy, do not move.** `localStorage` is left intact for several releases, so a
   rollback or an old cached build still finds working data.

Verification before the migration record is written: challenge count and per-challenge
match count must match the source exactly, or the migration aborts and reports.

## 8. Riot API access — verify before phase 3

Phase 3 opens with a spike, not code. Riot Sign-On requires a registered and approved
product on the developer portal, and approval is not guaranteed for hobby projects. This
design's understanding of that gating is drawn from training data, not from the current
portal, and must be confirmed against live documentation before any phase 3 work begins.

The spike answers three questions and produces a written recommendation:

1. Can this project register for RSO today, and on what terms?
2. What is the actual approval timeline?
3. Does RSO approval carry any implication for `VAL-MATCH-V1` access in phase 4?

A fourth question, added after planning: **are RSO and `VAL-MATCH-V1` separately gated?**
Phase 4 needs a PUUID, and RSO is only one way to obtain one — the Account API's
`by-riot-id/{gameName}/{tagLine}` lookup may serve, with the user typing their Riot ID.
If so, losing RSO does not necessarily cost auto-fetch, and the two legs can be pursued
independently. The phase table above assumes the stricter dependency until the spike
settles it.

**Phases 0–2 have no Riot dependency.** If Riot access is refused, the cloud-storage and
accounts goals are delivered in full; only the convenience of Riot sign-in and later
auto-fetch is lost. Email and Google sign-in cover authentication completely on their own.

### 12.1 What dropping Riot actually costs

Every consumer relationship runs one way: phase 3 depends on phases 0–2, and nothing in
phases 0–2 references phase 3 or later. Dropping Riot at any point leaves four inert
artifacts and requires no cleanup:

| Artifact | State if Riot is dropped |
|---|---|
| `source` enum value `"riot"` | Never produced |
| `riotMatchId` on match documents | Always null |
| `riot` write-protection on `users/{uid}` | Guards a field nobody writes; always passes |
| `riotAccounts/{puuid}` deny-all rule and its tests | Rule inert; tests are negative and still pass |

No client code in phases 0–2 references Riot. The two architectural decisions that look
Riot-adjacent — UUID match identity and one-document-per-match — are driven by offline
multi-device conflict resolution and stand on their own.

## 9. Phases

The Riot access spike runs **on day one, in parallel with phase 0**. It consumes nothing,
writes no code and blocks nothing, so its approval clock should start immediately rather
than after phase 2 ships. Its verdict selects the branch.

| Phase | Deliverable | Conditional |
|---|---|---|
| Spike | Riot access verdict: RSO, match access, both or neither | no — runs day one |
| 0 | Current app deployed to Firebase Hosting, zero behavior change | no |
| 1 | Firestore schema, security rules, anonymous auth, migration, sync layer | no |
| 2 | Email/password and Google sign-in, link-from-anonymous, account UI | no |
| 3R | RSO linking via Cloud Function and custom token (§6.3) | RSO granted |
| 3M | Riot ID resolved server-side to a PUUID (§6.4) | RSO refused, match access granted |
| — | Stop at phase 2; nothing to remove (§12.1) | neither granted |

Phases 0-2 are mandatory and unconditional; they deliver the cloud-storage and accounts
goals in full. 3R and 3M are alternatives, not a sequence — both produce
`users/{uid}.riot.puuid`, and building one makes the other unnecessary.

Phases 0-2 run entirely on the free Spark plan. Phase 3 is the first that requires Blaze.
Stopping after phase 2 is a clean terminal state: nothing built in phases 0-2 depends on
anything in phase 3 or later, and no cleanup is required. See §12.1.

Each phase ends in a deployable state. Phase 0 exists specifically so the deploy pipeline
is proven before any behavior changes.

## 10. Testing

The project currently has no test infrastructure, and adding a full framework is out of
scope. The plan introduces only what each phase needs:

- **Security rules** — `@firebase/rules-unit-testing` against the emulator. Non-optional;
  rules are the only thing standing between users' data. Positive and negative cases.
- **Sync diff and migration** — pure functions (snapshot diff, legacy-to-Firestore
  mapping, UUID assignment) extracted so they can be tested in Node without a browser.
  These carry the highest data-loss risk and must be covered.
- **Auth flows** — manual test matrix against the emulator, covering anonymous upgrade,
  each collision case in §6.2, and multi-device sign-in.
- **Regression** — a manual checklist per phase: create challenge, add match, edit match,
  delete, import CSV, archive, unarchive, export backup, restore backup, offline write
  then reconnect.

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Riot access refused | Phase 3 blocked | Phases 0–2 independent; spike before building |
| Migration data loss | Severe, irreversible | Auto-backup before migrating; copy not move; count verification; migration is idempotent and guarded |
| Boot-order breakage from async hydration | App fails to render | localStorage synchronous first paint (§3.2); no existing script becomes async |
| Offline match-number collisions | Wrong numbers shown | Reuse `assignImportNumbers()` reassignment and its existing visible notice |
| Blaze plan requires a card | Unexpected billing | **Phases 0-2 need only the free Spark plan.** Blaze is required from phase 3 solely because Cloud Functions cannot deploy on Spark. Set a $5 budget alert when upgrading. |
| Duplicated validation (client + rules) | Rules drift from client | Both listed in the same phase-1 task; §5 records the coupling |
| Firestore 1 MiB document cap | Large challenges fail to write | One document per match removes the risk entirely |

## 12. Out of scope (future specs)

- **Phase 4** — Riot match fetch. A callable function pulls the matchlist by PUUID, drops
  ids already present in `riotMatchId`, fetches details, maps them to tracker shape, and
  hands the array to `buildImportPreview()`. Derivations: `ACS = score / roundsPlayed`,
  ADR from `roundResults` damage, HS% from headshot/body/leg counts, rank from
  `competitiveTier`, agent and map from cached `VAL-CONTENT-V1` tables. `rrAfter` and
  `rrChange` are not exposed by the match API and stay manual, flagged in review.
- **Phase 5** — scheduled background fetch via `onSchedule`, with per-key token-bucket
  rate limiting and a per-user cooldown.
