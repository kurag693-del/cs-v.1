# ROADMAP — «Креатив-студия» (v2)

Единый формат: у каждой фазы одни и те же подразделы — **Цель**, **Файлы**, **Технические требования**, **Чек-лист приёмки**, **Сложность**. Ниже — сводка статуса и бэклог по моделям.

---

## Сводка статуса

| № | Фаза | По приёмке | Заметки |
|---|------|--------------|---------|
| **1** | Ядро ИИ + генерация | Закрыта | Бэклог: явный **выбор модели** — см. [Бэклог: выбор моделей](#бэклог-выбор-моделей) |
| **2** | Медиа + бренд | Почти всё | БД: PostgreSQL + Prisma; сторедж: S3-совместимый API. Периодически `npm ls` на лишние пакеты. |
| **3** | Календарь | Закрыта | — |
| **4** | Автопубликация РФ | Частично | **Telegram** — ок; **VK** ⏸ OAuth/config; retry/DLQ/smoke в тестах. **Dzen:** реализован fallback (см. фазу 4) |
| **5** | Аналитика (дашборд) | Закрыта | Внутренние метрики по постам; **метрики каналов** — см. фазу 11 |
| **6** | Надёжность + деплой | Закрыта по приёмке | Опционально: углубление алертов/DLQ |
| **7** | Монетизация + 152-ФЗ | Не закрыта | Отложено до стабильного продукта |
| **8** | AI-воркфлоу | Основное сделано | См. [Бэклог: выбор моделей](#бэклог-выбор-моделей); цепочка согласования и планирования покрыта **Vitest** (`draft-to-scheduled-gates`, `publish-guard`) + **Playwright** smoke (публичные маршруты); полный UI-flow «генерация → одобрение → слот» без логина — бэклог |
| **9** | Шаблоны + онбординг | Закрыта + бэклог 9+ | Сферные JSON, `UserContentTemplate` (БД), иконки ниш, импорт CSV, баннер «основной шаблон» на дашборде; см. [фазу 9](#фаза-9-библиотека-шаблонов-и-умный-онбординг) |
| **10** | Команда + RBAC | По коду закрыто | Workspace, инвайт, роли; гейт публикации для EDITOR через `editorsCanPublish` и `publish-guard.ts` — **Vitest** в `publish-guard.test.ts`; приёмка на проде — по чек-листу |
| **11** | Пост-аналитика (охваты из каналов) | Частично (MVP) | `engagement-tracker`, VK `wall.getById`, таблица на `/dashboard/analytics`, API sync; Telegram — деградация / `TELEGRAM_ENGAGEMENT_MOCK` — см. [фазу 11](#фаза-11-пост-аналитика-и-замкнутый-цикл) |
| **12** | Визуальный редактор | MVP на `/dashboard/design` | Привязка PNG из редактора к `Post.mediaUrls` — бэклог |

---

## Проверка по списку возможностей

| Возможность | Статус | Комментарий |
|-------------|--------|-------------|
| **Библиотека шаблонов контента** | Сделано | Сферы JSON + развёртка сценариев, селектор в генераторе и онбординге, избранное/prefs. Доп. ниши — `catalog.json`. |
| **Командный доступ (базовый)** | Сделано (MVP) | Пространство, инвайт, роли, бренды; политика публикации для EDITOR — в коде (`publish-guard`, настройка команды). |
| **Аналитика вовлечённости пост-фактум** | Частично | Сейчас: агрегаты по **своим** постам (частота, платформы, время). Нет подтягивания лайков/охватов из API Telegram/VK — это фаза 11. |

### Критично к стабильному продакшену (приоритет)

1. **Инфра первого деплоя** — PostgreSQL (любой хост), `DATABASE_URL`, `prisma db push` / миграции, переменные из `.env.example`; проверка `GET /api/health`; `NEXT_PUBLIC_APP_URL` для корректных редиректов и OpenRouter.
2. **Публикация и роли** — проверки в коде (`publish-guard`, workspace); для продакена задать `CRON_SECRET` и cron на `POST /api/publish/jobs` (или ваш оркестратор).
3. **VK OAuth** — только если нужен VK; иначе достаточно Telegram + ручной постинг.
4. **Выбор модели** (бэклог) — выравнивание UI с `router.ts` и лимитами тира.
5. **Монетизация / 152-ФЗ** (фаза 7) — перед платным коммерческим запуском в РФ.

Менее блокирующее: периодический аудит `npm`; E2E с сессией; привязка экспорта дизайнера к `Post.mediaUrls`.

---

## Бэклог: выбор моделей

**Цель:** не только провайдер (`deepseek` / `yandexgpt` / …), а явный **выбор модели** в согласовании с `src/lib/ai/router.ts` и лимитами тира.

- [x] **OpenRouter** — реализовано: `src/lib/ai/providers/openrouter-provider.ts` (OpenAI-compatible `https://openrouter.ai/api/v1`), регистрация в `registry.ts`, ключ `OPENROUTER_API_KEY`, заголовки referer/title, каталог моделей в env (`AI_TEXT_MODELS_*` и др.). Запись фактической модели — в ответе провайдера и `Generation.metadata` при необходимости.
- [ ] **UI** — пресеты «быстро / сбалансировано / дорого» и полное выравнивание с лимитами тира (селектор модели для OpenRouter частично есть в генераторе).
- [ ] **Связка** — жёсткая согласованность `routeModel` с выбранным slug при всех путях; опционально кэш/стоимость в cost-log.

---

## Фаза 1. Ядро ИИ + фикс генерации

### Цель
- Мульти-провайдерная архитектура (GigaChat, YandexGPT, DeepSeek и др.), снятие lock-in, выбор по цене/качеству.
- Качество: `buildPrompt`, структурная валидация (хук → тело → CTA), анти-шаблон.
- Прозрачность: провайдер и `modelUsed` в `Generation.metadata`.

### Файлы
- `src/lib/generate/actions.ts`, `src/lib/ai/types.ts`, `src/lib/ai/providers/types.ts`, `src/lib/ai/providers/gigachat-provider.ts`, `yandexgpt-provider.ts`, `registry.ts`, `src/lib/validation/generation-output.ts`, `TextGeneratorForm.tsx`, `TextGenerator.tsx`.

### Технические требования
- TypeScript strict, Zod на границах, `body >= 300`, единый формат ошибок, без утечки секретов.
- Без `@google/generative-ai` в критическом пути; Lucia: `userId` из сессии.

### Чек-лист приёмки
- [x] UI: выбор провайдера, генерация, `body >= 300`.
- [x] Отклонение шаблонных ответов / без CTA.
- [x] Vitest: `buildPrompt`, Zod-валидация.
- [x] `npm run ci` на registry-провайдерах.

### Статус (выполнено)
- [x] `AIProviderRegistry` (`gigachat`, `yandexgpt`, `deepseek`), UI-селектор, `modelUsed` в metadata.
- [x] Strict placeholder validation в `buildPrompt`.

### Сложность
**Высокая** · риск средний.

---

## Фаза 2. Медиа-пайплайн и бренд-профиль

### Цель
- Визуальный поток (загрузка, превью, `Post.mediaUrls`), бренд в генерации (`Brand`: voice, tone, colors, examples).
- База под image-prompt и обложки.

### Файлы
- `ImageUploader.tsx`, `src/lib/storage/upload.ts`, `src/lib/posts/actions.ts`, `src/lib/generate/actions.ts`, `src/lib/brands/actions.ts`, `src/lib/validation/brand.ts`, `src/lib/ai/image/actions.ts` (в т.ч. `generatePostRasterImage`, `image-gen/router`: mock / HTTP-шлюз / заготовка YandexART), `src/lib/validation/media.ts`, `package.json` (очистка зависимостей).

### Технические требования
- Server Actions, Zod (media, brand), Prisma, whitelist MIME, нормализация ошибок стореджа.

### Чек-лист приёмки
- [x] Загрузка, превью, `mediaUrls`, отклонение невалидных файлов.
- [x] Vitest: media, brand, `posts/actions` / `mediaUrls`.
- [x] Аудит зависимостей (см. сводку фазы 2 выше); при добавлении пакетов повторять проверку.

### Сложность
**Средняя/высокая** · риск низкий/средний.

---

## Фаза 3. Календарь и планирование

### Цель
- DnD, `scheduledAt`, статус-машина, cron-ready API.

### Файлы
- `PostCalendar.tsx`, `DraggablePostCard.tsx`, `src/lib/posts/actions.ts`, `src/lib/validation/posts.ts`, `prisma/schema.prisma`, `api/publish/jobs`, `api/publish/dispatch`, `src/lib/publish/state-machine.ts`.

### Технические требования
- Идемпотентные actions, state machine, Lucia (owner), `CRON_SECRET`, rate-limit.

### Чек-лист приёмки
- [x] DnD, фильтры, Vitest: state machine, конкурентные даты, 401 на неверный cron secret.

### Сложность
**Высокая** · риск средний.

---

## Фаза 4. Автопубликация РФ (Telegram, VK, Дзен)

### Цель
- Публикация в РФ-каналы, очередь, retry, DLQ, идемпотентность, прокси-абстракция.

### Файлы
- `src/lib/publish/actions.ts`, `api/publish/dispatch`, `api/publish/jobs`, `src/lib/publish/providers/telegram.ts`, `vk.ts`, `dzen.ts`, `queue/upstash.ts`, `retry-policy.ts`, `dead-letter.ts`, `proxy-client.ts`, `prisma/schema.prisma`, `src/lib/validation/publish.ts`.

### Технические требования
- Telegram: MarkdownV2; VK: upload + `wall.post`; Дзен: API или деградация.
- Upstash: retry + jitter, DLQ; идемпотентность; секреты только в env; rate-limit.

### Уточнение: Dzen fallback
- Если API недоступен: Markdown-черновик, «Экспорт в Дзен», RSS-импорт; уведомление в UI; smoke без внешнего API.

### Чек-лист приёмки
- [ ] Ручной E2E: пост в Telegram/VK → `PUBLISHED` (Telegram ✅ · VK ⏸ OAuth/config).
- [x] Сбой провайдера → retry → DLQ.
- [x] Vitest: идемпотентность, retry policy.
- [x] Smoke очереди.

### Сложность
**Очень высокая** · риск высокий.

---

## Фаза 5. Рекомендации и аналитика

### Цель
- Агрегаты, AI-подсказки, экспорт, tenant isolation.

### Файлы
- `src/lib/analytics/actions.ts`, `dashboard/page.tsx`, `contextual-ai-suggestion.tsx`, `src/lib/analytics/recommendations.ts`, `export.ts`, `api/analytics/export`, `src/lib/ai/router.ts`.

### Технические требования
- Только данные пользователя, Zod фильтров, детерминированные рекомендации, graceful degradation.

### Чек-лист приёмки
- [x] Дашборд, экспорт CSV/JSON, Vitest: метрики и рекомендации, smoke export.

### Сложность
**Средняя/высокая** · риск средний.

---

## Фаза 6. Надёжность, UX, деплой

### Цель
- Production-ready: ошибки, онбординг, CI, наблюдаемость.

### Файлы
- `error.tsx`, `not-found.tsx`, `ErrorBoundary`, `cost-log.ts`, `queue-monitor.ts`, `onboarding/page.tsx`, `middleware.ts`, `.github/workflows/ci.yml`.

### Технические требования
- Без утечки деталей в UI; correlation-id; онбординг под Lucia; `npm run ci`.

### Чек-лист приёмки
- [x] `error`/`not-found`, онбординг, Vitest: ошибки, middleware, полный CI.

### Сложность
**Средняя** · риск низкий/средний.

---

## Фаза 7. Монетизация и compliance (RU)

### Цель
- ЮKassa/CloudPayments, 152-ФЗ, экспорт ПДн.

### Файлы
- `src/lib/billing/yookassa.ts`, `cloudpayments.ts`, `api/billing/webhook`, `register/page.tsx`, `consent-log.ts`, `api/account/export`, `docs/` (политики).

### Технические требования
- Consent, аудит согласий, экспорт данных, RU-hosting критичных данных.

### Чек-лист приёмки
- [ ] Оплата, блок без consent, Vitest: consent/webhook, smoke биллинга.

### Сложность
**Высокая** · риск высокий.

---

## Фаза 8. AI-воркфлоу и оркестрация

### Цель
- A/B, хештеги, ресайклинг, approval перед автопостом; задел под OpenRouter/Gemini.

### Файлы
- `src/lib/generate/actions.ts`, `src/lib/ai/workflows/ab-variants.ts`, `hashtags.ts`, `recycle.ts`, `src/lib/approval/actions.ts`, `openrouter-provider.ts` (план), `gemini-provider.ts` (план), `registry.ts`, `TextGeneratorForm.tsx`.

### Технические требования
- 2–3 варианта (один запрос к модели + JSON `variants` где возможно), approval `DRAFT → REVIEW_PENDING → APPROVED/REJECTED`.

### Чек-лист приёмки
- [x] A/B, ресайклинг, Vitest: approval, реестр провайдеров.
- [ ] Gemini как отдельный провайдер (не через OpenRouter) — см. [Бэклог: выбор моделей](#бэклог-выбор-моделей).
- [x] Автотесты цепочки «одобрение + расписание»: Vitest (`draft-to-scheduled-gates`, `publish-guard`); Playwright — smoke публичных маршрутов и редирект на логин (`npm run test:e2e` в CI после сборки).
- [ ] E2E с сессией: generate → approve → schedule в браузере — бэклог (нужны тестовый пользователь/фикстуры).

### Текущий прогресс
- [x] A/B/C, авто-хештеги, ресайклинг 1→N, approval и ограничения без `APPROVED`.
- [x] DeepSeek (fallback GigaChat), YandexGPT, GigaChat в UI.

### Сложность
**Высокая** · риск средний/высокий.

---

## Фаза 9. Библиотека шаблонов и умный онбординг

### Цель
- Убрать «чистый лист»: пресеты ниш и быстрый старт до первой генерации.
- Дать **ориентиры по вертикали** (категории), **быстрый поиск** и персонализацию через **избранное** и **основной шаблон** без отдельной таблицы в БД.

### Файлы
- `src/lib/templates/*.json` — **основной источник** многосценарных ниш (развёртка в шаблоны с id `pack__scenario`); см. `prompts/templates/README.md`.
- `prompts/templates/catalog.json` — дополнительные однострочные ниши без отдельного JSON-пакета.
- `src/lib/templates/sphere-packs.ts` — валидация сферных пакетов.
- `src/lib/templates/builtin-templates.ts` — Zod-разбор каталога + слияние со сферами, экспорт `BUILTIN_TEMPLATES`, фильтры и порядок карточек (`TEMPLATE_CATEGORY_LABELS`).
- `src/lib/templates/template-prefs.ts` — Zod и парсинг `Profile.preferences.templatePrefs`, лимит избранного (до 12).
- `src/lib/templates/actions.ts` — `toggleFavoriteBuiltinTemplate`, `setPreferredBuiltinTemplate`, `getBuiltinTemplatePreferences`.
- `src/components/features/TemplateSelector.tsx` — фильтр по категории, поиск, сердечко (избранное), закладка (основной), режим ссылок для онбординга.
- `src/components/features/TextGeneratorForm.tsx` — предзаполнение темы / платформы / тона / **типа контента**; вызов server actions и `router.refresh()`.
- `src/app/dashboard/generate/page.tsx` — загрузка prefs и проброс в форму.
- `src/app/onboarding/page.tsx` — онбординг (пространство/бренд/генератор), селектор шаблонов, 4 шага до первой публикации в календаре.
- `src/lib/onboarding/actions.ts` — автоматический прогресс по фактам в БД.
- `src/lib/generate/actions.ts`, `src/lib/validation/generate.ts` — `templateId` до 80 символов (составные id сценариев).
- `src/__tests__/builtin-templates.test.ts`, `src/__tests__/template-prefs.test.ts`.

### Технические требования
- Шаблоны по-прежнему **в коде** (без миграций под каталог).
- Расширенная структура: `category`, `defaultContentType?`, опционально подсказки сферы в промпте через `brand_voice_json` (`nicheToneGuidance`, хештеги, CTA).
- Персонализация: `Profile.preferences.templatePrefs` (`favoriteBuiltinTemplateIds`, `preferredBuiltinTemplateId`) — merge с остальными ключами `preferences` (Stripe и др.).
- Неизвестный `templateId` на сервере → ошибка валидации.

### Чек-лист приёмки
- [x] Библиотека ниш: сферные JSON + `catalog.json`, уникальные `id`, Zod при загрузке; карточки по сценариям (много на одну вертикаль).
- [x] Категории + поиск по названию/нише/id; пустой результат при узком фильтре — подсказка в UI.
- [x] Избранное и «основной» шаблон сохраняются в профиле; порядок карточек: основной → избранные → остальные.
- [x] Применение шаблона подставляет тему, платформу, тон, при наличии — **тип контента** и подсказку по эмодзи (сферные шаблоны).
- [x] Генерация с `templateId` и контекстом ниши в промпте.
- [x] Vitest: каталог, фильтр, порядок, `templatePrefs`.

### Бэклог (фаза 9+)
- [x] Пользовательские шаблоны в БД и шаринг внутри команды: модель `UserContentTemplate`, `src/lib/templates/user-template-actions.ts`, панель на странице генерации; личные (`workspaceId` null) и командные (роль EDITOR+).
- [x] Иконки ниш по категориям в `TemplateSelector` (`category-template-icons`); импорт CSV: `scripts/import-user-templates-csv.mjs` (см. заголовок скрипта).
- [x] Подсказка «продолжить с основного шаблона» на дашборде (баннер + ссылка `?template=`).

### Сложность
**Низкая / средняя** (расширение prefs и UI) · зависимости: фаза 1.

---

## Фаза 10. Командная работа и RBAC

### Цель
- B2B: рабочее пространство (**Workspace**), несколько брендов внутри; редактор без лишних прав.
- Задел под расширение (несколько пространств на организацию позже).

### Файлы (реализовано, MVP)
- `prisma/schema.prisma` — `Workspace`, `WorkspaceMember`, `WorkspaceInvite` (`WorkspaceInviteRole`), `Brand.workspaceId`.
- `src/lib/workspace/invite-token.ts` — секрет в ссылке; в БД только SHA-256 с перцем `WORKSPACE_INVITE_PEPPER`.
- `src/lib/workspace/permissions.ts`, `src/lib/workspace/actions.ts`, `src/lib/validation/workspace.ts`.
- `src/lib/brands/access.ts`, правки `src/lib/brands/actions.ts` (видимость и редактирование брендов по workspace).
- `src/app/dashboard/workspace/page.tsx`, `src/components/features/WorkspaceSettings.tsx`, `src/app/join/workspace/page.tsx`.
- `scripts/backfill-workspaces.cjs`, npm script `workspace:backfill`.

### Технические требования
- Инвайт: одноразовая ссылка `/join/workspace?t=…`, срок **48 ч**, rate-limit на пространство и на автора.
- Принятие: email аккаунта = email приглашения; только при авторизации.
- OWNER задаёт **delegateBilling** и **delegateFullAccess** для роли ADMIN.

### Чек-лист приёмки
- [x] Инвайт → вход под нужным email → принять → доступ к пространству и брендам по роли.
- [x] Политика публикации: роль VIEWER не планирует/не публикует; EDITOR — по флагу `Workspace.settings.editorsCanPublish` (настройка на странице «Команда»); проверки в `schedulePost`, `updatePostStatus`, `enqueuePublishJob`.
- [x] Vitest: сценарии `assertUserCanScheduleOrPublishPost` с моком Prisma — `src/__tests__/publish-guard.test.ts`. Unit для invite-token — по-прежнему отдельно.

### Сложность
**Высокая** · зависимости: фаза 6.

---

## Фаза 11. Пост-аналитика и замкнутый цикл

### Цель
- Доказать ROI за счёт **метрик из каналов** (лайки, просмотры, репосты) после публикации; замкнутый feedback для контента.
- **Не путать с фазой 5:** текущий `/dashboard/analytics` строится на **внутренних** данных (посты, время слотов, платформы), без опроса Telegram/VK API.

### Файлы
- `src/lib/analytics/engagement-types.ts`, `src/lib/analytics/engagement-tracker.ts`, `src/lib/analytics/actions.ts` (`listPublishedPostsChannelMetrics`), `src/app/api/analytics/channel-metrics/route.ts`, `src/app/api/analytics/sync-engagement/route.ts`, `src/app/dashboard/analytics/page.tsx` (таблица метрик).

### Технические требования
- Асинхронный сбор; история снэпшотов в `metadata.engagementHistory`; degradation при недоступности API (Telegram Bot API без просмотров канала).

### Чек-лист приёмки
- [x] Обновление снимка по кнопке «Синхрон» и через `POST /api/analytics/sync-engagement`; таблица на `/dashboard/analytics`; Vitest: парсинг VK id, Zod snapshot.
- [x] После публикации — опционально `scheduleEngagementSyncAfterPublish` (`ENGAGEMENT_SYNC_AFTER_PUBLISH=true`); пакетно — `POST /api/analytics/engagement-cron` с `x-cron-secret` и телом `{ "limit": 15 }`.
- [ ] Smoke / приёмка с реальным VK — на стенде.

### Сложность
**Средняя** · зависимости: фаза 4.

---

## Фаза 12. Визуальный редактор (Canva-Lite)

### Цель
- Текст + картинка в одном окне; база под карусели и сторис.

### Файлы
- `src/components/features/PostDesigner.tsx`, `src/lib/design/templates.ts`, `src/lib/design/canvas-layout.ts`, `src/app/dashboard/design/page.tsx`, `src/app/api/design/export/route.ts`, `src/lib/storage/upload.ts` (server action).

### Технические требования
- Клиентский canvas; экспорт PNG → сторедж (при настроенном S3); лимиты размера (5 МБ, см. `MAX_EXPORT_BYTES`); мобильный предпросмотр через адаптивную ширину холста.

### Чек-лист приёмки
- [x] Создание визуала на `/dashboard/design`, скачивание валидного PNG.
- [x] Кнопка «В облако» при `S3_BUCKET` + `S3_PUBLIC_URL`; альтернатива `POST /api/design/export` (multipart `file`).
- [x] Vitest: `design-templates.test.ts`.
- [ ] Привязка загруженного URL к `Post.mediaUrls` при создании/редактировании поста (следующий инкремент).

### Сложность
**Очень высокая** · зависимости: фаза 2.

---

## Контрольные точки (milestones)

1. После фазы 1 — мульти-провайдерный MVP, стабильная генерация.
2. После фазы 3 — календарь и статус-машина.
3. После фазы 4 — контур автопубликации РФ с очередью и DLQ.
4. После фазы 5 — внутренняя аналитика по постам + экспорт (не путать с метриками каналов, фаза 11).
5. После фазы 6 — релизный контур, CI, онбординг.
6. После фазы 7 — легальный коммерческий запуск в РФ.
7. После фазы 8 — A/B, ресайклинг, approval.
8. После фазы 9 — библиотека ниш с фильтром и избранным, быстрый старт из онбординга и генератора.

*Историческая пометка:* изначально фазы шли последовательно; актуальное состояние — в [сводке](#сводка-статуса) выше.
