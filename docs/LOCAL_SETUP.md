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

For realistic local review of the current production content, you can port-forward Postgres from the existing MicroK8s cluster and point the local app at that tunnel:

```bash
kubectl --kubeconfig ~/.kube/config-jammers-microk8s -n prod port-forward svc/jammers-web-postgres 55432:5432
DATABASE_URL='postgresql://jammers:...@127.0.0.1:55432/prod' npm run dev -- --hostname 127.0.0.1 --port 3001
```

Operational notes:

- use this only for read-oriented local QA unless you intentionally want to mutate production data,
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
