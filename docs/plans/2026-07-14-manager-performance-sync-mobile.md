# Manager Performance, Resilient Sync, and Mobile Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make large BiliShelf libraries page quickly, make Bilibili imports safely resumable and observable, and make the existing manager usable on narrow mobile viewports.

**Architecture:** Preserve the serialized local-state format while adding a background state cache, revision-bound query indexes, and page-first DTO mapping. Replace ephemeral sync progress with durable page checkpoints and conservative two-phase reconciliation. Keep the desktop manager intact while moving folders into an accessible drawer and pagination into a sticky control surface on narrow screens.

**Tech Stack:** WXT, TypeScript, IndexedDB, Node `node:test`, Vue 3 Composition API, Pinia, Vue Router, Tailwind CSS, Reka UI, Playwright CLI.

---

### Task 1: Add Runtime Test Harnesses and Capture the Failing Behaviors

**Files:**
- Create: `extension/tests/helpers/background-runtime-harness.mjs`
- Create: `extension/tests/manager-query-runtime.test.mjs`
- Create: `extension/tests/favorites-sync-resume-runtime.test.mjs`
- Modify: `extension/tests/manager-large-library-regression.test.mjs`

**Step 1: Extract the reusable background runtime harness**

Move the existing Node 22 type-stripping import setup from `folder-playback-runtime.test.mjs` into a helper that:

- stubs `defineBackground` and Chrome APIs;
- rewrites relative imports to absolute file URLs;
- optionally exports named internal functions for runtime testing;
- injects deterministic `fetch`, clock, random, and storage implementations;
- returns JSON-serializable results from an isolated Node process.

Expose an API shaped like:

```js
const result = runBackgroundScenario({
  exports: ["syncFromBilibiliToState"],
  setupSource: "globalThis.fetch = ...",
  scenarioSource: "return await syncFromBilibiliToState(...)",
});
```

**Step 2: Write the failing resume regression**

Simulate page one success, page two HTTP 412, then resume page two successfully. Assert that page-one relationships still exist after the resumed scan.

```js
assert.deepEqual(result.afterResumeBvids.sort(), [
  "BVPAGE1A",
  "BVPAGE1B",
  "BVPAGE2A",
  "BVPAGE2B",
]);
```

**Step 3: Write the failing page-first query regression**

Generate 50,000 videos and assert that an unfiltered page query maps no more than `pageSize` DTOs. Instrument the mapper with a counter rather than asserting wall-clock timing.

**Step 4: Run the focused tests and verify RED**

Run:

```bash
node --test extension/tests/manager-query-runtime.test.mjs extension/tests/favorites-sync-resume-runtime.test.mjs
```

Expected: FAIL because the current query maps the full candidate set and resume cleanup drops earlier pages.

**Step 5: Commit the tests**

```bash
git add extension/tests/helpers/background-runtime-harness.mjs extension/tests/manager-query-runtime.test.mjs extension/tests/favorites-sync-resume-runtime.test.mjs extension/tests/manager-large-library-regression.test.mjs
git commit -m "test: reproduce manager query and sync resume failures"
```

### Task 2: Cache Local State and Page Query Results Before DTO Mapping

**Files:**
- Modify: `extension/entrypoints/background.ts`
- Modify: `extension/tests/manager-query-runtime.test.mjs`
- Modify: `extension/tests/manager-large-library-regression.test.mjs`

**Step 1: Add a background state cache**

Introduce cache fields next to `dbPromise`:

```ts
let cachedState: LocalState | null = null;
let stateRevision = 0;
let cachedIndexes: { revision: number; value: LocalStateIndexes } | null = null;
```

`readState()` returns `cachedState` after the first normalized IndexedDB load. `writeState()` updates the same cache and increments the revision only after a successful transaction.

**Step 2: Expand revision-bound indexes**

Add `videosById`, global active/deleted sorted ID lists, and folder-scoped sorted ID lists to `LocalStateIndexes`. Build them once per revision with `getLocalStateIndexes(state)`.

**Step 3: Split matching IDs from mapping DTOs**

Replace `filterVideoList()` usage in read routes with a query function that returns:

