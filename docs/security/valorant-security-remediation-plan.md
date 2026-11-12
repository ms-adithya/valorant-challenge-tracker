# Valorant Challenge Tracker --- Security Remediation Plan

**Source basis:** Current uploaded `valorant-challenge-tracker.zip` and
CodeRabbit Security Findings Report generated 6 Oct 2026.

**Purpose:** Provide a detailed, implementation-ready remediation plan
for the 18 reported security findings without treating every finding as
an independent fix.

**Important:** This document is a plan only. It does not prescribe
making changes immediately. Existing application behavior, cloud
architecture, Firestore rules, migration behavior, and test contracts
should be preserved unless a task explicitly requires a security
boundary change.

------------------------------------------------------------------------

## 1. Executive remediation strategy

The 18 CodeRabbit findings should be consolidated into six engineering
workstreams:

  ------------------------------------------------------------------------
  Priority          Workstream         Findings          Primary risk
  ----------------- ------------------ ----------------- -----------------
  P0                Identity/session   16, 17            Cross-account
                    ownership                            data exposure /
                                                         unauthorized
                                                         synchronization

  P0                Safe DOM rendering 1, 2, 4, 5, 7, 8  Stored/imported
                                                         XSS

  P0                Remove inline      3, 9, 13, 14      XSS through
                    JavaScript                           executable HTML
                    handlers                             attributes

  P1                Import/resource    6, 11, 12         Browser resource
                    budgets                              exhaustion

  P1                PDF/report         10                Browser/PDF
                    resource budget                      resource
                                                         exhaustion

  P1                CSV formula        15, 18            Spreadsheet
                    neutralization                       formula injection
  ------------------------------------------------------------------------

The recommended order is deliberate:

1.  Establish a reliable identity/state ownership boundary.
2.  Remove executable HTML/JavaScript sinks.
3.  Add bounded processing for attacker-controlled input.
4.  Harden export boundaries.
5.  Run the full security/regression verification suite.
6.  Re-scan and reconcile each CodeRabbit finding.

------------------------------------------------------------------------

# 2. Global rules for all remediation work

Before beginning individual tasks, preserve these project constraints.

## 2.1 Do not rewrite the architecture unnecessarily

The current project is vanilla HTML/CSS/JS with Firebase/Firestore cloud
synchronization.

Do not introduce a framework, bundler, or large rendering abstraction
merely to solve these findings.

Prefer small, local security utilities and existing project patterns.

## 2.2 Preserve established identity semantics

Challenge IDs are opaque identifiers.

Do not:

-   rewrite existing IDs;
-   migrate `c_` IDs to `ch_`;
-   change `matchId` semantics;
-   change the meaning of `no` as the display ordinal.

New runtime challenge IDs use the canonical `ch_` generator.

## 2.3 Preserve Firestore security boundaries

The Firestore rules remain the server-side authorization boundary.

Client-side changes must not weaken:

-   UID scoping;
-   challenge/match validation;
-   tombstone protection;
-   protected Riot fields;
-   server-authoritative conflict behavior.

## 2.4 Treat imported data as hostile

Anything originating from:

-   JSON backup;
-   CSV;
-   TSV;
-   restored challenge data;
-   imported match data;
-   archived challenge data;
-   user-controlled notes, names, IDs, labels;

must be considered untrusted until it reaches a safe output boundary.

Validation answers:

> "Is this value acceptable application data?"

It does **not** answer:

> "Is this value safe to put into HTML, JavaScript, or a spreadsheet?"

## 2.5 Security fixes must include regression tests

Every remediation task should add or update tests for:

-   the vulnerable input;
-   the safe behavior;
-   a regression case preventing reintroduction.

Do not rely solely on CodeRabbit re-scanning.

------------------------------------------------------------------------

# 3. P0 Workstream A --- Identity/session ownership

## Findings

