# Requirements Summary

## Source consolidation

The PDF and the follow-up text overlap, but the newer textual brief was treated as the canonical source wherever they conflict.

### Accepted scope

- Telegram is the primary and required authentication identity.
- Telegram username is the main public identifier for collaboration and invites.
- Admins can create and configure events, open and close registration, moderate songs and participants, manage bans, and publish a final setlist.
- Users can propose songs from live song search, request missing songs, claim multiple seats on a song, invite registered users, and leave seats while the board is open.
- Event rules include max set duration, max tracks per user, lineup configuration, playback support, and registration closing time.
- Admins maintain a registry of known groups whose songs should rank below organically assembled bands during selection.
- The final setlist has two sections: main set and backlog, with manual admin editing after algorithmic recommendation.

### Deferred from PDF

- Google and email-based registration or fallback are not implemented in this release.
- Email communications are not included.
- Advanced filtering and richer musician-rating analytics screens are intentionally simplified to keep the first release cohesive and testable.

## Assumptions

- Song duration comes from the song catalog and is used as the input to set duration constraints.
- Known groups are matched by exact member set when running the selection algorithm.
- Editing the event lineup after tracks already exist is intentionally restricted to avoid destructive seat reshaping.
- Telegram bot delivery depends on valid production credentials and users having an active Telegram link with the bot.