```ts
type VideoPageResult = {
  items: ReturnType<typeof mapVideo>[];
  pagination: { page: number; pageSize: number; total: number };
};
```

For unfiltered queries, select the sorted ID list, slice it, then call `mapVideo()` only for visible IDs. For filtered queries, cache matching IDs by revision and a stable query signature, then slice and map.

**Step 4: Invalidate derived caches on writes**

Every persisted mutation invalidates index and query caches. Read-only routes reuse them.

**Step 5: Run query tests and verify GREEN**

Run:

```bash
node --test extension/tests/manager-query-runtime.test.mjs extension/tests/manager-large-library-regression.test.mjs
```

Expected: PASS; mapper count is bounded by page size.

**Step 6: Run the benchmark report**

Report cold and warm page timings for 1k, 10k, and 50k videos without making a fragile timing threshold part of CI.

**Step 7: Commit**

```bash
git add extension/entrypoints/background.ts extension/tests/manager-query-runtime.test.mjs extension/tests/manager-large-library-regression.test.mjs
git commit -m "perf: cache local indexes and page video queries"
```

### Task 3: Persist Sync Jobs and Page Checkpoints

**Files:**
- Modify: `extension/entrypoints/background.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types.ts`
- Modify: `extension/tests/favorites-sync-resume-runtime.test.mjs`
- Create: `extension/tests/favorites-sync-checkpoint.test.mjs`

**Step 1: Write failing checkpoint/restart tests**

Cover:

- data is durable before a cursor advances;
- a serialized job restores current folder, next page, and seen identities;
- a missing or malformed seen-identity checkpoint restarts the folder at page one;
- a completed job clears active checkpoint state but retains the final summary.

**Step 2: Verify RED**

Run:

```bash
node --test extension/tests/favorites-sync-resume-runtime.test.mjs extension/tests/favorites-sync-checkpoint.test.mjs
```

Expected: FAIL because status and seen identities are currently memory-only.

**Step 3: Add normalized persisted job types**

Add a `favoritesJob` entry under `syncMeta` with safe default/normalization functions. Store selected folder IDs, current folder/page, per-folder seen keys, completion flags, counters, retry state, and last summary.

**Step 4: Checkpoint each completed page atomically**

After applying a page, persist state and the next-page cursor before another request starts. Update the in-memory status from the persisted job rather than maintaining a divergent status object.

**Step 5: Restore and expose durable status**

`GET /sync/bilibili/history-model/status` reads the normalized durable snapshot. Starting a sync reuses a paused checkpoint only when the selected folder set matches; otherwise it creates a new job.

**Step 6: Verify GREEN**

Run the two checkpoint/resume test files and confirm all assertions pass.

**Step 7: Commit**

```bash
git add extension/entrypoints/background.ts frontend/src/lib/api.ts frontend/src/types.ts extension/tests/favorites-sync-resume-runtime.test.mjs extension/tests/favorites-sync-checkpoint.test.mjs
git commit -m "feat: persist favorites sync checkpoints"
```

### Task 4: Make Remote Reconciliation Complete and Conservative