-   Finding 16 --- Authorization bypass
-   Finding 17 --- Sensitive data exposure

## Root problem

Authentication transitions do not establish a sufficiently strong
ownership boundary between:

-   records currently in memory;
-   localStorage/session state;
-   the previous authenticated UID;
-   the newly authenticated UID;
-   asynchronous cloud synchronization work.

The current cloud synchronization intentionally preserves local records
when an initial server snapshot is empty in order to support
migration/local-first behavior.

That behavior becomes dangerous during an account transition because an
empty destination snapshot can be mistaken for permission to synchronize
whatever records remain in memory.

The two findings are therefore treated as one identity/state-ownership
problem.

------------------------------------------------------------------------

## Task A1 --- Map the authentication state machine

Before changing code, document the current transitions:

1.  anonymous → authenticated;
2.  authenticated A → sign out;
3.  authenticated A → authenticated B;
4.  authenticated → reload;
5.  authenticated → second tab;
6.  anonymous local records → authentication;
7.  authentication → merge approval;
8.  authentication → merge rejection;
9.  authentication → empty remote snapshot;
10. old async cloud operation completes after identity changes.

Identify, for every transition:

-   current UID;
-   state currently in memory;
-   localStorage contents;
-   `activeChallenges`;
-   `archives`;
-   `data`;
-   `window.VCT.pendingMerge`;
-   cloud listener state;
-   pending push state;
-   hydration state;
-   asynchronous callbacks still capable of mutating state.

### Acceptance criteria

A written transition table exists before implementation begins.

No code changes are made solely from assumptions about the current
lifecycle.

------------------------------------------------------------------------

## Task A2 --- Introduce explicit session/identity ownership

Establish an explicit concept of the current cloud session.

At minimum, the design should be able to answer:

> "Which UID/session owns the records currently in memory?"

The state should not be considered synchronizable merely because
`lastSyncedSnapshot` is empty.

The ownership state should distinguish at least:

-   no authenticated owner;
-   authenticated owner;
-   approved transfer into the owner;
-   local anonymous data awaiting an explicit transfer decision.

### Acceptance criteria

A destination UID cannot inherit previous-account records merely because
its remote snapshot is empty.

------------------------------------------------------------------------

## Task A3 --- Add session-generation invalidation

Introduce a monotonically changing session generation/token when
authentication identity changes.

Every asynchronous operation that can mutate application state should
validate that it still belongs to the active session before applying
results.

Conceptually:

``` text
start session A
    ↓
async operation A begins
    ↓
session changes to B
    ↓
session generation changes
    ↓
operation A completes
    ↓
operation A must be ignored
```

This should cover cloud hydration/listener callbacks and any other
asynchronous state application discovered during the lifecycle audit.

### Acceptance criteria

A delayed callback from UID A cannot apply UID A's records after UID B
becomes current.

A delayed callback from an old anonymous/authentication state cannot
overwrite the current session.

------------------------------------------------------------------------

## Task A4 --- Separate migration from account switching

The current "empty remote snapshot preserves local state" behavior
exists for a legitimate migration/local-first use case.

Do not simply delete that behavior.

Instead, make the decision conditional on ownership context.

Conceptually:

``` text
First-ever local migration
    → local records may be retained for migration

Approved account transfer
    → incoming local records may be retained

Rejected account transfer
    → incoming records must be cleared/quarantined

Existing authenticated account switching
    → previous owner's records must not become destination state
```

### Acceptance criteria

Migration still works.

Approved transfer still works.

Rejected transfer cannot result in a later cloud upload.

Account switching cannot carry previous-account records into the
destination UID.

------------------------------------------------------------------------

## Task A5 --- Harden rejected transfer handling

When the user rejects a transfer/merge:

1.  explicitly mark the incoming local state as not authorized for
    destination synchronization;
2.  clear or quarantine those records;
3.  prevent `pushChanges()` from treating them as destination-owned;
4.  clear pending merge state;
5.  only then allow destination cloud synchronization.

