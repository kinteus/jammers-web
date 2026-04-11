# The Jammers Technical Reference

## Scope

This document complements the short architecture overview and deployment guides with a more implementation-oriented description of the current system.

It is intended for:

- maintainers,
- staff or principal engineers reviewing the system,
- release engineers,
- developers onboarding into the repository,
- future contributors extending the domain model.

## Technology stack

## Application layer

- Next.js 15 App Router
- React 19
- TypeScript
- Next.js server actions for mutations
- server-rendered route handlers and pages

## Data layer

- PostgreSQL
- Prisma ORM
- explicit Prisma migrations

## UI layer

- Tailwind CSS
- small internal UI primitives in `src/components/ui`
- responsive stage-sheet board design

## Validation and domain safety

- TypeScript structural typing
- Prisma relation constraints
- server-side rule guards in domain modules

## Testing and quality

- Vitest for domain logic regression tests
- ESLint
- TypeScript typecheck
- production build validation

## Delivery and operations

- Docker image build
- GitHub Actions CI
- GHCR release image publishing
- Kubernetes manifests with probes, HPA, and migration job pattern

## System architecture

The application is a single deployable monolith. This is a deliberate tradeoff:

- one codebase for UI and domain behavior,
- fewer moving parts during initial delivery,
- no separate public API service to coordinate,
- all durable state centralized in PostgreSQL,
- horizontally scalable app nodes because state is not stored in process memory.

At a high level the system interacts with:

- browser clients,
- PostgreSQL,
- Telegram auth verification,
- Telegram bot API for invitations,
- iTunes Search API for track discovery,
- GitHub Actions and container registry for delivery.

## Route map

### Public pages

- `/`
  Home page, public overview, newcomer onboarding, event discovery, and published setlist entry points.
- `/faq`
  Public FAQ, quick-start guidance, and product feedback form.
- `/events/[slug]`
  Public event board and musician workspace with board guide and filter state.

### User page

- `/profile`
  Authentication, profile editing, invite inbox, and personal assignments.

### Admin pages

- `/admin`
  Global admin dashboard.
- `/admin/events/[slug]`
  Event-level operations and curation.

### API routes

- `/api/auth/telegram`
  Telegram authentication callback endpoint.
- `/api/song-search`
  Song discovery proxy to iTunes Search API.
- `/api/healthz`
  Health endpoint for probes and basic service checks.

## Module map

## App routes

Route components live in `src/app`.

Important route files:

- [src/app/page.tsx](/Users/maksimnaumov/jammers-web/src/app/page.tsx)
- [src/app/faq/page.tsx](/Users/maksimnaumov/jammers-web/src/app/faq/page.tsx)
- [src/app/profile/page.tsx](/Users/maksimnaumov/jammers-web/src/app/profile/page.tsx)
- [src/app/events/[slug]/page.tsx](/Users/maksimnaumov/jammers-web/src/app/events/[slug]/page.tsx)
- [src/app/admin/page.tsx](/Users/maksimnaumov/jammers-web/src/app/admin/page.tsx)
- [src/app/admin/events/[slug]/page.tsx](/Users/maksimnaumov/jammers-web/src/app/admin/events/[slug]/page.tsx)

## Server actions

All mutation entry points currently live in:

- [src/server/actions.ts](/Users/maksimnaumov/jammers-web/src/server/actions.ts)

This file contains:

- auth session actions,
- profile updates,
- song request creation,
- track proposal creation,
- seat join and release,
- invite flows,
- event CRUD and status changes,
- moderation actions,
- curation lock acquisition,
- setlist selection and publishing.

This is acceptable for the current scope, but future growth may justify splitting actions by bounded context:

- `identity-actions.ts`
- `event-actions.ts`
- `board-actions.ts`
- `curation-actions.ts`
- `moderation-actions.ts`

## Query layer

Read-side aggregations live in:

- [src/server/query-data.ts](/Users/maksimnaumov/jammers-web/src/server/query-data.ts)

This layer shapes route-ready objects for:

- home page,
- event workspace,
- admin dashboard,
- profile workspace.

## Domain modules

Important rule and domain modules include:

- [src/lib/domain/rules.ts](/Users/maksimnaumov/jammers-web/src/lib/domain/rules.ts)
- [src/lib/domain/event-status.ts](/Users/maksimnaumov/jammers-web/src/lib/domain/event-status.ts)
- [src/lib/domain/lineup.ts](/Users/maksimnaumov/jammers-web/src/lib/domain/lineup.ts)
- [src/lib/domain/setlist-algorithm.ts](/Users/maksimnaumov/jammers-web/src/lib/domain/setlist-algorithm.ts)

These modules are the main place to evolve business rules without bloating page components.

## UI components

Recent product-specific components include:

