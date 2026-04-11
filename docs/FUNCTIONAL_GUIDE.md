# The Jammers Functional Guide

## Purpose

The Jammers is a public web application for assembling concert setlists in a way that feels closer to a live stage sheet than to a raw spreadsheet. The product is designed for music communities where:

- admins open a new concert board before each event,
- musicians propose songs and self-assemble lineups,
- admins curate the final show from the collected proposals,
- the resulting setlist is published back to the whole community.

The application replaces the historical spreadsheet workflow with a structured product while preserving the same core mental model: one row per song, one column per stage role, quick scanning for missing players, and explicit curation controls.

## Personas

### Guest

A guest is an unauthenticated visitor. Guests can:

- browse the public home page,
- open public event boards,
- see the board and published setlists,
- understand the event rules and lineup requirements,
- navigate to sign-in.

Guests cannot:

- propose songs,
- claim seats,
- invite other users,
- edit their musician profile,
- access admin tooling.

### Musician

A musician is a registered user authenticated through Telegram or the development fallback in local environments. Musicians can:

- maintain a profile,
- declare their instruments,
- propose songs,
- define an arrangement for a proposed song,
- join open seats on songs,
- leave songs they are part of,
- invite other users into open seats on songs they proposed,
- review pending invitations,
- see their personal playing commitments.

### Admin

An admin can do everything a musician can, plus:

- create events,
- configure event rules,
- manage stage lineups,
- manage the song catalog,
- moderate users with bans and ratings,
- maintain known groups,
- force-assign or clear seats,
- acquire a curation lock,
- run the setlist selection algorithm,
- reorder and move tracks between main set and backlog,
- publish the final setlist.

## Product map

The current application exposes the following main surfaces:

- `/`
  Public home page with current events and recently published events.
- `/profile`
  Telegram sign-in, local development sign-in, profile editing, invite inbox, and personal playing view.
- `/events/[slug]`
  Public event board and musician collaboration workspace.
- `/admin`
  Admin dashboard for global operations.
- `/admin/events/[slug]`
  Event-level curation and publishing console.

## Core product concepts

### Event

An event is a concert or jam session with:

- title and description,
- venue and start time,
- registration opening and closing window,
- maximum allowed main-set duration,
- limit on how many tracks one user may join,
- whether playback is allowed,
- stage notes,
- lineup slots that define the available stage roles.

### Song

A song is the canonical catalog entry composed of:

- artist,
- title,
- optional duration,
- optional notes.

Songs are reused between events. When a user chooses a song from external search, it is automatically materialized into the local catalog if it does not already exist.

### Track proposal

A track is the event-specific proposal of a song. It contains:

- a reference to the event,
- a reference to the song,
- the proposing user,
- optional notes for the band,
- a playback flag,
- a set of track seats generated from the event lineup,
- its current state.

The same song cannot be actively proposed twice for the same event.

### Seat

A seat is one position on one proposed song, for example:

- `Drums`
- `Guitar 1`
- `Guitar 2`
- `Vocals 1`
- `Keys`

Every seat is in one of three states:

- `OPEN`
  The part is part of the arrangement and still needs a player.
- `CLAIMED`
  The part is assigned to a concrete musician.
- `UNAVAILABLE`
  The part is intentionally not used in this arrangement.

### Invitation

An invitation is an explicit request sent from the proposer or an admin to another user for a specific seat on a specific track.

Invitation statuses:

- `PENDING`
- `ACCEPTED`
- `DECLINED`
- `CANCELED`
- `DELIVERY_FAILED`

### Main set and backlog

After registration closes, admins run the selection algorithm. The result is split into:

- `MAIN`
  Tracks selected for the candidate final show.
- `BACKLOG`
  Tracks retained but not selected into the main set.

Admins can move tracks between these sections manually.

## Musician-facing functionality

## 1. Registration and sign-in

### Telegram sign-in

The intended production path is Telegram authentication. Telegram username is the primary public identity in the product and is used for:

- invites,
- lineup visibility,
- published track rosters,
- collaboration references across the product.

### Local development sign-in

When development auth is enabled in non-production environments, `/profile` exposes a local sign-in form. This is intended only for:

- local testing,
- demo flows,
- CI-friendly manual verification.

It must be disabled in production.

## 2. Musician profile

Authenticated users can edit:

- Telegram username
  Required. If the user is linked through Telegram auth, the username becomes read-only to preserve identity integrity.
- full name,
- phone,
- email,
- bio,
- primary instruments.

Primary instruments are currently used for profile completeness and future matching scenarios. They are also useful context for admins and collaborators.

## 3. Viewing an event board

