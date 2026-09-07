# Development Notes

This document is for maintainers and contributors. It records implementation boundaries and local development conventions that do not belong in the player-facing README or in the in-app changelog.

## Architecture

The tracker is a static application with classic JavaScript files. Scripts share the global scope and are loaded synchronously in the order listed near the end of `index.html`. Script order is load-bearing because later files use functions and state created by earlier files.

The app stores challenges and matches in browser local storage. There is no required backend, account system, build step, or package manager.

## Source layout

- `js/constants.js` and `js/dom-utils.js` provide shared values and helpers.
- `js/storage.js`, `js/persistence.js`, and `js/challenge-state.js` own storage and active-challenge state.
- `js/match-*.js` files own match entry, validation, saving, importing, filtering, and rendering.
- `js/analytics-*.js`, `js/chart.js`, and `js/overview-panels.js` own analytical views.
- `js/navigation.js` owns page routing and sidebar state.
- `js/challenge-report.js` and `js/export.js` own report and data exports.
- `css/` contains ordered stylesheet partials. See `css/README.md` before changing load order.

## Data boundaries

Match History pagination, sorting, and filtering are presentation concerns. The canonical challenge match dataset remains independent from the table view. Overview charts and Analytics consume the canonical or range-scoped dataset; only the Match History renderer consumes the paginated slice.

Challenge membership is independent of the target match count. Matches recorded after the target remain associated with the challenge and continue to feed analytics. Displayed progress is capped at the target and separately reports additional recorded matches.

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

- `README.md` is the public project overview for GitHub and similar platforms.
- The Changelog tab in `index.html` contains concise user-facing release notes.
- `DEVELOPMENT.md` contains technical architecture and maintenance notes.
- `docs/` contains longer plans and design specifications.

Keep these boundaries when adding future release notes or implementation documentation.
