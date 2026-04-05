# Прод-настройка The Jammers на текущем MicroK8s-кластере

Этот документ описывает именно тот кластер, к которому уже выдан доступ через `config.crash`.

## Что уже известно по кластеру

- Кластер: `microk8s`
- Боевое namespace: `prod`
- Ingress class: `public`
- Основной домен: `thejammers.org`
- Уже занятые пути на `thejammers.org`:
  - `/nextgig`
  - `/nextgighosts`
- Уже есть TLS secret в `prod`:
  - `jammers-next-gig-ingress-tls`
- Уже есть pull secret в `prod`:
  - `ghcr-registry`
- Уже есть секрет с PostgreSQL URL в `prod`:
  - `potgres-secret`
  - ключ внутри секрета: `POSTGRES_DATABASE_URL`

## Важное наблюдение по текущим приложениям

Текущее приложение `jammers-next-gig` не использует БД: в его Deployment нет ни `DATABASE_URL`, ни `envFrom` с postgres-секретом.

Это значит:

- использование существующей PostgreSQL для нового приложения не затрагивает `jammers-next-gig`
- путь `/nextgig*` можно безопасно сохранить за текущим приложением
- новый сайт можно повесить на `https://thejammers.org/`, не трогая `/nextgig` и `/nextgighosts`

## Что уже подготовлено в репозитории

- production overlay переведён на namespace `prod`
- ingress настроен на `https://thejammers.org/`
- TLS переиспользует `jammers-next-gig-ingress-tls`
- build/deploy workflow умеет собирать `NEXT_PUBLIC_*` с production-значениями
- deployment и migration job берут `DATABASE_URL` из существующего `potgres-secret`
- на главной странице включён заметный `BETA`-баннер

## Локальный kubeconfig

Новый kubeconfig для этого проекта следует хранить отдельно от рабочих конфигов.

Рекомендуемый файл:

- `~/.kube/config-jammers-microk8s`

Использование:

```bash
kubectl --kubeconfig ~/.kube/config-jammers-microk8s get ns
```

Если нужно временно объединить контексты только в текущем shell:

```bash
export KUBECONFIG="$HOME/.kube/config:$HOME/.kube/config-jammers-microk8s"
kubectl config get-contexts
```

## Что нужно для реального боевого запуска

### 1. Kubernetes Secret приложения

В namespace `prod` нужно создать secret:

- `jammers-web-secrets`

Минимально он должен содержать:

- `SESSION_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_FEEDBACK_CHAT_ID`

Пример:

```bash
kubectl --kubeconfig ~/.kube/config-jammers-microk8s -n prod create secret generic jammers-web-secrets \
  --from-literal=SESSION_SECRET='REPLACE_ME' \
  --from-literal=TELEGRAM_BOT_TOKEN='REPLACE_ME' \
  --from-literal=TELEGRAM_FEEDBACK_CHAT_ID='REPLACE_ME' \
  --dry-run=client -o yaml | kubectl --kubeconfig ~/.kube/config-jammers-microk8s apply -f -
```

### 2. GitHub Actions переменные

В GitHub repository / environment `production` нужно добавить:

- `K8S_NAMESPACE=prod`
- `NEXT_PUBLIC_APP_URL=https://thejammers.org`
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=YOUR_BOT_USERNAME`

### 3. GitHub Actions secret

Нужно добавить:

- `KUBE_CONFIG_B64`

Туда кладётся base64 от отдельного kubeconfig для service account деплоя, а не от admin-конфига.

## Рекомендуемая схема CI/CD доступа

Не использовать admin kubeconfig в GitHub.

Вместо этого:

1. создать в `prod` service account `github-actions-deployer`
2. выдать ему namespace-scoped Role / RoleBinding
3. выпустить token
4. собрать отдельный kubeconfig только для CI
5. положить его в `KUBE_CONFIG_B64`

## Команды для bootstrap CI-доступа

### Применить RBAC

```bash
kubectl --kubeconfig ~/.kube/config-jammers-microk8s apply -f infra/k8s/bootstrap/github-actions-rbac.example.yaml
```

### Выпустить токен

```bash
kubectl --kubeconfig ~/.kube/config-jammers-microk8s -n prod create token github-actions-deployer
```

### Собрать kubeconfig для GitHub Actions

Нужно создать отдельный файл, например:

- `~/.kube/config-jammers-gha-prod`

В него должны попасть:

- cluster `microk8s-cluster`
- server `https://thejammers.org:16443`
- token service account
- context на namespace `prod`

### Закодировать kubeconfig

```bash
base64 < ~/.kube/config-jammers-gha-prod | tr -d '\n'
```

Эту строку нужно положить в GitHub secret `KUBE_CONFIG_B64`.

## Первый безопасный rollout

После того как секреты и GitHub variables добавлены:

1. запушить изменения в `main`
2. дождаться workflow `Deploy To Kubernetes`
3. проверить rollout:

```bash
kubectl --kubeconfig ~/.kube/config-jammers-microk8s -n prod rollout status deployment/jammers-web --timeout=10m
```

4. проверить ingress:

```bash
kubectl --kubeconfig ~/.kube/config-jammers-microk8s -n prod get ingress jammers-web -o yaml
```

5. проверить health:

```bash
curl -I https://thejammers.org/api/healthz
```

## Что принципиально не трогаем

- `ingress/prod/jammers-next-gig`
- пути `/nextgig` и `/nextgighosts`
- deployment `jammers-next-gig`
- существующий TLS secret `jammers-next-gig-ingress-tls`

Новый сайт живёт отдельно как `deployment/service/ingress jammers-web`, но использует тот же домен и тот же TLS-secret.
