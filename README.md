# Jammers Setlist

Jammers Setlist is a public concert planning web app for community jam events. Users authenticate with Telegram, propose songs from a controlled catalog, claim stage positions, invite other registered musicians, and follow the published setlist after admin curation. Admins manage event rules, moderate participants, run the setlist algorithm, maintain a backlog, and publish the final show order.

## Stack

- Next.js 15 with App Router and TypeScript
- PostgreSQL + Prisma
- Tailwind CSS + server actions
- Vitest for business-logic regression tests
- Docker, GitHub Actions, and Kubernetes manifests for delivery

## Core capabilities

- Telegram-based registration and sign-in, with a dev-only local fallback
- Public event boards with configurable stage lineups
- Track proposals from a catalog plus song-addition requests
- Multi-seat sign-up, N/A seats, Telegram invites, and personal dashboard
- Admin event CRUD, moderation, known-group registry, ratings, and curation lock
- Coverage-first setlist selection with previous-concert song exclusion and backlog support

## Quick start

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL and the app:

```bash
docker compose up --build
```

3. Or run locally:

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Validation commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Documentation

- [Requirements summary](./docs/requirements-summary.md)
- [Architecture overview](./docs/architecture.md)
- [Selection algorithm](./docs/ALGORITHM.md)
- [Local setup](./docs/LOCAL_SETUP.md)
- [Kubernetes deployment guide](./docs/K8S_DEPLOYMENT.md)

## Current external dependency

Repository publication to GitHub is blocked until `gh` is re-authenticated for account `kinteus` in the current environment.
