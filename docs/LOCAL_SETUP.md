# Local Setup

## Option 1: Docker Compose

```bash
cp .env.example .env
npm run local
```

This starts PostgreSQL and the app on `http://localhost:3000`.
If Docker Compose is unavailable in your environment, the same command falls back to `npm run dev`.

To stop the local stack when Compose is being used:

```bash
npm run local:down
```

## Option 2: Native development

1. Start PostgreSQL locally.
2. Copy `.env.example` to `.env` and update `DATABASE_URL`.
3. Install and prepare:

```bash
npm install
npx prisma migrate deploy
npm run db:seed
```

4. Start the app:

```bash
npm run dev
```

## Option 3: Local UI against the live production database

For realistic local review of the current production content, run:

```bash
npm run local:prod
```

This single command:

- starts `kubectl port-forward` to `svc/jammers-web-postgres` in namespace `prod`,
- rewrites the configured production `DATABASE_URL` to the local tunnel port,
- enables local development auth for existing users only,
- starts the app on `http://127.0.0.1:3001`, or the next free port if `3001` is busy.

The runner reads the production database URL from `JAMMERS_PROD_DATABASE_URL`, `DATABASE_URL`, or `.env.local`. The default kubeconfig is `~/.kube/config-jammers-microk8s`; override it with `JAMMERS_KUBECONFIG`.

If a user asks an AI agent to "подними приложение локально", the expected command is `npm run local:prod`.

Operational notes:

- use this only for read-oriented local QA unless you intentionally want to mutate production data,
- local dev auth is constrained to users that already exist in the production database when the app points at this tunnel,
- admin publish and delete flows are real writes when pointed at the live database,
- if the tunnel drops, the app now degrades to explicit `Local data unavailable` screens instead of Prisma crash overlays.

## Local authentication

- For production-like testing, configure `TELEGRAM_BOT_TOKEN` and `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`.
- For local development only, keep `ENABLE_DEV_AUTH=true` and sign in through `/profile`.
- For full production-style Telegram setup, follow [docs/TELEGRAM_AUTH_SETUP.md](/Users/maksimnaumov/jammers-web/docs/TELEGRAM_AUTH_SETUP.md).

## Recommended smoke checks

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
```
