# History-Weighted Setlist Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace maximum-coverage setlist selection with deterministic sequential ranking based on each musician's published-main-set participation history.

**Architecture:** `runSelectionAction` loads a qualifying published-set history snapshot and current candidates, while focused pure domain modules calculate history weights and sequential track ranking. Exact `bigint` weights stay inside domain logic and are serialized as decimal strings in the audit result; persistence remains one transaction.

**Tech Stack:** TypeScript 5.7, Next.js 15 server actions, Prisma 6/PostgreSQL, Vitest, Playwright smoke assertions, Markdown documentation.

**Spec:** `docs/superpowers/specs/2026-08-27-history-weighted-setlist-selection-design.md`

## Global Constraints

- Historical participation means appearing in a past published non-empty `MAIN` set.
- Published events with no `MAIN` items do not exist in the weight timeline and cannot hide the previous real concert.
- Every claimed current participant has full weight; `TrackSeat.isOptional` never applies a scoring coefficient.
- Existing previous-song, required-seat, minimum-participant, curation-lock, limit, backlog, and transaction behavior remains in force.
- Rank all eligible candidates sequentially, zeroing participant weights and incrementing ranked-entry counts after every position.
- Use exact scaled `bigint` scores: ordinary score is `10 * sum(weights)` and a positive known-group score becomes `1`.
- Do not run production-backed E2E selection flows because they rewrite production data.
- Preserve unrelated working-tree changes in `src/app/page.tsx`, `tests/smoke/app.smoke.spec.ts`, and `tests/home-page-layout.test.ts`.

---

## File Structure

- Create `src/lib/domain/setlist-history.ts`: pure qualification, deterministic history ordering, previous-song extraction, and initial-weight calculation.
- Create `tests/setlist-history.test.ts`: direct tests for the spreadsheet-equivalent formula and history edge cases.
- Rewrite `src/lib/domain/setlist-algorithm.ts`: sequential history-weighted ranking, eligibility, limit validation helper, partitioning, and JSON-safe audit fields.
- Rewrite `tests/setlist-algorithm.test.ts`: behavior-focused tests for ranking, zeroing, known groups, filters, tie-breaks, and exact scores.
- Modify `prisma/schema.prisma`: add `HISTORY_WEIGHTED` while preserving `COVERAGE_FIRST`.
- Create `prisma/migrations/20260827220000_add_history_weighted_selection_strategy/migration.sql`: PostgreSQL enum extension.
- Create `tests/selection-strategy-schema.test.ts`: schema/migration regression check.
- Modify `src/server/actions.ts`: load history, build snapshot, enforce participant track limits, invoke the new algorithm, and persist the new strategy.
- Modify `tests/event-slug-actions.test.ts`: mock/query/action coverage for history, limits, audit serialization, and transactional writes.
- Modify `src/app/admin/events/[slug]/page.tsx`: replace coverage-first product copy.
- Modify `tests/admin-event-page.test.ts`: assert the new history-weighted explanation.
- Rewrite `docs/ALGORITHM.md`: canonical product-level algorithm.
- Modify `docs/FUNCTIONAL_GUIDE.md`, `docs/TECHNICAL_REFERENCE.md`, and `README.md`: update behavior, architecture, and headline capability.
- Check `docs/requirements-summary.md`: change only text that explicitly claims maximum-coverage behavior.
- Check `tests/smoke/app.smoke.spec.ts`: keep it untouched unless its existing selection-confirmation assertions no longer match UI copy.

---

### Task 1: Historical Participation Snapshot

**Files:**
- Create: `src/lib/domain/setlist-history.ts`
- Create: `tests/setlist-history.test.ts`

**Interfaces:**
- Consumes: event IDs, `startsAt`, `mainTrackCount`, unique participant IDs, song IDs, and current participant IDs.
- Produces:

```ts
export type HistoricalParticipationEvent = {
  id: string;
  startsAt: Date;
  mainTrackCount: number;
  participantIds: string[];
  songIds: string[];
};

export type ParticipantHistorySnapshot = {
  eventCount: number;
  initialWeightsByParticipant: Map<string, bigint>;
  previousConcertSongIds: Set<string>;
};

export function buildParticipantHistorySnapshot(input: {
  currentParticipantIds: Iterable<string>;
  events: HistoricalParticipationEvent[];
}): ParticipantHistorySnapshot;
```

