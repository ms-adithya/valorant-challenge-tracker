# Stylesheets

`styles.css` (736 dense lines, one of them 8,004 characters long) was split into the 28 partials in
this folder. They are linked individually from `index.html`.

## Load order is load-bearing

These files are **not** independent modules. Files `12-*` onward are historical override layers:
they deliberately re-declare selectors from earlier files in order to win the cascade. Loading them
out of order, or lazily, changes the rendered result.

The order in `index.html` is the order of the numeric prefixes. **Keep them in sync.** If you add a
file, give it a prefix that places it correctly, and add the `<link>` in the matching position.

| Range | Contents |
| --- | --- |
| `01`–`11` | Foundation: tokens, shell, typography, forms, page layouts, base components. |
| `12`–`28` | Override layers accumulated across app versions v5.3 → v10.1. |

## What the split changed

Nothing that renders. Verified by capturing the full computed style (93 properties) of every
element across 14 UI states — 5 pages, 6 modals, the setup screen, an open combobox and a toast —
at 1440 px, 900 px and 390 px, before and after: **0 differences** over ~3.5 million property
comparisons.

Two consolidations were applied, both provably cascade-safe:

- **The 6 `:root` blocks were merged into one** (`01-tokens.css`). They had drifted badly — `--line`
  was redefined 6 times, `--text` 6, `--panel2` 5, `--bg` 4. The merged block keeps the value that
  actually won. This is safe because custom properties cascade independently of where `var()` is
  referenced, and nothing else declares these names at `:root` specificity. The conditional
  `:root { --sidebar }` inside `@media (max-width: 1000px)` was left in place.
- **One adjacent pair of identical `@media (max-width: 760px)` blocks was merged.** Nothing sat
  between them, so nothing could change order.

## `.combo-field`

Five fields in the match-entry modal (agent, map, result, rank after, rank status) used to be
`<label class="agent-field">Agent <div class="agent-combobox">…</div></label>`. That is invalid:
`<label>`'s content model is phrasing content, so it may not contain a `<div>`, and the agent and
rank-after fields additionally held a *second* labelable control (their search inputs) besides the
label's own control.

They are now `<div class="agent-field combo-field"><label class="combo-label" for="agent">Agent</label>
<div class="agent-combobox">…</div></div>`.

Because the wrapper stopped being a `<label>`, it is added to every rule the old `<label>` matched,
**in place**, so the cascade position is unchanged:

| File | Rule |
| --- | --- |
| `04-forms.css` | `label, .combo-field` |
| `14-modal-form-v6.css` | `label, .combo-field` · `.match-grid label, .match-grid .combo-field` · `#modal .combo-field:has(#…)` for flex `order` |
| `17-match-entry-v7.css` | `#modal .match-grid>label, #modal .match-grid>.combo-field` |
| `18-dashboard-v76.css` | `#modal label, #modal .combo-field` |

The inner `.combo-label` needs no rules of its own: `.match-grid label` already gives it the same
typography the bare text node inherited.

Verified with a geometry probe (bounding rect + 12 computed properties) over the modal and all five
open dropdowns at 1440/900/620/390 px, animations frozen: **0 differences** across 1,002 keys per
viewport.

## Known debt (not addressed — would change the cascade)

Fixing these means rewriting the override stack, which cannot be done without altering rendering.
They are listed here so the cost is visible rather than rediscovered:

- **103 `!important` declarations.** Mostly specificity escalation between override layers.
- **Duplicate selectors.** `#modal .modal-card` is declared 8 times, `body` 5, `.modal-card` 5,
  `.primary` 4.
- **26 duplicate `@media` conditions across 13 breakpoints**, scattered rather than grouped. Only
  the one adjacent pair could be merged safely; the other 25 would have to move past intervening
  rules. Several breakpoints are near-duplicates that could likely collapse — 620/650, 680/700,
  720/760 — but that is a design decision, not a mechanical one.

The standards-correct fix for the `!important` problem is **cascade layers** (`@layer`): wrap the
foundation and each override era in named layers, and later layers win on order alone, with no
specificity war and no `!important`. That is a deliberate cascade rewrite and needs its own
before/after verification pass.

## Production note

28 `<link>` tags means 28 requests. That is fine for local use and keeps the cascade explicit and
debuggable. If this is ever deployed, concatenate them **in this exact order** at build time.
