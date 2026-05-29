# Board, FAQ, search and validation fixes — design

Date: 2026-05-29

Five independent fixes to the gig board / FAQ / song search. Decisions below were
approved interactively before implementation.

## 1. Sticky songs-table header on page scroll

**Problem.** The header `<th>`s use `position: sticky; top: …`, but the table lives inside
`.table-scroll { overflow-x: auto }`. Per the CSS overflow spec, `overflow-x: auto` forces
`overflow-y` to compute to `auto`, turning `.table-scroll` into a vertical scroll container.
Because that container never scrolls vertically (no max-height — the board grows with the
page), the sticky header sticks to the container, not the viewport, so it scrolls away.

**Evidence (Chromium).** Verified empirically: `overflow-x:auto` → header not stuck;
`overflow-x:clip` → header stuck but horizontal scroll lost; `overflow-x:auto` +
`translateY` on `<thead>` → header stuck at the offset, sticky-left column preserved,
horizontal scroll preserved.

**Decision.** Keep the page-grows-with-content model (no internal max-height scroll panel;
the existing style contract test stays valid). Remove the vertical `top-*` sticky from the
header cells (it cannot reach the viewport through the trapped container) and float the whole
`<thead>` with a JS `translateY` equal to the clamped distance needed to hold it just under the
sticky site header. Keep the corner cell `sticky left-0` for the horizontal sticky column.

- Pure helper `getStickyHeaderTranslateY({ tableTop, tableHeight, theadHeight, stickyOffset })`
  returns `clamp(0, stickyOffset - tableTop, tableHeight - theadHeight)` — unit tested.
- A client effect measures the site-header height for `stickyOffset`, recomputes on
  scroll/resize via rAF, and writes the transform onto the `<thead>`.

## 2. FAQ content fully editable per-locale; remove two big blocks

**Scope (approved):** Only the two existing content sections — Participation rules and
Line-up technical details — become per-locale editable. Hero title/intro and the feedback
form stay as code. The two large cards "Быстрый старт" / "Quick start" and
"Нужна помощь?" / "Need help?" are removed from `/faq`.

**Storage (approved):** A single locale-keyed JSON blob, not new per-field columns. Add one
`faqContentJson` text column to `SitePageContent`:
`{ "en": { "participationRules": "…", "lineupDetails": "…" }, "ru": { … } }`.
Legacy `participationRulesMarkdown` / `lineupDetailsMarkdown` columns are kept and used as a
read fallback when the JSON is absent. Built-in locale defaults remain the final fallback.

- Admin FAQ dialog gains four textareas (2 sections × en/ru). YouTube URLs unchanged.
- `getFaqPageData` returns resolved per-locale markdown; `resolveFaqMarkdown` reads the JSON
  blob first, then legacy column, then defaults.

## 3. iTunes search: pagination + better artist+title results

**Decision (approved): both.**
- API `GET /api/song-search` accepts `offset` (and keeps a per-page limit). Results past the
  first page are returned so the dropdown can lazy-load more on scroll. The internal artist
  lookup pool is widened beyond the previous hard cap of 8.
- The dropdown in `SongSearchField` becomes a scroll container that requests the next page
  when scrolled near the bottom and appends de-duplicated results.

## 4. Validation toasts hold longer than update toasts; show the configured number

- `FloatingToast` keeps its default for success/update, but validation/error toasts get a
  longer `autoHideMs`. The board's feedback auto-clear timer uses the longer value for
  `tone: "error"`.
- The `min-required-seats` message interpolates the gig's `minParticipantsPerTrack`. The
  server passes the number in the redirect (`error=min-required-seats&minRequired=N`) and the
  event page renders it into the toast description for both locales.

## 5. Publish button disabled until a track is selected

- Lift `selectedSong` state into `TrackProposalForm` and disable the "Publish proposal to
  board" `SubmitButton` while no song is selected.
- Server hardening: `createTrackAction` redirects with `error=no-song-selected` instead of
  throwing when song fields are missing.

## Testing

TDD for the pure/logic pieces: sticky translate helper, `resolveFaqMarkdown` JSON behavior,
song-search offset/pagination, toast duration selection, min-required interpolation, and the
publish-disabled behavior. Full `npm test` + `npm run lint` + `npm run typecheck` must pass
with no regressions.

---

# Documentation sync (2026-05-29)

After the fixes above I audited `docs/FUNCTIONAL_GUIDE.md` and `docs/TECHNICAL_REFERENCE.md`
against the actual code. The following drifts were found and corrected in those docs.

## Drifts fixed

| Area | Documented (stale) | Reality (now synced) |
| --- | --- | --- |
| Event statuses | Listed `CURATING` | Enum is `DRAFT / OPEN / CLOSED / PUBLISHED / ARCHIVED` (CURATING was removed); curation happens in `CLOSED`. |
| Product/route map | Missing `/about`, `/archive` | Both pages exist and are public. |
| API routes | Only `auth/telegram`, `song-search`, `song-catalog-request`, `healthz` | Also `/api/client-error` and `/api/livez`; song-search is paginated (`offset`). |
| Arrangement (Step 2) | 3 modes (`I'm in` / `Need player` / `Skip`) + presets "Full band / Power trio / Acoustic" | 4 modes: `I'm in` / `Required seat` / `Optional seat` / `Off`. No presets exist; inline invite per seat does. |
| Event config | No minimum-players field | `minParticipantsPerTrack` exists and gates publishing; was undocumented. |
| FAQ | "quick-start rules", non-editable | Per-locale (EN/RU) admin-editable markdown; the "Quick start" / "Need help" blocks were removed. |
| Song search | dedup + normalized shape only | Wider pool + local-catalog merge, artist+title relevance, `offset` pagination + `hasMore`, graceful local fallback when iTunes is down. |
| Realtime | Not described | Postgres `LISTEN/NOTIFY` → `/ws/board` WebSocket bridge in `server.mjs` → client `router.refresh()` with backoff + 15s safety refresh. |
| Observability | "minimal", Sentry listed as future | Structured `app_error` JSON logging via `recordAppError` (stderr + dated files) and `/api/client-error`; Error IDs. Sentry still not wired in code. |
| Testing/CI | E2E listed as future work | Playwright smoke suite exists and runs in CI (`npm run test:smoke`) against a built app + seeded Postgres. |