### Acceptance criteria

Reproducing Finding 16's scenario does not create destination-account
documents from rejected incoming records.

A later save cannot resurrect rejected records under the destination
UID.

------------------------------------------------------------------------

## Task A6 --- Harden sign-out and cross-tab behavior

The existing `purgeLocalSession()` behavior should remain.

Extend the security model so that:

-   memory state;
-   UI views;
-   localStorage cache;
-   cloud listeners;
-   pending async operations;

all become invalid for the old identity.

Pay particular attention to multiple tabs because Firestore persistence
supports multi-tab behavior.

### Acceptance criteria

After sign-out, another surviving tab cannot continue displaying or
exporting the previous user's records as if they belonged to the new
identity.

An old tab cannot synchronize previous-account records after a new
identity becomes active.

------------------------------------------------------------------------

## Task A7 --- Identity transition tests

Add tests for at least:

1.  A → sign out → B;
2.  A → B with B empty;
3.  anonymous records → login → reject transfer;
4.  anonymous records → login → approve transfer;
5.  A callback completes after B becomes current;
6.  old listener fires after identity change;
7.  second tab retains stale state;
8.  local cache from A exists when B authenticates;
9.  rejected records cannot be pushed later;
10. destination empty snapshot does not authorize old state.

### Exit criteria

All identity tests pass.

Existing cloud-sync tests remain green.

Firestore rules tests remain green.

------------------------------------------------------------------------

# 4. P0 Workstream B --- Safe DOM rendering

## Findings

-   Finding 1
-   Finding 2
-   Finding 4
-   Finding 5
-   Finding 7
-   Finding 8

## Root problem

Imported agent/map/label strings reach `innerHTML`.

The safe direction is:

``` text
untrusted string
    ↓
DOM textContent / safe property
```

rather than:

``` text
untrusted string
    ↓
HTML source
```

------------------------------------------------------------------------

## Task B1 --- Inventory every affected HTML sink

Search the entire project for:

``` text
innerHTML
outerHTML
insertAdjacentHTML
template literals containing imported fields
```

Then classify each occurrence:

-   fixed/trusted HTML;
-   application-controlled enum;
-   imported/user-controlled string;
-   imported/user-controlled identifier;
-   mixed trusted/untrusted template.

The report explicitly identifies the following affected locations:

-   `js/analytics-panels.js`
-   `js/import-preview.js`
-   `index.html` top-map renderer

The inventory must verify whether additional equivalent sinks exist
outside the reported locations.

### Acceptance criteria

Every dynamic HTML sink has an explicit trust classification.

No imported string is assumed safe merely because it passed validation.

------------------------------------------------------------------------

## Task B2 --- Refactor top-agents rendering

Affected renderer:

-   `renderTopAgents`

Replace direct interpolation of:

-   agent name;
-   best map name;
-   initials/labels derived from imported data;

with DOM construction and `textContent`.

Fixed structure/classes can remain application-controlled.

### Acceptance criteria

Agent and map names are rendered literally.

A value such as:

``` text
<img src=x onerror=...>
```

appears as text and cannot create an element.

------------------------------------------------------------------------

## Task B3 --- Refactor distribution rendering

Affected renderer:

-   distribution cards

Keep grouping/aggregation logic unchanged.

Only change the rendering boundary.

Imported names must become text nodes.

### Acceptance criteria

Agent/map labels cannot introduce HTML.

Existing visual output remains functionally equivalent.

------------------------------------------------------------------------

## Task B4 --- Refactor win-rate bars

Affected renderer:

-   win-rate bars

The report identifies both:

-   element body;
-   `title` attribute;

as dynamic contexts.

Use:

-   `textContent` for displayed text;
-   DOM property assignment for `title`.

Do not solve this by adding increasingly complicated nested escaping
unless there is a strong reason to retain the template.

