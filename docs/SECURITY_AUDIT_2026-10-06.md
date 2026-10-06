# Аудит безопасности The Jammers — 6 октября 2026

## Область и статус

Проверены текущий исходный код, npm lockfile, серверные actions/API, Telegram login,
сессии, редиректы, CSP, WebSocket-мост, Docker/Kubernetes и публичные HTTP-ответы
https://thejammers.org/. Production проверялся без изменения данных, нагрузочных атак
и эксплуатации RCE. Проверка не доказывает отсутствие всех возможных уязвимостей.

**Исправления внесены локально. Приложение и настройки ingress не развёрнуты.**
В рабочем дереве до аудита уже были незакоммиченные продуктовые изменения; они сохранены.
Нельзя считать этот смешанный набор изменений уже проверенным production-релизом.

Запущенный образ: `ghcr.io/kinteus/jammers-web:sha-cffa6b85a216f84231af3eaf7f70e5e033771d65`.
Lockfile этого commit содержит Next.js **15.5.15**. Это свидетельство версии исходного
релиза, а не независимая проверка файлов внутри контейнера.

## Находки и исправления

| Приоритет | Находка | Результат |
| --- | --- | --- |
| Высокий | Next.js 15.5.15 и устаревшие зависимости имеют опубликованные advisories, включая критические; применимость зависит от конкретного обработчика/платформы | Next.js и eslint-config-next закреплены на 15.5.27; обновлён lockfile, Vitest, SheetJS, проблемные транзитивные зависимости. Runtime npm audit: 0 |
| Высокий | Старый профиль без Telegram ID автоматически захватывался по совпавшему изменяемому username | Автопривязка удалена. Нужна проверенная администратором миграция immutable ID |
| Высокий | Production super-admin определялся по username при отсутствии Telegram ID | В production допускается только настроенный `PRIMARY_ADMIN_TELEGRAM_ID`; отсутствие ID закрывает управление администраторами |
| Высокий, при ошибке конфигурации | `ENABLE_DEV_AUTH=true` разрешал произвольный локальный вход и назначение роли даже в production runtime | Production безусловно отключает development auth |
| Средний | Подписанный ответ Telegram не был связан с браузером, начавшим вход: login CSRF | Введён 256-битный state, HttpOnly cookie на 10 минут, проверка GET/POST callbacks, очистка после успешного входа |
| Средний | CSP production разрешал inline JavaScript и любые `ws:`/`wss:` | Nonce на каждый запрос, отсутствие `unsafe-inline`/`unsafe-eval` для scripts, точный WebSocket origin. Входящие CSP/nonce переписываются |
| Средний | Проверка returnTo до URL-нормализации пропускала пути, нормализующиеся в `//host` | Проверяется нормализованный origin/path, отклоняются backslash/control characters; клиент тоже проверяет redirectTo |
| Средний | GET callback обходил лимит POST, альтернативный sign-in action обходил маршрут; ошибки API раскрывали внутренние сообщения | Общий лимит GET/POST, неиспользуемый action удалён, ошибки обобщены, JSON ограничен 16 KiB |
| Средний | `/api/client-error` принимал неограниченное тело и поток неавторизованных записей в лог | Потоковое ограничение 16 KiB, проверка origin/ID, 20 запросов/IP/минуту; bounded rate-limit map |
| Средний | Catalog API обходил проверку банов и не ограничивал заявки; у API отсутствовала явная origin-проверка | Проверка банов/origin, длины полей и общий лимит 10 запросов/user/минуту для API и action |
| Средний | WebSocket принимал внешние Origin, крупные входящие сообщения и неограниченное число клиентов | Проверка Origin/eventId, 1 KiB payload, cap 1,000 соединений/process, heartbeat, запрет клиентских сообщений, только минимальные публичные invalidation events |
| Средний | Забаненный ADMIN проходил admin guard | Guard и dashboard проверяют активный бан; musician-search также отклоняет активный бан |
| Усиление | Runtime-контейнер работал как root и содержал инструменты разработки | USER node, UID/GID 1000, no privilege escalation, drop ALL capabilities, seccomp RuntimeDefault; dev dependencies удаляются из runtime, Prisma CLI сохранён |
| Низкий / усиление | Ingress подменяет годовой HSTS приложения на `max-age=15724800; includeSubDomains` | Подготовлен отдельный controller merge patch на 31536000 + includeSubDomains + preload; **применение ещё требуется** |

## Проверка пяти исходных замечаний

1. `unsafe-inline` в script-src подтверждён на live; локально заменён nonce. Само наличие
   слабой CSP не доказывает наличие XSS. Cookie сессии уже HttpOnly: XSS обычно позволяет
   действовать от имени пользователя и читать доступные странице данные, а не напрямую
   прочитать cookie или получить аккаунт Telegram.
