# Implementation Report

## Delivered scope

- Public Next.js application for concert setlist planning
- Telegram-based authentication entrypoint with bot-backed invite integration
- User profile management with instrument preferences
- Event configuration with lineup, timing, playback toggle, and participation limits
- Live song search via external provider plus missing-song request flow
- Track proposal composer, seat claim, seat release, seat skip marking, and invite response flow
- Admin moderation for ratings, bans, known groups, seat overrides, and event curation
- Coverage-first setlist algorithm with previous-concert song exclusion
- Manual setlist backlog management, publishing, and drummer-based sorting
- Stage-sheet board redesign aligned with The Jammers brand system
- Prisma schema, migrations, seed data, tests, Docker packaging, CI, and Kubernetes manifests

## Key implementation decisions

- Kept the system as a single deployable full-stack monolith to minimize delivery risk.
- Stored sessions server-side in PostgreSQL-backed session records instead of client-side JWTs.
- Used a deterministic coverage-first algorithm because it is explainable to admins and fast in runtime.
- Treated Telegram as the canonical identity provider and collaboration channel.

## Validation status

- `npm run lint`: passing
- `npm run typecheck`: passing
- `npm run test`: passing
- `npm run build`: passing
- `npx prisma validate`: passing when `DATABASE_URL` is set

## Review and bug-fix pass

During the final hardening pass, the following issues were found and fixed:

- Timer-based event closure is now enforced in mutation rules, not only shown in the UI.
- Canceled tracks are removed from setlist items to prevent ghost entries in published views.
- Telegram sign-in now merges correctly with existing users by Telegram username or ID.
- Dev-only sign-in is explicitly blocked in production.
- Admin curation now includes explicit sorting by drummer.
- Setlist reordering and drummer sorting use safe two-step reindexing to avoid unique-constraint collisions.

## Remaining external blocker

Three independent `codex exec review` runs were attempted to satisfy the explicit sub-agent review requirement. All three were blocked by external Codex/OpenAI authentication and API transport failures in the current environment, so that part could not be completed automatically from this session.

## Recommended next steps

1. Re-authenticate `gh` for account `kinteus` if GitHub operations are still needed from this machine.
2. Re-run the three external `codex exec review` sessions once the Codex/OpenAI auth issue is resolved.
3. Configure production Telegram bot credentials and disable dev auth in production config.
4. Replace placeholder ingress hostnames and image tags in `infra/k8s/base`.
