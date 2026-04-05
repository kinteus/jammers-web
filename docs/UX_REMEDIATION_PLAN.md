# UX Remediation Plan

## Why this plan exists

The product direction in `/docs/FUNCTIONAL_GUIDE.md` is solid, but the current interface still exposes too much system language and too little user guidance. The main experience should feel like:

1. Open the site and quickly choose a concert.
2. Open the concert and immediately understand which songs already exist.
3. Join a song with minimal friction, or propose a new one only when it improves the board.

Today, the interface often does the reverse:

- it introduces the system before the task,
- it shows explanation before action,
- it makes proposing feel as prominent as joining,
- it loses important actions on mobile,
- it exposes some actions to guests that they cannot actually complete.

This document captures the UX issues, the design principles used to fix them, and the next layers of work after the current implementation pass.

## Design principles for this product

### 1. Songs before settings

Musicians come to answer a practical question: "What is already on the board, and where can I help?"

The board and its songs must appear before configuration-heavy areas such as:

- arrangement explanations,
- proposal forms,
- catalog maintenance language,
- stage-plan theory.

### 2. Existing momentum before new input

If a concert already has good proposals with missing players, the interface should encourage filling those first. New proposals are valuable, but they should be framed as a second-order action after board review.

### 3. Clear state, clear next step

Every event state should answer:

- Is the board open?
- Can I join now?
- Can I propose now?
- What should I do first?

### 4. Mobile must remain actionable

Because many musicians will open the board from chat links or on the go, the mobile layout cannot be a read-only summary of the desktop board. Joining, releasing, skipping and inviting must be available on small screens too.

### 5. Do not show dead-end actions

If a guest cannot request a missing song, the UI should not show a fully interactive request form. Instead, it should explain the requirement and provide the correct next action.

## UX audit by surface

## Home page

### Problems found

- The hero prioritized platform language such as "workspace", "spreadsheet" and "selection flow" over the primary user journey.
- The "What ships in this version" block was release-oriented, not user-oriented.
- Event cards surfaced raw metrics but not their practical meaning.
- Published events were not clearly actionable destinations.
- The home page did not teach the expected sequence of actions.

### Fixes applied

- Reframed the hero around the real user path.
- Added an explicit 3-step journey.
- Reworked event cards to emphasize songs, open seats and tracks still needing players.
- Made published setlists clearly openable.
- Added supporting explanation for what happens after opening a concert.

### Recommended next layer

- Add event posters or stronger visual differentiation between event cards.
- Add relative time labels for registration close.
- Add lightweight recommendation hints such as "best for drummers" once instrument matching is available.

## Event page

### Problems found

- The top of the page emphasized stage-plan explanation before actual songs.
- The proposal composer appeared above the board, encouraging users to add before reviewing.
- Filtering was too limited for quick participation decisions.
- Guests could see a missing-song form they could not successfully submit.
- The page did not clearly communicate where the biggest role shortages were.

### Fixes applied

- Reordered the page so songs and board review come before proposal.
- Added "songs first" framing and filters for `all`, `need players`, and `mine`.
- Added top-of-page shortage summaries and direct links into actionable songs.
- Added guest sign-in prompts when the board is open.
- Gated missing-song requests to the correct user state.

### Recommended next layer

- Add anchor links from shortage roles to filtered song lists.
- Add per-track discussion or notes visibility without requiring board scanning.
- Add sort options such as "most complete", "newest", and "needs my instrument".

## Board interaction

### Problems found

- Desktop actions were available, but their intent was not always obvious.
- Mobile cards lost most of the operational actions and became mostly informational.
- Missing-seat information required too much scanning.
- Track rows did not summarize why a song still needed attention.

### Fixes applied

- Added consistent action controls on mobile.
- Improved track-level summaries such as "Needs vocals and bass".
- Clarified labels such as `Filled`, `Open`, and `Skipped`.
- Added song anchors so summary cards can jump users into the relevant row.

### Recommended next layer

- Add optimistic feedback or inline action confirmation.
- Add collapsible mobile grouping by "needs players" vs "ready".
- Add inline error states for action failures instead of relying on generic error boundaries.

## Proposal flow

### Problems found

- The composer was technically step-based, but it still felt like a large form.
- There was no immediate summary of what the arrangement currently meant.
- Users could forget to mark themselves in the song.

### Fixes applied

- Added arrangement summary counters.
- Added guidance that encourages claiming your own seat when appropriate.
- Tightened the copy so the flow reads as a guided decision, not a raw configuration panel.

### Recommended next layer

- Disable submission until a song is selected.
- Add inline validation that warns when no one is marked as already in.
- Add arrangement presets that adapt to the real lineup schema.

## Profile and invites

### Problems found

- The profile page behaved more like a settings form than a musician dashboard.
- Invites and current commitments were not surfaced as the main reasons to visit the page.
- Track cards did not make it easy to jump back into the live event board.
- The header mixed identity display with sign-out action.

### Fixes applied

- Reframed the profile as a dashboard.
- Added summary metrics and clearer quick actions.
- Added direct links back to the relevant event boards.
- Split visible identity from the sign-out control in the global header.

### Recommended next layer

- Group current songs by event.
- Add readiness markers or rehearsal confidence per assigned song.
- Add a personal condensed rehearsal view once that product direction is implemented.

## Highest-value next improvements after this pass

1. Add inline action feedback and server-action error presentation.
2. Add stronger event-state messaging, especially for closed vs published boards.
3. Add instrument-aware recommendations once profile data can be used safely.
4. Add public past-event archives with stronger navigation from home.
5. Add richer mobile board navigation for long events with many songs.
