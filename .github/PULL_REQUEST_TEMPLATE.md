## Summary

<!-- Briefly describe the changes in this pull request and the motivation behind them. -->

## Type of Change

- [ ] `feat`: New feature or functionality
- [ ] `fix`: Bug fix
- [ ] `docs`: Documentation updates
- [ ] `test`: New or updated tests
- [ ] `chore`: Maintenance, dependencies, or configuration

## Architectural Invariant Checklist

All PRs must adhere to the non-negotiable architectural invariants defined in [CONTRIBUTING.md](../CONTRIBUTING.md):

- [ ] **Zero Build Step**: Pure static HTML/CSS and vanilla JS runtime. No bundlers, transpilers, or frontend frameworks added.
- [ ] **Script Order Integrity**: Classic script tag order in `index.html` preserved. No `async` or `defer` added to existing scripts. Modals and dynamic UI use delegated event listeners.
- [ ] **Local-First Persistence**: `persist()` writes directly to `localStorage` first. Firestore sync is additive, non-blocking, and resilient to network drops.
- [ ] **Firestore Rules & Batch Limits**: If cloud sync/rules are touched, batched writes respect the $\le 400$ op limit, and challenge/match deletions atomically couple with `getAfter()` tombstones.
- [ ] **Documentation Boundaries**: No `.md` files inside `docs/` have been modified (reserved for long-term design specs).

## Verification & Testing

- [ ] Automated unit and failure-path tests pass (`npm test` — 76 tests).
- [ ] Firestore Security Rules emulator tests pass (`npm run test:rules` — 35 tests, if `firestore.rules` was modified).
- [ ] Manual verification completed across desktop and mobile viewport sizes.

## Related Issues

<!-- Link any related issues or discussions (e.g., Closes #123) -->