### Acceptance criteria

Names containing quotes, angle brackets, entities, and
event-handler-like text remain inert.

Tooltip behavior remains intact.

------------------------------------------------------------------------

## Task B5 --- Refactor top-maps renderer

Affected location:

-   `index.html`

Replace imported map-name interpolation with a DOM-safe rendering path.

The current map aggregation logic should remain unchanged.

### Acceptance criteria

Imported map names cannot create markup or event handlers.

------------------------------------------------------------------------

## Task B6 --- Import preview must be safe before validation/commit

Affected:

-   `js/import-preview.js`

This is especially important because the preview occurs before import
commit.

All dynamic values in the preview must be rendered as text:

-   agent;
-   map;
-   rank status;
-   correction/original text;
-   any other imported display value.

### Acceptance criteria

A malicious import cannot execute code merely by selecting the file.

The preview still displays rejected/adjusted rows correctly.

------------------------------------------------------------------------

## Task B7 --- Add DOM XSS regression tests

Tests should cover:

-   `<img onerror>`;
-   `<svg onload>`;
-   quote-breaking values;
-   HTML entities;
-   `javascript:`-like strings;
-   strings containing `onclick=`;
-   strings containing backticks;
-   strings containing `</div>`;
-   strings containing apostrophes and double quotes.

### Exit criteria

All affected renderers use safe output boundaries.

No imported text reaches executable HTML through the affected renderers.

------------------------------------------------------------------------

# 5. P0 Workstream C --- Eliminate inline JavaScript handlers

## Findings

-   Finding 3
-   Finding 9
-   Finding 13
-   Finding 14

## Root problem

Imported challenge/archive IDs are embedded into executable inline
JavaScript:

``` text
onclick="someFunction('${attackerControlledId}')"
```

The current escaping helper attempts to protect JavaScript string
syntax, but the value passes through an HTML attribute context first.

The safest design is not to serialize data into executable JavaScript at
all.

------------------------------------------------------------------------

## Task C1 --- Inventory all inline event handlers

Search for:

``` text
onclick=
onchange=
oninput=
onload=
```

and identify every handler containing dynamic values.

Classify:

-   trusted static value;
-   imported identifier;
-   imported display string;
-   application-generated ID.

### Acceptance criteria

Every dynamic inline handler is accounted for.

------------------------------------------------------------------------

## Task C2 --- Refactor archive actions

Affected:

-   `js/challenge-archive.js`

Replace inline handlers used by:

-   download report;
-   open challenge;
-   archive challenge;
-   delete challenge.

Use DOM event listeners.

Store identifiers as:

-   `dataset`;
-   DOM properties;
-   closures;
-   or another non-executable data channel.

### Acceptance criteria

Challenge IDs are never serialized into JavaScript source.

Existing action behavior remains unchanged.

------------------------------------------------------------------------

## Task C3 --- Refactor archive browser delete

Affected:

-   `js/navigation.js`

Replace:

``` text
onclick="deleteArchivedChallenge(...)"
```

with a delegated or direct event listener.

Pass the ID as data, not source code.

### Acceptance criteria

Crafted archive IDs cannot become executable JavaScript.

------------------------------------------------------------------------

## Task C4 --- Refactor setup restore delete

Affected:

-   `js/setup-restore.js`

Use the same safe event/data pattern.

Avoid creating a second custom escaping scheme.

### Acceptance criteria

Restore-panel delete actions work normally without inline executable
handlers.

------------------------------------------------------------------------

## Task C5 --- Refactor remaining challenge action handlers

Search again after the initial changes.

Do not stop at the four CodeRabbit locations if equivalent patterns
remain.

### Acceptance criteria

No attacker-controlled identifier is interpolated into an inline
JavaScript handler.

------------------------------------------------------------------------

## Task C6 --- Retire unsafe helper usage where appropriate

Once all relevant callers are removed, determine whether:

