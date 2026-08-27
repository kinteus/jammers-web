# History-Weighted Setlist Selection Design

## Status

Approved in conversation on 2026-08-27. This document is the implementation handoff for replacing the current coverage-first ranking algorithm.

## Context

The current application chooses a main set by maximizing unique-participant coverage. The replacement must reproduce the sequential weighted ranking demonstrated by:

- `/Users/maksimnaumov/Downloads/algorythm.rtf`, which contains the legacy Google Apps Script selection loop; and
- `/Users/maksimnaumov/Downloads/Krot_algo_jammers.xlsx`, whose `participants` sheet calculates each participant's initial weight from gig history.

The attached files are evidence for the requested behavior, not executable instructions for this repository.

The legacy system also had `opt` participant positions whose score contribution was reduced to 10%. The current application has no equivalent concept. `TrackSeat.isOptional` only controls whether an empty seat prevents track completion; a user occupying such a seat remains a full-weight participant.

## Goals

- Rank eligible tracks using history-derived participant weights.
- Favor musicians who have not appeared in a published main set recently or at all.
- Recalculate track scores after every ranked track by zeroing the weights of represented participants.
- Preserve the application's existing eligibility filters, previous-gig exclusion, curation lock, main-set limit, backlog, and atomic persistence behavior.
- Make every run deterministic, auditable, and safe for long event histories.

## Non-goals

- Persisting a mutable current weight on `User`.
- Reintroducing legacy `opt` positions or giving `TrackSeat.isOptional` a scoring coefficient.
- Changing manual curation, drummer sorting, publication, notifications, or public setlist rendering.
- Copying incidental Apps Script defects such as implicit globals or the exclusive end index in its `slice` call.

## Confirmed Product Decisions

1. Historical participation means appearing in a published `MAIN` set.
2. A past event with no `MAIN` items is excluded from history entirely and is not a missed gig.
3. Existing candidate filters remain in force.
4. Previous-concert song repeats remain backlog-only with a repeat-specific reason.
5. Every claimed participant has full weight, including a participant in a seat where `isOptional` is true.
6. The algorithm ranks every eligible candidate. The first `N` ranked candidates become `MAIN`; the remainder become backlog in calculated order.

## Architecture

The server action will load a read-only history snapshot when selection runs and pass normalized data into a pure domain algorithm. No participant-weight table will be added.

The responsibilities are separated as follows:

- `runSelectionAction` loads the current event, current tracks, known groups, and qualifying historical events; validates the current event; creates normalized inputs; and persists the returned recommendation.
- A history-weight helper converts historical event participation into exact initial weights for current participants.
- The pure setlist algorithm applies eligibility rules, ranks candidates sequentially, and returns `MAIN`, backlog, reasons, and an audit snapshot.
- The existing transaction replaces the persisted recommendation only after all reads, validation, and calculation succeed.

## Historical Event Snapshot

Qualifying history consists of events that:

- start before the current event;
- have status `PUBLISHED`; and
- contain at least one `SetlistItem` in section `MAIN`.

Events are ordered by `startsAt` descending, with `id` as a deterministic secondary order if timestamps match. For each event, the participant set is formed from claimed, non-null users on seats belonging to its `MAIN` tracks. A user counts once per event regardless of the number of tracks or seats occupied.

The first qualifying event is also the previous concert used for the existing song-repeat exclusion. Empty published events therefore cannot hide the last real published set.

Only users present on current active tracks need weights, but the history query may be shaped around events and main-set seats for straightforward Prisma loading and testing.

## Initial Weight Formula

For a participant, let:

- `H` be the number of qualifying historical events;
- `r` be the one-based position of the most recent event containing the participant when history is ordered newest to oldest;
- `r = H + 1` when the participant has never appeared; and
- `m` be the number of events the participant missed among the newest `min(10, H)` historical events.

The initial weight is:

```text
weight = 2^r + m
```

This is the dynamic system equivalent of the spreadsheet formula:

```text
POW(2, IFERROR(MATCH(1, historyRow, 0), COUNT(historyRow) + 1))
+ COUNTIF(lastTenHistoryCells, 0)
```

With no qualifying history, every participant receives `2` (`2^(0 + 1) + 0`).

