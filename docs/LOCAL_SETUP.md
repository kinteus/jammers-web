# Local Setup

## Option 1: Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

This starts PostgreSQL and the app on `http://localhost:3000`.

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

## Recommended smoke checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
