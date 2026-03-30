# Kubernetes Deployment Guide

## Delivery model

- Application image is built from `Dockerfile`.
- CI validates lint, typecheck, tests, build, and Docker image creation.
- Release workflow publishes images to GHCR on version tags.
- Kubernetes consumes the published image and environment-specific secrets.

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
- Readiness and liveness probes point to `/`.
- PostgreSQL is assumed to be external, managed, and secured separately.

## Release engineer handoff

- Consume the GHCR image produced by the release workflow.
- Inject cluster-specific secrets and ingress hostnames.
- Run `prisma migrate deploy` as a pre-deploy job or init job.
- Keep `ENABLE_DEV_AUTH=false` in production.
