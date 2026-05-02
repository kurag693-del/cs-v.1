/*
 * Не выполнять на продакшене с текущим стеком (Lucia + Prisma).
 *
 * Исторический черновик под связку Supabase Auth (auth.users) → профиль в public.profiles.
 * Сейчас регистрация и профиль создаются в приложении (route handlers / onboarding), без триггеров на auth.users.
 */
