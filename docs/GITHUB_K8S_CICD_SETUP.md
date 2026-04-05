# GitHub Actions + Kubernetes + Telegram Setup

## What is now prepared in the repository

The repository now includes:

- CI workflow: [/.github/workflows/ci.yml](/Users/maksimnaumov/jammers-web/.github/workflows/ci.yml)
- release image workflow: [/.github/workflows/release-image.yml](/Users/maksimnaumov/jammers-web/.github/workflows/release-image.yml)
- automatic deploy workflow to Kubernetes on `main` or `master`: [/.github/workflows/deploy-k8s.yml](/Users/maksimnaumov/jammers-web/.github/workflows/deploy-k8s.yml)
- base Kubernetes manifests: [/infra/k8s/base](/Users/maksimnaumov/jammers-web/infra/k8s/base)
- production overlay: [/infra/k8s/overlays/production](/Users/maksimnaumov/jammers-web/infra/k8s/overlays/production)
- example RBAC for GitHub Actions deploy access: [/infra/k8s/bootstrap/github-actions-rbac.example.yaml](/Users/maksimnaumov/jammers-web/infra/k8s/bootstrap/github-actions-rbac.example.yaml)
- production env template: [/.env.production.example](/Users/maksimnaumov/jammers-web/.env.production.example)
- Telegram auth guide: [/docs/TELEGRAM_AUTH_SETUP.md](/Users/maksimnaumov/jammers-web/docs/TELEGRAM_AUTH_SETUP.md)

## Delivery model

The new deploy workflow does this:

1. Runs lint, typecheck, tests, and build in GitHub Actions
2. Builds a Docker image
3. Pushes the image to GHCR
4. Applies Kubernetes manifests
5. Runs `prisma migrate deploy` as a Kubernetes Job
6. Updates the deployment image to the exact pushed SHA tag
7. Waits for rollout success

## Prerequisites

You need:

- a GitHub repository with Actions enabled
- a Kubernetes cluster reachable from GitHub Actions
- `kubectl` access to the cluster from your machine
- an ingress controller in the cluster, for example `ingress-nginx`
- TLS for your public host
- a PostgreSQL database reachable from the cluster
- a Telegram bot for login verification and message delivery

## Step 1: Decide your production values

Before touching GitHub or Kubernetes, decide these values:

- namespace: for example `jammers`
- public host: for example `jammers.example.com`
- TLS secret name: for example `jammers-web-tls`
- image registry path: by default the workflow uses `ghcr.io/<owner>/<repo>`
- app URL: must match the final public origin exactly, for example `https://jammers.example.com`

## Step 2: Edit the production overlay in the repo

Review these files and replace placeholders:

- [/infra/k8s/overlays/production/kustomization.yaml](/Users/maksimnaumov/jammers-web/infra/k8s/overlays/production/kustomization.yaml)
- [/infra/k8s/overlays/production/namespace.yaml](/Users/maksimnaumov/jammers-web/infra/k8s/overlays/production/namespace.yaml)
- [/infra/k8s/overlays/production/configmap-patch.yaml](/Users/maksimnaumov/jammers-web/infra/k8s/overlays/production/configmap-patch.yaml)
- [/infra/k8s/overlays/production/ingress-patch.yaml](/Users/maksimnaumov/jammers-web/infra/k8s/overlays/production/ingress-patch.yaml)

At minimum, change:

- namespace
- `NEXT_PUBLIC_APP_URL`
- ingress host
- TLS secret name
- `DEFAULT_ADMIN_USERNAME` if your admin handle is different

## Step 3: Create Kubernetes namespace

If you want the namespace from the production overlay:

```bash
kubectl apply -f infra/k8s/overlays/production/namespace.yaml
```

## Step 4: Give GitHub Actions access to the namespace

### Recommended approach

Create a dedicated service account instead of reusing cluster-admin kubeconfig.

1. Open:

- [/infra/k8s/bootstrap/github-actions-rbac.example.yaml](/Users/maksimnaumov/jammers-web/infra/k8s/bootstrap/github-actions-rbac.example.yaml)

2. Replace the namespace if needed.
3. Apply it:

