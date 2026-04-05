# The Jammers

The Jammers is a public concert planning web app for community jam events. Users authenticate with Telegram, discover songs through live external search, propose tracks, claim stage positions, invite other registered musicians, and follow the published setlist after admin curation. Admins manage event rules, moderate participants, run the setlist algorithm, maintain a backlog, and publish the final show order.

## Stack

- Next.js 15 with App Router and TypeScript
- PostgreSQL + Prisma
- Tailwind CSS + server actions
- Vitest for business-logic regression tests
- Docker, GitHub Actions, and Kubernetes manifests for delivery

## Core capabilities

- Telegram-based registration and sign-in, with a dev-only local fallback
- Public event boards with configurable stage lineups
- Track proposals from live song search plus song-addition requests
- Multi-seat sign-up, skipped seats, Telegram invites, and personal dashboard
- Admin event CRUD, moderation, known-group registry, ratings, and curation lock
- Coverage-first setlist selection with previous-concert song exclusion and backlog support

## Quick start

1. Copy `.env.example` to `.env`.
2. Start the app with one command:

```bash
npm run local
```

This command prefers Docker Compose when available. If Docker Compose is not installed, it falls back to the native Next.js dev server.

3. Or run locally:

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

To stop the Docker-based local stack when Compose is being used:

```bash
npm run local:down
```

## Validation commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Documentation

- [Requirements summary](./docs/requirements-summary.md)
- [Functional guide](./docs/FUNCTIONAL_GUIDE.md)
- [Architecture overview](./docs/architecture.md)
- [Technical reference](./docs/TECHNICAL_REFERENCE.md)
- [Selection algorithm](./docs/ALGORITHM.md)
- [Product ideas](./docs/PRODUCT_IDEAS.md)
- [Local setup](./docs/LOCAL_SETUP.md)
- [Telegram auth setup](./docs/TELEGRAM_AUTH_SETUP.md)
- [GitHub Actions + Kubernetes CI/CD setup](./docs/GITHUB_K8S_CICD_SETUP.md)
- [Kubernetes deployment guide](./docs/K8S_DEPLOYMENT.md)

## Current external dependency

Repository publication to GitHub is blocked until `gh` is re-authenticated for account `kinteus` in the current environment.