``` text
escapeJsSingleQuoted()
```

is still needed.

Do not delete it blindly.

If unused after the migration, remove it and update tests.

If still legitimately needed in a non-HTML context, document that
context.

------------------------------------------------------------------------

# 6. P1 Workstream D --- Import/resource budgets

## Findings

-   Finding 6 --- analytics matrix
-   Finding 11 --- importer expansion
-   Finding 12 --- score regex

The common principle is:

> Attacker-controlled input must have explicit size/complexity limits
> before expensive synchronous work.

------------------------------------------------------------------------

## Task D1 --- Define application-wide import limits

Establish explicit limits for:

-   maximum import file size;
-   maximum JSON backup size;
-   maximum CSV/TSV rows;
-   maximum CSV/TSV columns;
-   maximum field length;
-   maximum challenge name length;
-   maximum agent name length;
-   maximum map name length;
-   maximum notes length;
-   maximum score-string length.

Choose limits based on actual application requirements, not arbitrary
tiny values.

### Acceptance criteria

Limits are documented in code/tests.

Every import path applies them before expensive processing.

------------------------------------------------------------------------

## Task D2 --- Harden CSV/TSV parsing

Before:

``` text
Object.fromEntries(...)
```

enforce:

-   file-size limit;
-   header count limit;
-   row count limit;
-   row width limit.

Only construct recognized match fields where possible.

Do not allocate arbitrary attacker-controlled object shapes
unnecessarily.

### Acceptance criteria

A file with millions of headers/rows is rejected before large object
allocation.

Normal exported/imported files continue to work.

------------------------------------------------------------------------

## Task D3 --- Harden score normalization

Before regex processing:

1.  convert to string;
2.  enforce maximum length;
3.  use a bounded grammar;
4.  prefer an anchored parser where practical.

Avoid searching arbitrary-length attacker-controlled strings for a score
pattern.

### Acceptance criteria

Oversized score strings are rejected quickly.

Valid scores still parse exactly as before.

A stress test demonstrates bounded behavior.

------------------------------------------------------------------------

## Task D4 --- Replace analytics Cartesian scanning

Current conceptual pattern:

``` text
agents × maps × full match collection
```

Refactor to:

``` text
single pass over matches
        ↓
aggregate observed agent/map pairs
        ↓
apply dimension/cell limits
        ↓
render bounded result
```

Possible protections:

-   maximum agent dimensions;
-   maximum map dimensions;
-   maximum displayed cells;
-   pagination;
-   truncation with a clear UI message.

Do not silently drop data without communicating that the view was
bounded.

### Acceptance criteria

A malicious dataset cannot force unbounded `A × M × N` synchronous work.

Normal datasets produce equivalent statistics.

------------------------------------------------------------------------

## Task D5 --- Add stress tests

Include:

-   maximum valid file;
-   just-over-limit file;
-   huge header count;
-   huge row count;
-   huge field;
-   huge score string;
-   many unique agents;
-   many unique maps;
-   maximum matrix dimensions.

### Exit criteria

All bounded processing tests pass.

No test requires generating unreasonably large fixtures in the
repository.

------------------------------------------------------------------------

# 7. P1 Workstream E --- PDF/report resource budget

## Finding

-   Finding 10

## Root problem

Imported challenge names can be written repeatedly on every generated
PDF page, while imported match labels can increase page count.

------------------------------------------------------------------------

## Task E1 --- Establish report limits

Define limits for:

-   challenge name display length;
-   match count;
-   report page count;
-   report text volume;
-   generated PDF size where practical.

These should reflect realistic tracker usage.

------------------------------------------------------------------------

## Task E2 --- Bound footer/stamp text

The footer/stamp should use a fixed display-length representation.

Do not repeatedly serialize arbitrarily long imported challenge names.

Preserve the original full name in application data if needed; only the
PDF display representation should be bounded.

### Acceptance criteria

