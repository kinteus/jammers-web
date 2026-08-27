# The Jammers

The Jammers is a public concert planning web app for community jam events. Users authenticate with Telegram, discover songs through live external search, propose tracks, claim stage positions, invite other registered musicians, and follow the published setlist after admin curation. The public experience is intentionally newcomer-friendly: the home page teaches the expected join flow, event pages explain how to read the board quickly, show registration countdowns before sign-up opens, and the profile page pushes signed-in musicians toward the next useful action instead of behaving like a passive settings screen. Admins manage event rules, moderate participants, run the setlist algorithm, maintain a backlog, reorder the final set, and publish the final show order with Telegram notifications to confirmed players.

## Stack

- Next.js 15 with App Router and TypeScript
- PostgreSQL + Prisma
- Tailwind CSS + server actions
- Vitest for business-logic regression tests
- Docker, GitHub Actions, and Kubernetes manifests for delivery

## Core capabilities

- Telegram-based registration and sign-in, with a dev-only local fallback
- Public event boards with configurable stage lineups, registration-open countdowns, and board-reading guidance
- Track proposals from live song search plus resilient missing-song requests with inline success and error feedback
- Multi-seat sign-up, optimistic join/leave flows, Telegram invites for registered users, and a personal dashboard with actionable empty states
- Public FAQ, newcomer onboarding, and published setlist discovery from the main navigation
- Admin event CRUD, moderation, known-group registry, ratings, curation lock, quick event actions, and event deletion
- History-weighted setlist selection with previous-concert song exclusion, backlog support, draft-save set ordering, CSV export, and final-set Telegram notifications

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

### Run locally against the production database

If you need to inspect the real live data locally, use the single-command production tunnel runner:

```bash
npm run local:prod
```

This command starts a Kubernetes port-forward to `svc/jammers-web-postgres` in namespace `prod`, points `DATABASE_URL` at the tunnel, enables local sign-in for existing users, and starts the app at [http://127.0.0.1:3001](http://127.0.0.1:3001), or the next free port if `3001` is busy.

The runner reads the production database URL from `JAMMERS_PROD_DATABASE_URL`, `DATABASE_URL`, or the existing `.env.local` `DATABASE_URL`. The default kubeconfig is `~/.kube/config-jammers-microk8s`; override it with `JAMMERS_KUBECONFIG` if needed.

When asking an AI coding agent to "подними приложение локально", it should use:

```bash
npm run local:prod
```

Manual equivalent, if the runner is unavailable:

```bash
kubectl --kubeconfig ~/.kube/config-jammers-microk8s -n prod port-forward svc/jammers-web-postgres 55432:5432
npm run dev -- --hostname 127.0.0.1 --port 3001
```

As long as the `kubectl port-forward` process stays alive, the local app uses the real production database. Keep this mode read-oriented unless you intentionally want to mutate production data.

## Validation commands

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
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
