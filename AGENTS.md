# Agent Notes

- When the user asks to "подними приложение локально" / "start the app locally", use `npm run local:prod` from the repository root. This starts a Kubernetes port-forward to the production Postgres service and runs the local Next.js app against that tunnel.
- Keep this mode read-oriented unless the user explicitly asks for production data changes. The app is local, but the database is production.

## Verification

- After implementing new functionality or changing app behavior, always check whether the E2E/smoke tests still describe the current expected behavior. Update `tests/smoke` when the product behavior intentionally changes, and run the relevant E2E locally when it is safe to do so. If running E2E would mutate production-backed data through `npm run local:prod`, do not run it; explain that constraint and verify with narrower tests instead.

## Documentation Hygiene

- Treat documentation as part of every behavior, product, schema, API, configuration, deployment, or operations change. Before finishing, check the relevant docs below and update them in the same change when the implementation has changed what users, admins, maintainers, or operators should expect.
- If no documentation change is needed, say that you checked the relevant category and why it still matches. Do not leave stale docs for a follow-up unless the user explicitly scopes documentation out.
- Keep documentation checks targeted for context efficiency: open only the docs that match the task category first, then expand only if the change crosses categories.
- Product behavior, user/admin workflows, public pages, board UX, profile, FAQ, archive, invitations, and curation: [docs/FUNCTIONAL_GUIDE.md](/Users/maksimnaumov/jammers-web/docs/FUNCTIONAL_GUIDE.md), then [README.md](/Users/maksimnaumov/jammers-web/README.md) for headline capabilities.
- Requirements scope, deferred features, and product assumptions: [docs/requirements-summary.md](/Users/maksimnaumov/jammers-web/docs/requirements-summary.md) and [docs/PRODUCT_IDEAS.md](/Users/maksimnaumov/jammers-web/docs/PRODUCT_IDEAS.md).
- Architecture, route/API maps, data model, realtime behavior, testing strategy, and technical debt: [docs/TECHNICAL_REFERENCE.md](/Users/maksimnaumov/jammers-web/docs/TECHNICAL_REFERENCE.md), [docs/architecture.md](/Users/maksimnaumov/jammers-web/docs/architecture.md), and [prisma/schema.prisma](/Users/maksimnaumov/jammers-web/prisma/schema.prisma).
- Setlist selection, curation rules, previous-gig exclusion, known-group handling, and backlog/main-set behavior: [docs/ALGORITHM.md](/Users/maksimnaumov/jammers-web/docs/ALGORITHM.md).
- Local development, production-backed local QA, environment setup, and safe verification commands: [docs/LOCAL_SETUP.md](/Users/maksimnaumov/jammers-web/docs/LOCAL_SETUP.md) and [tests/smoke/app.smoke.spec.ts](/Users/maksimnaumov/jammers-web/tests/smoke/app.smoke.spec.ts).
- Telegram login, bot delivery, invites, feedback delivery, session/auth behavior, and auth-related environment variables: [docs/TELEGRAM_AUTH_SETUP.md](/Users/maksimnaumov/jammers-web/docs/TELEGRAM_AUTH_SETUP.md).
- Kubernetes, CI/CD, release, manifests, probes, secrets, production cluster operations, and runbooks: [docs/K8S_DEPLOYMENT.md](/Users/maksimnaumov/jammers-web/docs/K8S_DEPLOYMENT.md), [docs/GITHUB_K8S_CICD_SETUP.md](/Users/maksimnaumov/jammers-web/docs/GITHUB_K8S_CICD_SETUP.md), [docs/THEJAMMERS_PROD_CLUSTER_SETUP_RU.md](/Users/maksimnaumov/jammers-web/docs/THEJAMMERS_PROD_CLUSTER_SETUP_RU.md), and [infra/k8s](/Users/maksimnaumov/jammers-web/infra/k8s).
- Feature design records and implementation handoffs: [docs/superpowers/specs](/Users/maksimnaumov/jammers-web/docs/superpowers/specs) and [docs/superpowers/plans](/Users/maksimnaumov/jammers-web/docs/superpowers/plans). Use these for historical intent, but keep canonical current behavior in the main docs above.
- Error logging and production investigation docs live in this `AGENTS.md` section plus [docs/TECHNICAL_REFERENCE.md](/Users/maksimnaumov/jammers-web/docs/TECHNICAL_REFERENCE.md). Update both when Error IDs, `/api/client-error`, `recordAppError`, log paths, or Kubernetes log-investigation patterns change.

