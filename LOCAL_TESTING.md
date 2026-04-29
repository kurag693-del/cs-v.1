# Локальное тестирование (Auth + AI + S3, без Docker)

## 1) Установи локальные сервисы

- PostgreSQL на `localhost:5433`
- Redis на `localhost:6379`
- Mailpit (`mailpit.exe`) в `C:\tools\mailpit.exe`
- MinIO (`minio.exe`) в `C:\tools\minio.exe`

`npm run dev` автоматически:
- поднимет Redis/Mailpit/MinIO (если не запущены),
- создаст `S3_BUCKET`,
- применит публичную read-policy для объектов.

## 2) Проверь `.env`

В проекте уже прописаны локальные значения для S3:

- `S3_ENDPOINT=http://localhost:9000`
- `S3_ACCESS_KEY=minioadmin`
- `S3_SECRET_KEY=minioadmin`
- `S3_BUCKET=creative-media`
- `S3_PUBLIC_URL=http://localhost:9000/creative-media`

Для генерации текста обязательно укажи рабочие ключи GigaChat:

- `GIGACHAT_CLIENT_ID`
- `GIGACHAT_CLIENT_SECRET`

## 3) Подготовь БД и запусти проект

```bash
npm run prisma:gen
npm run prisma:push
npm run dev
```

## 4) Smoke-check

1. Регистрация нового пользователя.
2. Логин.
3. Генерация текста в `/dashboard/generate`.
4. Загрузка изображения и проверка, что URL сохраняется и показывается превью.
5. Сохранение черновика и проверка поста в календаре.
