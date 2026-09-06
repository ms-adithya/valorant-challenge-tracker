# Cloud Backend and Accounts — Implementation Plan

*Mandatory core (Tasks 1–12) plus branching Riot work (Tasks R1–R3 / M1–M2), routed by the Task 0 spike.*

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Valorant Challenge Tracker from three `localStorage` keys to per-user Firestore storage with anonymous, email, Google and Riot sign-in — without losing offline writes, without a build step, and without touching the 41 existing script tags.

**Architecture:** Firestore's offline persistence provides the local-first layer. `localStorage` is demoted from system-of-record to synchronous first-paint cache plus migration source, which keeps every existing script's parse-time behavior byte-identical. `persist()` becomes a snapshot-diff dispatcher that writes per-document changes; its 13 call sites are untouched. Riot Sign-On runs through Cloud Functions and a Firebase custom token, because Riot is not a native Firebase provider.

**Tech Stack:** Firebase Hosting, Cloud Firestore, Firebase Auth, Cloud Functions (Node 22, 2nd gen), Firebase JS SDK loaded as an ES module from gstatic, `node --test` for pure-function tests, `@firebase/rules-unit-testing` for security rules.

**Spec:** [docs/superpowers/specs/2026-09-06-cloud-backend-and-accounts-design.md](../specs/2026-09-06-cloud-backend-and-accounts-design.md)

## Global Constraints

- **No build step, no bundler, no framework.** `index.html` keeps loading plain `<script>` tags. The only new tag is one `<script type="module">`.
- **No existing script becomes `async`.** Parse-time behavior of all 40 existing external scripts must be unchanged.
- **`persist()` keeps its signature and boolean contract.** It returns `true` when the write was accepted *locally*, never "the server has it". All 13 call sites stay untouched.
- **Firestore batch limit is 500 operations.** Every batched write must chunk.
- **Firestore document cap is 1 MiB.** One document per match; never embed `matches[]` in a challenge document.
- **`localStorage` is copied, never moved.** Keys `vct4`, `vctActiveChallenges`, `vctArchives` retain their names and stay populated.
- **Enum values, copied verbatim from the codebase:**
  - `result`: `"Win"`, `"Loss"`, `"Draw"`
  - `rankStatus`: `"Promoted"`, `"Demoted"`, `"Placed"`, `"Same Rank"`
  - `status`: `"active"`, `"archived"`
  - `source`: `"manual"`, `"import"`, `"riot"`
- **Range rules, mirrored from [js/match-save.js](../../../js/match-save.js):** `hs`, `kast`, `rrAfter` are null or 0–100; counters are null or ≥ 0; `rounds == myScore + enemyScore`.
- **Secrets never reach the client.** Riot client secret and refresh tokens live only in Secret Manager.
- **Firebase SDK version is pinned once** in `js/cloud/firebase-boot.js` as `FIREBASE_SDK_VERSION` and reused for every import URL.
- **Tasks 1-12 run on the free Spark plan.** Blaze is required only by the Riot
  branches (Tasks R1 / M1), because Cloud Functions cannot deploy on Spark. No payment
  method is needed to complete Tasks 1-12.
- **Tasks 1-12 are mandatory and unconditional.** Nothing in them consumes anything from
  Task 0 or from either branch. They are the whole cloud-storage-and-accounts goal.
- **Everything after Task 12 is conditional** on the Task 0 spike. Branch task ids carry
  a letter (`R1`, `M1`) so conditional work is never mistaken for required work.

## Decision Gate

This plan has one mandatory core and three possible endings. **Task 0 decides which**,
and it runs on day one in parallel with Task 1 — it consumes nothing, writes no code,
and blocks nothing.

```
Day one, in parallel:
   Task 0  Riot access spike  ──────────────────────────┐
                                                        │ (answer arrives
   Task 1        Phase 0  Hosting                       │  days or weeks later)
   Tasks 2-8     Phase 1  Firestore, sync, migration    │
   Tasks 9-12    Phase 2  Accounts                      │
        │                                               │
        └──────────────► DECISION POINT ◄───────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
     Branch R              Branch M              Branch N
     RSO granted        Match access only        Neither
     Tasks R1-R3          Tasks M1-M2            Stop at 12
```

| Spike outcome | Branch | What you build | Blaze needed |
|---|---|---|---|
| RSO **and** `VAL-MATCH-V1` granted | **R**, then M is unnecessary | Riot sign-in, verified PUUID | yes |
| `VAL-MATCH-V1` only, no RSO | **M** | Typed Riot ID, unverified PUUID | yes |
| RSO only, no match access | **R** | Riot sign-in as a convenience; no auto-fetch | yes |
| Neither | **N** | Nothing further — Tasks 1-12 stand alone | **no** |

Both branches populate the **same field**, `users/{uid}.riot.puuid`, differing only in
how it is obtained and whether it is verified. Any later match-fetch work reads that one
field and does not care which branch produced it.

**If you must choose between R and M, choose by goal.** Automatic match fetching — the
feature this project set out to add — needs a PUUID, not a login. Branch M delivers that
in two tasks. Branch R delivers a nicer sign-in button and a *verified* PUUID in three.
See "Branch trade-offs" before deciding.

---

## Track S — Day One (parallel with Task 1)

### Task 0: Riot access spike

**No code, no infrastructure, no cost.** The output is a written recommendation that
routes the rest of this plan. Start it the same day you start Task 1 — if approval takes
weeks, the clock should run while Tasks 1-12 are being built.

**Files:**
- Create: `docs/superpowers/specs/2026-09-06-riot-access-spike.md`

**Interfaces:**
- Consumes: nothing
- Produces: a branch verdict (R / M / N) and, where granted, the exact `client_id`,
  redirect URI, authorize URL, token URL, scope strings and API-key header name used by
  Tasks R1-R3 or M1-M2

- [ ] **Step 1: Read the current developer portal**

Visit <https://developer.riotgames.com>, sign in with a Riot account, and read the
current terms for registering a product, for Riot Sign-On, and for `VAL-MATCH-V1`. This
plan's assumptions are drawn from training data and may be out of date. The portal is
authoritative; where it disagrees with this document, the portal wins.

- [ ] **Step 2: Answer four questions in writing**

1. Can this project register for RSO today, and on what terms?
2. What is the actual approval timeline?
3. Is `VAL-MATCH-V1` access available to this project, and on what terms?
4. **Are RSO and `VAL-MATCH-V1` gated separately?** Specifically: does the Account API's
   `by-riot-id/{gameName}/{tagLine}` endpoint work with a standard API key, with no RSO?
   If it does, Branch M is viable and a typed Riot ID substitutes for Riot sign-in.

- [ ] **Step 3: Record the exact values**

For Branch R, record verbatim: authorize URL, token URL, the account endpoint returning
PUUID, exact scope strings, and whether PKCE is required.

For Branch M, record verbatim: the `by-riot-id` endpoint, which regional routing values
it accepts, the API-key header name, and the rate limits attached to your key tier.

Tasks R1-R3 and M1-M2 substitute these values directly into their code.

- [ ] **Step 4: Write the recommendation and pick a branch**

Write `docs/superpowers/specs/2026-09-06-riot-access-spike.md` containing the four
answers, the recorded values, and an explicit verdict: **Branch R**, **Branch M**, or
**Branch N**. Use the Decision Gate table above.

- [ ] **Step 5: If the verdict is N, stop cleanly**

