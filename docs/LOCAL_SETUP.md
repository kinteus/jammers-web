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

## Local authentication

- For production-like testing, configure `TELEGRAM_BOT_TOKEN` and `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`.
- For local development only, keep `ENABLE_DEV_AUTH=true` and sign in through `/profile`.
- For full production-style Telegram setup, follow [docs/TELEGRAM_AUTH_SETUP.md](/Users/maksimnaumov/jammers-web/docs/TELEGRAM_AUTH_SETUP.md).

## Recommended smoke checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