- [ ] **Step 1: Write failing history-formula tests**

Create tests that assert newest participation, older participation, a newcomer, the 10-event miss window, duplicate participant occurrences, deterministic timestamp/ID ordering, and exclusion of `mainTrackCount: 0`.

```ts
function event(
  id: string,
  startsAt: string,
  participantIds: string[],
  songIds: string[],
): HistoricalParticipationEvent {
  return {
    id,
    startsAt: new Date(`${startsAt}T19:00:00.000Z`),
    mainTrackCount: songIds.length,
    participantIds,
    songIds,
  };
}

const snapshot = buildParticipantHistorySnapshot({
  currentParticipantIds: ["recent", "older", "new"],
  events: [
    event("gig-3", "2026-03-01", ["recent"], ["song-3"]),
    event("gig-2", "2026-02-01", [], ["song-2"]),
    event("gig-1", "2026-01-01", ["older", "older"], ["song-1"]),
    { ...event("empty", "2026-04-01", [], []), mainTrackCount: 0 },
  ],
});

expect(snapshot.eventCount).toBe(3);
expect(snapshot.initialWeightsByParticipant.get("recent")).toBe(4n); // 2^1 + two misses in the three-gig window
expect(snapshot.initialWeightsByParticipant.get("older")).toBe(10n); // 2^3 + two misses
expect(snapshot.initialWeightsByParticipant.get("new")).toBe(19n); // 2^4 + three misses
expect([...snapshot.previousConcertSongIds]).toEqual(["song-3"]);
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `npm test -- tests/setlist-history.test.ts`

Expected: FAIL because `@/lib/domain/setlist-history` does not exist.

- [ ] **Step 3: Implement the pure snapshot helper**

Filter `mainTrackCount <= 0`, sort by descending `startsAt` then ascending `id`, deduplicate participants and songs per event, calculate `r` and `m`, and use `1n << BigInt(r)` for `2^r`.

```ts
const recentMissCount = orderedEvents
  .slice(0, 10)
  .filter((event) => !new Set(event.participantIds).has(participantId)).length;
const lastAppearanceIndex = orderedEvents.findIndex((event) =>
  new Set(event.participantIds).has(participantId),
);
const recencyPosition = lastAppearanceIndex >= 0 ? lastAppearanceIndex + 1 : orderedEvents.length + 1;
const weight = (1n << BigInt(recencyPosition)) + BigInt(recentMissCount);
```

- [ ] **Step 4: Run history tests and verify GREEN**

Run: `npm test -- tests/setlist-history.test.ts`

Expected: PASS for all formula and qualification cases.

- [ ] **Step 5: Commit the snapshot unit**

```bash
git add src/lib/domain/setlist-history.ts tests/setlist-history.test.ts
git commit -m "feat: calculate participant history weights"
```

---

### Task 2: Sequential History-Weighted Ranking

**Files:**
- Modify: `src/lib/domain/setlist-algorithm.ts`
- Modify: `tests/setlist-algorithm.test.ts`

**Interfaces:**
- Consumes:

```ts
export type SelectionInput = {
  maxSetTrackCount: number;
  minParticipantsPerTrack?: number;
  historyEventCount: number;
  initialParticipantWeights: ReadonlyMap<string, bigint>;
  previousConcertSongIds: Set<string>;
  candidates: CandidateTrack[];
};

