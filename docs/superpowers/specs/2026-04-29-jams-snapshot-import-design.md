# Jams Snapshot Import Design

## Goal

Import `/Users/maksimnaumov/Downloads/Jams_db_snapshot.xlsx` into production so archive gig statistics, played songs, song recurrence, originators, and user profile statistics match the community history.

## Data Rules

- Treat each worksheet named `yyyy.mm.dd` as one historical gig.
- Name each imported event as `Гиг The Jammers <day> of <English month> <year>`, for example `Гиг The Jammers 19 of April 2026`.
- Import every non-empty artist/title row as a historical setlist item. Older worksheets have blank, `#REF!`, `0`, or missing statuses even when they represent real past gigs.
- For performer seats, read only role columns before `Additional Tool 1`.
- Ignore `Additional Tool 1` and every column to its right except `Originator`.
- Use `Originator` as `Track.proposedBy` when present and valid. Use `legacy_import` when it is missing.

## Song Identity

- Add nullable unique `Song.itunesTrackId`.
- Save iTunes external ids from current app song search selections into `Song.itunesTrackId`.
- During import, resolve songs by iTunes id when available, otherwise by normalized artist/title slug.
- Report unresolved iTunes matches during dry-run; these rows still import using local catalog identity so historical statistics can be correct for the available source data.

## User Identity

- Normalize Telegram handles by trimming `@`, removing spaces, and comparing lower-case.
- Match existing users case-insensitively by `telegramUsername`.
- Create missing valid usernames as `USER` with `fullName` equal to the normalized username.
- Treat placeholders such as `optional`, `n/a`, `none`, and empty cells as open or unavailable seats, not users.
- Produce a dry-run report of case collisions and suspicious near matches before production writes.

## Safety

- Implement `analyze`, `dry-run`, and `apply` modes.
- `analyze` reads only the workbook and reports parsed counts.
- `dry-run` reads production through the local tunnel and reports planned creates/updates without writing.
- `apply` performs idempotent event replacement for imported legacy events inside transactions.
- Run archive statistics verification before and after applying: global totals, per-year totals, and selected per-user totals.
