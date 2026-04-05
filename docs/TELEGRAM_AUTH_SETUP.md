# Telegram Auth Setup

## Readiness summary

The application is functionally ready for Telegram-based sign-in, but production launch still depends on external Telegram and deployment configuration.

What is already implemented in the app:

- Telegram Login Widget on `/profile`
- Telegram payload verification through bot-token HMAC
- server-side session creation in PostgreSQL-backed `AuthSession`
- merge/link of an existing imported user by Telegram username or Telegram ID
- automatic creation of a brand-new user on first successful Telegram sign-in
- Telegram bot delivery for invites and approval requests

What must still be configured outside the app:

- a real Telegram bot in BotFather
- widget bot username in environment variables
- bot token in environment variables
- production `NEXT_PUBLIC_APP_URL`
- production `SESSION_SECRET`
- the production domain connected to the Telegram login widget
- HTTPS on the final public domain

## Required environment variables

Use [.env.production.example](/Users/maksimnaumov/jammers-web/.env.production.example) as the base.

Required for production:

- `NODE_ENV=production`
- `DATABASE_URL`
- `SESSION_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
- `TELEGRAM_BOT_TOKEN`
- `ENABLE_DEV_AUTH=false`

Strongly recommended:

- `SESSION_TTL_HOURS=168`
- `TELEGRAM_AUTH_MAX_AGE_SECONDS=86400`
- `SESSION_COOKIE_NAME=jammers_session`

## How auth works end to end

1. A user opens `/profile`.
2. The Telegram widget is rendered from `telegram.org/js/telegram-widget.js`.
3. Telegram redirects signed auth data to `/api/auth/telegram`.
4. The backend verifies the HMAC signature using `TELEGRAM_BOT_TOKEN`.
5. The app upserts the user:
   - first by `telegramId`
   - otherwise by normalized `telegramUsername`
6. The app creates a server-side `AuthSession` record and sets an HTTP-only cookie.
7. The user is redirected back to `/profile` as an authenticated musician.

## Existing imported users

This is the important case for the legacy setlist import.

If a musician already exists in the database from the Excel import:

- and their current Telegram username matches the imported username,
- then the first successful Telegram sign-in links that existing row,
- `telegramId` is attached to that user,
- all historical statistics, profile data, future invites, and board participation remain on the same account.

Notes:

- username matching is normalized to lowercase in the app, so `RockAt777` and `rockat777` now map to the same stored identity.
- the person should have a Telegram username set in Telegram settings
- if the imported username contains a typo, the login will create a separate new account instead of linking the old one

If an imported user does not link correctly:

1. Find the existing imported user in the database.
2. Compare their stored `telegramUsername` with the real Telegram username.
3. Fix the stored username once.
4. Ask the person to sign in again through Telegram.

## New users

If a musician is not yet in the database:

- successful Telegram sign-in creates a new `User` row automatically
- the new account gets `telegramId`, `telegramUsername`, `fullName`, and `avatarUrl`
- after that they can:
  - claim seats
  - receive invites
  - approve or accept requests
  - complete their profile

Important limitation:

- if a brand-new person has never signed in before, other users usually cannot invite them by Telegram username yet, because invite lookup currently searches the application database first
- the new person should sign in once before others try to invite them

## Telegram-side setup

Configure the bot in BotFather:

1. Create or choose the bot.
2. Copy its token into `TELEGRAM_BOT_TOKEN`.
3. Copy its username without `@` into `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`.
4. Set the website domain for Telegram Login to the exact production host used by `NEXT_PUBLIC_APP_URL`.

Operational recommendation:

- use the same bot for both login widget verification and invite delivery

## Deployment checklist

Before launch:

1. Provision PostgreSQL and apply migrations.
2. Set the production environment variables.
3. Deploy behind HTTPS.
4. Make sure `NEXT_PUBLIC_APP_URL` exactly matches the public origin.
5. Disable dev auth with `ENABLE_DEV_AUTH=false`.
6. Open `/profile` and confirm the Telegram widget is visible.
7. Sign in with an already imported user and confirm:
   - the account opens the existing profile
   - no duplicate user is created
8. Sign in with a brand-new Telegram account and confirm:
   - a new user row is created
   - profile loads normally
9. Ask the new user to start the bot chat once, then test an invite.

## Recommended smoke test plan

### Case 1: Existing imported user

1. Pick a user already present in historical imports.
2. Confirm their `telegramUsername` is correct in the database.
3. Sign in through Telegram.
4. Confirm the same user record now has `telegramId`.
5. Confirm historical stats are still attached to that profile.

### Case 2: New user

1. Sign in through Telegram with an account not present in the database.
2. Confirm a new user row appears.
3. Open `/profile` and fill instruments if needed.
4. Start the Telegram bot chat.
5. Invite that user from a gig board by username.

### Case 3: Invite delivery

1. Invite a user who has linked Telegram and started the bot.
2. Confirm `TrackInvite` is created.
3. Confirm Telegram delivery succeeds.
4. Confirm the recipient can accept or decline in the app.

## Known constraints

- A user without a Telegram username is a poor fit for the current product model, because usernames are the main collaboration identity.
- Invite delivery requires the recipient to have a linked `telegramId`.
- In practice, the recipient should also have started the bot chat at least once.
- If `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` is missing, the Telegram widget will not render.
- If `TELEGRAM_BOT_TOKEN` is missing or wrong, login verification will fail.
- If the production domain is not configured correctly in Telegram, widget login will fail before the app can create a session.

## Launch verdict

The application is ready for Telegram-auth launch after external Telegram and environment setup is completed.

Inside the codebase, the core auth flow is already present and working. The remaining work is operational setup, not a missing authentication feature.