export function findParticipantsExceedingTrackLimit(
  candidates: Pick<CandidateTrack, "participantIds">[],
  maxTracksPerUser: number,
): string[];
```

- Produces the existing selected/backlog shapes plus:

```ts
type SelectionResult = {
  selected: RankedSetlistItem[];
  backlog: BacklogSetlistItem[];
  coverageCount: number;
  historyEventCount: number;
  initialParticipantWeights: Record<string, string>;
  rankedTrackIds: string[];
};
```

- [ ] **Step 1: Replace optimizer tests with failing sequential-ranking tests**

Cover score ordering, zeroing, entry-count tie-break, participant-count tie-break, creation/ID stability, known group reduction, repeat precedence, incomplete/minimum filters, duplicate seats, main/backlog split, zero limit, JSON-safe weight strings, and the track-limit helper.

```ts
function candidate(id: string, participantIds: string[]): CandidateTrack {
  return {
    id,
    songId: `song-${id}`,
    songTitle: id,
    artistName: "Artist",
    hasUnfilledRequiredSeats: false,
    participantIds,
    createdAt: new Date("2026-08-01T12:00:00.000Z"),
    matchedKnownGroupName: null,
  };
}

const result = buildSetlistRecommendation({
  maxSetTrackCount: 2,
  minParticipantsPerTrack: 1,
  historyEventCount: 3,
  initialParticipantWeights: new Map([
    ["u1", 16n],
    ["u2", 8n],
    ["u3", 4n],
  ]),
  previousConcertSongIds: new Set(),
  candidates: [
    candidate("shared-first", ["u1", "u2"]),
    candidate("u1-again", ["u1"]),
    candidate("fresh-after-zero", ["u3"]),
  ],
});

expect(result.rankedTrackIds).toEqual(["shared-first", "fresh-after-zero", "u1-again"]);
expect(result.initialParticipantWeights).toEqual({ u1: "16", u2: "8", u3: "4" });
```

- [ ] **Step 2: Run algorithm tests and verify RED**

Run: `npm test -- tests/setlist-algorithm.test.ts`

Expected: FAIL because the old optimizer ignores history weights and lacks the new audit fields/helper.

- [ ] **Step 3: Implement minimal sequential ranking**

Remove bitmask DP, bounded greedy/local-swap code, filled-seat and organic tie-break bonuses. Normalize unique participants, classify repeat/ineligible candidates, then repeatedly sort remaining eligible candidates with this comparator:

```ts
const leftScore = getScaledScore(left, currentWeights);
const rightScore = getScaledScore(right, currentWeights);
if (leftScore !== rightScore) return leftScore > rightScore ? -1 : 1;

const entryDelta = getMaxEntryCount(left, entryCounts) - getMaxEntryCount(right, entryCounts);
if (entryDelta !== 0) return entryDelta;
if (left.uniqueParticipantIds.length !== right.uniqueParticipantIds.length) {
  return right.uniqueParticipantIds.length - left.uniqueParticipantIds.length;
}
const createdAtDelta = left.createdAt.getTime() - right.createdAt.getTime();
return createdAtDelta || left.id.localeCompare(right.id);
```

Ordinary candidates return `10n * sum`; a known group returns `score === 0n ? 0n : 1n`. After shift, zero every participant weight and increment every participant entry count. Partition only after the full list is ranked.

- [ ] **Step 4: Run algorithm tests and verify GREEN**

Run: `npm test -- tests/setlist-algorithm.test.ts`

Expected: PASS with deterministic sequential order.

- [ ] **Step 5: Commit the ranking replacement**

```bash
git add src/lib/domain/setlist-algorithm.ts tests/setlist-algorithm.test.ts
git commit -m "feat: rank setlists by participant history"
```

---

### Task 3: Selection Strategy Schema Auditability

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260827220000_add_history_weighted_selection_strategy/migration.sql`
- Create: `tests/selection-strategy-schema.test.ts`

**Interfaces:**
- Produces `SelectionStrategy.HISTORY_WEIGHTED` in generated Prisma types.
- Preserves the existing `COVERAGE_FIRST` enum member and default for historic compatibility.

- [ ] **Step 1: Write the failing schema regression test**

```ts
expect(schema).toMatch(/enum SelectionStrategy[\s\S]*COVERAGE_FIRST[\s\S]*HISTORY_WEIGHTED/);
expect(migration).toContain(
  'ALTER TYPE "SelectionStrategy" ADD VALUE \'HISTORY_WEIGHTED\'',
);
```

- [ ] **Step 2: Run the schema test and verify RED**

Run: `npm test -- tests/selection-strategy-schema.test.ts`

