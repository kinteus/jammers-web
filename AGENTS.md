# Agent Notes

- When the user asks to "подними приложение локально" / "start the app locally", use `npm run local:prod` from the repository root. This starts a Kubernetes port-forward to the production Postgres service and runs the local Next.js app against that tunnel.
- Keep this mode read-oriented unless the user explicitly asks for production data changes. The app is local, but the database is production.

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