The public event page shows:

- event title,
- date and venue,
- current effective registration status,
- board summary metrics,
- registration rules,
- lineup summary,
- board explanation,
- proposal composer when registration is open and the user is authenticated,
- board table,
- published setlist once the event is published.

The page supports a `mine=1` filter, allowing a user to focus only on songs where they are already participating.

## 4. Proposing a song

When event registration is open and the user is signed in, the user can create a track proposal.

The proposal flow is intentionally split into two steps.

### Step 1. Choose the track

The user searches by:

- song title,
- artist name,
- or both.

The application queries the iTunes Search API in real time and shows a live result list. From this list the user can:

- browse candidate matches,
- see artwork, duration, and album metadata when available,
- confirm one match,
- automatically persist it into the local catalog.

If the desired track cannot be found, the user can fall back to a manual song request form lower on the page.

### Step 2. Set the arrangement

After selecting a track, the user defines how this song should be staged. For every seat generated from the event lineup, the user chooses one of:

- `I’m in`
  The proposing user is immediately assigned to this seat.
- `Need player`
  The seat is part of the arrangement but still open.
- `Skip`
  The seat is intentionally not used for this arrangement.

The arrangement builder also offers quick presets such as:

- Full band,
- Power trio,
- Acoustic.

These reduce the amount of repetitive seat-by-seat interaction for common setups.

### Additional proposal fields

The proposer can also add:

- notes for the band,
- playback flag if the event allows playback usage.

### Validation rules during proposal

The backend enforces:

- the user must not be banned,
- the event must still allow modifications,
- the same song cannot already exist as an active proposal in the same event,
- if one user claims multiple seats on the same song, each claim must belong to a different instrument type,
- if the user immediately claims seats, the event-level track participation limit must still be respected.

## 5. Requesting a missing song

If the track is not available in external search, a musician can submit a manual request containing:

- artist,
- track title,
- optional comment.

This request is stored for admins and appears in the admin dashboard.

## 6. Joining a seat

From the board table, authenticated users can join any seat that is:

- open,
- still editable under event rules,
- not blocked by ban or event closure,
- not a duplicate instrument-type claim for this user on the same song,
- within the user’s allowed event track limit.

The user joins the exact seat they click. Seat joins are server-validated and persisted atomically.

## 7. Leaving a seat

A user can release a seat they occupy while the board remains editable. The proposer or an admin can also remove a claimed seat occupant.

This supports:

- lineup adjustments,
- resolving mistakes,
- voluntary dropouts before registration closes.

## 8. Marking a seat as skipped

If the proposer or an admin decides that a role is not used in the arrangement, the seat can be marked as unavailable. Regular users cannot override an already claimed seat into a skipped state.

## 9. Inviting another musician

For open seats, the proposer or an admin can invite another user by Telegram username.

The invite flow performs the following:

- resolves the recipient by username,
- creates an invitation record,
- attempts Telegram bot delivery,
- records delivery failures if messaging cannot be completed,
- shows pending invites on the board.

This allows lineup assembly without requiring everyone to actively monitor the board at all times.

## 10. Viewing and responding to invites

On `/profile`, users see all pending seat invites. For each invite they can:

- review the song,
- see which seat is being offered,
- see who invited them,
- accept,
- decline.

When accepted, the seat becomes assigned to the recipient. When declined, the invitation is retained for auditability but no assignment occurs.

The profile page also shows outgoing optional-seat requests sent by the user, so musicians can track who is still waiting on approval.

## 11. Personal playing dashboard

The profile page also shows all songs where the user is currently assigned to a seat. For each entry the page displays:

- artist and song,
- seat label,
- event date,
- visible lineup of the song.

This gives musicians a simple personal “what am I playing?” overview.

## Board experience

## 12. Stage-sheet table board

The event board is intentionally table-first and mirrors the long-used spreadsheet workflow.

### Layout

- one row per track,
- a sticky first column for track information,
- grouped headers by role family,
- one compact seat cell per stage position,
- mobile fallback cards when a desktop table would be too dense.

### Track metadata shown in the sticky column

- title,
- artist,
- proposer,
- playback badge,
- “Mine” badge when relevant,
- “Needs X more” badge based on open seats,
- optional notes,
- remove action for authorized users.

### Seat cell behavior

Each cell displays:

- current state,
- current occupant or “Need player”,
- pending request summary with requester details when available,
- primary action relevant to the current viewer.

Current action patterns include:

- `Join`
- `Release`
- `Skip`
- `Invite`

The table is optimized for quick scan, not for large card-style micro-layouts.

## 13. Published setlist view

