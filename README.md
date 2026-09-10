# Valorant Challenge Tracker

A local-first web app for tracking a personal VALORANT competitive challenge. Record matches, follow rank and RR progression, and review performance across agents, maps, and match metrics.

## Features

- Create and manage multiple rank-progression challenges.
- Record, edit, delete, import, filter, sort, and export match history.
- Track rank, RR, score, K/D/A, ACS, ADR, DDDelta, HS%, KAST%, and optional match details.
- Review overview charts, recent form, agent and map analytics, cross-analysis, and challenge signals.
- Export completed challenge reports as PDF, CSV, or JSON.
- Back up and restore all local challenge data.
- Use the tracker without an account or server: data is stored in the browser's local storage.

## Running locally

This is a static HTML, CSS, and JavaScript application. Open `index.html` in a browser, serve the repository with any static web server, or use the local Firebase emulator.

For example, using Python from the repository root:

```text
python -m http.server 8000
```

Then open `http://localhost:8000`.

Or using the local Firebase emulator:

```text
npm run emulators
```

Then open `http://localhost:5000`.

## Deployment

The application is hosted on Firebase Hosting:
- Live URL: [https://valorant-challenge-tracker.web.app](https://valorant-challenge-tracker.web.app)
- Deployment command: `npm run deploy` (requires Firebase CLI authentication)

## Data and privacy

Match and challenge data stays in the browser's local storage. Use the built-in backup action regularly if the data matters. Clearing browser storage or using a different browser or device does not carry local data over automatically. Cloud storage and authentication capabilities are planned in phases.

## Project structure

- `index.html` - application markup and the in-app changelog.
- `css/` - ordered stylesheet partials. Load order is significant; see `css/README.md`.
- `js/` - classic JavaScript modules loaded in dependency order from `index.html`.
- `assets/` - static visual assets such as rank images.
- `docs/` - planning, architecture specs, and design documentation.
- `firebase.json`, `.firebaserc` - Firebase Hosting and emulator configuration.
- `firestore.rules`, `firestore.indexes.json` - Firestore security rules and index definitions.
- `package.json` - developer tooling and test scripts (not shipped to browser).
- `DEVELOPMENT.md` - technical notes and maintainer guidance.

## Changelog

The user-facing changelog is maintained in the Changelog tab inside the application. It is intentionally written for players and users. Technical implementation notes belong in [DEVELOPMENT.md](DEVELOPMENT.md).

## Disclaimer

This is an independent project. It is not affiliated with or endorsed by Riot Games. Reports and match data are user-generated.

