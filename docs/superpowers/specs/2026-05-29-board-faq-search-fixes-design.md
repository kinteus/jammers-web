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