```bash
kubectl apply -f infra/k8s/bootstrap/github-actions-rbac.example.yaml
```

4. Create a token for that service account:

```bash
kubectl -n jammers create token github-actions-deployer
```

This uses the modern Kubernetes token flow documented by Kubernetes: [kubectl create token](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_create/kubectl_create_token/).

5. Build a kubeconfig that points to your cluster and uses this token.

You can start from your current kubeconfig and replace:

- user token
- namespace if desired

6. Base64-encode the final kubeconfig file:

```bash
base64 < kubeconfig-github-actions.yaml | tr -d '\n'
```

On macOS, if `base64` wraps lines by default, use:

```bash
base64 < kubeconfig-github-actions.yaml | tr -d '\n'
```

You will store that in GitHub as `KUBE_CONFIG_B64`.

### Faster but less strict approach

If you are okay with broader privileges during the initial setup, you can base64-encode an existing kubeconfig that already works on your machine and use that in GitHub Actions. This is simpler, but less secure.

## Step 5: Prepare Kubernetes application secret

The app secret is not stored in GitHub Actions by default. It should live in the cluster.

Use:

- [/infra/k8s/base/secret.example.yaml](/Users/maksimnaumov/jammers-web/infra/k8s/base/secret.example.yaml)

Copy it locally, fill real values, and apply:

```bash
cp infra/k8s/base/secret.example.yaml /tmp/jammers-web-secret.yaml
kubectl -n jammers apply -f /tmp/jammers-web-secret.yaml
```

You must set:

- `DATABASE_URL`
- `SESSION_SECRET`
- `TELEGRAM_BOT_TOKEN`

### How to generate a good SESSION_SECRET

Use a long random value, for example:

```bash
openssl rand -hex 32
```

## Step 6: Decide whether your GHCR image is public or private

### Option A: Make the GHCR package public

This is the simplest path.

If your package is public, Kubernetes can pull the image without extra registry credentials.

### Option B: Keep GHCR private

If the repository or package is private, create an image pull secret in the cluster.

1. Create a GitHub Personal Access Token with package read access.
2. Create the docker-registry secret:

```bash
kubectl -n jammers create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GHCR_READ_TOKEN
```

3. Patch the deployment or service account to use `ghcr-pull-secret`.

This repo does not force imagePullSecrets by default, so public GHCR is the least-friction path.

GitHub package and secret docs:

