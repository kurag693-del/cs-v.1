export type BaseTask = "text" | "image_prompt" | "moderation";

// Оставляем legacy-задачи для совместимости с существующими вызовами генерации.
export type GenerationTask =
  | BaseTask
  | "social_post"
  | "blog_outline"
  | "ad_copy"
  | "feedback_optimizer"
  | "brand_voice";

export type SubscriptionTier = "FREE" | "PRO" | "TEAM" | "ENTERPRISE";

export type RouteDecision = {
  model: string;
  temperature: number;
  maxTokens: number;
  fallbackModel?: string;
  estimatedCost: number;
};

type TierConfig = Record<BaseTask, RouteDecision>;

// Маппинг для @google/generative-ai: используем явные Gemini алиасы.
const GEMINI_MODELS = {
  flash: "gemini-flash",
  pro: "gemini-pro",
} as const;

const FREE_CONFIG: TierConfig = {
  // Для FREE выбираем экономичные модели с низкой стоимостью токена.
  text: {
    model: GEMINI_MODELS.flash,
    fallbackModel: "gpt-4o-mini",
    temperature: 0.6,
    maxTokens: 900,
    estimatedCost: 0.0012,
  },
  image_prompt: {
    model: "gpt-4o-mini",
    fallbackModel: GEMINI_MODELS.flash,
    temperature: 0.7,
    maxTokens: 700,
    estimatedCost: 0.0015,
  },
  moderation: {
    model: GEMINI_MODELS.flash,
    temperature: 0.1,
    maxTokens: 300,
    estimatedCost: 0.0004,
  },
};

const PRO_CONFIG: TierConfig = {
  // Для PRO повышаем качество: основной выбор — более сильные модели.
  text: {
    model: GEMINI_MODELS.pro,
    fallbackModel: "gpt-4o",
    temperature: 0.55,
    maxTokens: 2200,
    estimatedCost: 0.008,
  },
  image_prompt: {
    model: "gpt-4o",
    fallbackModel: GEMINI_MODELS.pro,
    temperature: 0.65,
    maxTokens: 1800,
    estimatedCost: 0.007,
  },
  moderation: {
    model: GEMINI_MODELS.flash,
    fallbackModel: GEMINI_MODELS.pro,
    temperature: 0.1,
    maxTokens: 500,
    estimatedCost: 0.001,
  },
};

const TEAM_CONFIG: TierConfig = {
  // Для TEAM приоритет на качество и запас контекста, с premium fallback.
  text: {
    model: "gpt-4o",
    fallbackModel: GEMINI_MODELS.pro,
    temperature: 0.5,
    maxTokens: 3200,
    estimatedCost: 0.015,
  },
  image_prompt: {
    model: GEMINI_MODELS.pro,
    fallbackModel: "gpt-4o",
    temperature: 0.6,
    maxTokens: 2400,
    estimatedCost: 0.012,
  },
  moderation: {
    model: GEMINI_MODELS.pro,
    fallbackModel: GEMINI_MODELS.flash,
    temperature: 0.05,
    maxTokens: 700,
    estimatedCost: 0.002,
  },
};

function normalizeTask(task: GenerationTask): BaseTask {
  if (task === "image_prompt" || task === "moderation" || task === "text") {
    return task;
  }
  return "text";
}

function normalizeTier(tier: SubscriptionTier): "FREE" | "PRO" | "TEAM" {
  if (tier === "ENTERPRISE") return "TEAM";
  return tier;
}

export function routeModel(task: GenerationTask, tier: SubscriptionTier): RouteDecision {
  const normalizedTask = normalizeTask(task);
  const normalizedTier = normalizeTier(tier);

  if (normalizedTier === "FREE") {
    return FREE_CONFIG[normalizedTask];
  }
  if (normalizedTier === "PRO") {
    return PRO_CONFIG[normalizedTask];
  }
  return TEAM_CONFIG[normalizedTask];
}