## Production Investigation

- Kubernetes access for The Jammers is available through kubeconfigs in `~/.kube`.
- Prefer the production-scoped config for routine investigations:

```bash
kubectl --kubeconfig ~/.kube/config-jammers-gha-prod -n prod get pods
kubectl --kubeconfig ~/.kube/config-jammers-gha-prod -n prod logs deployment/jammers-web --since=72h --all-containers=true
```

- `~/.kube/config-jammers-microk8s` has broader cluster access and is useful for admin-only cases such as `exec`, direct Postgres inspection, or manual port-forwarding. Use it carefully and keep actions read-only unless the user explicitly asks for a production mutation.
- For production DB inspection, prefer narrow `SELECT` queries and avoid schema/data writes. The production Postgres pod is `jammers-web-postgres` in namespace `prod`; the app database is `prod` and user is `jammers`.
- The one-command local production runner, `npm run local:prod`, uses the MicroK8s kubeconfig to port-forward Postgres and then starts the local Next app against that tunnel.

## Error Logging And Tracking

- User-visible app errors show an `Error ID`. For Next server-render errors this is usually `err_<digest>`, where `<digest>` is the Next digest. For client-only errors without a digest, the id is generated as `err_<timestamp>_<random>`.
- The root client error boundary is [src/app/error.tsx](/Users/maksimnaumov/jammers-web/src/app/error.tsx). It logs the browser error to `console.error` and POSTs a compact report to `/api/client-error` with `errorId`, `digest`, `message`, `name`, `path`, and `stack`.
- `/api/client-error` is implemented in [src/app/api/client-error/route.ts](/Users/maksimnaumov/jammers-web/src/app/api/client-error/route.ts). It calls `recordAppError`.
- `recordAppError` is implemented in [src/server/error-log.ts](/Users/maksimnaumov/jammers-web/src/server/error-log.ts). It writes one JSON line with `type: "app_error"` to both stderr and a local log file.
- In Kubernetes, stderr is visible via `kubectl logs`; this is the first place to search by Error ID:

```bash
kubectl --kubeconfig ~/.kube/config-jammers-gha-prod -n prod logs deployment/jammers-web --since=72h --all-containers=true | rg 'err_2795894724|2795894724|app_error'
```

- File logs live inside each app pod at `ERROR_LOG_DIR`, configured in `infra/k8s/base/configmap.yaml` as `/tmp/jammers-error-logs`. Files are named `errors-YYYY-MM-DD.log`; retention defaults to `ERROR_LOG_RETENTION_DAYS=14`.
- Pod-local files are ephemeral and per-pod. Prefer `kubectl logs` first; use pod file logs only when you need same-pod JSONL context and the pod has not restarted.
- Server-render crashes may appear twice: a raw Next.js stack in pod logs with `digest: '<number>'`, and later an `app_error` JSON line if the client error boundary rendered and successfully POSTed `/api/client-error`.
- Investigation pattern for a reported Error ID:
  1. Search pod logs for both the full id and the digest part without `err_`.
  2. Note `path`, `userAgent`, timestamp, and nearby raw stack lines.
  3. Reproduce locally with `npm run local:prod` when the issue depends on production data.
  4. If production DB state is needed, use narrow read-only SQL through the Kubernetes Postgres pod or a local port-forward.