2. `connect-src ws: wss:` подтверждён на live и убран в исправленном коде.
3. Обычные абсолютные внешние URL сервер уже отклонял. Дополнительно исправлен реальный
   обход через URL-нормализацию, например `/a/..//evil.example`, и клиентский redirectTo.
4. CVE-2025-29927 не относится к закреплённой версии 15.5.15. `/admin` проверяет роль на
   сервере; запрос с `x-middleware-subrequest` вернул страницу `Admin access required.`,
   а не админские данные. Однако более новые advisories требуют обновления до 15.5.27.
5. HSTS 182 дня подтверждён. Отсутствие preload само по себе не уязвимость. Директива
   preload не означает включение в браузерный preload list; заявка туда не отправлялась.

`/.env` и `/.git/HEAD` возвращают 404. Новый локальный `/api/musician-search` ещё отсутствует
в проверенном live-релизе (404); его проверки выполнялись по коду и unit-тестам.

## Проверки

- `npm run lint`, `npm run typecheck`, `git diff --check`.
- `npm run test:coverage`: 346 тестов / 82 файла; пороги покрытия соблюдены.
- Production build с заведомо отдельным локальным DATABASE_URL, без подключения к production.
- Два Chromium smoke-теста: свежие CSP nonces, nonce у Next scripts, блокирование вставленного
  inline-script и отсутствие админских форм при заголовке обхода middleware.
- `npm audit --omit=dev`: **0**. Полный `npm audit`: **7 high** в dev-цепочке `braces`
  (`braces`, `micromatch`, `fast-glob`, `chokidar`, `tailwindcss`, `@next/eslint-plugin-next`,
  `eslint-config-next`). У установленной последней `braces@3.0.3` нет исправленной версии
  в npm. Это остающаяся находка, а не устранённая уязвимость; в production-образ эти dev
  packages больше не копируются. Не передавайте недоверенные glob patterns инструментам
  сборки; обновите цепочку после исправления upstream. Безусловный `audit fix --force`
  предложил бы несовместимые изменения, включая откат eslint-config-next.
- Отдельный `npm ci --omit=dev --ignore-scripts` в временном каталоге успешно установил
  production-зависимости: Prisma CLI и Next присутствуют, Tailwind/Vitest отсутствуют, audit — 0.
- Docker daemon недоступен: реальная сборка/запуск нового контейнера не проверены локально.
- Полный продуктовый E2E не запускался: он пишет fixtures и сессии, изолированная PostgreSQL
  здесь не поднята. Dedicated security smoke использует недоступную локальную БД, а не tunnel.
- Реальный Telegram round-trip и WebSocket bridge с PostgreSQL требуют staging-проверки.
  Автоматические тесты не подменяют эти проверки.

## Перед выпуском

1. Отделить/проверить существовавшие продуктовые изменения и подготовить release commit.
2. Настроить проверенный immutable `PRIMARY_ADMIN_TELEGRAM_ID`. Согласовать миграцию
   username-only пользователей: автоматическая привязка больше не работает.
3. Выполнить Docker build и полный smoke на отдельной БД, проверить Telegram direct/widget
   login, state expiry и обновление доски через WebSocket на staging.
4. Выпустить образ, проверить rollout и live CSP/nonce. При смене CSP не кэшировать HTML
   совместно между пользователями/запросами.
5. Проверить остальные TLS-хосты ingress-контроллера, затем применить
   `infra/k8s/controller/hsts-patch.yaml` по `docs/K8S_DEPLOYMENT.md` и проверить HSTS снаружи.

Ограничения, которые остаются частью архитектуры: rate limits локальны для каждого pod,
`style-src` допускает inline styles, `img-src` допускает внешние HTTPS-картинки. Поэтому
CSP не следует трактовать как абсолютную защиту от XSS или любых каналов утечки.

Документация обновлена в техническом, auth, функциональном, local-development и deployment
разделах, а также AGENTS.md для правил приёма клиентских ошибок. README проверен: headline
возможности продукта не изменились, отдельное security-дополнение туда не требуется.

## Источники

- Next.js: https://nextjs.org/blog (security release 2026-09-30: 15.5.27).
- CSP nonce: https://nextjs.org/docs/app/guides/content-security-policy.
- CVE-2025-29927: https://github.com/advisories/GHSA-f82v-jwr5-mffw.
- Актуальные Next.js advisories: https://github.com/vercel/next.js/security/advisories.
- SheetJS install/update: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/.
- Остающаяся braces-находка: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm.