- [GitHub Actions secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

## Step 7: Add GitHub repository secrets and variables

### GitHub secret

Add this repository or environment secret:

- `KUBE_CONFIG_B64`

How:

1. Open GitHub repository
2. `Settings`
3. `Secrets and variables`
4. `Actions`
5. Add new secret named `KUBE_CONFIG_B64`
6. Paste the base64-encoded kubeconfig

### GitHub variable

Add this variable:

- `K8S_NAMESPACE`

Set it to the same namespace used in:

- [/infra/k8s/overlays/production/kustomization.yaml](/Users/maksimnaumov/jammers-web/infra/k8s/overlays/production/kustomization.yaml)
- [/infra/k8s/overlays/production/namespace.yaml](/Users/maksimnaumov/jammers-web/infra/k8s/overlays/production/namespace.yaml)

If you use GitHub Environments, put them in the `production` environment, because the workflow is already bound to `environment: production`.

## Step 8: Create and configure the Telegram bot

Official Telegram bot management reference:

- [Telegram Bot Features / BotFather](https://core.telegram.org/bots/features)
- [Telegram Login Widget](https://core.telegram.org/widgets/login)

### Create a new bot

In Telegram:

1. Open `@BotFather`
2. Send `/newbot`
3. Enter display name, for example `The Jammers Bot`
4. Enter username, for example `the_jammers_auth_bot`

Rules from Telegram:

- username must end with `bot`
- username is case-insensitive
- allowed characters are Latin letters, digits, underscores

BotFather will return a token like:

```text
123456789:AA...
```

Put that token into:

- Kubernetes secret field `TELEGRAM_BOT_TOKEN`

Put the bot username without `@` into:

- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` in your app config

### Set the Telegram Login domain

This is required for Telegram website login.

In BotFather:

1. Send `/setdomain`
2. Choose your bot
3. Enter the production domain only, for example:

```text
jammers.example.com
```

Use the exact host used in:

- `NEXT_PUBLIC_APP_URL`
- ingress host

Do not include protocol in the domain entry unless BotFather explicitly asks for it in your current flow.

### Optional bot tuning

Useful BotFather commands:

- `/setdescription`
- `/setabouttext`
- `/setuserpic`
- `/setcommands`
- `/setprivacy`

Suggested commands:

```text
start - Open the bot and enable notifications
help - Show basic help
```

### Very important operational note

Invite delivery and approval-request delivery work best only after the user has started a chat with the bot at least once. So after login launch, tell people:

- sign in on the site
- open the bot
- press `Start`

## Step 9: Configure production app values

Use:

- [/.env.production.example](/Users/maksimnaumov/jammers-web/.env.production.example)

These are the important production values:

- `NODE_ENV=production`
- `DATABASE_URL=...`
- `SESSION_SECRET=...`
- `NEXT_PUBLIC_APP_URL=https://your-domain`
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_bot_username`
- `TELEGRAM_BOT_TOKEN=...`
- `ENABLE_DEV_AUTH=false`

### Why bot username matters at runtime

The app now passes Telegram widget bot username from the server into the client widget at runtime, so Kubernetes config is enough and you do not need a separate special image build per bot username.

## Step 10: First manual cluster apply

Before relying on GitHub Actions, do one manual apply:

```bash
kubectl apply -k infra/k8s/overlays/production
```

Then run a manual migration job:

```bash
kubectl -n jammers apply -f infra/k8s/base/migration-job.example.yaml
```

If you do this manually, remember to replace the image tag in that example manifest with a real image that already exists in GHCR.

Then confirm:

```bash
kubectl -n jammers get pods
kubectl -n jammers get ingress
kubectl -n jammers rollout status deployment/jammers-web
```

## Step 11: Push to main and let GitHub Actions deploy

The workflow:

- [/.github/workflows/deploy-k8s.yml](/Users/maksimnaumov/jammers-web/.github/workflows/deploy-k8s.yml)

Triggers on:

- push to `main`
- push to `master`
- manual run

It pushes image tags:

- `ghcr.io/<owner>/<repo>:sha-<full-commit-sha>`
- `ghcr.io/<owner>/<repo>:latest`

Then it:

- applies manifests
- runs migrations
- updates deployment image
- waits for rollout

## How already imported users will authenticate

If a person already exists in the database from the historical import:

- and their Telegram username matches the stored username,
- the app links the real Telegram identity to that existing account,
- their old stats and history stay attached to the same row.

The app now normalizes usernames to lowercase before matching, which makes this much safer.

## How brand-new users will authenticate

If a person is not in the database yet:

- Telegram login creates a new `User` row automatically,
- after that they can complete their profile,
- but to receive Telegram invite messages reliably, they should also start the bot chat.

## Full launch checklist

1. Edit production overlay values in the repo.
2. Create namespace in the cluster.
3. Apply GitHub Actions RBAC or prepare kubeconfig.
4. Create Kubernetes secret with database/session/Telegram token.
5. Make GHCR package public or configure pull secret.
6. Create Telegram bot in BotFather.
7. Set bot domain in BotFather.
8. Add GitHub secret `KUBE_CONFIG_B64`.
9. Add GitHub variable `K8S_NAMESPACE`.
10. Push to `main`.
11. Verify deployment and open `/profile`.
12. Test Telegram login with:
   - one already imported user
   - one brand-new user
13. Start bot chat and test invite delivery.

## Recommended smoke tests after first deploy

### Auth

1. Open `/profile`
2. Confirm Telegram widget renders
3. Sign in as existing imported user
4. Confirm no duplicate account was created
5. Sign in as new user
6. Confirm new account was created

### Board

1. Claim an open seat
2. Invite another registered user
3. Create an optional-seat approval request on a closed future gig
4. Approve it from the proposer profile

### Ops

1. Confirm `/api/healthz` returns OK
2. Confirm pods are ready
3. Confirm migration job completed
4. Confirm ingress serves the real host
