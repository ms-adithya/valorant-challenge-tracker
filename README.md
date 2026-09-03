## v9.4 — Match save reliability
- Fixed Add/Edit Match getting stuck on Checking… after submit.
- Match-number collision checks now normalise imported/string match numbers.
- Save handler now always restores button state, including unexpected validation/storage/UI errors.
- Optional RR fallback uses the chronologically previous match rather than the last array entry.

# Valorant Challenge Tracker v8.0

Adds reference-driven Accuracy, Role Performance and Top Agents analytics plus denser match-history presentation. All new analytics are derived from existing tracker data. Body/leg hit counts are deliberately not fabricated from HS%.

## Changelog policy

Starting with v8.1, the application includes a dedicated **Changelog** navigation tab. Patch notes are cumulative: future releases should append a new entry and keep previous release notes available in expandable sections, similar to a game update feed.

### v8.1
- Added dedicated Steam-style expandable Changelog UI.
- Preserved prior README/development notes inside the in-app changelog.
- Added Top Maps ranked-performance presentation to the analytics design direction.
- Retained v8.0 competitive analytics and dashboard improvements.

### v8.2
- Fixed the missing visible Changelog sidebar navigation entry.
- Added a dedicated Top Maps analytics panel with WR, W/L/D record, ranking and View All Maps expansion.
- Top Maps derives its values from stored match data rather than hard-coded demo statistics.

### v8.3
- Fixed Top Maps leaking into the Matches page; it is now contained exclusively inside Analytics.
- Reordered Analytics for a clearer information hierarchy and reading flow.
- Rebuilt Changelog as a real sidebar page using the same router as the rest of the app.
- Changelog remains accessible even when no challenge is active and preserves prior patch history.

### v8.4
- Fixed challenge-form native reload on an invalid target-rank validation path.
- Replaced remaining normal-flow browser alerts with tracker-native notice UI.
- Added non-blocking success feedback for challenge creation, match saves and backup restore.
- Polished sidebar navigation, cards, tables, modals, Top Maps and Changelog presentation.
- Preserved Top Maps exclusively within Analytics and retained the v8.3 analytics flow.

### v8.5
- Added Matches → Import matches.
- Supports CSV, TSV and compatible JSON match files.
- Tracker-exported CSV files can be imported back directly.
- Added pre-import preview with row-level validation; invalid files are blocked before any match is saved.
- Imported rows use the same score, rounds, percentage, non-negative stat, RR and rank-progression rules as manual match entry.

### v8.6
- Reorganised Add/Edit Match with a collapsible Advanced options section above Notes.
- RR after match, RR change, first kills, first deaths, multi kills and rounds played are now optional advanced fields.
- Core match and performance inputs stay visible for faster entry.

### v8.7
- Fixed Advanced options placement in Add/Edit Match.
- Advanced options now appears immediately above Notes, after all standard match fields.
- Opening Advanced options keeps the section header visible using nearest-position modal scrolling.

### v8.8
- Fixed Advanced Options at the CSS grid-order layer.
- It now appears immediately above Notes.
- Removed forced scrolling when Advanced Options expands.

### v8.9
- Reworked match modal scrolling: the overlay stays fixed while the card scrolls internally.
- Expanded Advanced Options can no longer push the modal top/header outside the viewport.
- Internal scrollbar remains hidden while wheel/touch scrolling continues to work.

### v9.0
- Fixed all Match Import review dismissal paths: Cancel, ×, backdrop and Escape.
- "Fix file to import" now closes the review and opens the file picker again.
- RR After / RR Change are optional during import, matching Advanced Options in the match form.
- Optional RR values are validated only when present.


## v9.6 — Optional RR data integrity

- Missing RR After / RR Change are preserved as optional null values rather than converted to zero.
- Overview, recent matches, progression charts and RR-per-match insights no longer display `null`, `+null`, or fabricated zero RR.
- Legacy null-like optional numeric values are normalised when data loads.
- Match IDs remain stable after deletion and new matches choose the lowest unused positive number.
- Changelog current-version indicator now matches the shipped build.

## v9.1 — Import numbering & editable match IDs
- Match numbers are editable in Add/Edit Match and must remain unique positive integers.
- Imports preserve a supplied unused match number.
- Missing, invalid, duplicate, or already-used imported numbers are reassigned to the lowest available match number.
- Bulk assignment reserves numbers across the entire import so imported rows cannot collide with each other.
- Import review shows preserved/reassigned numbering and lets the user edit each proposed match number before import.
- Valid rows can be imported even when other rows need attention; invalid rows are skipped.
- Match history is sorted by match number after saves/imports and analytics are recalculated from the resulting history.


