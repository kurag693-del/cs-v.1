# Настройка Railway Proxy (sandbox)

## 1) Сначала локальный sandbox

1. Убедитесь, что в `.env.local` есть:
   - `PUBLISH_MODE=sandbox`
   - `PUBLISH_PROXY_URL=http://127.0.0.1:8787/publish`
   - `PUBLISH_PROXY_SECRET=<ваш_секрет>`
   - `PUBLISH_TOKEN_ENCRYPTION_KEY=<ваш_секрет>`
2. Запустите локальный sandbox proxy:
   - `npm run proxy:sandbox`
3. Проверьте health endpoint:
   - `GET http://127.0.0.1:8787/health`
4. Запустите приложение и проверьте сценарий публикации через календарь/dispatch.

## 2) Подключения платформ пользователем

1. Откройте `http://localhost:3000/dashboard/integrations`.
2. Выберите бренд и платформу.
3. Подключите одним из способов:
   - Ввод токена вручную (sandbox)
   - Кнопка VK OAuth (требуются VK env-переменные)
4. Подключения хранятся отдельно для каждого пользователя и бренда.

## 3) Обязательные env для VK OAuth

- `VK_OAUTH_CLIENT_ID`
- `VK_OAUTH_CLIENT_SECRET`
- `VK_OAUTH_REDIRECT_URI` (должен указывать на `/api/platform-credentials/vk/callback`)

## 4) Деплой в Railway (сначала sandbox)

1. Создайте сервис в Railway для proxy.
2. Задеплойте минимальный Node-сервис с `/health` и `/publish`.
3. Добавьте env в Railway:
   - `PUBLISH_PROXY_SECRET`
   - `PUBLISH_PROXY_MODE=sandbox`
4. Добавьте env в основное приложение:
   - `PUBLISH_MODE=production` только когда будете готовы к реальной внешней публикации.
   - `PUBLISH_PROXY_URL=https://<ваш-railway-домен>/publish`
   - `PUBLISH_PROXY_SECRET=<тот_же_секрет>`

## 5) Переход в production

Только после sandbox-проверок:
1. Установите `PUBLISH_MODE=production`.
2. Настройте proxy на реальные вызовы API Telegram/VK/Dzen.
3. Храните токены в БД в зашифрованном виде и передавайте их только server-to-server по TLS.