- [src/components/event-board-guide.tsx](/Users/maksimnaumov/jammers-web/src/components/event-board-guide.tsx)
- [src/components/song-search-field.tsx](/Users/maksimnaumov/jammers-web/src/components/song-search-field.tsx)
- [src/components/seat-planner-field.tsx](/Users/maksimnaumov/jammers-web/src/components/seat-planner-field.tsx)
- [src/components/track-board-filters.tsx](/Users/maksimnaumov/jammers-web/src/components/track-board-filters.tsx)
- [src/components/track-proposal-composer.tsx](/Users/maksimnaumov/jammers-web/src/components/track-proposal-composer.tsx)
- [src/components/track-board-table.tsx](/Users/maksimnaumov/jammers-web/src/components/track-board-table.tsx)
- [src/components/site-header.tsx](/Users/maksimnaumov/jammers-web/src/components/site-header.tsx)

## Data model

The Prisma schema is defined in:

- [prisma/schema.prisma](/Users/maksimnaumov/jammers-web/prisma/schema.prisma)

### Identity and access

- `User`
- `AuthSession`
- `Ban`
- `AdminUserRating`
- `UserInstrument`

### Catalog and discovery

- `Artist`
- `Song`
- `SongCatalogRequest`

### Event planning

- `Event`
- `EventLineupSlot`
- `Track`
- `TrackSeat`
- `TrackInvite`
- `SetlistItem`
- `SelectionRun`
- `EventEditLock`

### Group modeling

- `EnsembleGroup`
- `EnsembleGroupMember`

## Important relational invariants

- `Song` is unique by `artistId + title`.
- `TrackSeat` is unique by `trackId + lineupSlotId + seatIndex`.
- `Track` is unique by `eventId + songId + state`, preventing active duplicate proposals.
- `EventLineupSlot` is unique by `eventId + key`.

## Authentication and session model

## Telegram auth

Production auth relies on Telegram login verification:

- Telegram widget posts signed user data,
- the backend verifies the HMAC signature using the bot token,
- user identity is upserted,
- a server-side session is created.

Telegram-specific helper files include:

- [src/lib/auth/telegram.ts](/Users/maksimnaumov/jammers-web/src/lib/auth/telegram.ts)
- [src/server/upsert-telegram-user.ts](/Users/maksimnaumov/jammers-web/src/server/upsert-telegram-user.ts)

## Session storage

Sessions are:

- opaque,
- backed by hashed tokens in the database,
- stored server-side,
- invalidated centrally.

This is safer and operationally simpler than fully client-side JWT session ownership for this product.

## Local development auth

Development auth is guarded by:

- `ENABLE_DEV_AUTH`,
- `NODE_ENV !== "production"`.

This guard is enforced server-side to avoid accidental leakage into production behavior.

## Event and board lifecycle

## Effective event status

The UI may show an effective status derived from:

- stored event status,
- registration close timestamp,
- runtime conditions.

This allows timer-based closure to be reflected correctly without waiting for a manual admin click.

For structured data, non-published closed boards are emitted as scheduled events rather than postponed events. This keeps search-engine semantics aligned with the real product meaning: registration may be closed while the event itself is still happening as planned.

## Mutation protection

Board mutations check:

- current user presence,
- admin permissions when necessary,
- ban status,
- event openness,
- seat claimability,
- track limit rules.

This logic lives server-side and is not delegated to client trust.

## Song search integration

The live song search endpoint is:

- [src/app/api/song-search/route.ts](/Users/maksimnaumov/jammers-web/src/app/api/song-search/route.ts)

Current design choices:

- iTunes Search API instead of Spotify API,
- no user OAuth required,
- simpler deployment,
- lower operational overhead,
- sufficient metadata for early product needs.

Current behavior:

- minimum query length guard,
- proxy request from server,
- deduplication by artist + track name,
- normalized response shape for the client.

If the application later needs:

- better popularity ranking,
- richer metadata,
- preview clips,
- explicit release markets,
- more reliable cover-song search,

then Spotify or MusicBrainz + YouTube enrichment may become worthwhile.

## Invitation delivery

The invite send path attempts Telegram delivery using:

- [src/server/telegram-bot.ts](/Users/maksimnaumov/jammers-web/src/server/telegram-bot.ts)

Failures are recorded as delivery status rather than silently ignored. This is important operationally because not every Telegram user may have already started the bot chat.

## Selection algorithm

The algorithm is documented at a product level in:

- [docs/ALGORITHM.md](/Users/maksimnaumov/jammers-web/docs/ALGORITHM.md)

Implementation details:

- current strategy is deterministic and greedy,
- tracks with no participants are ignored,
- songs from the previous published event are excluded,
- known groups are deprioritized,
- the algorithm optimizes for marginal unique participant coverage under duration constraints,
- results are persisted into `SetlistItem`.

Why this matters technically:

- deterministic outputs simplify admin trust,
- explainability is more important than theoretical optimality,
- runtime is fast enough for interactive admin workflows.

## Curation concurrency model