Once admins publish the event, the event page additionally exposes the final ordered setlist:

- only tracks in the `MAIN` section,
- in their curated order,
- with visible assigned musicians per seat.

This turns the collaboration board into a final public show plan.

## Admin-facing functionality

## 14. Global admin dashboard

The admin home page aggregates several responsibilities.

### Event creation

Admins can create new events with:

- title,
- description,
- start time,
- registration close time,
- venue,
- venue map URL,
- maximum set duration,
- maximum tracks per user,
- stage notes,
- playback policy,
- lineup JSON.

### Song catalog maintenance

Admins can manually upsert songs into the internal catalog with:

- artist,
- track title,
- duration,
- notes.

This complements, but does not replace, external song search.

### Moderation

Admins can:

- ban users temporarily or permanently,
- record admin-only ratings and notes about musicians.

### Known groups

Admins can define pre-formed groups by:

- group name,
- optional description,
- exact set of member Telegram usernames.

These groups affect setlist selection priority.

### Global queue visibility

The dashboard also shows:

- pending song requests,
- recent users,
- events.

## 15. Event settings administration

On `/admin/events/[slug]`, admins can edit event configuration after creation:

- title and description,
- times,
- venue,
- limits,
- stage notes,
- playback policy,
- lineup JSON.

This page is the operational control center for a specific event.

## 16. Event status transitions

Events move through the following statuses:

- `DRAFT`
  Event exists but is not open for participation.
- `OPEN`
  Musicians can propose tracks, claim seats, and invite others.
- `CLOSED`
  Registration is not accepting new participant changes.
- `CURATING`
  Admin curation is underway.
- `PUBLISHED`
  Final setlist is public.
- `ARCHIVED`
  Historical terminal state for long-term retention.

Admins can set the main statuses directly from the event admin page. In addition, timer-based registration closure is enforced server-side.

## 17. Curation lock

Before sensitive curation actions, an admin can acquire a lock. The lock is intended to:

- avoid concurrent curation collisions,
- make ownership of the current editing session explicit,
- protect selection and publishing flows.

The UI shows the current lock owner and expiration time when a lock exists.

## 18. Running the selection algorithm

Once registration is closed, admins can trigger the setlist algorithm. The algorithm tries to maximize unique participant coverage while respecting:

- set duration budget,
- prior-gig song exclusion,
- known-group de-prioritization.

The output is split into main set and backlog.

## 19. Drummer-based sort

Admins can sort the main set by drummer. This is useful when operationally planning:

- hardware transitions,
- setup minimization,
- pacing for drum change logistics.

The resulting order can still be adjusted manually afterwards.

## 20. Manual curation of main set and backlog

After selection, admins can manually move tracks:

- from backlog to main,
- from main to backlog,
- to a different order index.

This ensures the algorithm remains a recommendation engine, not a hard lock on the final artistic or operational decision.

## 21. Publishing the final setlist

When the main set is ready, admins can publish it. Publishing:

- marks the event as published,
- exposes the public final setlist to all visitors,
- turns the collaboration board into a final public event artifact.

## 22. Direct seat administration

Admins can override seat assignments for any track:

- assign a user into a seat by Telegram username,
- clear a claimed seat,
- cancel a whole track if necessary.

These tools are important for resolving real-world exceptions near the event date.

## Business rules

## Participation limits

- Each event has a maximum number of tracks a single user may join.
- The limit is enforced when a user joins or initially proposes a song with claimed seats.

## Event closure

- Registration can be closed manually through status changes.
- Registration can also close by timer.
- The backend enforces closure even if the client UI is stale.

## Duplicate prevention

- Active duplicate songs for the same event are blocked by application logic and database uniqueness.

## Ban enforcement

- Banned users are blocked from participation mutations.

## Known groups and fairness

- Known groups are deprioritized during selection so organically assembled lineups are favored.

## Previous-gig repetition control

- Songs from the immediately previous published concert are excluded from selection.

## Current implementation boundaries

- Spotify auth-based search is not currently implemented; the app uses iTunes Search API because it is open and integration-light.
- Rich messaging workflows beyond Telegram invites are not implemented.
- Files, charts, and analytics exports are minimal in the current release.
- There is no rehearsal scheduling or attendance confirmation module yet.
- There is no public search or archive browsing UI for historical events beyond current published views.

## Functional summary

In product terms, The Jammers currently supports the full end-to-end loop:

1. admin creates an event,
2. musicians sign in,
3. musicians propose and assemble songs,
4. admins moderate and refine,
5. admins run selection,
6. admins curate and publish the setlist,
7. musicians review their assignments and the public final result.
