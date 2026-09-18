# Contributing to Valorant Challenge Tracker

Thank you for your interest in contributing to Valorant Challenge Tracker!

To keep the application fast, lightweight, and reliable for all players, this project operates under strict architectural and documentation invariants. Please review this guide before submitting issues or opening pull requests.

---

## Architectural Invariants (Non-Negotiable)

1. **Zero Build Step / Pure Vanilla JS**:
   - Do **NOT** introduce bundlers (Webpack, Vite, Rollup), transpilers, or frontend frameworks (React, Vue, etc.).
   - The browser runtime must remain pure static HTML, CSS, and vanilla JavaScript that executes directly in the browser without compilation.

2. **Load-Bearing Script Order in `index.html`**:
   - Classic scripts in `index.html` execute synchronously in parse-time order and share the global scope.
   - Do **NOT** mark existing `<script>` tags as `async` or `defer`.
   - Modals and dynamic UI elements must use delegated event listeners (`document.addEventListener('click', ...)`) rather than parse-time query selectors.

3. **Local-First Persistence Contract**:
   - `persist()` must always commit to browser `localStorage` first. Cloud synchronization to Firestore is additive, non-blocking, and transparent.

4. **Server-Enforced Authority in Firestore**:
   - Security and data integrity are enforced at the Firestore Security Rules boundary (`firestore.rules`).
   - Challenge and match deletions require atomic `getAfter()` tombstone coupling under `meta/tombstones`.
   - Batch writes must respect the operation-bounded chunking limit ($\le 400$ operations per batch).

5. **Strict Documentation Boundaries**:
   - **`README.md`**: Public overview and front door for GitHub visitors.
   - **`index.html` (Changelog Tab)**: Player-facing release notes explaining gameplay improvements.
   - **`CONTRIBUTING.md`**: Contribution guidelines, pull request checklist, and non-negotiable architectural invariants.
   - **`CODE_OF_CONDUCT.md`**: Community standards, pledge, and enforcement procedures.
   - **`DEVELOPMENT.md`**: Technical architecture, maintainer guidance, and engineering invariants.
   - **`SECURITY.md`**: Security policy, server-enforced architecture details, and vulnerability reporting procedures.
   - **`docs/`**: Long-term architecture specifications and design records (strictly reserved; do not modify in routine PRs).

---

## Local Development & Testing

### Running the App Locally
You can serve the static files with any local HTTP server:

```bash
# Using Python 3
python -m http.server 8000

# Or using VS Code Live Server
```

### Running Tests
All contributions must pass the automated test suites before being merged:

```bash
# Run pure unit & failure path tests (124 tests)
npm test

# Run Firestore Security Rules tests via emulator (40 tests, requires Java 21)
npm run test:rules
```

---

## Pull Request Guidelines

1. **Branch Naming**:
   - Create a dedicated feature or fix branch from `main`:
     - `feat/feature-name`
     - `fix/bug-description`
     - `docs/documentation-update`
     - `chore/task-name`
2. **Commit Conventions**:
   - Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
   - Keep commits atomic, well-described, and focused on a single change.
3. **Checklist Before Submitting**:
   - [ ] No new npm runtime dependencies or build tools introduced.
   - [ ] Script order in `index.html` preserved.
   - [ ] All 124 unit/failure tests pass (`npm test`).
   - [ ] All 40 security rules tests pass (`npm run test:rules`) if `firestore.rules` was modified.
   - [ ] No `.md` files in `docs/` modified.
   - [ ] Adhere to the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Code of Conduct

We are committed to providing a welcoming, diverse, and harassment-free community. All contributors and participants are required to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported to [adithyams64203@gmail.com](mailto:adithyams64203@gmail.com).

---

## Reporting Issues

- **Bug Reports**: Please use our [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) and include browser name/version, steps to reproduce, and console errors (F12).
- **Feature Requests**: Please use our [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md) to propose enhancements aligned with the tracker's zero-build-step philosophy.
- **Security Vulnerabilities**: Do **not** open public issues. Follow our private disclosure policy in [SECURITY.md](SECURITY.md).