Long challenge names cannot multiply PDF output size through repeated
full-length footer text.

------------------------------------------------------------------------

## Task E3 --- Bound report pagination

Before or during generation, enforce a practical page/report budget.

If exceeded:

-   stop generation safely;
-   show a clear user-facing message;
-   avoid producing a partially misleading report.

### Acceptance criteria

A maliciously oversized backup cannot force unbounded report generation.

------------------------------------------------------------------------

## Task E4 --- PDF stress tests

Test:

-   very long challenge name;
-   many matches;
-   large combination of long labels + many pages;
-   just-over-limit report.

------------------------------------------------------------------------

# 8. P1 Workstream F --- CSV formula neutralization

## Findings

-   Finding 15
-   Finding 18

## Root problem

The current CSV serializer provides CSV quoting but does not establish a
policy that untrusted text must remain literal when opened by
spreadsheet software.

------------------------------------------------------------------------

## Task F1 --- Define the export threat model

Identify untrusted text fields:

-   notes;
-   agent names;
-   map names;
-   challenge names;
-   other imported strings.

Identify trusted numeric fields separately.

Do not formula-neutralize legitimate numeric values unnecessarily.

------------------------------------------------------------------------

## Task F2 --- Define one shared neutralization policy

The policy should address formula-like prefixes and relevant leading
whitespace/control-character cases.

It must be consistent across:

-   match CSV export;
-   challenge CSV export;
-   any future CSV exporter.

Do not create separate slightly different policies in different files.

------------------------------------------------------------------------

## Task F3 --- Apply the policy at the CSV export boundary

The best boundary is the conversion from untrusted text to
spreadsheet-facing CSV cell content.

Keep internal stored data unchanged.

Do not corrupt imported data simply because it may later be exported.

### Acceptance criteria

A stored value beginning with a spreadsheet formula prefix is exported
as literal text.

The same policy is used by all CSV exporters.

------------------------------------------------------------------------

## Task F4 --- Test against supported spreadsheet behavior

Create regression cases for prefixes such as:

``` text
=
+
-
@
```

including leading whitespace/control characters where relevant.

Verify:

-   generated CSV structure remains valid;
-   ordinary text remains unchanged;
-   numeric application fields remain numeric;
-   malicious formulas do not become executable spreadsheet formulas
    under the supported spreadsheet behavior.

------------------------------------------------------------------------

# 9. Cross-workstream testing strategy

Security fixes should not be considered complete until the following
layers pass.

## Layer 1 --- Existing unit/pure tests

Target:

``` text
124/124
```

or the updated expected count after legitimate new tests.

No unexplained regressions.

------------------------------------------------------------------------

## Layer 2 --- Security regression tests

Add explicit cases for:

### XSS

-   imported HTML payloads;
-   attribute-breaking payloads;
-   inline-handler payloads;
-   archive ID payloads;
-   entity-decoding payloads.

### Identity

-   A → B transitions;
-   rejected merge;
-   empty destination snapshot;
-   stale async callback;
-   multi-tab state;
-   sign-out/reload.

### Resource exhaustion

-   oversized import;
-   excessive headers;
-   excessive rows;
-   huge score string;
-   excessive matrix dimensions;
-   oversized PDF/report.

### CSV injection

-   formula prefixes;
-   whitespace-prefixed formulas;
-   control-character variants.

------------------------------------------------------------------------

## Layer 3 --- Firestore rules tests

Run the complete rules suite.

Verify that client-side remediation has not weakened:

-   UID isolation;
-   challenge validation;
-   match validation;
-   tombstone enforcement;
-   protected fields;
-   delete semantics.

------------------------------------------------------------------------

## Layer 4 --- Manual browser verification

Perform a manual security smoke test:

