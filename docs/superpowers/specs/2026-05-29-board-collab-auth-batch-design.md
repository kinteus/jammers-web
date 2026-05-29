# Board collaboration + auth batch — design

Date: 2026-05-29

A batch of 11 changes spanning Telegram auth, the songs board table UI, the
invite/seat lifecycle, bot notifications, the personal profile, and the
track propose/edit flow. Decisions captured from the user during brainstorming
are noted inline.

## 1 + 1.1 — Telegram username required for board write access

**Constraint (researched):** Telegram exposes a username only when the user has
made it public; there is no official API to receive a private/non-public
username. The stable identifier is the numeric `id` (`telegramId`).
`request_access=write` only grants bot-messaging permission, not username access.

Therefore we do **not** hard-reject login.

- A user is in the **"needs username"** state when logged in but
  `telegramUsername` is null (covers brand-new logins and pre-existing users).
- **Write actions are blocked** while in this state: propose, claim, release,
  invite, respond-to-invite, edit arrangement, delete/cancel track, optional
  toggle, closed-optional requests. Reads stay open. Enforced by a shared
  server guard (`assertUserHasTelegramUsername`) inside the relevant actions,
  plus UI gating (controls hidden/disabled with an explanatory note) and a
  prominent prompt on `/profile` and the event board.
- **Manual entry in profile:** the profile username field is editable **only
  while `telegramUsername` is null**. Once set (via Telegram login or manual
  entry) it becomes **read-only** — same behavior as for users who already have
  a username. Validate Telegram format (5–32 chars, `[A-Za-z0-9_]`, must start
  with a letter), store normalized lowercase, handle the unique-constraint
  collision gracefully with a friendly error.
- *Tradeoff:* manual entry is not ownership-verified, but message delivery uses
  `telegramId` (the real account) and the unique constraint prevents two
  accounts from claiming the same handle.

Touch points: `src/lib/auth/telegram.ts`, `src/server/upsert-telegram-user.ts`,
`src/app/profile/page.tsx`, `src/server/actions.ts` (`updateProfileAction` +
write guards), profile/board UI.

## 2 — "Position already taken" bot message (new)

Does not exist today (invite-accept silently cancels other PENDING invites; a
direct claim leaves them PENDING). Build `sendTelegramSeatTakenMessage` and wire
it on all claim paths — `runClaimSeat`, `runRespondToInvite` (accept),
`adminAssignSeatAction`: set other PENDING invites for that seat to CANCELED and
message those invitees. EN/RU, `Promise.allSettled`, delivery failures ignored.

## 3 — Horizontal scroll collision (CSS)

The sticky song column has a semi-transparent row background, so scrolling seat
cells bleed through. Give the sticky song `<td>` a solid opaque base layer
matching the row tone, keep its right shadow, ensure seat cells sit below it.
No change to overflow/max-width approach.

## 4 — Delete button broken for proposer (bug)

Server already allows proposer when board is OPEN. Reproduce, find the real
cause (suspects: invalid nested `<form>`, event-lock redirect), fix with a
regression test.

## 5 — Anyone can invite to a seat

Relax UI `canInvite` and `runInviteToSeat` so any logged-in user (with a
username) can invite to OPEN seats while the board is OPEN. Closed/published
optional request flow unchanged.

## 6 — Desktop full-bleed table + one-line Artist–Track

Board section breaks out to full viewport width on desktop (only this section;
other pages keep the 1440px cap). Song cell line 1 becomes "Artist — Track" on
one line, smaller and lighter (~0.95rem, medium weight), artist truncated first
so the track title stays readable; proposer + readiness on a compact secondary
line. Mobile unchanged.

## 7 — Must seat yourself to propose (regular users)

`createTrackAction`: if a non-admin proposer claims 0 seats → reject with
`error=no-self-seat` toast. Admins exempt. Client disables submit + inline hint
for non-admins until an "I'm in" seat is chosen. Ends invite-only proposals for
non-admins (intended).

## 8 — Profile invites show lineup + open positions

Extend invitations query to include `track.seats` (+ `user`, `lineupSlot`).
Invite panel shows who's already seated (`Seat: @user`) and which positions are
still open.

## 9 — Stable song numbers under filtering

Compute `trackNumberById` from the full ordered `boardTracks` list (pre-filter)
and pass to the table; use for desktop + mobile instead of array index.
Filtering/sorting no longer renumbers. Published final set keeps setlist-order
numbers (already the `boardTracks` order when PUBLISHED).

## 10 — Notify author when track completes

`maybeNotifyTrackComplete` after each successful claim path; compare
`isComplete` before/after and message `track.proposedBy` on the transition to
complete. Fires once per transition; skips if proposer has no `telegramId`.

## 11 — Full arrangement re-edit via the compose modal

Add an edit mode to the compose modal (launcher/form/composer/seat-planner),
opened from an edit button (proposer while OPEN; admin anytime).

- Song: locked for proposer; editable for admin (reuse `adminReplaceTrackSongAction`).
- Seats pre-hydrated from current seats. OPEN seats fully editable. Seats
  claimed by others: proposer cannot set to n/a (disabled, shown occupied);
  admin can (releases occupant). Proposer's own claimed seat editable.
- New `updateTrackArrangementAction` updates existing seat rows in place
  (preserving untouched claims), creates invites for newly opened seats,
  re-applies min-participant/role-family checks. Replaces the limited optional
  toggle popover (comment/flags stay editable in the modal's notes section).

## Testing strategy

TDD per item: unit tests for server actions (auth guard, self-seat,
invite permission, arrangement update, notifications fan-out, stable numbering
helper), component tests for profile invites + seat planner edit hydration, and
a CSS regression checked via the existing Playwright smoke where practical.
Full `vitest`, `lint`, `tsc` must stay green.