Publishing and algorithm execution can be protected by an event-level curation lock:

- lock is time-bounded,
- lock belongs to one admin,
- lock status is visible in the UI,
- lock ownership is checked before sensitive curation steps.

This is a lightweight concurrency-control mechanism suitable for a staff-operated internal admin workflow.

## Security model

## Server-side authorization

All admin mutations call explicit role guards. All musician mutations call authenticated user guards.

## Session protection

- server-managed session tokens,
- hashed storage,
- role derived from database state, not client claims.

## Input trust boundary

All meaningful writes occur on the server:

- form input is parsed server-side,
- IDs are revalidated against the database,
- event editability is rechecked,
- uniqueness is enforced both in code and by DB constraints.

## Ban enforcement

Bans are not just visual; they are checked before participation mutations.

## Production safety switches

- dev auth is blocked in production,
- production secrets are expected from runtime secret injection,
- repository does not contain production credentials.

## UI and design system

Recent visual direction is based on The Jammers brand materials:

- deep blue,
- deep red,
- black/ink,
- light sand background,
- controlled gradient accents,
- table-first event board.

Core visual configuration:

- [tailwind.config.ts](/Users/maksimnaumov/jammers-web/tailwind.config.ts)
- [src/app/globals.css](/Users/maksimnaumov/jammers-web/src/app/globals.css)

The board intentionally avoids a card-per-seat information architecture in favor of:

- sticky track rows,
- grouped headers,
- denser cells,
- spreadsheet familiarity,
- improved readability on large event boards.

Recent UX additions in the production UI include:

- newcomer onboarding and next-gig guidance on `/`,
- page-specific FAQ metadata and localized fallback content,
- a dedicated board-guide component on event pages,
- automatically applying board search filters,
- actionable empty states on `/profile`.

## Environment and configuration

Environment parsing is centralized through:

- [src/lib/env.ts](/Users/maksimnaumov/jammers-web/src/lib/env.ts)

Important runtime variables include:

- `DATABASE_URL`
- `SESSION_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
- `ENABLE_DEV_AUTH`
- `DEFAULT_ADMIN_USERNAME`
- `NEXT_PUBLIC_APP_URL`

## Local development

Key scripts from [package.json](/Users/maksimnaumov/jammers-web/package.json):

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:seed`

Current local flow:

1. start PostgreSQL,
2. configure `.env`,
3. run Prisma migrations,
4. seed sample data,
5. start Next.js dev server.

When port `3000` is occupied, Next.js automatically falls back to the next available port.

## Testing strategy

The test suite is currently strongest in the domain layer, especially:

- setlist selection,
- Telegram auth verification,
- participation rules.

This is appropriate for high-risk business logic, but there is room to expand into:

- route-level integration tests,
- server-action integration tests,
- UI component tests for the board composer,
- end-to-end browser tests for musician and admin flows.

## Delivery pipeline

CI is configured in GitHub Actions:

- lint,
- typecheck,
- tests,
- production build,
- Docker image build.

Release publishing is handled by a separate workflow that pushes container images on version tags.

Primary files:

- [.github/workflows/ci.yml](/Users/maksimnaumov/jammers-web/.github/workflows/ci.yml)
- [.github/workflows/release-image.yml](/Users/maksimnaumov/jammers-web/.github/workflows/release-image.yml)
- [Dockerfile](/Users/maksimnaumov/jammers-web/Dockerfile)

## Kubernetes runtime model

Kubernetes base manifests live in:

- [infra/k8s/base](/Users/maksimnaumov/jammers-web/infra/k8s/base)

Important characteristics:

- app Deployment with multiple replicas,
- HPA-based scaling,
- PodDisruptionBudget,
- explicit migration job template,
- externalized secrets,
- health endpoint probes via `/api/healthz`.

## Observability and operability

Current built-in observability is intentionally minimal:

- readiness and liveness via health route,
- build and test gates in CI,
- persisted operational state in the DB.

Recommended next technical improvements:

- structured request logging,
- audit trail for admin curation changes,
- metrics for invites and proposal conversion,
- Sentry or equivalent error tracking,
- feature flags for experimental board behavior.

## Known technical debt

Current acceptable debt areas:

- `src/server/actions.ts` has become large and should eventually be split by bounded context.
- The admin UI is functionally rich but not yet as visually refined as the musician event board.
- Selection algorithm reasoning is stored, but richer operator-facing explanations could be added.
- There is no dedicated background worker yet; Telegram delivery happens inline.
- Some tests remain focused on logic rather than full-stack scenarios.

## Recommended extension path

If the product continues to grow, the highest-leverage technical evolution would be:

1. split server actions into bounded modules,
2. add end-to-end tests for core board flows,
3. add audit logging for all admin mutations,
4. introduce a job queue for invite delivery and future notifications,
5. add analytics and recommendation services only after the core workflow stabilizes.