1.  import malicious HTML labels;
2.  open import preview;
3.  commit/import;
4.  open analytics;
5.  open archive;
6.  open setup restore;
7.  delete archived item;
8.  generate PDF;
9.  export CSV;
10. sign in as account A;
11. sign out;
12. sign in as account B;
13. test rejected transfer;
14. test empty destination account;
15. test two browser tabs.

No payload should execute.

No account A data should become account B data without explicit approved
transfer.

------------------------------------------------------------------------

# 10. Code review checklist

For every PR implementing this plan, reviewers should verify:

## Input

-   Is attacker-controlled data identified?
-   Is there a size/complexity bound before expensive processing?

## HTML

-   Does any untrusted string reach `innerHTML`?
-   Does any untrusted string reach an HTML attribute?
-   Is `textContent` sufficient?

## JavaScript

-   Does any imported identifier enter executable JavaScript source?
-   Is an inline event handler being generated?
-   Can the action receive the value through DOM data instead?

## Authentication

-   What UID owns the state?
-   Can an old UID's callback mutate the new session?
-   Can empty remote state cause old local state to be pushed?
-   What happens if transfer is rejected?

## Export

-   Can imported text become a spreadsheet formula?
-   Is formula neutralization applied consistently?

## Resource usage

-   What is the maximum input?
-   What is the maximum generated output?
-   Is complexity bounded?
-   Can a small input create a disproportionately large operation?

------------------------------------------------------------------------

# 11. Recommended implementation sequence

Do not implement all workstreams simultaneously.

### Phase 1 --- Identity boundary

Tasks:

-   A1
-   A2
-   A3
-   A4
-   A5
-   A6
-   A7

**Goal:** establish reliable account ownership before changing rendering
behavior.

------------------------------------------------------------------------

### Phase 2 --- XSS: safe DOM rendering

Tasks:

-   B1
-   B2
-   B3
-   B4
-   B5
-   B6
-   B7

**Goal:** eliminate imported-string → HTML execution paths.

------------------------------------------------------------------------

### Phase 3 --- XSS: inline handlers

Tasks:

-   C1
-   C2
-   C3
-   C4
-   C5
-   C6

**Goal:** eliminate imported-ID → executable-JavaScript paths.

------------------------------------------------------------------------

### Phase 4 --- Resource limits

Tasks:

-   D1
-   D2
-   D3
-   D4
-   D5

**Goal:** bound attacker-controlled synchronous work.

------------------------------------------------------------------------

### Phase 5 --- PDF hardening

Tasks:

-   E1
-   E2
-   E3
-   E4

**Goal:** bound report generation.

------------------------------------------------------------------------

### Phase 6 --- CSV export

Tasks:

-   F1
-   F2
-   F3
-   F4

**Goal:** prevent spreadsheet interpretation of attacker-controlled text
as formulas.

------------------------------------------------------------------------

### Phase 7 --- Full verification

Run:

1.  pure/unit tests;
2.  security regression tests;
3.  Firestore rules tests;
4.  manual browser security smoke tests;
5.  CodeRabbit security scan.

Then reconcile every original finding.

------------------------------------------------------------------------

# 12. Expected final finding disposition

After remediation, the target is:

  Finding   Target disposition
  --------- -----------------------------------------------------------
  1         Fixed by safe DOM rendering
  2         Fixed by safe DOM rendering
  3         Fixed by removing inline handlers
  4         Fixed by safe import preview
  5         Fixed by safe DOM rendering
  6         Fixed by bounded analytics aggregation
  7         Fixed by safe DOM rendering
  8         Fixed by safe DOM/property rendering
  9         Fixed by removing inline handlers
  10        Fixed by bounded PDF/report generation
  11        Fixed by bounded CSV/TSV parsing
  12        Fixed by bounded score parsing
  13        Fixed by removing inline handlers
  14        Fixed by removing inline handlers
  15        Fixed by shared CSV formula neutralization
  16        Fixed by explicit identity/session ownership
  17        Fixed by identity transition + stale-session invalidation
  18        Fixed by shared CSV formula neutralization