Expected: FAIL because the enum and migration do not exist.

- [ ] **Step 3: Add the enum member and migration**

```prisma
enum SelectionStrategy {
  COVERAGE_FIRST
  HISTORY_WEIGHTED
}
```

```sql
ALTER TYPE "SelectionStrategy" ADD VALUE 'HISTORY_WEIGHTED';
```

- [ ] **Step 4: Generate Prisma client and run the schema test**

Run: `npm run db:generate && npm test -- tests/selection-strategy-schema.test.ts`

Expected: Prisma generation succeeds and the test passes.

- [ ] **Step 5: Commit the auditable strategy**

```bash
git add prisma/schema.prisma prisma/migrations/20260827220000_add_history_weighted_selection_strategy/migration.sql tests/selection-strategy-schema.test.ts
git commit -m "feat: add history weighted selection strategy"
```

---

### Task 4: Server Action History Integration

**Files:**
- Modify: `src/server/actions.ts`
- Modify: `tests/event-slug-actions.test.ts`

**Interfaces:**
- Consumes `buildParticipantHistorySnapshot`, `findParticipantsExceedingTrackLimit`, and the new `SelectionInput`.
- Produces one `SelectionRun` with `strategy: SelectionStrategy.HISTORY_WEIGHTED` and atomically rebuilt setlist items.

- [ ] **Step 1: Add failing server-action tests**

Extend `dbMock.event` with `findMany`. Assert the history query filters on earlier `PUBLISHED` events with `setlistItems.some.section = MAIN`, orders by `startsAt desc` then `id asc`, and selects main item song IDs and claimed seat user IDs.

Add fixtures for:

- one empty published event omitted by the query result;
- one real previous main set supplying both history participation and repeat song IDs;
- a claimed `isOptional: true` seat contributing exactly like a required claimed seat;
- an over-limit user causing rejection before `$transaction`; and
- a successful run persisting `strategy: HISTORY_WEIGHTED` and string weights.

```ts
expect(txMock.selectionRun.create).toHaveBeenCalledWith({
  data: expect.objectContaining({
    eventId: "event-1",
    startedById: "admin-1",
    strategy: SelectionStrategy.HISTORY_WEIGHTED,
    resultSummaryJson: expect.objectContaining({
      historyEventCount: 1,
      initialParticipantWeights: { "user-1": expect.any(String) },
    }),
  }),
});
```

- [ ] **Step 2: Run action tests and verify RED**

Run: `npm test -- tests/event-slug-actions.test.ts`

Expected: FAIL because the action still uses `findFirst`, does not build weights, and does not set the new strategy.

- [ ] **Step 3: Implement history loading and validation**

Load history with explicit relation filters and order. Convert each event to `HistoricalParticipationEvent`, using `setlistItems.length` as `mainTrackCount`, deduplicated claimed seat users, and main-track song IDs.

Build current candidates exactly once. Count each user's distinct current active track IDs with `findParticipantsExceedingTrackLimit`. Format affected users with `@telegramUsername`, then `fullName`, then user ID; throw before `$transaction`.

Pass snapshot weights, count, and previous songs to `buildSetlistRecommendation`. Explicitly set `SelectionStrategy.HISTORY_WEIGHTED` in `selectionRun.create`.

- [ ] **Step 4: Run domain and action tests**

Run: `npm test -- tests/setlist-history.test.ts tests/setlist-algorithm.test.ts tests/event-slug-actions.test.ts`

Expected: PASS.

- [ ] **Step 5: Run typecheck after generated-client integration**

Run: `npm run typecheck`

Expected: PASS with `SelectionStrategy.HISTORY_WEIGHTED` available.

- [ ] **Step 6: Commit the server integration**

```bash
git add src/server/actions.ts tests/event-slug-actions.test.ts
git commit -m "feat: use published set history in selection"
```

---

### Task 5: Product Copy and Canonical Documentation

