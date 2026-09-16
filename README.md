# Valorant Challenge Tracker

[![Live App](https://img.shields.io/badge/Live_App-valorant--challenge--tracker.web.app-00f59b?style=flat&logo=firebase)](https://valorant-challenge-tracker.web.app)
[![Tests](https://img.shields.io/badge/Tests-76%20unit%20%7C%2035%20rules-brightgreen?style=flat&logo=node.js)](tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)

A high-performance, local-first web application designed for competitive VALORANT players to log matches, follow rank and RR progression, analyze agent/map performance, and celebrate ranked climb milestones. Built with zero runtime dependencies, robust offline support, and seamless real-time cloud synchronization.

🌐 **Live Application**: [https://valorant-challenge-tracker.web.app](https://valorant-challenge-tracker.web.app)

---

## Key Features

- **Challenge Management**: Set up custom competitive goals (e.g., *30 Games to Diamond*) with target match counts, starting rank/RR baseline, and optional descriptions. Archive, restore, or manage multiple challenges independently.
- **Granular Match Logging**: Record match outcome, scores, rank transitions (Promoted, Demoted, Placed, Same Rank), RR delta, and combat statistics (ACS, ADR, K/D/A, DDDelta, HS%, KAST%, first bloods, and multikills). Supports CSV/TSV bulk import and JSON backup restoration.
- **Visual Analytics & Trajectory**: Real-time overview charts mapping Rank & RR progression over time, recent match form, agent and map win rates, role distributions, and comprehensive Agent × Map cross-analysis matrices.
- **Publication-Ready Exports**: Generate paginated, printable PDF challenge completion reports with high-resolution layout and match histories, or export clean CSV and JSON datasets.
- **Local-First & Phase 1 Cloud Sync**:
  - **Local-First Architecture**: Completely functional offline with immediate browser storage persistence.
  - **Real-Time Multi-Tab Sync**: When signed in with Firebase, background synchronization propagates updates across tabs and devices in real time.
  - **Durable Tombstones**: Deletions record persistent tombstones in Cloud Firestore, preventing phantom "zombie" resurrections across concurrent sessions.
  - **Automatic Migration**: Existing local storage data automatically migrates to Cloud Firestore on first sign-in without data loss.
  - **Offline Resilience & Queueing**: Changes made while disconnected are queued and safely synchronized when connectivity resumes.

---

## Quick Start

### Live Web Application
Launch the live tracker directly in any modern desktop or mobile browser:
👉 **[https://valorant-challenge-tracker.web.app](https://valorant-challenge-tracker.web.app)**

### Running Locally

The client application is static HTML, CSS, and vanilla JavaScript with zero build steps or bundlers required.

#### Option A: Lightweight Static Server (Local-Only Mode)
Serve the workspace with any local HTTP server:

```bash
# Using Python 3
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser. (Alternatively, use VS Code *Live Server*).

#### Option B: Firebase Local Emulator Suite (Full Cloud Simulation)
To test or develop Cloud Sync, Firestore security rules, and Auth locally:

```bash
# Start Auth, Firestore, and Hosting emulators
npm run emulators
```
Then open `http://localhost:5000` in your browser.

---

## Testing

The repository maintains an automated test suite verifying data integrity, edge cases, and server rules:

```bash
# Run the pure-function Node test suite (76 tests)
npm test

# Run Firestore security rules tests against the Firestore emulator (35 tests)
# Note: Requires local Java runtime (Microsoft OpenJDK 21)
npm run test:rules
```

- **Pure-Function Suite (`npm test`)**: 76 unit and integration tests covering snapshot diffing, storage recovery, match number reconciliation, rank progression derivation, input validation, and dialog event delegation.
- **Rules Suite (`npm run test:rules`)**: 35 emulator tests covering tenant data isolation, tombstone immutability, `getAfter()` write barriers, and schema validation.

---

## Project Structure

```text
valorant-challenge-tracker/
├── index.html              # Core application markup, modal templates & player changelog
├── css/                    # Ordered stylesheet partials (01-tokens.css -> 30-modal-keyboard.css)
│   └── README.md           # Load-order hierarchy and architectural documentation
├── js/                     # Classic JavaScript modules (loaded in dependency order)
│   ├── constants.js        # Global constants, enums, rank definitions
│   ├── dom-utils.js        # DOM helpers, escaping, and formatting
│   ├── storage.js          # Local storage access and recovery
│   ├── persistence.js      # Centralized persist() coordinator
│   ├── challenge-state.js  # Active challenge state & normalization
│   ├── challenge-actions.js# Challenge lifecycle (open, archive, delete, unarchive)
│   ├── dialogs.js          # Modals, confirmations, toasts & event delegation
│   ├── match-*.js          # Match entry, modal, validation, dataset, table controls
│   ├── analytics-*.js      # Analytical computations, breakdowns, and signals
│   ├── chart.js            # Interactive SVG charts and trend lines
│   ├── export.js           # CSV, JSON export and data portability
│   ├── challenge-report.js # Formatted PDF report generator
│   └── cloud/              # Phase 1 Cloud Sync engine
│       ├── firebase-boot.js   # Firebase SDK bootstrap & auth
│       ├── snapshot-model.js  # Document dictionary serialization
│       ├── snapshot-diff.js   # Pure snapshot diffing and chunking
│       ├── cloud-sync.js      # Real-time synchronization bridge & tombstone manager
│       └── cloud-migrate.js   # Local-to-cloud initial data migration
├── assets/                 # Static visual assets (rank icons, tier emblems)
├── tests/                  # Automated test suites
│   ├── failure-paths.test.js  # Edge cases, recovery, batching & dialog tests
│   ├── snapshot-model.test.js # Snapshot construction, hydration & round-trips
│   ├── snapshot-diff.test.js  # Snapshot diffing & batch chunking logic
│   ├── cloud-migrate.test.js  # Local-to-cloud data migration tests
│   └── rules/                 # Firestore rules unit test specs
├── firestore.rules         # Server-enforced Firestore security rules
├── firestore.indexes.json  # Cloud Firestore composite indexes
├── firebase.json           # Firebase Hosting & Emulator configuration
├── DEVELOPMENT.md          # Maintainer guidance and architectural invariants
├── SECURITY.md             # Security policy and server-side rules specification
└── package.json            # Tooling and test runner configuration
```

---

## Documentation Boundaries

To keep information organized and prevent redundant or conflicting documentation:

- **`README.md`**: Front door and public presentation for GitHub visitors, users, and prospective contributors.
- **`index.html` (Changelog Tab)**: Player-facing release notes detailing feature updates, UX polish, and fixes in plain language.
- **`DEVELOPMENT.md`**: Technical maintainer notes, architectural invariants, state machines, and testing guidelines.
- **`SECURITY.md`**: Security architecture specification, server-side rule invariants, and private vulnerability disclosure policies.
- **`docs/`**: Long-term architecture specifications, RFCs, and phase design records (strictly reserved; not modified during chore updates).

---

## Changelog

User-facing release notes are integrated directly into the application in the **Changelog** tab (viewable by clicking the book icon in the navigation bar). For deep technical history and developer invariants, consult [DEVELOPMENT.md](DEVELOPMENT.md).

---

## License

This project is open-source under the [MIT License](https://opensource.org/licenses/MIT).

---

## Disclaimer

Valorant Challenge Tracker is an independent, community project. It is not affiliated with, endorsed, or sponsored by Riot Games, Inc. VALORANT and Riot Games are trademarks or registered trademarks of Riot Games, Inc. All reports and match statistics are user-generated.

