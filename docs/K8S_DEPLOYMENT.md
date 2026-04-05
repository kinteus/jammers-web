# Kubernetes Deployment Guide

For the full GitHub Actions + Kubernetes + Telegram launch runbook, see [docs/GITHUB_K8S_CICD_SETUP.md](/Users/maksimnaumov/jammers-web/docs/GITHUB_K8S_CICD_SETUP.md).

For the current live MicroK8s cluster used by The Jammers, see the cluster-specific Russian runbook: [docs/THEJAMMERS_PROD_CLUSTER_SETUP_RU.md](/Users/maksimnaumov/jammers-web/docs/THEJAMMERS_PROD_CLUSTER_SETUP_RU.md).

## Delivery model

- Application image is built from `Dockerfile`.
- CI validates lint, typecheck, tests, build, and Docker image creation.
- Release workflow publishes images to GHCR on version tags.
- Kubernetes consumes the published image and environment-specific secrets.
- Application health probes are served from `/api/healthz`.

## Required secrets

Create a `Secret` from `infra/k8s/base/secret.example.yaml` with real values:

- `DATABASE_URL`
- `SESSION_SECRET`
- `TELEGRAM_BOT_TOKEN`

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
- Readiness and liveness probes point to `/api/healthz`.
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