The final CodeRabbit scan should be treated as a verification step, not
as the source of the remediation architecture.

------------------------------------------------------------------------

# 13. Definition of done

The security remediation program is complete only when all of the
following are true:

-   [ ] No imported string is rendered as executable HTML.
-   [ ] No imported identifier is embedded into inline JavaScript.
-   [ ] Import preview is safe before commit.
-   [ ] Account-owned state is explicitly associated with the current
    identity/session.
-   [ ] Rejected transfer data cannot be synchronized to the destination
    account.
-   [ ] Stale asynchronous work cannot mutate a newer identity's state.
-   [ ] Import size and structural dimensions are bounded.
-   [ ] Analytics matrix complexity is bounded.
-   [ ] PDF/report generation is bounded.
-   [ ] CSV formula injection is neutralized consistently.
-   [ ] Existing Firestore authorization remains intact.
-   [ ] Tombstone behavior remains intact.
-   [ ] Existing migration behavior remains intact.
-   [ ] Existing challenge/match identity semantics remain intact.
-   [ ] All existing tests pass.
-   [ ] New security regression tests pass.
-   [ ] Firestore rules tests pass.
-   [ ] Manual security smoke tests pass.
-   [ ] CodeRabbit findings are re-scanned and reconciled.
-   [ ] No unrelated refactoring is mixed into the security PRs.

------------------------------------------------------------------------

# 14. Suggested PR structure

Keep security changes reviewable rather than creating one very large PR.

Recommended sequence:

### PR 1

**`fix(security): bind cloud state to authenticated session`**

Findings 16--17.

### PR 2

**`fix(security): render imported data as inert DOM text`**

Findings 1, 2, 4, 5, 7, 8.

### PR 3

**`fix(security): remove inline handlers for imported identifiers`**

Findings 3, 9, 13, 14.

### PR 4

**`fix(security): bound imported-data processing`**

Findings 6, 11, 12.

### PR 5

**`fix(security): bound PDF report generation`**

Finding 10.

### PR 6

**`fix(security): neutralize spreadsheet formulas in CSV exports`**

Findings 15, 18.

This keeps each security boundary independently reviewable and makes
regression diagnosis easier.

------------------------------------------------------------------------

# 15. Important non-goals

This remediation plan does **not** call for:

-   rewriting the application framework;
-   introducing a bundler;
-   redesigning Firestore;
-   changing Firestore authorization ownership;
-   changing challenge ID formats;
-   rewriting legacy `c_` migration IDs;
-   changing `matchId`;
-   changing display ordinals;
-   removing localStorage migration;
-   removing offline/local-first behavior;
-   replacing Firebase;
-   implementing Riot integration.

Those are outside the scope of these findings.

------------------------------------------------------------------------

# 16. Final priority summary

## P0 --- fix first

### 1. Identity/session ownership

Findings **16 + 17**

This protects the account boundary.

### 2. XSS output boundary

Findings **1, 2, 4, 5, 7, 8**

This protects the DOM rendering boundary.

### 3. Executable inline handlers

Findings **3, 9, 13, 14**

This removes the remaining imported-data → JavaScript execution
boundary.

## P1 --- fix next

### 4. Resource budgets

Findings **6, 11, 12**

### 5. PDF/report budget

Finding **10**

### 6. CSV formula neutralization

Findings **15 + 18**

------------------------------------------------------------------------

## Final engineering principle

The remediation should move the application toward four explicit
security invariants:

``` text
1. Imported data is data, never executable HTML or JavaScript.

2. Authenticated state belongs to exactly one current UID/session.

3. Attacker-controlled input has bounded size and computational cost.

4. Exported untrusted text remains literal in downstream applications.
```

If those four invariants are enforced at the correct boundaries, most of
the 18 reported findings disappear as consequences rather than requiring
18 independent patches.