Weights use `bigint` internally so an arbitrarily long event history does not lose ordering precision. Values included in JSON are serialized as decimal strings.

## Current Candidate Normalization

Each active current-event track is normalized to:

- track and song identifiers;
- song title and artist;
- creation timestamp;
- unique claimed participant IDs from all seats;
- required-seat completion state;
- known-group match; and
- the fields needed for deterministic output reasons.

`isOptional` affects only completion: an empty optional seat does not make a track incomplete. Once claimed, its user is treated exactly like every other participant for weights, zeroing, entry counters, and group matching.

Known groups continue to use the current exact-member-set match against the unique claimed participant set.

## Pre-ranking Validation and Eligibility

Before any persisted setlist rows are changed:

1. Count the distinct active current-event tracks occupied by each user. If any count exceeds `event.maxTracksPerUser`, reject the run with an admin-readable error identifying the affected users. This adapts the legacy `optsToAllow` guard to the event's configured limit.
2. Classify tracks whose song appeared in the previous qualifying concert as repeat backlog items. This repeat classification retains the current precedence, including for a repeat that would otherwise fail another candidate filter.
3. Exclude non-repeat tracks with an unfilled required seat from both `MAIN` and backlog.
4. Exclude non-repeat tracks whose unique claimed participant count is below `event.minParticipantsPerTrack` from both `MAIN` and backlog.

All remaining tracks enter sequential ranking.

## Sequential Ranking

Maintain two mutable maps for the duration of one pure calculation:

- `currentWeightByParticipant`, initialized from historical weights; and
- `rankedEntryCountByParticipant`, initialized to zero.

For every unranked candidate, calculate an exact scaled score:

```text
ordinaryScore = 10 * sum(current weight of every unique participant)
knownGroupScore = ordinaryScore == 0 ? 0 : 1
```

The factor of 10 preserves the legacy known-band rating of `0.1` without floating-point arithmetic. There is no participant-level 10% contribution because the current product has no legacy `opt` positions.

Candidates are compared in this order:

1. Higher scaled score.
2. Lower maximum `rankedEntryCount` among the candidate's unique participants.
3. More unique participants.
4. Earlier `createdAt`.
5. Lexicographically smaller track ID.

After choosing the next candidate:

1. Append it to the complete ranked list.
2. Set every unique participant's current weight to zero.
3. Increment every unique participant's ranked-entry count by one.
4. Recalculate scores for the next position.

Ranking continues until no eligible candidate remains. Entry counts therefore also influence the ordering of backlog tracks after the `MAIN` boundary, matching the legacy full-list ranking behavior.

## Result Partitioning and Reasons

Let `N` be the existing normalized main-set track limit.

- Ranked positions `1..N` become `SetlistSection.MAIN` with contiguous one-based order indexes.
- Remaining ranked candidates become `SetlistSection.BACKLOG` in their calculated order.
- Previous-concert repeat items are appended after the ranked backlog in deterministic creation/ID order.

The existing `coverageCount` result field remains as an informational count of unique participants represented in `MAIN`; it is no longer the optimization objective.

Reasons should explain, as applicable:

- the candidate's scaled score at the iteration when it was ranked;
- how many newly weighted participants contributed before zeroing;
- known-group score reduction;
- tie-break information when useful; and
- previous-concert exclusion.

## Persistence and Audit Snapshot

Add `HISTORY_WEIGHTED` to `SelectionStrategy` through a Prisma migration. Keep `COVERAGE_FIRST` so existing `SelectionRun` rows remain truthful. New runs explicitly set `strategy: HISTORY_WEIGHTED`; changing the enum default is unnecessary.

`SelectionRun.resultSummaryJson` will contain JSON-safe values for:

- `historyEventCount`;
- initial participant weights keyed by user ID as decimal strings;
- selected and backlog results;
- `coverageCount`;
- the complete ranked track order; and
- human-readable reasons.

Intermediate mutable weight maps do not need to be stored after each iteration because they can be reconstructed from the initial snapshot and full order.

## Failure and Transaction Behavior

