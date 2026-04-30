# Фаза 4: локальное ручное тестирование (Sandbox + надежность)

## Предусловия

1. В `.env.local` должны быть:
   - `PUBLISH_MODE=sandbox`
   - `PUBLISH_PROXY_URL=http://127.0.0.1:8787/publish`
   - `PUBLISH_PROXY_SECRET=<same value for app/proxy>`
   - `PUBLISH_TOKEN_ENCRYPTION_KEY=<long random secret>`
2. База данных запущена (`postgres`), зависимости установлены (`npm install`).

## 1) Запуск локальных сервисов

Откройте терминал #1:

```bash
npm run proxy:sandbox
```

Ожидается:
- proxy слушает `http://127.0.0.1:8787`
- health endpoint отвечает:

```bash
curl http://127.0.0.1:8787/health
```

Ожидаемый ответ:
`{"success":true,"status":"ok","mode":"sandbox"}`

Откройте терминал #2:

```bash
npm run dev
```

## 1.1) Настройка Railway proxy для ручных тестов

1. Задеплойте папку `proxy/railway-publish-proxy` в Railway.
2. В Railway задайте env:
   - `PUBLISH_PROXY_SECRET` (должен совпадать со значением в app)
   - `PUBLISH_PROXY_MODE=sandbox`
3. Скопируйте Railway URL и задайте в `.env.local` приложения:
   - `PUBLISH_PROXY_URL=https://<railway-domain>/publish`
4. Оставьте приложение в sandbox:
   - `PUBLISH_MODE=sandbox`
5. Перезапустите app сервер.

## 2) Подключение платформ пользователем (вручную)

1. Войдите в приложение.
2. Откройте `http://localhost:3000/dashboard/integrations`.
3. Выберите бренд.
4. Выберите платформу (`TELEGRAM`, `VK`, `DZEN`).
5. Введите `access token` (в sandbox можно любой непустой).
6. Нажмите `Подключить платформу`.
7. Убедитесь, что запись появилась:
   - "Мои подключения"
   - "Статус по брендам и платформам" as `Подключено`.

## 3) Проверка VK OAuth (опционально в sandbox)

Требуемые env:
- `VK_OAUTH_CLIENT_ID`
- `VK_OAUTH_CLIENT_SECRET`
- `VK_OAUTH_REDIRECT_URI=http://localhost:3000/api/platform-credentials/vk/callback`

Шаги:
1. На странице интеграций выберите `VK` и бренд.
2. Нажмите `Подключить VK через OAuth`.
3. Пройдите OAuth на стороне VK.
4. После редиректа на странице должен появиться toast успеха/ошибки.

## 4) Ручной сценарий успешной публикации (sandbox)

1. Создайте/подготовьте пост с условиями:
   - status `SCHEDULED`
   - `scheduledAt <= now`
   - у выбранного бренда должна быть подключена платформа.
2. Откройте страницу календаря.
3. Нажмите `Запустить очередь`.
4. Ожидается:
   - toast со счетчиками обработки,
   - статус поста меняется на `PUBLISHED`,
   - в metadata появляется sandbox external id,
   - в логах Railway proxy есть запрос с platform/context.

## 5) Ручной сценарий Retry + DLQ

### 5.1 Принудительный сбой провайдера
Установите в `.env.local`:
- `PUBLISH_MODE=production`
- `PUBLISH_PROXY_URL=http://127.0.0.1:9999/publish` (non-existing endpoint)

Перезапустите приложение (`npm run dev`).

### 5.2 Повторный запуск dispatch
1. Убедитесь, что пост в `SCHEDULED` и credential подключен.
2. Запустите dispatch несколько раз (кнопкой в календаре или через API).
3. Ожидается:
   - растет счетчик попыток (`publishAttempts`),
   - планируются retry,
   - после лимита попыток задача уходит в DLQ, пост становится `FAILED`.

### 5.3 Возврат в sandbox
Верните:
- `PUBLISH_MODE=sandbox`
- `PUBLISH_PROXY_URL=http://127.0.0.1:8787/publish`

Перезапустите приложение.

## 6) Скриптовые проверки

Запустите:

```bash
npm run smoke:publish-worker
```

Ожидается:
- проходят тесты retry policy,
- проходят тесты idempotency,
- проходят тесты DLQ.

## 7) Остановка локальных сервисов

Остановите оба процесса через `Ctrl+C`.
