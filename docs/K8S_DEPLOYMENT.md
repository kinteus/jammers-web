# Kubernetes Deployment Guide

For the full GitHub Actions + Kubernetes + Telegram launch runbook, see [docs/GITHUB_K8S_CICD_SETUP.md](/Users/maksimnaumov/jammers-web/docs/GITHUB_K8S_CICD_SETUP.md).

For the current live MicroK8s cluster used by The Jammers, see the cluster-specific Russian runbook: [docs/THEJAMMERS_PROD_CLUSTER_SETUP_RU.md](/Users/maksimnaumov/jammers-web/docs/THEJAMMERS_PROD_CLUSTER_SETUP_RU.md).

## Delivery model

- Application image is built from `Dockerfile`.
- CI validates lint, typecheck, tests, build, and Docker image creation.
- Release workflow publishes images to GHCR on version tags.
- Kubernetes consumes the published image and environment-specific secrets.
- Application probes are split by purpose: readiness uses `/api/healthz`, while startup and liveness use `/api/livez`.

## Required secrets

Create a `Secret` from `infra/k8s/base/secret.example.yaml` with real values:

- `DATABASE_URL`
- `SESSION_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_FEEDBACK_CHAT_ID` when FAQ feedback delivery should post to Telegram

## Apply manifests

1. Review and adjust hostnames and image tags in `infra/k8s/base`.
2. Apply base resources:

```bash
kubectl apply -k infra/k8s/base
```

3. Run the migration job before or during rollout:

```bash
kubectl apply -f infra/k8s/base/migration-job.example.yaml
kubectl logs job/jammers-web-migrate
```

4. Roll out the app deployment:

```bash
kubectl rollout status deployment/jammers-web
```

## Scaling and resilience

- Deployment starts with 2 replicas.
- HPA scales between 2 and 6 replicas on CPU.
- PodDisruptionBudget keeps at least one pod available.
- Readiness probes point to `/api/healthz`; startup and liveness probes point to `/api/livez`.
- PostgreSQL is assumed to be external, managed, and secured separately.

## Recommended rollout sequence

1. Push or reference the target image tag in GHCR.
2. Apply or update Secrets and ConfigMaps first.
3. Run the migration job against the target database.
4. Roll out the Deployment.
5. Wait for readiness probe success.
6. Verify `/api/healthz` and a manual page load.
7. Only then route production traffic if your ingress strategy supports staged cutover.

## Release engineer handoff

- Consume the GHCR image produced by the release workflow.
- Inject cluster-specific secrets and ingress hostnames.
- Run `prisma migrate deploy` as a pre-deploy job or init job.
- Keep `ENABLE_DEV_AUTH=false` in production.
- Ensure Telegram bot credentials are valid before enabling invite delivery flows.

## Security release prerequisites

- Configure the verified `PRIMARY_ADMIN_TELEGRAM_ID` before deploying the security changes;
  otherwise production admin-list management fails closed. Never infer the ID from a username.
- The application container now runs as UID/GID 1000 with capabilities dropped and privilege
  escalation disabled. The image owns its writable `.next` cache as `node`; `/tmp` holds logs.
- `NEXT_PUBLIC_APP_URL` must match the actual browser origin, including scheme/port. It is
  used for WebSocket CSP and origin validation. Keep nonce-bearing HTML out of shared caches.
- NGINX ingress overrides application HSTS. The MicroK8s controller currently returns
  `max-age=15724800; includeSubDomains`. A merge patch is provided separately because it
  affects every TLS host on the controller, not just this application:

```bash
kubectl --kubeconfig ~/.kube/config-jammers-microk8s -n ingress patch configmap nginx-load-balancer-microk8s-conf --type merge --patch-file infra/k8s/controller/hsts-patch.yaml
curl -sSI https://thejammers.org/
```

Review other controller hosts before applying the patch. Expect exactly one HSTS header
with `max-age=31536000; includeSubDomains; preload`. The `preload` directive does not submit
the domain to the browser preload list; registration is a separate operational decision.
Do not enable arbitrary ingress snippets to work around HSTS. This repository patch alone
does not change the running controller or deploy the updated application.
