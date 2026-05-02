/**
 * Понятные пользователю названия задач генерации.
 * Технически все варианты по-прежнему используют один «конверт» ответа (hook / body / hashtags / cta);
 * меняется смысл полей — см. expertHint.
 */
export type FormGenerationTask =
  | 'social_post'
  | 'blog_outline'
  | 'ad_copy'
  | 'image_prompt'
  | 'feedback_optimizer'
  | 'brand_voice'

export type GenerationTaskPreset = {
  value: FormGenerationTask
  /** Коротко для карточки */
  title: string
  /** 1–2 предложения простым языком */
  description: string
  /** Что означают hook / body / … именно для этого шаблона */
  expertHint: string
}

export const GENERATION_TASK_PRESETS: readonly GenerationTaskPreset[] = [
  {
    value: 'social_post',
    title: 'Пост в соцсетях',
    description:
      'Текст для ленты: цепляющее начало, основная мысль, теги и что сделать читателю. Подходит почти всегда.',
    expertHint:
      'hook — первая строка (цепляк); body — основной текст; hashtags — теги; cta — призыв (например «напишите в комментариях»).',
  },
  {
    value: 'ad_copy',
    title: 'Реклама или оффер',
    description:
      'Короткий убедительный текст: выгода, доверие, чёткое действие. Удобно для акций и платных объявлений.',
    expertHint:
      'hook — заголовок оффера; body — выгоды и доказательства; cta — что сделать прямо сейчас; hashtags — по теме кампании.',
  },
  {
    value: 'blog_outline',
    title: 'План статьи или длинного поста',
    description:
      'Не сам текст «под публикацию», а структура: подзаголовки и логика разделов. Потом можно развернуть в статью.',
    expertHint:
      'hook — рабочий заголовок материала; body — план с подзаголовками и пунктами; hashtags и cta — по смыслу темы.',
  },
  {
    value: 'image_prompt',
    title: 'Описание для картинки',
    description:
      'Сформулируйте в теме, что должно быть на изображении — получите текст для генератора картинок (стиль, объекты, настроение).',
    expertHint:
      'hook — короткое название идеи; body — развёрнутое визуальное описание сцены; hashtags — тематические теги.',
  },
  {
    value: 'feedback_optimizer',
    title: 'Улучшить черновик',
    description:
      'Опишите в поле «Тема» свой текст или задачу — ИИ перепишет сильнее, без выдуманных фактов.',
    expertHint:
      'hook — усиленный заголовок; body — переработанный основной текст; cta — призыв сохраняется или усиливается по вашей теме.',
  },
  {
    value: 'brand_voice',
    title: 'Голос бренда',
    description:
      'Набор правил тона и стиля, чтобы все посты звучали «вашим» голосом. Полезно перед серией публикаций.',
    expertHint:
      'hook — условное имя профиля; body — правила тона, слов и структуры; cta — как применять эти правила в постах.',
  },
]

export function getGenerationTaskPreset(value: string | undefined): GenerationTaskPreset {
  const key = (value ?? 'social_post') as FormGenerationTask
  return GENERATION_TASK_PRESETS.find((p) => p.value === key) ?? GENERATION_TASK_PRESETS[0]!
}