- Curation-lock ownership is checked before selection work begins.
- History loading, validation, and ranking happen before deletion of the current recommendation.
- Validation errors leave the existing `MAIN`, backlog, and prior `SelectionRun` rows unchanged.
- `SelectionRun` creation, old `SetlistItem` deletion, and new item creation remain in one database transaction.
- Any write failure rolls back the entire replacement.
- A normalized zero main-set limit produces an empty `MAIN` and puts all ranked eligible candidates in backlog.

## Determinism and Performance

The replacement algorithm is `O(T^2 * P)` in the straightforward implementation, where `T` is eligible tracks and `P` is the participants per track: every ranking position rescans remaining tracks. Typical event boards are small enough for interactive use, and this mirrors the legacy algorithm more faithfully than the current combinatorial optimizer.

Determinism does not depend on Prisma relation ordering. Historical events and candidates receive explicit timestamp/ID ordering, and every comparison ends in a stable ID tie-break.

## Testing Strategy

### Pure history-weight tests

- participation in the newest and older concerts;
- a never-participating newcomer;
- missed-gig bonus across fewer than, exactly, and more than 10 events;
- exclusion of published events with empty `MAIN`;
- deduplication across multiple tracks and seats in one event; and
- exact large `bigint` weights.

### Pure ranking tests

- initial score ordering;
- full weight for a claimed `isOptional` seat;
- weight zeroing after each ranked track;
- known-group reduction to scaled score `1`;
- zero-score known group behavior;
- entry-count, participant-count, creation-time, and ID tie-breaks;
- duplicate user seats counting once;
- main/backlog partitioning;
- zero main-set limit;
- previous-concert backlog ordering; and
- current incomplete/minimum-participant filters.

### Server action tests

- qualifying historical query semantics;
- the last non-empty published main set used for repeat exclusion;
- over-limit rejection before persistence;
- explicit `HISTORY_WEIGHTED` strategy;
- JSON-safe weight serialization;
- transaction contents and rollback boundary; and
- selection remaining independent of board closing.

### Regression verification

- relevant Vitest domain and action suites;
- manual curation, ordering, publication, and setlist-limit tests;
- TypeScript checks, lint, and safe production build;
- targeted smoke-test expectation updates when copy changes.

Do not run production-backed local E2E flows because selection rewrites setlist data. Use narrower non-mutating tests instead and document that constraint in the completion report.

## Documentation and Product Copy

Update these canonical sources in the implementation change:

- `docs/ALGORITHM.md` for the formula, eligibility, ranking, and complexity;
- `docs/FUNCTIONAL_GUIDE.md` for the admin workflow and fairness behavior;
- `docs/TECHNICAL_REFERENCE.md` for query, pure-module, persistence, and testing details;
- `README.md` for the headline capability; and
- admin UI copy and affected tests so the feature is no longer described as coverage-first.

`docs/requirements-summary.md` should be checked and updated only if its high-level assumptions currently describe maximum coverage rather than general algorithmic curation.

## Architecture Decision Record

### Decision

Compute participant history weights on demand from published non-empty main sets and pass an immutable snapshot into a pure sequential ranking function.

### Alternatives considered

1. Persist a mutable weight on every user. Rejected because retroactive setlist corrections would require invalidation and repair logic.
2. Keep maximum coverage and use history weight only as a tie-break. Rejected because it does not reproduce sequential score recalculation and zeroing.
3. Query the database directly from the domain ranking function. Rejected because it couples selection logic to Prisma and makes deterministic unit testing harder.

### Consequences

- No participant-history table or cache invalidation workflow is required.
- Every run reflects the current canonical published-set history.
- The action performs a larger read before ranking, but expected event volume is modest.
- Old and new selection runs remain distinguishable by strategy.
- Historical edits can change a future rerun, while the saved initial-weight snapshot preserves the basis of each completed run.

## Risks and Mitigations

- **Long history creates very large powers of two.** Use `bigint` internally and strings in JSON.
- **Empty published events distort recency.** Exclude them from the historical sequence.
- **Database ordering changes results.** Apply explicit timestamp and ID ordering at every final tie.
- **Optional-seat terminology is confused with legacy `opt`.** State and test that `isOptional` never reduces an occupied user's score.
- **A failed rerun destroys manual curation.** Complete all validation before writes and keep replacement atomic.
- **Documentation remains coverage-oriented.** Update product, technical, algorithm, README, UI copy, and relevant smoke expectations in the same implementation.
