/**
 * Минимальная длина поля `body` у принятого ответа модели.
 * Связана с лимитом поста в форме, но с верхней границей: иначе при maxLength ~800+
 * требовалось бы 60%+ символов — модели часто возвращают качественный, но более короткий текст.
 */
export function bodyMinCharsFromMaxPostLength(maxLength: number): number {
  return Math.max(300, Math.min(400, Math.floor(maxLength * 0.38)))
}
