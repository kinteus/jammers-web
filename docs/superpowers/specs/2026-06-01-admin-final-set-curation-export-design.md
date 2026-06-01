# Admin Final Set Curation Export Design

## Goal

Improve the admin gig final-set workspace so admins can quickly assemble the running order, export the current main set to CSV, and inspect songs with the same YouTube affordance used in the gig table.

## Confirmed Behavior

- Remove drag-and-drop from the admin setlist stack.
- Keep arrow controls for single-song movement.
- Keep drummer-cluster arrow controls for the main set.
- Main-set order changes are local draft changes until the admin clicks Save.
- Multiple song or drummer-cluster moves can happen quickly without waiting for each database write.
- Saving the order persists the whole current main-set order in one existing `reorderSetlistSectionAction` call.
- Saving does not refresh the page.
- Backlog remains immediately persisted for its own reorder controls and section-move forms unless changed by the final-set workflow.
- Song titles in the admin setlist stack link to YouTube search for `artist + title`, matching the public gig table behavior.
- Main set appears as a full-width admin block with flatter song cards.
- Backlog appears below the main set.
- CSV export is available at any time from the main-set block and exports the currently visible main-set order, including unsaved local draft order.

## CSV Format

The export uses these columns in order:

id, Band, Song, Comments from orgs, Status, Vocal 1, Vocal 2, Vocal 3, Guitar 1, Guitar 2, Bass, Drums, Keyboard, Additional Tool 1, Additional Tool 2, PB, Tone, Originator, Next Song, Cover (url), Duration (мс)

Rules:

- `id` is the visible 1-based order in the exported final set.
- `Band` is artist name.
- `Song` is song title.
- `Comments from orgs` is the track comment, if any.
- `Status` is empty for every row.
- Instrument columns contain only claimed real users.
- Empty, unavailable, open, optional, and placeholder seats export as empty cells.
- `PB` is populated for playback-required tracks, otherwise empty.
- `Tone`, `Cover (url)`, and `Duration (ms)` are empty.
- `Originator` is the user who proposed the track.
- `Next Song` is the next row's `id`; the final row is empty.

## Implementation Shape

`AdminSetlistStack` remains the focused client component for setlist ordering. It gains optional draft-save and CSV-export behavior for the main set, while the page provides richer item data needed by CSV export. The existing server action remains the persistence boundary, preserving current lock checks and safe two-phase reindexing.

## Testing

Update `tests/admin-setlist-stack.test.tsx` first:

- prove draggable attributes and drag handlers are gone from rendered cards,
- prove song titles render as YouTube links,
- prove main-set movements do not call persistence until Save is clicked,
- prove multiple cluster moves are saved in one payload,
- prove CSV export includes the required headers, current draft order, blank `Status`, blank unused instrument fields, and `Next Song`.

Docs to update after implementation:

- `docs/FUNCTIONAL_GUIDE.md`
- `docs/TECHNICAL_REFERENCE.md`
- `README.md` headline capabilities, because it currently mentions drag-and-drop ordering.