Do not build against an endpoint you cannot call. Tasks 1-12 already deliver cloud
storage, offline-first sync, migration and accounts in full. Read "Branch N" below,
confirm nothing needs removing, and close the plan out.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-09-06-riot-access-spike.md
git commit -m "docs: record Riot access spike findings and branch verdict"
```

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `.gitignore` | Exclude `node_modules/`, Firebase caches, local env |
| `package.json` | Dev tooling only — never shipped to the browser |
| `firebase.json`, `.firebaserc` | Hosting, Firestore and emulator config |
| `firestore.rules` | Ownership and field validation |
| `firestore.indexes.json` | Composite indexes (empty to start) |
| `js/cloud/snapshot-model.js` | Pure: globals ⟷ document shape. No Firebase imports. |
| `js/cloud/snapshot-diff.js` | Pure: two snapshots → creates/updates/deletes. No Firebase imports. |
| `js/cloud/firebase-boot.js` | ES module. SDK init, anonymous auth, subscriptions, `window.VCT`. |
| `js/cloud/cloud-sync.js` | Rehydrate on snapshot, push on `persist()` |
| `js/cloud/cloud-migrate.js` | One-time `localStorage` → Firestore migration |
| `js/cloud/auth-ui.js` | Account panel, sign-in/out, provider linking |
| `functions/index.js` | Branch R: `riotAuthStart`, `riotAuthCallback`. Branch M: `resolveRiotId`. |
| `functions/riot.js` | Branch R only: signed-state helpers |
| `tests/*.test.js` | Pure-function tests via `node --test` |
| `tests/rules/*.test.js` | Security rules tests via emulator |

**Modified:** `index.html` (one module script tag, account panel markup), `js/persistence.js` (dispatcher), `js/storage.js` (unchanged reads, exported snapshot hook), `js/challenge-actions.js` and `js/challenge-options.js` (id-based handlers), `js/navigation.js` and `js/challenge-archive.js` (call sites for those handlers).

**Why `snapshot-model.js` and `snapshot-diff.js` are separate and Firebase-free:** they carry the highest data-loss risk in the project and must be testable in Node with no emulator, no browser and no network. Keeping Firebase imports out of them is what makes that possible.

---

## Phase 0 — Hosting

### Task 1: Firebase project scaffolding and Hosting deploy

Deploys the app exactly as it is today. Zero behavior change. This exists so the deploy pipeline is proven before anything else moves.

**Files:**
- Create: `.gitignore`, `package.json`, `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`
- Test: manual — the deployed URL renders and behaves identically to local

**Interfaces:**
- Consumes: nothing
- Produces: an npm script surface (`npm test`, `npm run test:rules`, `npm run emulators`, `npm run deploy`) and a deployed Hosting origin used by every later task

- [ ] **Step 1: Create `.gitignore`**

The repo has none today, and a `package.json` arrives in this task.

```gitignore
node_modules/
.firebase/
firebase-debug.log
firestore-debug.log
ui-debug.log
.env
.env.*
functions/node_modules/
functions/.env
```

- [ ] **Step 2: Create `package.json`**

Dev tooling only. The browser never loads any of this.

```json
{
  "name": "valorant-challenge-tracker",
  "version": "1.0.0",
  "private": true,
  "description": "Dev tooling only. The app itself is static and has no build step.",
  "scripts": {
    "test": "node --test tests/",
    "test:rules": "firebase emulators:exec --only firestore \"node --test tests/rules/\"",
    "emulators": "firebase emulators:start",
    "deploy": "firebase deploy --only hosting",
    "deploy:rules": "firebase deploy --only firestore:rules"
  },
  "devDependencies": {}
}
```

- [ ] **Step 3: Install dev dependencies**

Do not hand-pin these — let npm resolve current versions, then commit the lockfile.

```bash
npm install --save-dev firebase-tools @firebase/rules-unit-testing
```

- [ ] **Step 4: Create the Firebase project and link it**

```bash
npx firebase login
npx firebase projects:create valorant-challenge-tracker
```

If that name is taken, choose another and use it consistently below.

- [ ] **Step 5: Create `.firebaserc`**

Replace `valorant-challenge-tracker` with the project id actually created in Step 4.

```json
{
  "projects": {
    "default": "valorant-challenge-tracker"
  }
}
```

- [ ] **Step 6: Create `firebase.json`**

`"public": "."` serves the repo root, because the app lives there. The ignore list is what keeps `docs/`, `tests/`, `functions/` and `.git` out of the deploy.

```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**",
      "docs/**",
      "tests/**",
      "functions/**",
      "package.json",
      "package-lock.json",
      "firestore.rules",
      "firestore.indexes.json"
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [{ "key": "Cache-Control", "value": "max-age=3600" }]
      },
      {
        "source": "/index.html",
        "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "hosting": { "port": 5000 },
    "functions": { "port": 5001 },
    "ui": { "enabled": true }
  }
}
```

`index.html` is served `no-cache` deliberately: it is the file that pins the SDK version, so a stale copy would pin a stale SDK.

- [ ] **Step 7: Create placeholder Firestore config**

Rules are replaced with real ones in Task 2. This deny-all default is the correct starting posture.

`firestore.rules`:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

`firestore.indexes.json`:
```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

- [ ] **Step 8: Deploy**

```bash
npm run deploy
```

- [ ] **Step 9: Verify the deployed app behaves identically**

Open the Hosting URL and confirm, by hand: create a challenge, add a match, view Analytics, export CSV, export backup JSON. Data still lives in `localStorage` at this point — nothing has changed but the origin.

Expected: identical behavior to opening `index.html` locally.

- [ ] **Step 10: Commit**

```bash
git add .gitignore package.json package-lock.json firebase.json .firebaserc firestore.rules firestore.indexes.json
git commit -m "chore: add Firebase Hosting config and dev tooling"
```

---

## Phase 1 — Firestore, anonymous auth, migration, sync

### Task 2: Security rules and rules tests

Rules are the only thing standing between one user's data and another's, so they are written and tested before any client code can write a document.

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules/firestore-rules.test.js`

**Interfaces:**
- Consumes: `firebase.json` emulator config from Task 1
- Produces: the document shapes every later task must satisfy — `users/{uid}`, `users/{uid}/challenges/{challengeId}`, `.../matches/{matchId}`, `riotAccounts/{puuid}`

- [ ] **Step 1: Write the failing rules test**

`tests/rules/firestore-rules.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const fs = require("node:fs");

let env;

const validChallenge = {
  name: "Road to Gold",
  target: 20,
  startRank: "Silver 2",
  startRR: 40,
  targetRank: "Gold 1",
  description: "",
  status: "active",
  isOpen: true,
  archivedAt: null,
};

const validMatch = {
  no: 1,
  date: "2026-09-06T10:00:00.000Z",
  agent: "Jett",
  map: "Ascent",
  result: "Win",
  rankAfter: "Silver 2",
  rankStatus: "Same Rank",
  rrAfter: 60,
  rrChange: 20,
  myScore: 13,
  enemyScore: 7,
  rounds: 20,
  kills: 20,
  deaths: 14,
  assists: 4,
  ddDelta: null,
  hs: 24,
  acs: 240,
  adr: 150,
  kast: 72,
  firstKills: null,
  firstDeaths: null,
  multiKills: null,
  notes: "",
  source: "manual",
  riotMatchId: null,
};

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: "vct-rules-test",
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

test.beforeEach(async () => { await env.clearFirestore(); });
test.after(async () => { await env.cleanup(); });

const asAlice = () => env.authenticatedContext("alice").firestore();
const asBob = () => env.authenticatedContext("bob").firestore();
const asAnon = () => env.unauthenticatedContext().firestore();

test("owner can create and read their own challenge", async () => {
  const db = asAlice();
  await assertSucceeds(db.doc("users/alice/challenges/c1").set(validChallenge));
  await assertSucceeds(db.doc("users/alice/challenges/c1").get());
});

test("another signed-in user cannot read or write it", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("users/alice/challenges/c1").set(validChallenge);
  });
  const db = asBob();
  await assertFails(db.doc("users/alice/challenges/c1").get());
  await assertFails(db.doc("users/alice/challenges/c1").set(validChallenge));
});

test("signed-out users are denied entirely", async () => {
  const db = asAnon();
  await assertFails(db.doc("users/alice/challenges/c1").get());
  await assertFails(db.doc("users/alice/challenges/c1").set(validChallenge));
});

test("valid match is accepted", async () => {
  const db = asAlice();
  await assertSucceeds(db.doc("users/alice/challenges/c1").set(validChallenge));
  await assertSucceeds(
    db.doc("users/alice/challenges/c1/matches/m1").set(validMatch)
  );
});

test("rounds must equal the sum of scores", async () => {
  const db = asAlice();
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m1")
      .set({ ...validMatch, rounds: 19 })
  );
});

test("out-of-range percentages are rejected", async () => {
  const db = asAlice();
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m1").set({ ...validMatch, hs: 101 })
  );
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m1").set({ ...validMatch, kast: -1 })
  );
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m1").set({ ...validMatch, rrAfter: 120 })
  );
});

test("negative counters are rejected", async () => {
  const db = asAlice();
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m1").set({ ...validMatch, kills: -1 })
  );
});

test("null optional values are accepted", async () => {
  const db = asAlice();
  await assertSucceeds(
    db.doc("users/alice/challenges/c1/matches/m1")
      .set({ ...validMatch, rrAfter: null, rrChange: null, hs: null })
  );
});

test("unknown enum values are rejected", async () => {
  const db = asAlice();
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m1")
      .set({ ...validMatch, result: "Forfeit" })
  );
  await assertFails(
    db.doc("users/alice/challenges/c1").set({ ...validChallenge, status: "deleted" })
  );
});

test("client cannot write the riot field on its own user document", async () => {
  const db = asAlice();
  await assertFails(
    db.doc("users/alice").set({ displayName: "Alice", riot: { puuid: "p1" } })
  );
});

test("client cannot write riotAccounts at all", async () => {
  const db = asAlice();
  await assertFails(db.doc("riotAccounts/p1").set({ uid: "alice" }));
  await assertFails(db.doc("riotAccounts/p1").get());
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test:rules
```

Expected: FAIL. The deny-all rules from Task 1 reject even the legitimate writes, so every `assertSucceeds` case fails.

- [ ] **Step 3: Write the real rules**

Replace `firestore.rules` entirely:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function signedInAs(uid) {
      return request.auth != null && request.auth.uid == uid;
    }

    // null passes: these fields are legitimately optional (see v9.6).
    function inRange(v, lo, hi) {
      return v == null || (v is number && v >= lo && v <= hi);
    }
    function nonNeg(v) {
      return v == null || (v is number && v >= 0);
    }

    function validChallenge(d) {
      return d.name is string && d.name.size() > 0 && d.name.size() <= 200
        && d.target is int && d.target >= 1
        && d.startRank is string
        && (d.targetRank == null || d.targetRank is string)
        && inRange(d.startRR, 0, 100)
        && d.status in ['active', 'archived']
        && d.isOpen is bool;
    }

    function validMatch(d) {
      return d.no is int && d.no >= 1
        && d.agent is string
        && d.map is string
        && d.result in ['Win', 'Loss', 'Draw']
        && d.rankAfter is string
        && d.rankStatus in ['Promoted', 'Demoted', 'Placed', 'Same Rank']
        && d.myScore is int && d.myScore >= 0
        && d.enemyScore is int && d.enemyScore >= 0
        && d.rounds is int && d.rounds == d.myScore + d.enemyScore
        && inRange(d.hs, 0, 100)
        && inRange(d.kast, 0, 100)
        && inRange(d.rrAfter, 0, 100)
        && nonNeg(d.kills) && nonNeg(d.deaths) && nonNeg(d.assists)
        && nonNeg(d.acs) && nonNeg(d.adr)
        && nonNeg(d.firstKills) && nonNeg(d.firstDeaths) && nonNeg(d.multiKills)
        && d.source in ['manual', 'import', 'riot'];
    }

    match /users/{uid} {
      allow read, delete: if signedInAs(uid);

      // `riot` is written only by the Admin SDK, which bypasses rules entirely.
      allow create: if signedInAs(uid)
                    && !request.resource.data.keys().hasAny(['riot']);
      allow update: if signedInAs(uid)
                    && !request.resource.data.diff(resource.data)
                          .affectedKeys().hasAny(['riot']);

      match /challenges/{challengeId} {
        allow read, delete: if signedInAs(uid);
        allow create, update: if signedInAs(uid)
                              && validChallenge(request.resource.data);

        match /matches/{matchId} {
          allow read, delete: if signedInAs(uid);
          allow create, update: if signedInAs(uid)
                                && validMatch(request.resource.data);
        }
      }

      match /meta/{docId} {
        allow read, write: if signedInAs(uid);
      }
    }

    // PUUID -> uid uniqueness index. Admin SDK only; no client access at all.
    match /riotAccounts/{puuid} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test:rules
```

Expected: PASS, all cases.

- [ ] **Step 5: Deploy the rules**

```bash
npm run deploy:rules
```

- [ ] **Step 6: Commit**

```bash
git add firestore.rules tests/rules/firestore-rules.test.js
git commit -m "feat: add Firestore security rules with ownership and field validation"
```

---

### Task 3: Snapshot model (pure)

Converts between the app's three globals and flat document maps. No Firebase imports, so it runs under `node --test` with no emulator.

**Files:**
- Create: `js/cloud/snapshot-model.js`, `tests/snapshot-model.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `buildSnapshot({data, activeChallenges, archives}) -> {challenges: {[id]: doc}, matches: {["challengeId/matchId"]: doc}}` — assigns `matchId` in place on any match lacking one
  - `applyDocuments(challengeEntries, matchEntriesByChallenge) -> {data, activeChallenges, archives}` where `challengeEntries` is `[{id, doc}]` and `matchEntriesByChallenge` is `{[challengeId]: [{id, doc}]}`
  - `newMatchId() -> string`
  - `CHALLENGE_FIELDS`, `MATCH_FIELDS` — string arrays

- [ ] **Step 1: Write the failing test**

`tests/snapshot-model.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");
const { buildSnapshot, applyDocuments } = require("../js/cloud/snapshot-model.js");

const challenge = (over = {}) => ({
  id: "ch_1",
  name: "Road to Gold",
  target: 20,
  startRank: "Silver 2",
  startRR: 40,
  targetRank: "Gold 1",
  description: "",
  matches: [],
  ...over,
});

const match = (over = {}) => ({
  no: 1, date: "2026-09-06T10:00:00.000Z", agent: "Jett", map: "Ascent",
  result: "Win", rankAfter: "Silver 2", rankStatus: "Same Rank",
  rrAfter: 60, rrChange: 20, myScore: 13, enemyScore: 7, rounds: 20,
  kills: 20, deaths: 14, assists: 4, ddDelta: null, hs: 24, acs: 240,
  adr: 150, kast: 72, firstKills: null, firstDeaths: null,
  multiKills: null, notes: "", ...over,
});

test("flattens challenges into a document map", () => {
  const c = challenge();
  const snap = buildSnapshot({ data: c, activeChallenges: [c], archives: [] });
  assert.deepStrictEqual(Object.keys(snap.challenges), ["ch_1"]);
  assert.strictEqual(snap.challenges.ch_1.status, "active");
  assert.strictEqual(snap.challenges.ch_1.isOpen, true);
  assert.strictEqual(snap.challenges.ch_1.name, "Road to Gold");
});

test("marks only the open challenge as isOpen", () => {
  const a = challenge({ id: "ch_a" });
  const b = challenge({ id: "ch_b" });
  const snap = buildSnapshot({ data: b, activeChallenges: [a, b], archives: [] });
  assert.strictEqual(snap.challenges.ch_a.isOpen, false);
  assert.strictEqual(snap.challenges.ch_b.isOpen, true);
});

test("marks archived challenges and preserves archivedAt", () => {
  const a = challenge({ id: "ch_old", archivedAt: "2026-01-01T00:00:00.000Z" });
  const snap = buildSnapshot({ data: null, activeChallenges: [], archives: [a] });
  assert.strictEqual(snap.challenges.ch_old.status, "archived");
  assert.strictEqual(snap.challenges.ch_old.archivedAt, "2026-01-01T00:00:00.000Z");
});

test("assigns a matchId in place when missing and keeps it stable", () => {
  const c = challenge({ matches: [match()] });
  buildSnapshot({ data: c, activeChallenges: [c], archives: [] });
  const assigned = c.matches[0].matchId;
  assert.ok(typeof assigned === "string" && assigned.length > 0);
  buildSnapshot({ data: c, activeChallenges: [c], archives: [] });
  assert.strictEqual(c.matches[0].matchId, assigned);
});

test("keys matches by challengeId/matchId", () => {
  const c = challenge({ matches: [match({ matchId: "m_1" })] });
  const snap = buildSnapshot({ data: c, activeChallenges: [c], archives: [] });
  assert.deepStrictEqual(Object.keys(snap.matches), ["ch_1/m_1"]);
  assert.strictEqual(snap.matches["ch_1/m_1"].no, 1);
  assert.strictEqual(snap.matches["ch_1/m_1"].source, "manual");
});

test("preserves null optionals rather than coercing to zero", () => {
  const c = challenge({ matches: [match({ matchId: "m_1", rrAfter: null, rrChange: null })] });
  const snap = buildSnapshot({ data: c, activeChallenges: [c], archives: [] });
  assert.strictEqual(snap.matches["ch_1/m_1"].rrAfter, null);
  assert.strictEqual(snap.matches["ch_1/m_1"].rrChange, null);
});

test("round-trips back into the three globals", () => {
  const c = challenge({ matches: [match({ matchId: "m_1" })] });
  const snap = buildSnapshot({ data: c, activeChallenges: [c], archives: [] });
  const entries = Object.entries(snap.challenges).map(([id, doc]) => ({ id, doc }));
  const byChallenge = { ch_1: [{ id: "m_1", doc: snap.matches["ch_1/m_1"] }] };
  const state = applyDocuments(entries, byChallenge);
  assert.strictEqual(state.activeChallenges.length, 1);
  assert.strictEqual(state.archives.length, 0);
  assert.strictEqual(state.data.id, "ch_1");
  assert.strictEqual(state.data.matches.length, 1);
  assert.strictEqual(state.data.matches[0].no, 1);
});

test("sorts rehydrated matches by no", () => {
  const entries = [{ id: "ch_1", doc: { name: "x", target: 5, startRank: "Iron 1", startRR: 0, targetRank: null, description: "", status: "active", isOpen: true, archivedAt: null } }];
  const byChallenge = {
    ch_1: [
      { id: "m_b", doc: { ...match({ no: 3 }) } },
      { id: "m_a", doc: { ...match({ no: 1 }) } },
    ],
  };
  const state = applyDocuments(entries, byChallenge);
  assert.deepStrictEqual(state.data.matches.map((m) => m.no), [1, 3]);
});

test("falls back to the first active challenge when none is flagged open", () => {
  const entries = [{ id: "ch_1", doc: { name: "x", target: 5, startRank: "Iron 1", startRR: 0, targetRank: null, description: "", status: "active", isOpen: false, archivedAt: null } }];
  const state = applyDocuments(entries, {});
  assert.strictEqual(state.data.id, "ch_1");
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node --test tests/snapshot-model.test.js
```

Expected: FAIL with `Cannot find module '../js/cloud/snapshot-model.js'`.

- [ ] **Step 3: Write the implementation**

`js/cloud/snapshot-model.js`. The UMD-style wrapper is what lets one file serve both a plain `<script>` tag and `require()` in tests, with no build step.

```js
// Pure conversion between the app's three globals and flat Firestore document maps.
// No Firebase imports: this file must stay testable in plain Node.
(function (root, factory) {
  const api = factory(root);
  root.VCTSnapshotModel = api;
  Object.assign(root, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {

  const CHALLENGE_FIELDS = [
    "name", "target", "startRank", "startRR", "targetRank", "description"
  ];

  const MATCH_FIELDS = [
    "no", "date", "agent", "map", "result", "rankAfter", "rankStatus",
    "rrAfter", "rrChange", "myScore", "enemyScore", "rounds",
    "kills", "deaths", "assists", "ddDelta", "hs", "acs", "adr", "kast",
    "firstKills", "firstDeaths", "multiKills", "notes"
  ];

  function newMatchId() {
    if (root.crypto && typeof root.crypto.randomUUID === "function") {
      return root.crypto.randomUUID();
    }
    return `m_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function pick(source, fields) {
    const out = {};
    for (const key of fields) out[key] = source[key] === undefined ? null : source[key];
    return out;
  }

  function buildSnapshot(state) {
    const data = state.data || null;
    const openId = data ? data.id : null;
    const challenges = {};
    const matches = {};

    function add(challenge, status) {
      if (!challenge || !challenge.id) return;
      const doc = pick(challenge, CHALLENGE_FIELDS);
      doc.status = status;
      doc.isOpen = challenge.id === openId;
      doc.archivedAt = challenge.archivedAt || null;
      challenges[challenge.id] = doc;

      const list = Array.isArray(challenge.matches) ? challenge.matches : [];
      for (const m of list) {
        // Assigned in place so the id survives in the live object, not just the snapshot.
        if (!m.matchId) m.matchId = newMatchId();
        const md = pick(m, MATCH_FIELDS);
        md.source = m.source || "manual";
        md.riotMatchId = m.riotMatchId || null;
        matches[`${challenge.id}/${m.matchId}`] = md;
      }
    }

    for (const c of state.activeChallenges || []) add(c, "active");
    for (const c of state.archives || []) add(c, "archived");
    // `data` is normally also present in activeChallenges via syncCurrentChallenge(),
    // but persist() can be called before that sync in some paths.
    if (data && !challenges[data.id]) add(data, "active");

    return { challenges, matches };
  }

  function applyDocuments(challengeEntries, matchEntriesByChallenge) {
    const activeChallenges = [];
    const archives = [];
    let data = null;

    for (const entry of challengeEntries) {
      const doc = entry.doc;
      const challenge = { id: entry.id };
      for (const key of CHALLENGE_FIELDS) {
        challenge[key] = doc[key] === undefined ? null : doc[key];
      }
      if (doc.archivedAt) challenge.archivedAt = doc.archivedAt;

      const rows = (matchEntriesByChallenge || {})[entry.id] || [];
      challenge.matches = rows
        .map((row) => Object.assign({ matchId: row.id }, row.doc))
        .sort((a, b) => Number(a.no) - Number(b.no));

      if (doc.status === "archived") archives.push(challenge);
      else activeChallenges.push(challenge);

      if (doc.isOpen) data = challenge;
    }

    if (!data && activeChallenges.length) data = activeChallenges[0];
    return { data, activeChallenges, archives };
  }

  return { buildSnapshot, applyDocuments, newMatchId, CHALLENGE_FIELDS, MATCH_FIELDS };
});
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
node --test tests/snapshot-model.test.js
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add js/cloud/snapshot-model.js tests/snapshot-model.test.js
git commit -m "feat: add pure snapshot model converting globals to document maps"
```

---

### Task 4: Snapshot diff (pure)

Turns two snapshots into a write set. This is the heart of sync and the highest-risk pure function in the project — a wrong diff silently loses data.

**Files:**
- Create: `js/cloud/snapshot-diff.js`, `tests/snapshot-diff.test.js`

**Interfaces:**
- Consumes: snapshot shape from Task 3
- Produces: `diffSnapshots(prev, next) -> {creates: Change[], updates: Change[], deletes: Change[]}` where `Change` is `{kind: "challenge"|"match", key: string, doc?: object}`; `chunk(array, size) -> array[][]`

- [ ] **Step 1: Write the failing test**

`tests/snapshot-diff.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");
const { diffSnapshots, chunk } = require("../js/cloud/snapshot-diff.js");

const empty = () => ({ challenges: {}, matches: {} });
const withChallenge = (id, doc = {}) => ({
  challenges: { [id]: { name: "A", status: "active", isOpen: true, ...doc } },
  matches: {},
});

test("no changes produces an empty write set", () => {
  const snap = withChallenge("ch_1");
  const d = diffSnapshots(snap, JSON.parse(JSON.stringify(snap)));
  assert.deepStrictEqual(d.creates, []);
  assert.deepStrictEqual(d.updates, []);
  assert.deepStrictEqual(d.deletes, []);
});

test("a new challenge is a create", () => {
  const d = diffSnapshots(empty(), withChallenge("ch_1"));
  assert.strictEqual(d.creates.length, 1);
  assert.strictEqual(d.creates[0].kind, "challenge");
  assert.strictEqual(d.creates[0].key, "ch_1");
});

test("a changed field is an update, not a create", () => {
  const d = diffSnapshots(withChallenge("ch_1"), withChallenge("ch_1", { name: "B" }));
  assert.strictEqual(d.creates.length, 0);
  assert.strictEqual(d.updates.length, 1);
  assert.strictEqual(d.updates[0].doc.name, "B");
});

test("a removed challenge is a delete", () => {
  const d = diffSnapshots(withChallenge("ch_1"), empty());
  assert.strictEqual(d.deletes.length, 1);
  assert.strictEqual(d.deletes[0].key, "ch_1");
});

test("deleting a challenge also emits deletes for its matches", () => {
  const prev = {
    challenges: { ch_1: { name: "A" } },
    matches: { "ch_1/m_1": { no: 1 }, "ch_1/m_2": { no: 2 } },
  };
  const d = diffSnapshots(prev, empty());
  const matchDeletes = d.deletes.filter((x) => x.kind === "match");
  assert.strictEqual(matchDeletes.length, 2);
});

test("null and undefined are treated as equal so optionals do not churn", () => {
  const prev = { challenges: {}, matches: { "ch_1/m_1": { no: 1, rrAfter: null } } };
  const next = { challenges: {}, matches: { "ch_1/m_1": { no: 1, rrAfter: undefined } } };
  assert.deepStrictEqual(diffSnapshots(prev, next).updates, []);
});

test("a real value change on an optional is detected", () => {
  const prev = { challenges: {}, matches: { "ch_1/m_1": { no: 1, rrAfter: null } } };
  const next = { challenges: {}, matches: { "ch_1/m_1": { no: 1, rrAfter: 0 } } };
  assert.strictEqual(diffSnapshots(prev, next).updates.length, 1);
});

test("adding a field counts as a change", () => {
  const prev = { challenges: {}, matches: { "ch_1/m_1": { no: 1 } } };
  const next = { challenges: {}, matches: { "ch_1/m_1": { no: 1, notes: "gg" } } };
  assert.strictEqual(diffSnapshots(prev, next).updates.length, 1);
});

test("chunk splits to the Firestore batch limit", () => {
  const items = Array.from({ length: 1100 }, (_, i) => i);
  const parts = chunk(items, 500);
  assert.deepStrictEqual(parts.map((p) => p.length), [500, 500, 100]);
});

test("chunk returns nothing for an empty array", () => {
  assert.deepStrictEqual(chunk([], 500), []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node --test tests/snapshot-diff.test.js
```

Expected: FAIL with `Cannot find module '../js/cloud/snapshot-diff.js'`.

- [ ] **Step 3: Write the implementation**

`js/cloud/snapshot-diff.js`:

```js
// Pure diff of two snapshots into a Firestore write set.
// No Firebase imports: this file must stay testable in plain Node.
(function (root, factory) {
  const api = factory();
  root.VCTSnapshotDiff = api;
  Object.assign(root, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

  // null and undefined are the same absence here; v9.6 relies on optional
  // fields staying null rather than churning into 0.
  function sameValue(a, b) {
    if (a === null || a === undefined) return b === null || b === undefined;
    return a === b;
  }

  function sameDoc(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!sameValue(a[key], b[key])) return false;
    }
    return true;
  }

  function scan(kind, before, after, out) {
    for (const key of Object.keys(after)) {
      if (!(key in before)) out.creates.push({ kind, key, doc: after[key] });
      else if (!sameDoc(before[key], after[key])) {
        out.updates.push({ kind, key, doc: after[key] });
      }
    }
    for (const key of Object.keys(before)) {
      if (!(key in after)) out.deletes.push({ kind, key });
    }
  }

  function diffSnapshots(prev, next) {
    const out = { creates: [], updates: [], deletes: [] };
    scan("challenge", prev.challenges || {}, next.challenges || {}, out);
    // Firestore does not cascade-delete subcollections, so orphaned matches
    // must be deleted explicitly. Dropping a challenge drops its matches from
    // the snapshot, which lands them here automatically.
    scan("match", prev.matches || {}, next.matches || {}, out);
    return out;
  }

  function chunk(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
  }

  return { diffSnapshots, chunk, sameDoc };
});
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
node --test tests/snapshot-diff.test.js
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add js/cloud/snapshot-diff.js tests/snapshot-diff.test.js
git commit -m "feat: add pure snapshot diff producing Firestore write sets"
```

---

### Task 5: Firebase boot module and anonymous auth

Initializes the SDK, signs in anonymously, and exposes `window.VCT`. No data flows yet — this task proves the SDK loads and a uid exists.

**Files:**
- Create: `js/cloud/firebase-boot.js`
- Modify: `index.html` (add two script tags)

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `window.VCT` with `{ app, auth, db, uid, ready }` where `ready` is a Promise resolving to the uid; `window.VCT.onReady(fn)` registers a callback

- [ ] **Step 1: Confirm the current Firebase SDK version**

Open <https://firebase.google.com/docs/web/setup> and read the version in the CDN import examples. Use that exact string in Step 3. The plan writes `11.0.2`; if the docs show something newer, use the newer value in all four import URLs.

- [ ] **Step 2: Register a Web App and capture the config**

```bash
npx firebase apps:create WEB "Valorant Challenge Tracker"
npx firebase apps:sdkconfig WEB
```

Copy the printed config object into Step 3. These values are public by design — Firebase config is not a secret, and security rules are what protect the data.

- [ ] **Step 3: Write the boot module**

`js/cloud/firebase-boot.js`:

```js
// ES module. Because module scripts are deferred, this runs AFTER every classic
// <script> in index.html — which is exactly what makes the localStorage-first
// boot path in storage.js safe to leave untouched.
const FIREBASE_SDK_VERSION = "11.0.2";
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

const { initializeApp } = await import(`${CDN}/firebase-app.js`);
const { getAuth, signInAnonymously, onAuthStateChanged } =
  await import(`${CDN}/firebase-auth.js`);
const {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} = await import(`${CDN}/firebase-firestore.js`);

const firebaseConfig = {
  apiKey: "REPLACE_WITH_VALUE_FROM_STEP_2",
  authDomain: "REPLACE_WITH_VALUE_FROM_STEP_2",
  projectId: "REPLACE_WITH_VALUE_FROM_STEP_2",
  storageBucket: "REPLACE_WITH_VALUE_FROM_STEP_2",
  messagingSenderId: "REPLACE_WITH_VALUE_FROM_STEP_2",
  appId: "REPLACE_WITH_VALUE_FROM_STEP_2",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// persistentMultipleTabManager is required: the tracker is the kind of app
// people leave open in a second tab, and the single-tab default would throw there.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const readyCallbacks = [];
let resolveReady;
const ready = new Promise((resolve) => { resolveReady = resolve; });

const VCT = {
  app,
  auth,
  db,
  uid: null,
  ready,
  onReady(fn) {
    if (VCT.uid) fn(VCT.uid);
    else readyCallbacks.push(fn);
  },
};

window.VCT = VCT;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.error("VCT: anonymous sign-in failed", err);
      // The app keeps working on localStorage alone. This is a degraded
      // mode, not a failure state.
      if (typeof window.showAppNotice === "function") {
        window.showAppNotice(
          "Cloud sync is unavailable right now. Your data is still saved in this browser.",
          "Offline mode"
        );
      }
    }
    return;
  }
  const first = VCT.uid === null;
  VCT.uid = user.uid;
  VCT.isAnonymous = user.isAnonymous;
  if (first) {
    resolveReady(user.uid);
    while (readyCallbacks.length) readyCallbacks.shift()(user.uid);
  }
  window.dispatchEvent(new CustomEvent("vct:auth", { detail: { user } }));
});
```

Replace each `REPLACE_WITH_VALUE_FROM_STEP_2` with the corresponding value printed in Step 2 before running anything.

- [ ] **Step 4: Wire the script tags in `index.html`**

Add the two pure files as classic scripts immediately after `js/constants.js` (line 438), so later classic scripts can use them:

```html
  <script src="./js/cloud/snapshot-model.js"></script>
  <script src="./js/cloud/snapshot-diff.js"></script>
```

Then add the module script after `js/bootstrap.js` (line 475):

```html
  <script type="module" src="./js/cloud/firebase-boot.js"></script>
```

- [ ] **Step 5: Verify anonymous sign-in works**

```bash
npm run emulators
```

Open <http://localhost:5000>, then in the browser console:

```js
await window.VCT.ready
```

Expected: resolves to a uid string. `window.VCT.isAnonymous` is `true`. The Emulator UI Auth tab shows one anonymous user. The app still renders and saves normally — nothing has changed about data flow yet.

- [ ] **Step 6: Commit**

```bash
git add js/cloud/firebase-boot.js index.html
git commit -m "feat: initialize Firebase SDK with anonymous auth and offline persistence"
```

---

### Task 6: Sync layer — rehydrate and push

Connects the pure functions to Firestore. After this task the app reads and writes cloud data.

**Files:**
- Create: `js/cloud/cloud-sync.js`
- Modify: `js/persistence.js`, `index.html`

**Interfaces:**
- Consumes: `buildSnapshot`, `applyDocuments` (Task 3); `diffSnapshots`, `chunk` (Task 4); `window.VCT` (Task 5)
- Produces: `window.VCT.cloud` with `{ pushChanges(), start(uid), lastSyncedSnapshot }`

- [ ] **Step 1: Write the sync module**

`js/cloud/cloud-sync.js`. This is a classic script, so it reads the Firestore helpers off `window.VCT.fx`, which the boot module must now export.

```js
// Bridges Firestore to the app's three globals. Loaded as a classic script,
// so all Firestore functions arrive via window.VCT.fx (set by firebase-boot.js).
(function () {
  let lastSyncedSnapshot = { challenges: {}, matches: {} };
  let hydrated = false;
  let pushing = false;
  let pushQueued = false;

  function userRoot() {
    const { fx, db, uid } = window.VCT;
    return fx.doc(db, "users", uid);
  }

  async function pushChanges() {
    const VCT = window.VCT;
    if (!VCT || !VCT.uid || !VCT.fx) return;
    // Never write before the first snapshot lands, or an empty local state
    // would diff into a full delete of everything on the server.
    if (!hydrated) return;
    if (pushing) { pushQueued = true; return; }
    pushing = true;
    try {
      const next = window.buildSnapshot({
        data: window.data,
        activeChallenges: window.activeChallenges,
        archives: window.archives,
      });
      const { creates, updates, deletes } = window.diffSnapshots(lastSyncedSnapshot, next);
      const all = [...creates, ...updates, ...deletes];
      if (!all.length) return;

      const { fx, db, uid } = VCT;
      for (const part of window.chunk(all, 500)) {
        const batch = fx.writeBatch(db);
        for (const change of part) {
          const ref = refFor(fx, db, uid, change);
          if (change.doc) batch.set(ref, withTimestamps(fx, change.doc), { merge: false });
          else batch.delete(ref);
        }
        await batch.commit();
      }
      lastSyncedSnapshot = next;
    } catch (err) {
      // A failed push is recoverable: lastSyncedSnapshot is not advanced, so
      // the next persist() re-diffs and retries the same changes.
      console.error("VCT: cloud push failed", err);
    } finally {
      pushing = false;
      if (pushQueued) { pushQueued = false; pushChanges(); }
    }
  }

  function refFor(fx, db, uid, change) {
    if (change.kind === "challenge") {
      return fx.doc(db, "users", uid, "challenges", change.key);
    }
    const [challengeId, matchId] = change.key.split("/");
    return fx.doc(db, "users", uid, "challenges", challengeId, "matches", matchId);
  }

  function withTimestamps(fx, doc) {
    return Object.assign({}, doc, { updatedAt: fx.serverTimestamp() });
  }

  async function start(uid) {
    const { fx, db } = window.VCT;
    await fx.setDoc(userRoot(), { schemaVersion: 1, updatedAt: fx.serverTimestamp() }, { merge: true });

    const challengesRef = fx.collection(db, "users", uid, "challenges");
    fx.onSnapshot(challengesRef, async (snap) => {
      const entries = snap.docs.map((d) => ({ id: d.id, doc: d.data() }));
      const byChallenge = {};
      await Promise.all(entries.map(async (entry) => {
        const matchesRef = fx.collection(db, "users", uid, "challenges", entry.id, "matches");
        const ms = await fx.getDocs(matchesRef);
        byChallenge[entry.id] = ms.docs.map((d) => ({ id: d.id, doc: d.data() }));
      }));
      rehydrate(entries, byChallenge);
    }, (err) => console.error("VCT: challenge subscription failed", err));
  }

  function rehydrate(entries, byChallenge) {
    // Nothing on the server yet: keep whatever localStorage gave us and let
    // migration (Task 7) push it up. Do NOT blank the app.
    if (!entries.length && !hydrated) { hydrated = true; return; }

    const state = window.applyDocuments(entries, byChallenge);
    window.data = state.data;
    window.activeChallenges = state.activeChallenges;
    window.archives = state.archives;

    lastSyncedSnapshot = window.buildSnapshot(state);
    hydrated = true;

    // These run at parse time on the localStorage path; re-run them now that
    // the real data has arrived.
    window.normalizeStoredChallenges();
    window.render();
  }

  window.VCT = window.VCT || {};
  window.VCT.cloud = {
    pushChanges,
    start,
    get lastSyncedSnapshot() { return lastSyncedSnapshot; },
    get hydrated() { return hydrated; },
  };
})();
```

- [ ] **Step 2: Export the Firestore helpers from the boot module**

In `js/cloud/firebase-boot.js`, widen the Firestore import and attach the helpers, then start sync. Replace the existing Firestore import block with:

```js
const fx = await import(`${CDN}/firebase-firestore.js`);
const {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} = fx;
```

Add `fx` to the `VCT` object literal (`app, auth, db, fx, uid: null, ready, ...`), and at the end of the file:

```js
VCT.onReady((uid) => {
  if (VCT.cloud) VCT.cloud.start(uid);
});
```

- [ ] **Step 3: Add the sync script tag**

In `index.html`, add immediately after the `snapshot-diff.js` tag from Task 5:

```html
  <script src="./js/cloud/cloud-sync.js"></script>
```

It must load before the module script, since the module calls `VCT.cloud.start`.

- [ ] **Step 4: Make `persist()` dispatch to the cloud**

In `js/persistence.js`, rename the existing function body to `persistLocal` and add a new `persist`. The localStorage rollback behavior is unchanged; the cloud push is additive and never throws into the caller.

Replace lines 8–30 (`function persist(){ ... }`) with:

```js
function persistLocal(){
 const keys=["vct4","vctActiveChallenges","vctArchives"];
 const previous=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));
 try{
  localStorage.setItem("vct4",JSON.stringify(data));
  localStorage.setItem("vctActiveChallenges",JSON.stringify(activeChallenges));
  localStorage.setItem("vctArchives",JSON.stringify(archives));
  return true;
 }catch(err){
  // Avoid leaving the three storage records at different revisions after a partial write.
  for(const k of keys){try{previous[k]===null?localStorage.removeItem(k):localStorage.setItem(k,previous[k])}catch{}}
  console.error("Could not save VCT data",err);
  showAppNotice("Your browser could not save this change. Check available storage/privacy settings, then try again.","Save failed");
  return false;
 }
}
function persist(){
 syncCurrentChallenge();
 activeChallenges.forEach(syncChallengeCompletion);
 archives.forEach(syncChallengeCompletion);
 [data,...activeChallenges,...archives].filter(Boolean).forEach(rebuildChallengeRankProgression);
 // localStorage stays the synchronous, all-or-nothing local write. Its result is
 // what persist() reports, preserving the contract every call site relies on.
 if(!persistLocal())return false;
 // Cloud push is fire-and-forget by design: a persist() return of true means
 // "accepted locally", never "the server has it".
 if(window.VCT&&window.VCT.cloud)window.VCT.cloud.pushChanges();
 return true;
}
```

- [ ] **Step 5: Verify sync end to end**

```bash
npm run emulators
```

At <http://localhost:5000>: create a challenge and add a match. In the Emulator UI Firestore tab, confirm `users/{uid}/challenges/{id}` exists with `isOpen: true`, and `.../matches/{uuid}` holds the match.

Then reload the page. Expected: the challenge and match are still present, and the Firestore tab shows no duplicate documents.

- [ ] **Step 6: Verify offline writes queue and replay**

With the app open, use DevTools → Network → Offline. Add a match. Expected: the save completes instantly with the normal success toast — no spinner, no error. Go back online. Expected: the match appears in the Emulator UI within a few seconds.

- [ ] **Step 7: Commit**

```bash
git add js/cloud/cloud-sync.js js/cloud/firebase-boot.js js/persistence.js index.html
git commit -m "feat: sync app state to Firestore via snapshot diff on persist"
```

---

### Task 7: One-time migration from localStorage

**Files:**
- Create: `js/cloud/cloud-migrate.js`, `tests/cloud-migrate.test.js`
- Modify: `js/cloud/firebase-boot.js`, `index.html`

**Interfaces:**
- Consumes: `buildSnapshot` (Task 3), `chunk` (Task 4), `window.VCT` (Task 5), `exportBackupJson()` from [js/export.js:26](../../../js/export.js)
- Produces: `window.VCT.migrate.run(uid)` returning `{migrated: boolean, challengeCount: number, matchCount: number}`; `readLegacyState()` for testing

- [ ] **Step 1: Write the failing test for the pure part**

`tests/cloud-migrate.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");
const { countState, legacyFromRaw } = require("../js/cloud/cloud-migrate.js");

test("counts challenges and matches across all three buckets", () => {
  const state = {
    data: { id: "a", matches: [{ no: 1 }, { no: 2 }] },
    activeChallenges: [{ id: "a", matches: [{ no: 1 }, { no: 2 }] }],
    archives: [{ id: "b", matches: [{ no: 1 }] }],
  };
  // `data` is the same object as activeChallenges[0]; it must not be double-counted.
  assert.deepStrictEqual(countState(state), { challengeCount: 2, matchCount: 3 });
});

test("counts an open challenge missing from activeChallenges", () => {
  const state = {
    data: { id: "z", matches: [{ no: 1 }] },
    activeChallenges: [],
    archives: [],
  };
  assert.deepStrictEqual(countState(state), { challengeCount: 1, matchCount: 1 });
});

test("handles a completely empty state", () => {
  assert.deepStrictEqual(
    countState({ data: null, activeChallenges: [], archives: [] }),
    { challengeCount: 0, matchCount: 0 }
  );
});

test("falls back to the legacy vct2 key when vct4 is absent", () => {
  const raw = { vct4: null, vctActiveChallenges: null, vctArchives: null, vct2: { id: "old", matches: [] } };
  const state = legacyFromRaw(raw);
  assert.strictEqual(state.data.id, "old");
  assert.deepStrictEqual(state.archives, []);
});

test("coerces non-array buckets to arrays", () => {
  const raw = { vct4: null, vctActiveChallenges: "corrupt", vctArchives: 7, vct2: null };
  const state = legacyFromRaw(raw);
  assert.deepStrictEqual(state.activeChallenges, []);
  assert.deepStrictEqual(state.archives, []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node --test tests/cloud-migrate.test.js
```

Expected: FAIL with `Cannot find module '../js/cloud/cloud-migrate.js'`.

- [ ] **Step 3: Write the implementation**

`js/cloud/cloud-migrate.js`:

```js
// One-time localStorage -> Firestore migration, guarded by users/{uid}/meta/migration.
// Copies; never deletes the legacy keys.
(function (root, factory) {
  const api = factory(root);
  root.VCTMigrate = api;
  Object.assign(root, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {

  function legacyFromRaw(raw) {
    let data = raw.vct4 || null;
    if (!data && raw.vct2 && typeof raw.vct2 === "object") data = raw.vct2;
    const activeChallenges = Array.isArray(raw.vctActiveChallenges) ? raw.vctActiveChallenges : [];
    const archives = Array.isArray(raw.vctArchives) ? raw.vctArchives : [];
    return { data, activeChallenges, archives };
  }

  function countState(state) {
    const seen = new Map();
    const add = (c) => { if (c && c.id && !seen.has(c.id)) seen.set(c.id, c); };
    (state.activeChallenges || []).forEach(add);
    (state.archives || []).forEach(add);
    add(state.data);
    let matchCount = 0;
    for (const c of seen.values()) {
      matchCount += Array.isArray(c.matches) ? c.matches.length : 0;
    }
    return { challengeCount: seen.size, matchCount };
  }

  function readLegacyState() {
    const readKey = (key) => {
      try {
        const value = root.localStorage.getItem(key);
        return value === null ? null : JSON.parse(value);
      } catch (err) {
        console.warn(`VCT: could not read ${key}`, err);
        return null;
      }
    };
    return legacyFromRaw({
      vct4: readKey("vct4"),
      vctActiveChallenges: readKey("vctActiveChallenges"),
      vctArchives: readKey("vctArchives"),
      vct2: readKey("vct2"),
    });
  }

  async function run(uid) {
    const VCT = root.VCT;
    const { fx, db } = VCT;
    const guardRef = fx.doc(db, "users", uid, "meta", "migration");

    const existing = await fx.getDoc(guardRef);
    if (existing.exists()) return { migrated: false, reason: "already-migrated" };

    const state = readLegacyState();
    const counts = countState(state);
    if (counts.challengeCount === 0) {
      await fx.setDoc(guardRef, {
        completedAt: fx.serverTimestamp(),
        sourceKeys: [], challengeCount: 0, matchCount: 0, backupDownloaded: false,
      });
      return { migrated: false, reason: "nothing-to-migrate", ...counts };
    }

    // Hand the user a file copy before anything moves.
    let backupDownloaded = false;
    try {
      if (typeof root.exportBackupJson === "function") {
        root.exportBackupJson();
        backupDownloaded = true;
      }
    } catch (err) {
      console.warn("VCT: pre-migration backup failed", err);
    }

    const snapshot = root.buildSnapshot(state);
    const writes = [];
    for (const [id, doc] of Object.entries(snapshot.challenges)) {
      writes.push({ ref: fx.doc(db, "users", uid, "challenges", id), doc });
    }
    for (const [key, doc] of Object.entries(snapshot.matches)) {
      const [challengeId, matchId] = key.split("/");
      writes.push({
        ref: fx.doc(db, "users", uid, "challenges", challengeId, "matches", matchId),
        doc,
      });
    }

    for (const part of root.chunk(writes, 500)) {
      const batch = fx.writeBatch(db);
      for (const w of part) {
        batch.set(w.ref, Object.assign({}, w.doc, { updatedAt: fx.serverTimestamp() }));
      }
      await batch.commit();
    }

    // Verify before recording success. A mismatch means the guard is never
    // written, so the next load retries rather than silently accepting loss.
    const written = await fx.getDocs(fx.collection(db, "users", uid, "challenges"));
    if (written.size !== counts.challengeCount) {
      throw new Error(
        `Migration verification failed: expected ${counts.challengeCount} challenges, found ${written.size}`
      );
    }

    await fx.setDoc(guardRef, {
      completedAt: fx.serverTimestamp(),
      sourceKeys: ["vct4", "vctActiveChallenges", "vctArchives"],
      challengeCount: counts.challengeCount,
      matchCount: counts.matchCount,
      backupDownloaded,
    });

    return { migrated: true, ...counts };
  }

  return { run, readLegacyState, legacyFromRaw, countState };
});
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
node --test tests/cloud-migrate.test.js
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Run migration before sync starts**

In `js/cloud/firebase-boot.js`, replace the `VCT.onReady` block added in Task 6 with:

```js
VCT.onReady(async (uid) => {
  try {
    const result = await window.VCTMigrate.run(uid);
    if (result.migrated && typeof window.showToast === "function") {
      window.showToast(
        `${result.challengeCount} challenge${result.challengeCount === 1 ? "" : "s"} moved to your account.`
      );
    }
  } catch (err) {
    console.error("VCT: migration failed", err);
    if (typeof window.showAppNotice === "function") {
      window.showAppNotice(
        "Your existing data could not be moved to the cloud yet. It is still safe in this browser, and we will retry next time you open the tracker.",
        "Migration postponed"
      );
    }
  }
  if (VCT.cloud) VCT.cloud.start(uid);
});
```

Migration must complete before `start()` subscribes, so the first snapshot already contains the migrated documents.

- [ ] **Step 6: Add the script tag**

In `index.html`, after the `cloud-sync.js` tag:

```html
  <script src="./js/cloud/cloud-migrate.js"></script>
```

- [ ] **Step 7: Verify migration against real legacy data**

```bash
npm run emulators
```

In the browser at <http://localhost:5000>, first clear Firestore from the Emulator UI, then seed legacy data in the console:

```js
localStorage.setItem("vct4", JSON.stringify({id:"ch_legacy",name:"Legacy Run",target:5,startRank:"Silver 1",startRR:30,targetRank:"Gold 1",description:"",matches:[{no:1,date:"2026-01-01T00:00:00.000Z",agent:"Sage",map:"Haven",result:"Win",rankAfter:"Silver 1",rankStatus:"Same Rank",rrAfter:50,rrChange:20,myScore:13,enemyScore:9,rounds:22,kills:15,deaths:12,assists:7,ddDelta:null,hs:20,acs:200,adr:130,kast:70,firstKills:null,firstDeaths:null,multiKills:null,notes:""}]}));
localStorage.setItem("vctActiveChallenges", localStorage.getItem("vct4").replace(/^/, "[") + "]");
localStorage.setItem("vctArchives", "[]");
location.reload();
```

Expected: a backup JSON file downloads, a toast reports one challenge moved, the Emulator UI shows `users/{uid}/challenges/ch_legacy` with one match subdocument, `users/{uid}/meta/migration` records `challengeCount: 1, matchCount: 1`, and the three `localStorage` keys are **still present and unchanged**.

- [ ] **Step 8: Verify migration is idempotent**

Reload again. Expected: no second backup download, no toast, no duplicate documents, and the migration guard's `completedAt` is unchanged.

- [ ] **Step 9: Commit**

```bash
git add js/cloud/cloud-migrate.js tests/cloud-migrate.test.js js/cloud/firebase-boot.js index.html
git commit -m "feat: migrate localStorage data to Firestore once per account"
```

---

### Task 8: Convert index-based archive handlers to id-based

Spec §4.3. A snapshot arriving between render and click can shift array indices and act on the wrong challenge.

**Files:**
- Modify: `js/challenge-actions.js:28-46`, `js/challenge-options.js:20-26`, `js/challenge-archive.js:18-20`, `js/navigation.js:4`, `js/setup-restore.js:17`

**Interfaces:**
- Consumes: nothing
- Produces: `deleteArchivedChallenge(id: string)` and `unarchiveChallenge(id: string)` — both now take a challenge id, not an array index

- [ ] **Step 1: Change the two handlers to look up by id**

In `js/challenge-actions.js`, replace the body of `deleteArchivedChallenge` so it resolves the index itself:

```js
function deleteArchivedChallenge(id){
 const archiveIndex=archives.findIndex(c=>c.id===id);
 if(archiveIndex<0)return;
 // ...rest of the existing body, unchanged, still using archiveIndex
}
```

Apply the identical treatment to `unarchiveChallenge(id)` in `js/challenge-options.js`, resolving `idx` from `archives.findIndex(c=>c.id===id)` instead of accepting it as a parameter.

- [ ] **Step 2: Update the three call sites to pass ids**

In `js/challenge-archive.js:18`, the template already computes `archiveIndex`; delete that line and pass `safeId` instead:

```js
: `<button class="ghost" type="button" onclick="unarchiveChallenge('${safeId}')">Unarchive</button><button class="ghost delete-archive-btn" type="button" onclick="deleteArchivedChallenge('${safeId}')">Delete</button>`
```

In `js/navigation.js:4` and `js/setup-restore.js:17`, both templates map over `archives` with an index `i`. Replace `data-restore-archive="${i}"` with `data-restore-archive="${escapeHtml(c.id)}"` and `deleteArchivedChallenge(${i})` with `deleteArchivedChallenge('${escapeJsSingleQuoted(c.id)}')`.

- [ ] **Step 3: Update the delegated restore handler**

Find the `[data-restore-archive]` click handler in `js/challenge-options.js` and pass the dataset value straight through instead of coercing it to a number:

```js
unarchiveChallenge(trigger.dataset.restoreArchive);
```

- [ ] **Step 4: Verify by hand**

At <http://localhost:5000> with the emulators running: create two challenges, archive both, then unarchive the *second* one from the Challenges page. Expected: the second challenge opens — not the first. Repeat from the empty-state restore panel. Then delete an archived challenge and confirm the correct one disappears.

- [ ] **Step 5: Commit**

```bash
git add js/challenge-actions.js js/challenge-options.js js/challenge-archive.js js/navigation.js js/setup-restore.js
git commit -m "fix: address archived challenges by id instead of array index"
```

---

## Phase 2 — Accounts

### Task 9: Account panel and auth state UI

**Files:**
- Create: `js/cloud/auth-ui.js`, `css/31-auth.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: `window.VCT` (Task 5)
- Produces: `renderAuthState()`, `openAuthModal(mode)` where mode is `"signin"` or `"signup"`, `closeAuthModal()`

- [ ] **Step 1: Add the account markup**

In `index.html`, add inside the sidebar, immediately before the closing `</aside>`:

```html
<div class="auth-panel" id="authPanel">
  <div class="auth-state" id="authState"></div>
</div>
```

And add the modal immediately before the closing `</body>`, following the pattern of the existing import modal:

```html
<div class="modal hidden" id="authModal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
  <div class="modal-card auth-card">
    <header>
      <h2 id="authModalTitle">Sign in</h2>
      <button class="ghost" type="button" id="closeAuthModal" aria-label="Close">&times;</button>
    </header>
    <div class="auth-error hidden" id="authError" role="alert"></div>
    <button class="ghost auth-google" type="button" id="googleSignInBtn">Continue with Google</button>
    <div class="auth-divider"><span>or</span></div>
    <form id="authForm">
      <label for="authEmail">Email</label>
      <input type="email" id="authEmail" autocomplete="email" required>
      <label for="authPassword">Password</label>
      <input type="password" id="authPassword" autocomplete="current-password" required minlength="6">
      <button type="submit" id="authSubmitBtn">Sign in</button>
    </form>
    <p class="auth-switch">
      <span id="authSwitchText">New here?</span>
      <button class="linklike" type="button" id="authSwitchBtn">Create an account</button>
    </p>
  </div>
</div>
```

- [ ] **Step 2: Write the panel renderer**

`js/cloud/auth-ui.js`:

```js
// Account panel and sign-in modal. Classic script; Firebase auth functions
// arrive via window.VCT.ax (set by firebase-boot.js).
(function () {
  let authMode = "signin";

  function renderAuthState() {
    const host = document.getElementById("authState");
    if (!host) return;
    const VCT = window.VCT;
    const user = VCT && VCT.auth ? VCT.auth.currentUser : null;

    if (!user) {
      host.innerHTML = `<p class="auth-offline">Working offline</p>`;
      return;
    }
    if (user.isAnonymous) {
      host.innerHTML = `
        <p class="auth-anon">Your data is saved on this device only.</p>
        <button class="ghost" type="button" id="openSignUpBtn">Create an account</button>
        <button class="linklike" type="button" id="openSignInBtn">I already have one</button>`;
      document.getElementById("openSignUpBtn").onclick = () => openAuthModal("signup");
      document.getElementById("openSignInBtn").onclick = () => openAuthModal("signin");
      return;
    }
    const label = user.displayName || user.email || "Signed in";
    host.innerHTML = `
      <p class="auth-user">${escapeHtml(label)}</p>
      <button class="linklike" type="button" id="signOutBtn">Sign out</button>`;
    document.getElementById("signOutBtn").onclick = signOut;
  }

  function openAuthModal(mode) {
    authMode = mode;
    const modal = document.getElementById("authModal");
    document.getElementById("authModalTitle").textContent =
      mode === "signup" ? "Create an account" : "Sign in";
    document.getElementById("authSubmitBtn").textContent =
      mode === "signup" ? "Create account" : "Sign in";
    document.getElementById("authSwitchText").textContent =
      mode === "signup" ? "Already have an account?" : "New here?";
    document.getElementById("authSwitchBtn").textContent =
      mode === "signup" ? "Sign in instead" : "Create an account";
    document.getElementById("authPassword").setAttribute(
      "autocomplete", mode === "signup" ? "new-password" : "current-password"
    );
    clearAuthError();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("authEmail").focus();
  }

  function closeAuthModal() {
    const modal = document.getElementById("authModal");
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.getElementById("authForm").reset();
    clearAuthError();
  }

  function showAuthError(message) {
    const box = document.getElementById("authError");
    box.textContent = message;
    box.classList.remove("hidden");
  }

  function clearAuthError() {
    const box = document.getElementById("authError");
    box.textContent = "";
    box.classList.add("hidden");
  }

  async function signOut() {
    if (!await appConfirm({
      title: "Sign out?",
      message: "Your challenges stay in your account. This device will start a fresh local session.",
      confirmText: "Sign out",
      kicker: "ACCOUNT",
    })) return;
    await window.VCT.ax.signOut(window.VCT.auth);
    location.reload();
  }

  document.getElementById("closeAuthModal").onclick = closeAuthModal;
  document.getElementById("authSwitchBtn").onclick = () =>
    openAuthModal(authMode === "signup" ? "signin" : "signup");
  document.getElementById("authModal").addEventListener("click", (e) => {
    if (e.target.id === "authModal") closeAuthModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("authModal").classList.contains("hidden")) {
      closeAuthModal();
    }
  });
  window.addEventListener("vct:auth", renderAuthState);

  window.renderAuthState = renderAuthState;
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
  window.showAuthError = showAuthError;
  window.clearAuthError = clearAuthError;
  window.getAuthMode = () => authMode;
})();
```

- [ ] **Step 3: Export the auth helpers from the boot module**

In `js/cloud/firebase-boot.js`, replace the named auth import with a namespace import and attach it:

```js
const ax = await import(`${CDN}/firebase-auth.js`);
const { getAuth, signInAnonymously, onAuthStateChanged } = ax;
```

Add `ax` to the `VCT` object literal alongside `fx`.

- [ ] **Step 4: Write the stylesheet**

Create `css/31-auth.css` using the existing token variables from `css/01-tokens.css`. Follow the visual language of `css/08-modals.css` for the modal card and `css/02-shell-nav.css` for the sidebar panel. Link it in `index.html` after `css/30-modal-keyboard.css`.

- [ ] **Step 5: Add the script tag**

In `index.html`, after `js/cloud/cloud-migrate.js`:

```html
  <script src="./js/cloud/auth-ui.js"></script>
```

- [ ] **Step 6: Verify**

At <http://localhost:5000>: the sidebar shows "Your data is saved on this device only" with two buttons. Clicking each opens the modal in the right mode. The switch link toggles modes. Escape, the ×, and a backdrop click all close it.

- [ ] **Step 7: Commit**

```bash
git add js/cloud/auth-ui.js css/31-auth.css js/cloud/firebase-boot.js index.html
git commit -m "feat: add account panel and sign-in modal shell"
```

---

### Task 10: Email/password sign-up with anonymous account linking

The critical behavior: signing up **links** to the anonymous account, so the uid and all its data survive.

**Files:**
- Modify: `js/cloud/auth-ui.js`

**Interfaces:**
- Consumes: `window.VCT.ax`, `openAuthModal`/`showAuthError` (Task 9)
- Produces: `handleEmailAuth(email, password, mode)` — resolves on success, calls `showAuthError` on failure

- [ ] **Step 1: Implement the submit handler**

Append to `js/cloud/auth-ui.js`, inside the IIFE and before the `window.*` exports:

```js
  const AUTH_MESSAGES = {
    "auth/invalid-email": "That email address does not look right.",
    "auth/missing-password": "Enter your password.",
    "auth/weak-password": "Choose a password of at least 6 characters.",
    "auth/email-already-in-use": "An account already uses that email. Try signing in instead.",
    "auth/invalid-credential": "That email and password do not match an account.",
    "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
    "auth/network-request-failed": "No connection. Your data is still saved on this device.",
  };

  function authMessage(err) {
    return AUTH_MESSAGES[err && err.code] ||
      "Something went wrong signing in. Your local data is untouched.";
  }

  async function handleEmailAuth(email, password, mode) {
    const { auth, ax } = window.VCT;
    const current = auth.currentUser;

    if (mode === "signup") {
      const credential = ax.EmailAuthProvider.credential(email, password);
      // Link rather than create: this preserves the anonymous uid and every
      // document already written under it.
      if (current && current.isAnonymous) {
        try {
          await ax.linkWithCredential(current, credential);
          return;
        } catch (err) {
          if (err.code === "auth/credential-already-in-use" ||
              err.code === "auth/email-already-in-use") {
            await offerMerge(() => ax.signInWithEmailAndPassword(auth, email, password));
            return;
          }
          throw err;
        }
      }
      await ax.createUserWithEmailAndPassword(auth, email, password);
      return;
    }

    // Signing in as someone else abandons or merges the anonymous session.
    if (current && current.isAnonymous) {
      await offerMerge(() => ax.signInWithEmailAndPassword(auth, email, password));
      return;
    }
    await ax.signInWithEmailAndPassword(auth, email, password);
  }

  // Shared by email and Google. `signIn` performs the actual provider sign-in.
  async function offerMerge(signIn) {
    const local = window.buildSnapshot({
      data: window.data,
      activeChallenges: window.activeChallenges,
      archives: window.archives,
    });
    const localCount = Object.keys(local.challenges).length;

    let keepLocal = false;
    if (localCount > 0) {
      keepLocal = await appConfirm({
        title: "Keep this device's challenges?",
        message: `That account already exists. You have ${localCount} challenge${localCount === 1 ? "" : "s"} saved on this device. Add them to that account, or sign in and leave them behind?`,
        confirmText: "Add them to the account",
        cancelText: "Leave them behind",
        kicker: "ACCOUNT",
      });
    }

    const pending = keepLocal
      ? { activeChallenges: window.activeChallenges.slice(), archives: window.archives.slice() }
      : null;

    await signIn();

    if (pending) window.VCT.pendingMerge = pending;
  }

  document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAuthError();
    const btn = document.getElementById("authSubmitBtn");
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Working…";
    try {
      await handleEmailAuth(
        document.getElementById("authEmail").value.trim(),
        document.getElementById("authPassword").value,
        authMode
      );
      closeAuthModal();
      showToast(authMode === "signup" ? "Account created." : "Signed in.");
    } catch (err) {
      console.error("VCT: auth failed", err);
      showAuthError(authMessage(err));
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });
```

- [ ] **Step 2: Apply a pending merge after sync starts**

In `js/cloud/cloud-sync.js`, at the end of `rehydrate()`, after `window.render()`:

```js
    // A merge staged during sign-in: append the previous device's challenges
    // to the account that was just signed into.
    const pending = window.VCT.pendingMerge;
    if (pending) {
      window.VCT.pendingMerge = null;
      const incoming = [...pending.activeChallenges, ...pending.archives];
      for (const challenge of incoming) {
        // Fresh ids so a challenge present in both places is not overwritten.
        const copy = Object.assign({}, challenge, { id: null });
        window.ensureChallengeId(copy);
        copy.matches = (challenge.matches || []).map((m) =>
          Object.assign({}, m, { matchId: window.newMatchId() })
        );
        if (challenge.archivedAt) window.archives.push(copy);
        else window.activeChallenges.push(copy);
      }
      window.persist();
      window.render();
      window.showToast(`${incoming.length} challenge${incoming.length === 1 ? "" : "s"} added to your account.`);
    }
```

- [ ] **Step 3: Verify sign-up preserves data**

```bash
npm run emulators
```

As an anonymous user, create a challenge with two matches. Note the uid via `window.VCT.uid` in the console. Sign up with `test@example.com` / `password123`.

Expected: `window.VCT.uid` is **unchanged**, `window.VCT.isAnonymous` is now `false`, the challenge and both matches are still present, and the Emulator UI Auth tab shows one user with an email — not two users.

- [ ] **Step 4: Verify the merge path**

Sign out, create a new anonymous challenge, then sign in as `test@example.com`. Expected: the confirm dialog offers to keep the device's challenges; choosing "Add them to the account" produces an account holding both, with distinct challenge ids.

- [ ] **Step 5: Verify error handling**

Attempt sign-up with an existing email, sign-in with a wrong password, and sign-up with a 3-character password. Expected: each shows the specific message from `AUTH_MESSAGES` inside the modal, and the modal stays open.

- [ ] **Step 6: Commit**

```bash
git add js/cloud/auth-ui.js js/cloud/cloud-sync.js
git commit -m "feat: add email sign-up that links to the anonymous account"
```

---

### Task 11: Google sign-in

**Files:**
- Modify: `js/cloud/auth-ui.js`

**Interfaces:**
- Consumes: `offerMerge`, `authMessage` (Task 10)
- Produces: `handleGoogleAuth()`

- [ ] **Step 1: Enable the Google provider**

In the Firebase console, Authentication → Sign-in method, enable Google and set a support email. For emulator testing no configuration is needed — the Auth emulator presents a provider-picker stub.

- [ ] **Step 2: Implement the handler**

Append inside the IIFE in `js/cloud/auth-ui.js`:

```js
  async function handleGoogleAuth() {
    const { auth, ax } = window.VCT;
    const provider = new ax.GoogleAuthProvider();
    const current = auth.currentUser;

    if (current && current.isAnonymous) {
      try {
        await ax.linkWithPopup(current, provider);
        return;
      } catch (err) {
        if (err.code === "auth/credential-already-in-use") {
          await offerMerge(() => ax.signInWithPopup(auth, provider));
          return;
        }
        throw err;
      }
    }
    await ax.signInWithPopup(auth, provider);
  }

  document.getElementById("googleSignInBtn").addEventListener("click", async () => {
    clearAuthError();
    const btn = document.getElementById("googleSignInBtn");
    btn.disabled = true;
    try {
      await handleGoogleAuth();
      closeAuthModal();
      showToast("Signed in with Google.");
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user" ||
          err.code === "auth/cancelled-popup-request") return;
      console.error("VCT: Google auth failed", err);
      showAuthError(authMessage(err));
    } finally {
      btn.disabled = false;
    }
  });
```

- [ ] **Step 3: Handle the cross-provider collision**

Add to `AUTH_MESSAGES` in `js/cloud/auth-ui.js`:

```js
    "auth/account-exists-with-different-credential":
      "That email is already registered with a different sign-in method. Sign in that way first, then link Google from your account panel.",
    "auth/popup-blocked":
      "Your browser blocked the sign-in popup. Allow popups for this site and try again.",
```

- [ ] **Step 4: Verify**

As an anonymous user with a challenge, sign in with Google via the emulator. Expected: the uid is unchanged and the challenge survives. Sign out and back in with Google — the same account is returned.

Then, with a password account already registered to `test@example.com`, attempt Google sign-in using that same address. Expected: the cross-provider message appears in the modal.

- [ ] **Step 5: Commit**

```bash
git add js/cloud/auth-ui.js
git commit -m "feat: add Google sign-in with anonymous account linking"
```

---

### Task 12: Multi-device verification and account documents

**Files:**
- Modify: `js/cloud/cloud-sync.js`

**Interfaces:**
- Consumes: `window.VCT` (Task 5), `renderAuthState` (Task 9)
- Produces: `users/{uid}` documents carrying `displayName`, `email`, `photoURL`

- [ ] **Step 1: Write profile fields onto the user document**

In `js/cloud/cloud-sync.js`, replace the `setDoc(userRoot(), ...)` call inside `start()`:

```js
    const user = window.VCT.auth.currentUser;
    await fx.setDoc(userRoot(), {
      schemaVersion: 1,
      displayName: user.displayName || null,
      email: user.email || null,
      photoURL: user.photoURL || null,
      updatedAt: fx.serverTimestamp(),
    }, { merge: true });
```

Note that `riot` is deliberately absent: security rules reject any client write touching that key, and the Admin SDK owns it (Task R2 or M1, depending on branch).

- [ ] **Step 2: Verify multi-device sync**

With the emulators running, open <http://localhost:5000> in two different browser profiles (not two tabs — two profiles, so the uid genuinely differs until sign-in). Sign in to the same email account in both.

Add a match in profile A. Expected: it appears in profile B within a few seconds without a manual reload.

- [ ] **Step 3: Verify concurrent offline edits**

Take profile B offline. Edit match #1's notes in A; edit match #2's ACS in B. Bring B online.

Expected: **both edits survive.** This is the payoff of one document per match — the two writes touch different documents, so last-write-wins never collides. Record the result; if either edit is lost, stop and re-examine the diff in Task 4.

- [ ] **Step 4: Verify a real conflict resolves predictably**

Edit the *same* match's notes on both devices while B is offline, then reconnect. Expected: B's value wins, because it was written to the server last. This is documented last-write-wins behavior, not a bug.

- [ ] **Step 5: Run the full regression checklist**

Against the deployed or emulated app, signed in: create challenge, add match, edit match, delete match, import a CSV, archive, unarchive, export CSV, export backup JSON, restore a backup, offline write then reconnect. Every one must behave as it did before phase 1.

- [ ] **Step 6: Deploy and commit**

```bash
npm run deploy
git add js/cloud/cloud-sync.js
git commit -m "feat: store profile fields on the user document"
```

---

## Decision Point

Tasks 1–12 are complete. The app has cloud storage, offline-first sync, migration and
accounts. **This is a valid finished state.**

Read the verdict recorded in Task 0 Step 4 and continue into exactly one branch below.
If Task 0 has not returned an answer yet, stop here and wait — do not start a branch
speculatively, because the two branches want different secrets and different endpoints.

### Branch trade-offs

Both branches end with a populated `users/{uid}.riot.puuid`. The differences that matter:

| | Branch R — RSO | Branch M — Riot ID |
|---|---|---|
| Tasks | 3 | 2 |
| User does | Clicks "Continue with Riot" | Types `Name#TAG` once |
| PUUID is | **Verified** — Riot confirms ownership | **Unverified** — any Riot ID can be entered |
| Needs | RSO product approval | A standard API key |
| Secrets | `RIOT_CLIENT_ID`, `RIOT_CLIENT_SECRET`, `RIOT_STATE_SECRET` | `RIOT_API_KEY` |

**The verification gap is a real consideration, not a formality.** Under Branch M a user
can type someone else's Riot ID and pull that person's competitive match history into
their own tracker. For a personal tool that is unremarkable — the same data is visible on
public tracker sites. For a public product it is a privacy question you should answer
deliberately rather than inherit. Two honest mitigations: keep signups closed while on
Branch M, or treat Branch M as a bridge and move to Branch R once RSO is approved. The
`riot.source` field (`"rso"` or `"riot-id"`) records which applies, so the distinction
survives in the data.

---

## Branch R — Riot Sign-On

**Only if Task 0 returned verdict R.** Three tasks.

### Task R1: Cloud Functions scaffolding and `riotAuthStart`

**Files:**
- Create: `functions/package.json`, `functions/index.js`, `functions/riot.js`, `tests/riot-state.test.js`
- Modify: `firebase.json`

**Interfaces:**
- Consumes: endpoint values recorded in Task 0 Step 3
- Produces: HTTP endpoint `riotAuthStart` accepting `?idToken=<optional>` and redirecting to Riot's authorize URL; `signState(payload, secret)` and `verifyState(token, secret, maxAgeMs)` in `functions/riot.js`

- [ ] **Step 1: Upgrade the project to the Blaze plan**

Cloud Functions cannot deploy on Spark. In the Firebase console, upgrade to Blaze, then
set a budget alert at $5 under Google Cloud Billing → Budgets & alerts. Realistic cost at
personal scale sits inside the free allowance, but a payment method is mandatory. This is
the first task in the entire plan that requires one.

- [ ] **Step 2: Initialize the functions directory**

```bash
npx firebase init functions
```

Choose JavaScript, decline ESLint, and decline installing dependencies now.

- [ ] **Step 3: Set `functions/package.json`**

```json
{
  "name": "functions",
  "description": "Riot Sign-On endpoints for the Valorant Challenge Tracker",
  "engines": { "node": "22" },
  "main": "index.js",
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^6.0.0"
  },
  "private": true
}
```

```bash
cd functions && npm install && cd ..
```

- [ ] **Step 4: Store the Riot credentials as secrets**

```bash
npx firebase functions:secrets:set RIOT_CLIENT_ID
npx firebase functions:secrets:set RIOT_CLIENT_SECRET
npx firebase functions:secrets:set RIOT_STATE_SECRET
```

For `RIOT_STATE_SECRET`, generate a value with `openssl rand -hex 32`. It signs the
anti-CSRF state parameter and is unrelated to Riot.

- [ ] **Step 5: Write the state signing helpers**

`functions/riot.js`:

```js
const crypto = require("node:crypto");

// The state parameter carries the caller's uid (so a signed-in user links
// rather than creating a second identity) and must be tamper-proof.
function signState(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verifyState(token, secret, maxAgeMs = 10 * 60 * 1000) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload.ts || Date.now() - payload.ts > maxAgeMs) return null;
  return payload;
}

module.exports = { signState, verifyState };
```

- [ ] **Step 6: Write the test**

`tests/riot-state.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");
const { signState, verifyState } = require("../functions/riot.js");

const SECRET = "test-secret";

test("round-trips a payload", () => {
  const token = signState({ uid: "alice", nonce: "n1", ts: Date.now() }, SECRET);
  assert.strictEqual(verifyState(token, SECRET).uid, "alice");
});

test("rejects a tampered payload", () => {
  const token = signState({ uid: "alice", ts: Date.now() }, SECRET);
  const forged = Buffer.from(JSON.stringify({ uid: "bob", ts: Date.now() })).toString("base64url")
    + "." + token.split(".")[1];
  assert.strictEqual(verifyState(forged, SECRET), null);
});

test("rejects a token signed with a different secret", () => {
  const token = signState({ uid: "alice", ts: Date.now() }, "other-secret");
  assert.strictEqual(verifyState(token, SECRET), null);
});

test("rejects an expired token", () => {
  const token = signState({ uid: "alice", ts: Date.now() - 11 * 60 * 1000 }, SECRET);
  assert.strictEqual(verifyState(token, SECRET), null);
});

test("rejects malformed input", () => {
  assert.strictEqual(verifyState("garbage", SECRET), null);
  assert.strictEqual(verifyState("", SECRET), null);
  assert.strictEqual(verifyState(null, SECRET), null);
});
```

- [ ] **Step 7: Run the test**

```bash
node --test tests/riot-state.test.js
```

Expected: PASS, 5 tests.

- [ ] **Step 8: Write `riotAuthStart`**

`functions/index.js`. Substitute the authorize URL, token URL, account URL and scope
strings recorded in Task 0 Step 3.

```js
const crypto = require("node:crypto");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { signState, verifyState } = require("./riot.js");

admin.initializeApp();

const RIOT_CLIENT_ID = defineSecret("RIOT_CLIENT_ID");
const RIOT_CLIENT_SECRET = defineSecret("RIOT_CLIENT_SECRET");
const RIOT_STATE_SECRET = defineSecret("RIOT_STATE_SECRET");

// Values recorded in the Task 0 spike. Replace if the portal differs.
const RIOT_AUTHORIZE_URL = "https://auth.riotgames.com/authorize";
const RIOT_TOKEN_URL = "https://auth.riotgames.com/token";
const RIOT_ACCOUNT_URL = "https://europe.api.riotgames.com/riot/account/v1/accounts/me";
const RIOT_SCOPES = "openid offline_access";

function redirectUri(req) {
  return `https://${req.hostname}/riotAuthCallback`;
}

exports.riotAuthStart = onRequest(
  { secrets: [RIOT_CLIENT_ID, RIOT_STATE_SECRET], cors: false },
  async (req, res) => {
    const idToken = (req.query.idToken || "").toString();
    let uid = null;
    if (idToken) {
      try {
        uid = (await admin.auth().verifyIdToken(idToken)).uid;
      } catch (err) {
        console.warn("riotAuthStart: bad idToken", err.message);
      }
    }

    const state = signState(
      { uid, nonce: crypto.randomBytes(16).toString("hex"), ts: Date.now() },
      RIOT_STATE_SECRET.value()
    );

    const url = new URL(RIOT_AUTHORIZE_URL);
    url.searchParams.set("client_id", RIOT_CLIENT_ID.value());
    url.searchParams.set("redirect_uri", redirectUri(req));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", RIOT_SCOPES);
    url.searchParams.set("state", state);

    res.redirect(302, url.toString());
  }
);
```

- [ ] **Step 9: Deploy and verify the redirect**

```bash
npx firebase deploy --only functions:riotAuthStart
```

Visit the function URL in a browser. Expected: a 302 to `auth.riotgames.com` carrying
`client_id`, `redirect_uri`, `response_type=code`, `scope` and `state`. Do not complete
the login yet — the callback does not exist.

- [ ] **Step 10: Commit**

```bash
git add functions/ tests/riot-state.test.js firebase.json
git commit -m "feat: add riotAuthStart function with signed state parameter"
```

---

### Task R2: `riotAuthCallback`, custom token and PUUID uniqueness

**Files:**
- Modify: `functions/index.js`
- Create: `tests/rules/riot-accounts.test.js`

**Interfaces:**
- Consumes: `verifyState` (Task R1), `riotAccounts/{puuid}` rules (Task 2)
- Produces: HTTP endpoint `riotAuthCallback` redirecting to `/?riotToken=<customToken>` on success or `/?riotError=<code>` on failure

- [ ] **Step 1: Write the callback**

Append to `functions/index.js`:

```js
exports.riotAuthCallback = onRequest(
  { secrets: [RIOT_CLIENT_ID, RIOT_CLIENT_SECRET, RIOT_STATE_SECRET], cors: false },
  async (req, res) => {
    const fail = (code) => res.redirect(302, `/?riotError=${encodeURIComponent(code)}`);

    const code = (req.query.code || "").toString();
    const stateToken = (req.query.state || "").toString();
    if (!code) return fail("no_code");

    const state = verifyState(stateToken, RIOT_STATE_SECRET.value());
    if (!state) return fail("bad_state");

    let tokens;
    try {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(req),
      });
      const basic = Buffer.from(
        `${RIOT_CLIENT_ID.value()}:${RIOT_CLIENT_SECRET.value()}`
      ).toString("base64");
      const response = await fetch(RIOT_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      if (!response.ok) {
        console.error("riotAuthCallback: token exchange failed", response.status);
        return fail("token_exchange");
      }
      tokens = await response.json();
    } catch (err) {
      console.error("riotAuthCallback: token exchange threw", err);
      return fail("token_exchange");
    }

    let account;
    try {
      const response = await fetch(RIOT_ACCOUNT_URL, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!response.ok) {
        console.error("riotAuthCallback: account lookup failed", response.status);
        return fail("account_lookup");
      }
      account = await response.json();
    } catch (err) {
      console.error("riotAuthCallback: account lookup threw", err);
      return fail("account_lookup");
    }

    const puuid = account.puuid;
    if (!puuid) return fail("no_puuid");

    const db = admin.firestore();
    const indexRef = db.doc(`riotAccounts/${puuid}`);

    let uid;
    try {
      uid = await db.runTransaction(async (tx) => {
        const existing = await tx.get(indexRef);

        if (existing.exists) {
          const ownerUid = existing.data().uid;
          // Signed in as someone else: refuse rather than silently merging
          // two people's match histories.
          if (state.uid && state.uid !== ownerUid) throw new Error("already_linked");
          return ownerUid;
        }

        const targetUid = state.uid || (await admin.auth().createUser({})).uid;
        tx.set(indexRef, {
          uid: targetUid,
          source: "rso",
          linkedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(
          db.doc(`users/${targetUid}`),
          {
            riot: {
              puuid,
              gameName: account.gameName || null,
              tagLine: account.tagLine || null,
              region: account.region || null,
              source: "rso",
              linkedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          },
          { merge: true }
        );
        return targetUid;
      });
    } catch (err) {
      if (err.message === "already_linked") return fail("already_linked");
      console.error("riotAuthCallback: link transaction failed", err);
      return fail("link_failed");
    }

    const customToken = await admin.auth().createCustomToken(uid);
    return res.redirect(302, `/?riotToken=${encodeURIComponent(customToken)}`);
  }
);
```

The refresh token in `tokens.refresh_token` is deliberately **not** stored. Match fetching
authenticates with your API key against the PUUID, not with the user's OAuth token, so
there is nothing that needs it. Storing a live credential nothing reads would be pure
liability.

- [ ] **Step 2: Write the rules test**

`tests/rules/riot-accounts.test.js`:

```js
const test = require("node:test");
const fs = require("node:fs");
const { initializeTestEnvironment, assertFails } = require("@firebase/rules-unit-testing");

let env;

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: "vct-riot-rules-test",
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

test.after(async () => { await env.cleanup(); });

test("no client may read or write the riotAccounts index", async () => {
  const alice = env.authenticatedContext("alice").firestore();
  await assertFails(alice.doc("riotAccounts/puuid-1").get());
  await assertFails(alice.doc("riotAccounts/puuid-1").set({ uid: "alice" }));
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(anon.doc("riotAccounts/puuid-1").get());
});

test("a user cannot forge the riot field on another user's document", async () => {
  const bob = env.authenticatedContext("bob").firestore();
  await assertFails(bob.doc("users/alice").set({ riot: { puuid: "puuid-1" } }));
});
```

- [ ] **Step 3: Run the rules tests**

```bash
npm run test:rules
```

Expected: PASS. The `riotAccounts` rules written in Task 2 already deny all client
access, so these confirm rather than drive — which is the point of writing them.

- [ ] **Step 4: Deploy and verify the full round trip**

```bash
npx firebase deploy --only functions
```

Visit `riotAuthStart` and complete the Riot login. Expected: a redirect back to
`/?riotToken=...`, a `riotAccounts/{puuid}` document mapping to a uid, and a
`users/{uid}` document carrying the `riot` field with `source: "rso"`.

- [ ] **Step 5: Verify the duplicate-link refusal**

Sign in as a second account and attempt to link the same Riot account. Expected: redirect
to `/?riotError=already_linked`, and neither the index nor either user document changes.

- [ ] **Step 6: Commit**

```bash
git add functions/index.js tests/rules/riot-accounts.test.js
git commit -m "feat: add Riot OAuth callback minting Firebase custom tokens"
```

---

### Task R3: Riot link UI

**Files:**
- Modify: `js/cloud/auth-ui.js`, `js/cloud/cloud-sync.js`, `js/cloud/firebase-boot.js`, `index.html`

**Interfaces:**
- Consumes: `riotAuthStart` / `riotAuthCallback` (Tasks R1, R2), `renderAuthState` (Task 9)
- Produces: `startRiotLink()`, `consumeRiotRedirect()`

- [ ] **Step 1: Add the Riot button to the modal**

In `index.html`, immediately after the Google button:

```html
    <button class="ghost auth-riot" type="button" id="riotSignInBtn">Continue with Riot</button>
```

- [ ] **Step 2: Implement the redirect handlers**

Append inside the IIFE in `js/cloud/auth-ui.js`:

```js
  const RIOT_ERRORS = {
    no_code: "Riot did not complete the sign-in. Try again.",
    bad_state: "That sign-in link expired. Try again.",
    token_exchange: "Riot rejected the sign-in. Try again in a moment.",
    account_lookup: "Signed in to Riot, but your account details could not be read.",
    no_puuid: "Riot did not return an account id.",
    already_linked: "That Riot account is already linked to a different tracker account.",
    link_failed: "The Riot account could not be linked. Try again.",
  };

  async function startRiotLink() {
    const user = window.VCT.auth.currentUser;
    // Pass an ID token so the function links to this account instead of
    // creating a second identity.
    const idToken = user ? await user.getIdToken() : "";
    location.href = `/riotAuthStart?idToken=${encodeURIComponent(idToken)}`;
  }

  async function consumeRiotRedirect() {
    const params = new URLSearchParams(location.search);
    const token = params.get("riotToken");
    const error = params.get("riotError");
    if (!token && !error) return;

    // Clear the query string before anything can fail, so a reload does not
    // replay a spent token.
    history.replaceState(null, "", location.pathname);

    if (error) {
      showAppNotice(RIOT_ERRORS[error] || "Riot sign-in did not complete.", "Riot sign-in");
      return;
    }
    try {
      await window.VCT.ax.signInWithCustomToken(window.VCT.auth, token);
      showToast("Riot account linked.");
    } catch (err) {
      console.error("VCT: custom token sign-in failed", err);
      showAppNotice("Riot signed you in, but the tracker could not finish. Try again.", "Riot sign-in");
    }
  }

  document.getElementById("riotSignInBtn").addEventListener("click", () => {
    startRiotLink().catch((err) => {
      console.error("VCT: Riot link failed to start", err);
      showAuthError("Could not start Riot sign-in. Try again.");
    });
  });

  window.startRiotLink = startRiotLink;
  window.consumeRiotRedirect = consumeRiotRedirect;
```

- [ ] **Step 3: Run the redirect handler once the SDK is ready**

In `js/cloud/firebase-boot.js`, inside the existing `VCT.onReady` callback, after
`VCT.cloud.start(uid)`:

```js
  if (typeof window.consumeRiotRedirect === "function") window.consumeRiotRedirect();
```

- [ ] **Step 4: Show the linked account in the panel**

In `renderAuthState()`, in the signed-in branch, before the `host.innerHTML` assignment:

```js
    const riot = window.VCT.riotProfile;
    const riotLine = riot
      ? `<p class="auth-riot-linked">${escapeHtml(riot.gameName)}#${escapeHtml(riot.tagLine)}</p>`
      : `<button class="linklike" type="button" id="linkRiotBtn">Link Riot account</button>`;
```

Include `${riotLine}` in the template, then wire the button when present:

```js
    const linkBtn = document.getElementById("linkRiotBtn");
    if (linkBtn) linkBtn.onclick = () => startRiotLink();
```

Populate `window.VCT.riotProfile` by subscribing to the user document. In
`js/cloud/cloud-sync.js`, inside `start()`:

```js
    fx.onSnapshot(userRoot(), (snap) => {
      window.VCT.riotProfile = snap.exists() ? (snap.data().riot || null) : null;
      if (typeof window.renderAuthState === "function") window.renderAuthState();
    });
```

- [ ] **Step 5: Verify the full flow**

Signed in with email, click "Link Riot account". Expected: redirect to Riot, then back
with the toast, the panel showing `GameName#TAG`, the query string cleared, and
`window.VCT.uid` **unchanged** — the link did not create a second account.

- [ ] **Step 6: Verify the error path**

Visit `/?riotError=already_linked` directly. Expected: the specific notice appears and
the query string is cleared.

- [ ] **Step 7: Deploy and commit**

```bash
npm run deploy
git add js/cloud/auth-ui.js js/cloud/cloud-sync.js js/cloud/firebase-boot.js index.html
git commit -m "feat: add Riot account linking UI and redirect handling"
```

---

## Branch M — Riot ID identity, no RSO

**Only if Task 0 returned verdict M.** Two tasks. Produces the same
`users/{uid}.riot.puuid` as Branch R, obtained from a user-typed `Name#TAG` and resolved
server-side. Read "Branch trade-offs" above first — the PUUID this branch produces is
unverified, and that has a privacy consequence.

### Task M1: Cloud Functions scaffolding and `resolveRiotId`

**Files:**
- Create: `functions/package.json`, `functions/index.js`
- Modify: `firebase.json`

**Interfaces:**
- Consumes: endpoint values recorded in Task 0 Step 3, `riotAccounts/{puuid}` rules (Task 2)
- Produces: callable function `resolveRiotId({gameName, tagLine})` returning `{puuid, gameName, tagLine, region}`, throwing `HttpsError` with codes `unauthenticated`, `invalid-argument`, `not-found`, `already-exists`, `resource-exhausted`

- [ ] **Step 1: Upgrade the project to the Blaze plan**

Cloud Functions cannot deploy on Spark. In the Firebase console, upgrade to Blaze, then
set a budget alert at $5 under Google Cloud Billing → Budgets & alerts. Realistic cost at
personal scale sits inside the free allowance, but a payment method is mandatory. This is
the first task in the entire plan that requires one.

- [ ] **Step 2: Initialize the functions directory**

```bash
npx firebase init functions
```

Choose JavaScript, decline ESLint, and decline installing dependencies now.

- [ ] **Step 3: Set `functions/package.json`**

```json
{
  "name": "functions",
  "description": "Riot ID resolution for the Valorant Challenge Tracker",
  "engines": { "node": "22" },
  "main": "index.js",
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^6.0.0"
  },
  "private": true
}
```

```bash
cd functions && npm install && cd ..
```

- [ ] **Step 4: Store the API key as a secret**

```bash
npx firebase functions:secrets:set RIOT_API_KEY
```

Paste the key from <https://developer.riotgames.com>. It must never reach the client:
anyone holding it can exhaust your rate limit.

- [ ] **Step 5: Write the callable**

`functions/index.js`. Substitute the endpoint path and header name recorded in Task 0
Step 3.

```js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

const RIOT_API_KEY = defineSecret("RIOT_API_KEY");

// Riot accounts are global, but the Account API is reached through regional
// routing hosts. Rather than asking the user which region they are in — a
// question most players cannot answer correctly — try each in turn.
const ROUTING = ["americas", "europe", "asia"];
const LOOKUP_COOLDOWN_MS = 10 * 1000;

exports.resolveRiotId = onCall({ secrets: [RIOT_API_KEY] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before linking a Riot ID.");
  }
  const uid = request.auth.uid;

  const gameName = String(request.data?.gameName ?? "").trim();
  const tagLine = String(request.data?.tagLine ?? "").trim().replace(/^#/, "");
  if (!gameName || !tagLine) {
    throw new HttpsError("invalid-argument", "Enter both a name and a tag.");
  }
  if (gameName.length > 32 || tagLine.length > 8) {
    throw new HttpsError("invalid-argument", "That does not look like a Riot ID.");
  }

  const db = admin.firestore();
  const cooldownRef = db.doc(`users/${uid}/meta/riotLookup`);

  // Per-user cooldown. The API key's rate limit is shared by every user, so
  // one person retrying in a loop would degrade the service for everyone.
  const cooldown = await cooldownRef.get();
  const lastAt = cooldown.exists ? cooldown.data().lastAt?.toMillis?.() ?? 0 : 0;
  if (Date.now() - lastAt < LOOKUP_COOLDOWN_MS) {
    throw new HttpsError("resource-exhausted", "Wait a few seconds and try again.");
  }
  await cooldownRef.set(
    { lastAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

  let account = null;
  let region = null;
  for (const routing of ROUTING) {
    const url = `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/`
      + `${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    let response;
    try {
      response = await fetch(url, { headers: { "X-Riot-Token": RIOT_API_KEY.value() } });
    } catch (err) {
      console.error("resolveRiotId: fetch threw", routing, err);
      continue;
    }
    if (response.status === 404) continue;
    if (response.status === 429) {
      throw new HttpsError("resource-exhausted", "Riot is rate limiting us. Try again shortly.");
    }
    if (!response.ok) {
      console.error("resolveRiotId: lookup failed", routing, response.status);
      continue;
    }
    account = await response.json();
    region = routing;
    break;
  }

  if (!account || !account.puuid) {
    throw new HttpsError("not-found", "No Riot account matches that name and tag.");
  }

  const indexRef = db.doc(`riotAccounts/${account.puuid}`);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(indexRef);
    // Same uniqueness guarantee as Branch R: one Riot account, one tracker account.
    if (existing.exists && existing.data().uid !== uid) {
      throw new HttpsError("already-exists", "That Riot ID is already linked to another account.");
    }
    tx.set(indexRef, {
      uid,
      source: "riot-id",
      linkedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(
      db.doc(`users/${uid}`),
      {
        riot: {
          puuid: account.puuid,
          gameName: account.gameName || gameName,
          tagLine: account.tagLine || tagLine,
          region,
          source: "riot-id",
          linkedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
  });

  return {
    puuid: account.puuid,
    gameName: account.gameName || gameName,
    tagLine: account.tagLine || tagLine,
    region,
  };
});
```

- [ ] **Step 6: Deploy**

```bash
npx firebase deploy --only functions:resolveRiotId
```

- [ ] **Step 7: Verify against a real Riot ID**

From the browser console on the deployed app, signed in:

```js
const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-functions.js");
const call = httpsCallable(getFunctions(window.VCT.app), "resolveRiotId");
await call({ gameName: "YOUR_NAME", tagLine: "YOUR_TAG" });
```

Expected: returns `{puuid, gameName, tagLine, region}`. In the Firestore console,
`users/{uid}.riot.source` is `"riot-id"` and `riotAccounts/{puuid}.uid` matches your uid.

- [ ] **Step 8: Verify the failure paths**

Call it with a nonsense name — expected `not-found`. Call it twice within ten seconds —
expected `resource-exhausted`. Sign in as a second account and claim the same Riot ID —
expected `already-exists`, with neither document changed.

- [ ] **Step 9: Commit**

```bash
git add functions/ firebase.json
git commit -m "feat: resolve Riot IDs to PUUIDs server-side with uniqueness and cooldown"
```

---

### Task M2: Riot ID entry UI

**Files:**
- Modify: `js/cloud/firebase-boot.js`, `js/cloud/auth-ui.js`, `js/cloud/cloud-sync.js`, `index.html`, `css/31-auth.css`

**Interfaces:**
- Consumes: `resolveRiotId` (Task M1), `renderAuthState` (Task 9)
- Produces: `submitRiotId(gameName, tagLine)`; `window.VCT.riotProfile`

- [ ] **Step 1: Load the Functions SDK in the boot module**

In `js/cloud/firebase-boot.js`, alongside the existing Auth and Firestore imports:

```js
const fnx = await import(`${CDN}/firebase-functions.js`);
const functions = fnx.getFunctions(app);
```

Add `fnx` and `functions` to the `VCT` object literal, next to `fx` and `ax`.

- [ ] **Step 2: Add the form markup**

In `index.html`, inside the `authPanel` div, after `authState`:

```html
<form class="riot-id-form hidden" id="riotIdForm">
  <label for="riotGameName">Riot ID</label>
  <div class="riot-id-fields">
    <input type="text" id="riotGameName" placeholder="Name" maxlength="32" autocomplete="off" required>
    <span class="riot-id-hash">#</span>
    <input type="text" id="riotTagLine" placeholder="TAG" maxlength="8" autocomplete="off" required>
  </div>
  <p class="riot-id-error hidden" id="riotIdError" role="alert"></p>
  <button type="submit" id="riotIdSubmit">Link account</button>
</form>
```

- [ ] **Step 3: Wire the submit handler**

Append inside the IIFE in `js/cloud/auth-ui.js`:

```js
  const RIOT_ID_ERRORS = {
    "functions/unauthenticated": "Sign in before linking a Riot ID.",
    "functions/invalid-argument": "Enter both a name and a tag, for example Ace#1234.",
    "functions/not-found": "No Riot account matches that name and tag. Check the spelling.",
    "functions/already-exists": "That Riot ID is already linked to another account.",
    "functions/resource-exhausted": "Too many attempts. Wait a few seconds and try again.",
  };

  async function submitRiotId(gameName, tagLine) {
    const { fnx, functions } = window.VCT;
    const call = fnx.httpsCallable(functions, "resolveRiotId");
    const result = await call({ gameName, tagLine });
    return result.data;
  }

  function showRiotIdError(message) {
    const box = document.getElementById("riotIdError");
    box.textContent = message;
    box.classList.remove("hidden");
  }

  const riotIdForm = document.getElementById("riotIdForm");
  if (riotIdForm) {
    riotIdForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      document.getElementById("riotIdError").classList.add("hidden");
      const btn = document.getElementById("riotIdSubmit");
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Checking…";
      try {
        const account = await submitRiotId(
          document.getElementById("riotGameName").value,
          document.getElementById("riotTagLine").value
        );
        showToast(`Linked ${account.gameName}#${account.tagLine}.`);
        riotIdForm.reset();
      } catch (err) {
        console.error("VCT: Riot ID link failed", err);
        showRiotIdError(
          RIOT_ID_ERRORS[err.code] || "That Riot ID could not be linked. Try again."
        );
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  }

  window.submitRiotId = submitRiotId;
```

- [ ] **Step 4: Show the linked account and toggle the form**

In `renderAuthState()`, in the signed-in branch, before the `host.innerHTML` assignment:

```js
    const riot = window.VCT.riotProfile;
    const riotLine = riot
      ? `<p class="auth-riot-linked">${escapeHtml(riot.gameName)}#${escapeHtml(riot.tagLine)}</p>`
      : "";
```

Include `${riotLine}` in the template. Then, at the end of `renderAuthState()`:

```js
  // The form is only offered to signed-in users who have not linked yet.
  const form = document.getElementById("riotIdForm");
  if (form) {
    const user = window.VCT.auth.currentUser;
    const show = !!user && !user.isAnonymous && !window.VCT.riotProfile;
    form.classList.toggle("hidden", !show);
  }
```

Populate `window.VCT.riotProfile` by subscribing to the user document. In
`js/cloud/cloud-sync.js`, inside `start()`:

```js
    fx.onSnapshot(userRoot(), (snap) => {
      window.VCT.riotProfile = snap.exists() ? (snap.data().riot || null) : null;
      if (typeof window.renderAuthState === "function") window.renderAuthState();
    });
```

- [ ] **Step 5: Style the form**

Extend `css/31-auth.css` with `.riot-id-form`, `.riot-id-fields` (a flex row placing the
`#` between the two inputs), `.riot-id-hash` and `.riot-id-error`, using the tokens in
`css/01-tokens.css`. Match the field styling already used by `css/04-forms.css`.

- [ ] **Step 6: Verify**

Signed in with email and no Riot ID linked: the form is visible. Enter your Riot ID.
Expected: a success toast, the form disappears, and the panel shows `Name#TAG`. Reload —
the linked account persists and the form stays hidden.

- [ ] **Step 7: Verify the error surface**

Enter a nonsense Riot ID. Expected: the not-found message appears inline and the form
stays visible. Submit twice quickly. Expected: the cooldown message.

- [ ] **Step 8: Deploy and commit**

```bash
npm run deploy
git add js/cloud/firebase-boot.js js/cloud/auth-ui.js js/cloud/cloud-sync.js index.html css/31-auth.css
git commit -m "feat: add Riot ID entry linking a PUUID without RSO"
```

---

## Branch N — Stop at Task 12

**Only if Task 0 returned verdict N.** No tasks. This section exists so stopping is an
explicit, verified decision rather than an abandonment.

- [ ] **Step 1: Confirm nothing is dangling**

```bash
grep -rn "riot" js/ --include="*.js" -i | grep -v vendor
```

Expected: **no matches.** No client code in Tasks 1-12 references Riot. If anything
appears, a branch task was partially applied and should be reverted.

- [ ] **Step 2: Confirm the inert artifacts are harmless**

Four Riot-shaped things remain, all written in Task 2 or Task 3. None is load-bearing and
none needs removing:

| Artifact | Where | State |
|---|---|---|
| `source` enum value `"riot"` | `firestore.rules` | Never produced |
| `riotMatchId` on match documents | `js/cloud/snapshot-model.js` | Always null |
| `riot` write-protection on `users/{uid}` | `firestore.rules` | Guards a field nobody writes; always passes |
| `riotAccounts/{puuid}` deny-all | `firestore.rules` | Inert |

Leaving them costs one null field per match document and roughly eight lines of rules.
Removing them would require a schema migration for no benefit. **Leave them.**

- [ ] **Step 3: Confirm you never needed Blaze**

In the Firebase console, verify the project is still on the Spark plan and no payment
method is attached. Tasks 1-12 use only Firestore, Auth and Hosting, all of which are on
the free tier.

- [ ] **Step 4: Record the outcome**

Append the verdict and its date to
`docs/superpowers/specs/2026-09-06-riot-access-spike.md`, so a future reader knows Riot
was evaluated and declined rather than forgotten. Note the conditions under which it
would be worth revisiting.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-06-riot-access-spike.md
git commit -m "docs: close out Riot integration as not currently available"
```

---

## What each branch means for automatic match fetching

Match fetching is deliberately **not** planned here — its tasks cannot be written
honestly until Task 0 returns the real endpoint terms. This section records only how the
branch choice affects it, so the branch decision is made with its consequences visible.

Match fetching needs three things:

1. **A PUUID.** Branch R and Branch M both supply it at `users/{uid}.riot.puuid`. The
   fetch code reads that one field and does not care which branch wrote it.
2. **`VAL-MATCH-V1` access.** An independent gate. Neither branch grants it.
3. **A landing place.** Already built: `buildImportPreview(objects)` at
   [js/import-preview.js:71](../../../js/import-preview.js) takes an array of raw objects
   and drives validation, match-number assignment, the review UI and commit. Fetched
   matches enter there.

Consequences by branch:

| | Branch R | Branch M | Branch N |
|---|---|---|---|
| Fetch possible if `VAL-MATCH-V1` granted | yes | yes | no — no PUUID source |
| PUUID trust | verified by Riot | user-asserted | n/a |
| Extra work before fetch can start | none | none | a PUUID source must be built first |

Scheduled background fetching depends **totally** on match fetching — it is the same code
on a timer — and works identically under R and M. Neither branch needs the user's OAuth
tokens for it: `VAL-MATCH-V1` authenticates with your API key against a PUUID, so once
the PUUID is stored, no user credential is involved. This is why Task R2 deliberately
discards the refresh token.

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: §3.1 seams → Tasks 4 and 6; §3.2
boot order → Tasks 5 and 6; §3.3 dispatcher → Task 6 Step 4; §4 data model → Tasks 2, 3;
§4.2 match identity → Task 3; §4.3 index handlers → Task 8; §5 rules → Task 2; §6.1
anonymous → Task 5; §6.2 upgrade and collisions → Tasks 10, 11; §6.3 RSO → Tasks R1, R2,
R3; §7 migration → Task 7; §8 spike → Task 0; §10 testing → Tasks 2, 3, 4, 7, 12, R1;
§12.1 drop-safety → Branch N.

**Branch M is a spec addition.** The spec describes RSO as the only PUUID source. Branch M
introduces a second — a server-resolved Riot ID with `riot.source` distinguishing
`"rso"` from `"riot-id"`, and the privacy consequence of an unverified PUUID recorded
under "Branch trade-offs". Spec §6.3 and §4 must be updated to match.

**Type consistency.** `buildSnapshot` / `applyDocuments` / `newMatchId` / `diffSnapshots`
/ `chunk` are used with identical signatures throughout. `window.VCT.fx` (Firestore),
`.ax` (Auth) and `.fnx` (Functions) are introduced in Tasks 6, 9 and M2 respectively and
used consistently after. `offerMerge(signIn)` is defined in Task 10 and reused in Task 11.
`window.VCT.riotProfile` is populated identically in Tasks R3 Step 4 and M2 Step 4, so
`renderAuthState()` behaves the same under either branch.

**Known duplication, accepted.** Validation lives in both the client
([js/match-save.js](../../../js/match-save.js)) and `firestore.rules`. Spec §5 records the
coupling; both must change together. Tasks R1 and M1 also repeat the Cloud Functions
scaffolding steps, because only one of them will ever be executed and a reader of either
must not have to consult the other.
