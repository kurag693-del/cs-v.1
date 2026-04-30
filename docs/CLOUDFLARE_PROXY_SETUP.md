# Настройка Cloudflare Proxy (sandbox/production)

## 1) Настройка приложения

1. Убедитесь, что в `.env.local` есть:
   - `PUBLISH_MODE=sandbox`
   - `PUBLISH_PROXY_URL=https://<your-cloudflare-worker>.workers.dev/publish`
   - `PUBLISH_PROXY_SECRET=<ваш_секрет>`
   - `PUBLISH_TOKEN_ENCRYPTION_KEY=<ваш_секрет>`
2. Перезапустите приложение после изменения env.

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

## 4) Деплой в Cloudflare Workers

1. Перейдите в `proxy/cloudflare-publish-proxy`.
2. Установите зависимости:
   - `npm install`
3. Авторизуйтесь в Cloudflare:
   - `npx wrangler login`
4. Задайте секреты Worker:
   - `npx wrangler secret put PUBLISH_PROXY_SECRET`
   - `npx wrangler secret put TELEGRAM_BOT_TOKEN`
   - `npx wrangler secret put TELEGRAM_CHAT_ID`
   - при необходимости `VK_ACCESS_TOKEN`, `VK_OWNER_ID`, `DZEN_API_TOKEN`
5. В `wrangler.toml` оставьте/задайте `PUBLISH_PROXY_MODE=sandbox` для тестов, либо `production` для реальных публикаций.
6. Деплой:
   - `npm run deploy`
7. Добавьте env в основное приложение:
   - `PUBLISH_PROXY_URL=https://<your-worker>.workers.dev/publish`
   - `PUBLISH_PROXY_SECRET=<тот_же_секрет>`
   - `PUBLISH_MODE=sandbox` (для dry-run) или `PUBLISH_MODE=production` (для real publish)

## 5) Проверка

1. Проверьте health:
   - `GET https://<your-worker>.workers.dev/health`
2. Запустите публикацию из календаря (`Запустить очередь`).
3. Убедитесь, что статус поста сменился на `PUBLISHED`.