## What is accurate and was left as-is

Personas, the propose → assemble → curate → publish loop, seat states
(`OPEN/CLAIMED/UNAVAILABLE`), invite statuses, relational invariants, Telegram/session auth
model, selection-algorithm description, curation lock, and drummer sort all match the code.

---

# E2E test-case backlog (Playwright smoke layer)

The current smoke suite (`tests/smoke/app.smoke.spec.ts`) already covers: public page render +
nearest gig, local sign-in, join/release a seat, cross-session realtime, add-proposal + edit
track settings, sign-in `returnTo`, admin cockpit open, and the selection-algorithm confirm
dialog. The cases below are the highest-value gaps — they protect the business rules and the
five fixes from this spec, which currently have only unit coverage.

Conventions: each case seeds its own event/users via the existing helpers (`createSmokeEvent`,
`createSmokeTrack`, `signInLocally`) and asserts both UI and persisted DB state where relevant.

## P0 — guards and rules that prevent crashes / bad data

1. **Publish disabled until a track is selected (fix #5).**
   Open "Add song" without choosing a result → assert the "Publish proposal to board" button is
   `disabled`. Select a result → assert it becomes enabled and publishing succeeds. Guards the
   regression that previously crashed the page.

2. **Minimum-required-players validation shows the configured number (fix #4).**
   Seed an event with `minParticipantsPerTrack = N`. Propose a song marking fewer than `N`
   required seats → assert the publish is blocked and the toast text contains `N`, and that the
   error toast persists longer than a routine update toast.

3. **Per-user participation limit.**
   Seed `maxTracksPerUser = k`. Join `k` seats across tracks, then attempt one more → assert the
   block message and that no extra `TrackSeat` is claimed in the DB.

4. **Duplicate-song prevention.**
   Propose the same song twice in one event → assert the second attempt is rejected (inline
   error, no new `Track`).

5. **Ban enforcement.**
   Ban a user, then attempt to join/propose → assert the action is blocked server-side.

6. **Auth guards for admin surfaces.**
   As a guest and as a non-admin musician, navigate to `/admin` and `/admin/events/[id]` →
   assert redirect/forbidden and that no admin controls render.

## P1 — core collaboration flows

7. **Invite lifecycle.**
   Proposer invites another musician by Telegram username for an open seat → recipient sees it in
   `/profile` inbox → **accept** assigns the seat (DB + UI); separate run for **decline** (invite
   retained, seat stays open). Mock/stub Telegram bot delivery.

8. **Unknown-username invite.**
   Invite a username with no Jammers profile → assert an inline board error (not a crash page).

9. **Optional-seat request flow.**
   A musician requests an `Optional` seat → it appears as an outgoing request on their `/profile`
   and in the proposer/admin queue → approval assigns the seat.

10. **Registration window behavior.**
    Pre-open event: board visible, countdown shown, Join disabled. After `registrationClosesAt`
    (timer-based, status still `OPEN`): assert the board behaves as closed and mutations are
    rejected.

11. **Publish → public setlist.**
    Run selection, then publish → assert only `MAIN` tracks render in curated order on the public
    event page, with assigned musicians visible, and the event is `PUBLISHED`.

12. **FAQ per-locale editing (fix #2).**
    As admin, edit EN and RU markdown for both sections → assert `/faq` renders the new content in
    each locale and that the removed "Quick start" / "Need help" blocks are absent.

## P2 — curation, admin overrides, and resilience

13. **Manual curation.**
    Move a track backlog→main and main→backlog, reorder via drag-and-drop, and run drummer sort →
    assert resulting `SetlistItem` sections/order.

14. **Curation lock visibility.**
    Acquire a lock as admin A → admin B sees the lock owner/expiry and is gated from sensitive
    actions.

15. **Direct seat administration.**
    Admin assigns a user into a seat by username, clears a claimed seat, and cancels a track →
    assert DB state for each.

16. **Sticky board header on scroll (fix #1).**
    With a board taller than the viewport, scroll down → assert the `<thead>` stays pinned below
    the site header (bounded by the table), and horizontal scroll still works.

17. **Song-search pagination/scroll (fix #3).**
    Seed enough local-catalog matches for one artist that the target is past page 1. Type the
    artist, scroll the dropdown → assert more results load and the target becomes selectable.
    (Avoids depending on live iTunes in CI.)

18. **Missing-song request inline form.**
    Submit the manual request → assert in-place success state; simulate failure → assert the
    explicit error message (no full-page navigation).

19. **Client error reporting.**
    Force a client render error → assert the error boundary renders an `Error ID` and a report is
    POSTed to `/api/client-error`.

Suggested order of implementation: P0 first (they back the five fixes and the rules that cause
incidents), then P1, then P2. Realtime is already covered, so new cases should reuse the same
two-context pattern only where cross-session behavior is the thing under test.