**Files:**
- Modify: `src/app/admin/events/[slug]/page.tsx`
- Modify: `tests/admin-event-page.test.ts`
- Modify: `docs/ALGORITHM.md`
- Modify: `docs/FUNCTIONAL_GUIDE.md`
- Modify: `docs/TECHNICAL_REFERENCE.md`
- Modify: `README.md`
- Check: `docs/requirements-summary.md`
- Check only: `tests/smoke/app.smoke.spec.ts`

**Interfaces:**
- Produces accurate English/Russian admin copy and canonical documentation for operators and maintainers.
- Keeps the selection button and confirmation accessible names unchanged, so the smoke test need not be edited unless inspection proves otherwise.

- [ ] **Step 1: Write the failing admin-copy assertion**

Replace coverage-first expectations with assertions for history-weighted fairness in both locales, for example:

```ts
expect(source).toContain("participant history");
expect(source).toContain("истории участия");
expect(source).not.toContain("coverage-first");
```

- [ ] **Step 2: Run the copy test and verify RED**

Run: `npm test -- tests/admin-event-page.test.ts`

Expected: FAIL while the page still says `coverage-first`.

- [ ] **Step 3: Update UI copy and documents**

Describe recency weights, last-10 miss bonus, full weight for occupied optional seats, known-group reduction, sequential zeroing, previous real concert, main/backlog split, `bigint` audit serialization, and `O(T^2 * P)` runtime. Remove claims that exact or bounded maximum coverage is the active strategy.

Update README's headline selection capability to history-weighted fairness. Leave `docs/requirements-summary.md` unchanged if it contains only strategy-neutral curation statements.

Inspect the user's existing smoke-test diff. Do not edit it if the selection button/confirmation regex remains valid.

- [ ] **Step 4: Run copy and targeted regression tests**

Run: `npm test -- tests/admin-event-page.test.ts tests/setlist-limit.test.ts tests/setlist-order.test.ts tests/publish-setlist-action.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit product copy and documentation**

```bash
git add src/app/admin/events/[slug]/page.tsx tests/admin-event-page.test.ts docs/ALGORITHM.md docs/FUNCTIONAL_GUIDE.md docs/TECHNICAL_REFERENCE.md README.md
git commit -m "docs: explain history weighted setlist selection"
```

---

### Task 6: Final Verification and Documentation Hygiene

**Files:**
- Verify all changed implementation, migration, test, UI, and documentation files.
- Do not modify production data or run production-backed E2E selection.

**Interfaces:**
- Consumes the completed feature.
- Produces evidence that code, schema, tests, copy, and docs agree.

- [ ] **Step 1: Run focused feature tests**

Run:

```bash
npm test -- \
  tests/setlist-history.test.ts \
  tests/setlist-algorithm.test.ts \
  tests/selection-strategy-schema.test.ts \
  tests/event-slug-actions.test.ts \
  tests/admin-event-page.test.ts \
  tests/setlist-limit.test.ts \
  tests/setlist-order.test.ts \
  tests/publish-setlist-action.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run static verification**

Run: `npm run typecheck && npm run lint`

Expected: both commands pass with no warnings.

- [ ] **Step 3: Run the full unit suite**

Run: `npm test`

Expected: all Vitest tests pass.

- [ ] **Step 4: Run a production build**

Run: `npm run build`

Expected: Next.js production build completes successfully.

- [ ] **Step 5: Review smoke-test relevance without executing it**

Confirm `tests/smoke/app.smoke.spec.ts` still tests the selection confirmation flow and that its regex does not depend on removed `coverage-first` copy. Record that `npm run test:smoke` was intentionally skipped because local production mode is backed by production Postgres and selection rewrites setlist data.

- [ ] **Step 6: Review documentation categories**

Confirm the product guide, algorithm doc, technical reference, README, requirements summary, and smoke-test documentation all match the implemented behavior. Confirm no Kubernetes, Telegram-auth, or deployment documentation is affected.

- [ ] **Step 7: Inspect the final diff and commit any verification fixes**

Run: `git diff --check && git status --short && git log --oneline -8`.

If verification required a scoped fix, stage only its exact files and commit with a specific message such as `fix: align history weighted selection audit`.

Expected: no whitespace errors, no generated junk, and the user's unrelated working-tree changes remain present and uncommitted.