## v9.3 — Import review reliability & UX
- Fixed the bulk **Import valid matches** action not firing. The modal is rendered after the main script, so the handler now uses delegated event handling.
- Added guarded import state to prevent accidental double-imports.
- Rebuilt the review modal into a fixed header / scrollable rows / fixed action footer layout.
- Replaced the oversized native bulk checkbox with a compact tracker-styled control.
- Improved row spacing, match-number editing, status alignment, responsive behaviour, close control, and error readability.
- Valid rows can be imported while invalid rows are skipped when **Import ready only** is enabled.


## v9.7 — Dynamic analytics
- Analytics range selector (All / Last 5 / 10 / 20).
- Shot accuracy uses actual match IDs instead of sequential chart positions.
- Agent usage is deterministically ordered by pick count, then agent name.
- Analytics summary meters now reflect data rather than decorative fixed widths.

## v9.8 — Analytics range consistency
- The global Analytics View range now applies consistently to Role performance, Top agents, Top maps, Agent usage, Map rotation, Win rate by agent, and Win rate by map.
- Top analytics ADR/ACS/DDΔ are calculated from the selected range rather than the full challenge.
- Changing the range rerenders every range-aware analytics component in one pass.

- Match Result now uses the custom dropdown UI (Win / Loss / Draw) with keyboard navigation and no search field.

- Duplicate match numbers in Add/Edit Match now trigger an on-screen toast, highlight/focus the Match number field, and prevent saving until an unused number is entered.

- Hardened duplicate Match # feedback: duplicate saves now show both the in-modal validation notice and an error toast above the modal, while focusing the conflicting Match number field.

- Fixed manual saves into Match History number gaps. Match-number uniqueness now checks only actual matches in the currently open challenge.
- Deleted/missing IDs and IDs from other/archived challenges do not reserve a number.
- Match-number availability is checked live while editing the Match number field; gaps such as #5–#24 remain reusable when absent.

- CSS structure cleanup: all embedded `<style>` blocks were moved out of `index.html` into `styles.css`.
- `index.html` now contains structure/content only; no inline style attributes or embedded style blocks remain.
- Audited HTML IDs for uniqueness and removed exact duplicate CSS rule blocks while preserving intentional cascade/media-context overrides.

- Fixed the Match History Sort & Filter regression that could hide all existing matches. Filtering now operates only on the rendered table and preserves stored match history.

- Fixed Match History rendering after Sort & Filter: the filter-option builder referenced a missing HTML-escape helper, throwing before table rows could render. Added the helper and hardened legacy/incomplete match-row rendering.

### v10.1 — Stability & interface polish
- Restored compatibility for validation/report HTML escaping and hardened local persistence failures.
- Match History sorting/filtering now keeps the complete stored dataset intact and clearly reports visible/total rows and active filters.
- Overview trend and RR charts use actual Match History numbers, preserve numeric gaps, and keep real match IDs in tooltips.
- Current rank and Recent Matches derive from actual match-number order rather than insertion order.
- Optional overview metrics remain unavailable (`—`) when not recorded instead of being represented as zero.
- Added sticky table headers/actions, improved horizontal scrolling, keyboard focus, reduced-motion support, and responsive filter/toolbar behaviour.

### Match History pagination boundary
Match History pagination is presentation-only. The canonical challenge match dataset remains independent from table filters, sorting, page size, and current page. Overview charts and Analytics consume the canonical/range-scoped dataset; only the Match History renderer consumes the paginated slice. This prevents 25/50-row table settings from changing statistics or charts on large challenges.

## Challenge completion model (v10.1 maintenance)

- Challenge membership is independent of the target match count. Matches recorded after the target remain part of the challenge and continue to feed analytics/charts.
- Displayed progress is capped at the target. A 5-match challenge with 8 associated matches displays `5 / 5 completed · 3 additional matches`.
- Completed challenges persist `completedAtMatchId`, the Match # that crossed the target boundary (derived from challenge-associated matches in numeric Match # order for migrated/imported data), plus `completedAt` when a match timestamp is available.
- Challenge History distinguishes target completion from total membership: `Completed · 5/5 · 8 recorded matches`.
- Match History pagination remains presentation-only and never scopes the analytical dataset.
- Rank progression semantics are intentionally unchanged in this maintenance update.

### Rank/RR progression runtime model (v10.1 stability architecture)

Rank/RR progression now has a centralized, provenance-aware runtime normalization layer via `rebuildChallengeRankProgression(challenge)`. Existing match fields (`rankStatus`, `rankAfter`, `rrAfter`, `rrChange`) remain the persisted user/import facts; derived states are intentionally not written back to storage.

Priority is **recorded > safely derived > unknown**. Missing RR remains null/unknown, same-rank RR can be derived only when arithmetic is unambiguous, missing links stop the derivation chain, and a later recorded RR-after value starts a new anchor. Placement and rank-boundary transitions do not guess RR arithmetic. The runtime state records before/change/after values with `recorded`, `derived`, or `unknown` provenance and is rebuilt after challenge mutations/persistence and when current rank state is requested.
