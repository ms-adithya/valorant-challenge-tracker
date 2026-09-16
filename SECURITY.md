# Security Policy

## Supported Versions

We actively provide security patches and updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| < 1.0   | :x:                |

---

## Server-Enforced Security Architecture

Valorant Challenge Tracker enforces a defense-in-depth security model implemented in Cloud Firestore Security Rules (`firestore.rules`). Security invariants are verified using automated unit tests with the Firebase Local Emulator Suite (`@firebase/rules-unit-testing`).

### 1. Client Isolation & Authentication
- **User Root Boundaries**: All document read and write operations under `/users/{uid}/**` strictly require Firebase Authentication where `request.auth.uid == uid`. No cross-user access is permitted.
- **Client Privilege Restrictions**: Clients cannot attach or mutate privileged auth metadata (such as the `riot` identity object on the user profile). Privileged fields and reverse-lookup indexes (`/riotAccounts/{puuid}`) are strictly restricted to the Firebase Admin SDK (`allow read, write: if false`).

### 2. Append-Only Durable Tombstones
- **Tombstone Storage**: Challenge and match deletions record persistent tombstones under `/users/{uid}/meta/tombstones`.
- **Immutable & Undeletable**: The tombstones document can never be deleted (`allow delete: if false`). Updates are strictly append-only: keys can only be added, never removed or modified (`removedKeys().size() == 0 && changedKeys().size() == 0`).
- **Resurrection Prevention**: Rules evaluate `isTombstonedChallenge` and `isTombstonedMatch` on creation and update paths, rejecting any client write for a previously deleted entity.

### 3. Post-Delete `getAfter()` Write Barrier
- **Atomic Deletion Guarantee**: To prevent orphaned records or unrecorded deletions, Firestore rules utilize `getAfter()` and `existsAfter()` barriers (`isTombstonedChallengeAfter` and `isTombstonedMatchAfter`).
- **Atomic Batch Invariant**: A client cannot delete a challenge or match document unless the corresponding tombstone entry (`c_<challengeId>` or `m_<challengeId>_<matchId>`) is written within the exact same atomic batch or transaction.

### 4. Strict Schema & Range Validation
Server-side rule predicates validate incoming payloads before accepting writes:
- **Challenges (`validChallenge`)**: Validates name string length (1–200 characters), positive integer targets (`target >= 1`), valid rank strings, start RR in range (`0 <= startRR <= 100`), status in `['active', 'archived']`, and boolean `isOpen`.
- **Matches (`validMatch`)**: Validates sequential integer match number (`no >= 1`), validated result strings (`['Win', 'Loss', 'Draw']`), rank status enums, non-negative scores with round sum consistency (`rounds == myScore + enemyScore`), bounded percentages (`0 <= v <= 100` for HS%, KAST%, and RR-after), non-negative combat metrics (kills, deaths, assists, ACS, ADR, multikills), and valid source provenance (`['manual', 'import', 'riot']`). Optional fields safely permit `null` without zero-coercion.

---

## Reporting a Vulnerability

The Valorant Challenge Tracker team takes security seriously. If you believe you have discovered a security vulnerability regarding data persistence, Firestore Security Rules, or client authentication, please report it responsibly.

### How to Report Privately
**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, please report via one of the following methods:
1. **GitHub Private Vulnerability Reporting** (Preferred):
   - Navigate to the [Security tab](https://github.com/ms-adithya/valorant-challenge-tracker/security) of this repository.
   - Click **Report a vulnerability** to open an advisory draft.
2. **Email**:
   - Send details to the repository maintainer: `adithyams64203@gmail.com`

### What to Include in Your Report
To help us triage and resolve the issue quickly, please include:
- A clear description of the vulnerability and its potential impact.
- Step-by-step instructions or a minimal Proof of Concept (PoC) to reproduce the behavior.
- Relevant files, functions, or Firestore rules involved.
- Any suggested fixes or mitigations (if available).

---

## Our Response Process
1. **Acknowledgment**: We aim to acknowledge receipt of your vulnerability report within 48 hours.
2. **Assessment & Confirmation**: We will investigate the issue and provide a confirmation or request for further clarification.
3. **Patching & Coordinated Disclosure**: Once confirmed, a fix will be implemented on a private branch, verified via automated rules and unit tests, and deployed. We will coordinate with you before publicly disclosing the advisory.
