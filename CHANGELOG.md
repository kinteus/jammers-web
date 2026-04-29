# Changelog

## 0.2.0 - 2026-04-29

- Добавлен debounce для поиска песен в iTunes, чтобы запросы не уходили на каждый введенный символ.
- Улучшена desktop-таблица гига: заголовок закреплен при скролле, строки и колонки получили единую фиксированную ширину, длинный текст обрезается с возможностью прочитать полное значение через hover/title.
- Добавлена сортировка desktop-таблицы по занятости конкретной позиции: свободные или занятые места можно поднимать вверх по клику на заголовок роли.
- Обновлен бейдж `Плейбэк` в desktop-таблице: он больше не добавляет строке высоту и размещается компактно рядом с названием трека.
- Улучшена отмена трека из сет-листа: кнопка заменена на понятный красный крестик, перед удалением показывается подтверждение.
- Исправлена авторизация предзагруженных пользователей с отличающимся регистром Telegram username, включая кейс `@Kyle_Reese`.
- Исправлена обработка принятия приглашений на трек: ошибки больше не превращаются в безмолвное обновление профиля, а показываются inline с понятным описанием причины, включая лимит треков на гиг.
- Переделано приглашение людей на песню: вместо произвольного Telegram username используется список зарегистрированных пользователей с поиском по имени и Telegram-аккаунту, с debounce.
- Улучшен UX окна приглашения: после отправки инвайта страница не сбрасывается наверх, клик вне формы не скипает ввод, одновременно открыто только одно окно приглашения.
- На главной странице обновлен блок ближайшего гига: удален текст `Что сейчас просит внимания в ближайшем гиге`, название вынесено как `Следующий гиг: <название>`, ниже показаны дата, время и место со ссылкой, если она есть.
- Облака цитат на главной странице сдвинуты ближе к краям экрана.
- Добавлена команда `npm run local:prod`, которая одной командой поднимает локальное приложение через Kubernetes port-forward к продовой базе.
- Усилен `local:prod` runner: он выбирает production database URL вместо локального dev `DATABASE_URL`, проверяет реальное SQL-соединение перед стартом Next.js и завершает приложение при падении tunnel.
- Добавлена документация для локального запуска через production tunnel в README, `docs/LOCAL_SETUP.md` и `AGENTS.md`, включая указание для моделей использовать эту команду при запросе "подними приложение локально".
- В `AGENTS.md` добавлены осторожные инструкции по использованию kubeconfig из `~/.kube` для расследований production-кейсов.
- В `AGENTS.md` задокументирована текущая система логирования и трекинга ошибок: client error boundary, `/api/client-error`, `recordAppError`, JSONL stderr/file logs, error id/digest и поиск по Kubernetes logs.
- Добавлены и обновлены регрессионные тесты для debounce поиска, таблицы треков, приглашений, предзагруженных Telegram-пользователей, облаков цитат и local production runner.

## 0.1.0 - 2026-03-30

- Bootstrapped a full-stack Next.js application for concert setlist planning.
- Added Telegram-based sign-in flow, session management, RBAC scaffolding, and profile management.
- Implemented event management, lineup configuration, track proposals, seat claims, seat invitations, and user moderation.
- Added the coverage-first setlist selection algorithm with known-band de-prioritization and previous-concert exclusion.
- Added Prisma schema, seed data, regression tests, Docker assets, GitHub Actions workflows, and Kubernetes deployment manifests.
- Documented architecture, operations, assumptions, and deployment/runbooks.
