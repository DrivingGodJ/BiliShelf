# Manager Performance, Resilient Sync, and Mobile Layout Design

**Date:** 2026-07-14

**Status:** Approved

## Goal

Improve large-library browsing performance, make Bilibili imports complete and safely resumable under risk control, expose sync progress and unresolved items, and reorganize the manager so it is usable on narrow mobile viewports.

Pure WebDAV cross-platform sync is intentionally outside this delivery. The mobile manager layout created here should be reusable by that later work.

## Chosen Approach

Use a hybrid, backward-compatible change instead of either a narrow patch or an immediate full IndexedDB normalization:

- retain the existing serialized local-state format;
- cache the normalized state in the background runtime;
- cache reusable query indexes by state revision;
- page candidate video IDs before mapping full video DTOs;
- persist resumable sync job state and page checkpoints;
- reconcile remote deletions only after a complete, validated scan;
- replace the inline mobile folder sidebar with compact navigation and a drawer.

This solves the reported pain without taking on a high-risk storage migration while the existing performance work remains uncommitted.

## Query Performance

The background runtime will load and normalize the IndexedDB state once, then retain it until a write replaces it. Writes increment a state revision and invalidate derived indexes.

Reusable indexes will include:

- active folders by ID;
- videos by ID;
- folder items grouped by video and folder;
- active folder IDs per video;
- tag summaries per video;
- globally sorted active video IDs;
- sorted video IDs per folder using the folder-specific `addedAt` value;
- deleted video IDs sorted for trash;
- normalized search fields used by filters.

Unfiltered manager queries will choose the relevant sorted ID list, compute the total, slice the requested page, and only then map the visible videos. Filtered queries will scan lightweight indexed records, cache their matching ID list by revision and query signature, then page and map. A small LRU avoids retaining unbounded query results.

Folder counts and tag usage counts will reuse the same revision-bound indexes. The first request after a background restart may still pay the one-time state load cost; repeated paging and folder switching must not reread or rescan the entire state.

## Durable Sync Jobs

A persisted favorites sync job will record:

- job ID and status;
- selected remote folder IDs;
- current folder and page;
- per-folder scan start and completion state;
- remote identities seen across every completed page;
- scanned, inserted, updated, skipped, invalid, and unresolved counts;
- retry attempt, last error, next allowed retry time, and risk-control state.

Each page checkpoint will persist data before advancing its cursor. If the service worker stops, a restarted task resumes from the last durable cursor. A resumed folder must reuse its previously persisted seen-identity set. If that set is missing or inconsistent, the folder restarts at page one instead of performing destructive reconciliation from a partial set.

## Complete and Safe Reconciliation

Remote synchronization is split into import and reconciliation phases.

During import, pages only create or update local records and relationships. No local relationship is removed while a scan is partial, resumed without a valid checkpoint, risk-blocked, or inconsistent.

A folder is eligible for reconciliation only when:

- the scan has a valid page-one origin or a complete durable checkpoint chain;
- pagination reaches a natural end;
- the observed remote identity count is consistent with the API metadata;
- no unresolved response or risk-control error remains.

Missing remote relationships become reconciliation candidates after the first complete scan. They are removed only after a second consecutive complete scan also omits them, protecting local data from transient incomplete Bilibili responses.

Remote folders with zero items are imported as empty local folders.

When a media row has no BV ID, sync will attempt to resolve it through its numeric aid and the Bilibili view endpoint. Rows that still cannot be resolved remain in a bounded unresolved-item report with their available identity and metadata. They are visible to the user and count toward completeness checks instead of being silently discarded.

## Risk Control and Observability

Risk and transient failures use different policies:

- HTTP 412 pauses the job immediately, persists the checkpoint, and requires an explicit resume after the displayed cooldown.
- HTTP 429, timeouts, and 5xx responses use capped exponential backoff with random jitter and honor `Retry-After` when available.
- successful requests gradually reduce the transient failure streak.
- no retry loop may advance a page cursor before its data is durable.

The frontend sync status will show the current folder/page, scanned and imported counts, updates, invalid items, missing-BV resolutions, unresolved items, incomplete folders, last error, and next allowed resume time. Users can pause, resume, or restart a selected folder from page one.

## Mobile Manager Layout

At narrow widths, the desktop folder sidebar will leave document flow. A sticky mobile scope bar will show a folder-menu trigger, the active folder, and the current result count. The folder list will open in an accessible drawer with search, selection, create, reorder, and folder actions.

The manager content will render before the drawer contents, keeping the first video visible near the initial viewport. Video cards remain a single column. Pagination becomes a mobile sticky footer with previous, next, page input, and page-size controls. Secondary manager actions collapse behind a compact More menu while desktop structure remains unchanged.

The mobile layout must support keyboard navigation, focus return, reduced motion, safe-area insets, and touch targets of at least 44 CSS pixels.

## Testing

Implementation follows test-driven development.

Automated coverage will include:

- deterministic tests proving unfiltered queries map only the requested page;
- state-cache and revision invalidation tests;
- 1k, 10k, and 50k benchmark reporting;
- fault injection where page one succeeds, page two returns 412, and resume preserves page-one relationships;
- service-worker restart simulation from a page checkpoint;
- empty remote folders;
- missing-BV resolution and unresolved reporting;
- inconsistent `has_more` and media counts preventing reconciliation;
- two-complete-scan deletion confirmation;
- backoff bounds, jitter, pause, and resume behavior;
- frontend contracts for the expanded sync status;
- Playwright checks at 390x844 and desktop widths for the folder drawer, first-video position, and sticky pagination.

Verification will run the full Node regression suite, `vue-tsc`, extension type checking, production builds, and fresh before/after performance measurements.

## Compatibility and Rollout

Existing IndexedDB state and exports remain compatible. New sync job fields are optional and normalized with safe defaults. A stale job from an older version is treated as incomplete and may import data, but it cannot delete relationships until a fresh complete scan succeeds.

The changes will be delivered in independently tested stages: query performance, durable sync core, completeness and backoff, sync UI, then mobile layout.