**Files:**
- Modify: `extension/entrypoints/background.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `extension/tests/favorites-sync-completeness.test.mjs`

**Step 1: Write failing completeness tests**

Add runtime cases for:

- zero-item remote folders create local folders;
- missing BV with a valid aid resolves through the view endpoint;
- unresolved missing-BV rows appear in the result and prevent destructive reconciliation;
- `has_more: false` with an inconsistent remote total marks the folder incomplete;
- a risk-blocked or incomplete run removes no local relationship;
- one complete omission marks a candidate and a second complete omission removes it.

**Step 2: Verify RED**

Run:

```bash
node --test extension/tests/favorites-sync-completeness.test.mjs
```

Expected: FAIL for every new completeness behavior.

**Step 3: Import empty folders**

Remove the `mediaCount > 0` filter from remote folder discovery and ensure every selected remote folder is materialized locally.

**Step 4: Resolve missing BV IDs by aid**

When `bvid`/`bv_id` is blank and a positive aid exists, request `BILI_VIEW_API?aid=...`. Import a resolved BV normally. Record bounded unresolved DTOs when resolution fails.

**Step 5: Validate scan completeness**

Track observed remote identities and expected totals. Treat inconsistent pagination or unresolved identities as incomplete and skip reconciliation.

**Step 6: Add two-scan deletion candidates**

Persist per-folder candidate identities after the first complete omission. Remove relationships only after the next complete scan omits the same identities. Clear candidates when an identity reappears.

**Step 7: Verify GREEN and commit**

```bash
node --test extension/tests/favorites-sync-completeness.test.mjs extension/tests/favorites-sync-resume-runtime.test.mjs
git add extension/entrypoints/background.ts frontend/src/lib/api.ts extension/tests/favorites-sync-completeness.test.mjs
git commit -m "fix: make favorites reconciliation complete and safe"
```

### Task 5: Replace Fixed Pacing with Durable Backoff and Pause/Resume

**Files:**
- Modify: `extension/shared/favorites-sync-throttle.js`
- Modify: `extension/shared/favorites-sync-throttle.d.ts`
- Modify: `extension/entrypoints/background.ts`
- Modify: `extension/tests/favorites-sync-throttle.test.mjs`
- Modify: `extension/tests/favorites-sync-checkpoint.test.mjs`

**Step 1: Write failing policy tests**

Test deterministic random inputs for:

- exponential retry growth and cap;
- jitter staying inside bounds;
- `Retry-After` precedence;
- 412 producing a paused job rather than an automatic retry loop;
- 429/timeout/5xx producing a scheduled retry;
- successful requests reducing a transient failure streak.

**Step 2: Verify RED**

Run:

```bash
node --test extension/tests/favorites-sync-throttle.test.mjs extension/tests/favorites-sync-checkpoint.test.mjs
```

**Step 3: Implement policy helpers**

Add pure helpers such as:

```js
resolveTransientRetryPolicy({ attempt, retryAfterMs, random })
resolveRiskPausePolicy({ detectedAt, previousRiskCount, random })
```

Return explicit `delayMs`, `nextRetryAt`, `automatic`, and reason fields.

**Step 4: Persist policy decisions in the sync job**

Update the job before returning from an error. Use `chrome.alarms` only for automatic transient retries. A 412 remains paused until the cooldown expires and the user explicitly resumes.

**Step 5: Verify GREEN and commit**

```bash
node --test extension/tests/favorites-sync-throttle.test.mjs extension/tests/favorites-sync-checkpoint.test.mjs
git add extension/shared/favorites-sync-throttle.js extension/shared/favorites-sync-throttle.d.ts extension/entrypoints/background.ts extension/tests/favorites-sync-throttle.test.mjs extension/tests/favorites-sync-checkpoint.test.mjs
git commit -m "feat: add observable favorites sync backoff"
```

### Task 6: Surface Complete Sync Status in the Manager

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/components/dialogs/SyncImportDialog.vue`
- Modify: `frontend/src/lib/manager-i18n.ts`
- Create: `frontend/tests/sync-status-ui.test.mjs`

**Step 1: Write failing UI contract tests**

Assert that the dialog exposes current folder/page, scanned/imported/updated/skipped/unresolved/incomplete counts, risk pause information, next allowed resume time, and restart/resume events.

**Step 2: Verify RED**

Run:

```bash
node --test frontend/tests/sync-status-ui.test.mjs
```

**Step 3: Extend frontend types and polling**

Model the durable job status in `api.ts`/`types.ts`. Keep polling while running or waiting for an automatic retry; stop polling while risk-paused and render explicit actions.

**Step 4: Render progress and diagnostics**

Add compact progress, counters, unresolved/incomplete warnings, and pause/resume/restart controls to `SyncImportDialog.vue`. Do not hide skipped items inside a success toast.

**Step 5: Add CN/EN strings**

Add matching keys to `MANAGER_I18N` and keep user-facing error language actionable.

**Step 6: Verify and commit**

```bash
node --test frontend/tests/sync-status-ui.test.mjs frontend/tests/ui-layout-regressions.test.mjs
pnpm --dir frontend run check
git add frontend/src/types.ts frontend/src/lib/api.ts frontend/src/App.vue frontend/src/components/dialogs/SyncImportDialog.vue frontend/src/lib/manager-i18n.ts frontend/tests/sync-status-ui.test.mjs
git commit -m "feat: show resilient sync progress and errors"
```

