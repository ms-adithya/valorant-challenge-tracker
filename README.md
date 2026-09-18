# Valorant Challenge Tracker

[![Live App](https://img.shields.io/badge/Live_App-valorant--challenge--tracker.web.app-00f59b?style=flat&logo=firebase)](https://valorant-challenge-tracker.web.app)
[![Tests](https://img.shields.io/badge/Tests-124%20unit%20%7C%2040%20rules-brightgreen?style=flat&logo=node.js)](tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

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
  - **Real-Time Account Sync**: Anonymous and linked Firebase accounts synchronize challenges and matches across tabs and devices, with durable cloud persistence and offline recovery.
  - **Durable Tombstones**: Deletions record persistent tombstones in Cloud Firestore, preventing phantom "zombie" resurrections across concurrent sessions.
  - **Automatic Migration**: Existing local storage data automatically migrates to Cloud Firestore on first sign-in without data loss.
  - **Offline Resilience & Queueing**: Changes made while disconnected are queued and safely synchronized when connectivity resumes.

---

## Quick Start

### Live Web Application
Launch the live tracker directly in any modern desktop or mobile browser:
👉 **[https://valorant-challenge-tracker.web.app](https://valorant-challenge-tracker.web.app)**

### Running Locally

The client application is static HTML, CSS, and vanilla JavaScript with zero build steps or bundlers required. Serve the repository with any local static HTTP server:

```bash
# Using Python 3
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser. (Alternatively, use VS Code *Live Server* or any static file server).

> [!NOTE]
> The local Firebase Emulator Suite is dedicated to executing automated Firestore Security Rules unit tests (`npm run test:rules`). The browser runtime is a static web client that connects to the project services configured in `js/cloud/firebase-boot.js`.

### Client error reporting

Uncaught browser errors and unhandled promise rejections are captured by the small
`js/error-reporting.js` module. To receive production reports, define
`window.VCT_ERROR_REPORT_URL` before the script loads and point it to an HTTPS endpoint
accepting JSON `{ errors: [...] }`. Without that optional endpoint, reports stay in a
bounded local queue and are not sent anywhere. Common emails, tokens, passwords, secrets,
and API-key query parameters are redacted before delivery.

---

## Testing

The repository maintains an automated test suite verifying data integrity, edge cases, and server rules:

```bash
# Run the pure-function Node test suite (124 tests)
npm test

# Run Firestore security rules tests against the Firestore emulator (40 tests)
# Note: Requires local Java runtime (Microsoft OpenJDK 21)
npm run test:rules
```

- **Pure-Function Suite (`npm test`)**: 124 unit and integration tests covering authentication, account switching, sign-out isolation, snapshot diffing, migration, storage recovery, match number reconciliation, rank progression derivation, input validation, and dialog event delegation.
- **Rules Suite (`npm run test:rules`)**: 40 emulator tests covering tenant data isolation, tombstone immutability, `getAfter()` write barriers, and schema validation.

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
│   ├── auth-ui.test.js         # Account panel and modal behavior
│   ├── email-auth.test.js      # Email linking and account merge flows
│   ├── google-auth.test.js     # Google linking, collisions, and popup handling
│   ├── multi-device-sync.test.js # Account sync and snapshot orchestration
│   └── signout-isolation.test.js # Session cleanup and account isolation
│   └── rules/                 # Firestore rules unit test specs
├── firestore.rules         # Server-enforced Firestore security rules
├── firestore.indexes.json  # Cloud Firestore composite indexes
├── firebase.json           # Firebase Hosting & Emulator configuration
├── CONTRIBUTING.md         # Contribution guidelines & architectural invariants
├── CODE_OF_CONDUCT.md      # Contributor Covenant Code of Conduct
├── DEVELOPMENT.md          # Maintainer guidance and architectural invariants
├── SECURITY.md             # Security policy and server-side rules specification
├── LICENSE                 # MIT License & Riot Games IP notice
└── package.json            # Tooling and test runner configuration
```

---

## Documentation Boundaries

To keep information organized and prevent redundant or conflicting documentation:

- **`README.md`**: Front door and public presentation for GitHub visitors, users, and prospective contributors.
- **`index.html` (Changelog Tab)**: Player-facing release notes detailing feature updates, UX polish, and fixes in plain language.
- **`CONTRIBUTING.md`**: Contribution guidelines, pull request checklist, and non-negotiable architectural invariants.
- **`CODE_OF_CONDUCT.md`**: Community standards, pledge, and enforcement procedures.
- **`DEVELOPMENT.md`**: Technical maintainer notes, architectural invariants, state machines, and testing guidelines.
- **`SECURITY.md`**: Security architecture specification, server-side rule invariants, and private vulnerability disclosure policies.
- **`docs/`**: Long-term architecture specifications, RFCs, and phase design records (strictly reserved; not modified during chore updates).

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting an issue or opening a pull request. It outlines our architectural invariants (zero build step, parse-time script order, local-first persistence) and verification workflow.

All contributors and community participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Changelog

User-facing release notes are integrated directly into the application in the **Changelog** tab (viewable by clicking the book icon in the navigation bar). For deep technical history and developer invariants, consult [DEVELOPMENT.md](DEVELOPMENT.md).

---

## License
 
The original source code and documentation of this project are open-source under the [MIT License](LICENSE).

VALORANT, Riot Games, and all associated properties, names, rank iconography, and game assets are trademarks or registered trademarks of Riot Games, Inc. and are not covered by the MIT license. See the [LICENSE](LICENSE) file for full terms and third-party intellectual property notices.

---

## Disclaimer

Valorant Challenge Tracker is an independent, community project. It is not affiliated with, endorsed, or sponsored by Riot Games, Inc. VALORANT and Riot Games are trademarks or registered trademarks of Riot Games, Inc. All reports and match statistics are user-generated.