### Task 7: Reorganize the Manager for Mobile Navigation

**Files:**
- Create: `frontend/src/components/layout/ManagerFolderNavigation.vue`
- Create: `frontend/src/components/layout/MobileManagerBar.vue`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/components/FolderSidebar.vue`
- Modify: `frontend/src/components/layout/ManagerHeader.vue`
- Modify: `frontend/src/components/panels/ManagerPanel.vue`
- Modify: `frontend/src/lib/manager-i18n.ts`
- Create: `frontend/tests/mobile-manager-layout.test.mjs`

**Step 1: Write failing structural tests**

Assert that narrow layouts use a folder drawer trigger, the desktop sidebar is hidden from mobile document flow, the mobile scope bar displays the active folder/result count, and pagination has a sticky mobile container with safe-area padding.

**Step 2: Verify RED**

Run:

```bash
node --test frontend/tests/mobile-manager-layout.test.mjs
```

**Step 3: Add responsive folder navigation**

Use one logical `FolderSidebar` instance per breakpoint through `ManagerFolderNavigation.vue`: inline at `lg` and above, and inside an accessible Reka dialog/drawer below `lg`. Close the drawer after folder selection and restore focus to the trigger.

**Step 4: Add the sticky mobile scope bar**

Show the drawer trigger, active scope, and count before the manager header. Keep touch targets at least 44px and respect `prefers-reduced-motion`.

**Step 5: Compact mobile header actions**

Keep primary search/sync affordances visible and move secondary management actions behind a More control on narrow widths. Preserve the existing desktop grids.

**Step 6: Make pagination mobile-sticky**

Move the mobile controls into a bottom sticky surface with `env(safe-area-inset-bottom)` padding while retaining the desktop footer.

**Step 7: Verify structural tests and type checking**

```bash
node --test frontend/tests/mobile-manager-layout.test.mjs frontend/tests/ui-layout-regressions.test.mjs
pnpm --dir frontend run check
```

**Step 8: Commit**

```bash
git add frontend/src/components/layout/ManagerFolderNavigation.vue frontend/src/components/layout/MobileManagerBar.vue frontend/src/App.vue frontend/src/components/FolderSidebar.vue frontend/src/components/layout/ManagerHeader.vue frontend/src/components/panels/ManagerPanel.vue frontend/src/lib/manager-i18n.ts frontend/tests/mobile-manager-layout.test.mjs
git commit -m "feat: add mobile manager navigation"
```

### Task 8: Browser Verification, Full Regression, and Performance Report

**Files:**
- Modify only if verification finds a regression.

**Step 1: Run all Node regression tests**

```powershell
$tests = @(Get-ChildItem 'frontend/tests','extension/tests' -Filter '*.test.mjs' | Select-Object -ExpandProperty FullName)
node --test $tests
```

Expected: all tests pass.

**Step 2: Run type checking**

```bash
pnpm --dir frontend run check
pnpm --dir extension exec tsc --noEmit
```

Expected: pass. If the pre-existing missing declaration for `folder-playback-session.js` remains, add the matching `.d.ts` rather than suppressing the error.

**Step 3: Build production artifacts**

```bash
pnpm --dir frontend run build
pnpm --dir extension run build:chrome
```

Expected: both builds exit zero.

**Step 4: Run fresh performance measurements**

Compare cold and warm 1k/10k/50k queries against the recorded baseline. Report mapper counts and elapsed times without hiding outliers.

**Step 5: Verify desktop and mobile in a real browser**

Use Playwright CLI at desktop and 390x844. Confirm:

- the first video appears in the initial mobile content flow;
- the folder drawer opens, selects a folder, closes, and returns focus;
- next/previous/jump pagination works from the sticky footer;
- desktop sidebar and header grids remain intact;
- sync paused/running/incomplete states are readable.

**Step 6: Review the final diff and status**

Confirm unrelated user changes were preserved and no Playwright/Vite temporary files remain.

**Step 7: Final commit if verification required adjustments**

```bash
git add <only-the-adjusted-files>
git commit -m "fix: address manager stability verification findings"
```
