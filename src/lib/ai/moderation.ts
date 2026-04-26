import { readFileSync } from "node:fs";
import path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

import { routeModel, type SubscriptionTier } from "@/lib/ai/router";

const MODERATION_PROMPT = readFileSync(
  path.join(process.cwd(), "prompts", "v1_content_moderation.md"),
  "utf-8"
);

const ModerationFlagSchema = z.object({
  category: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  quote: z.string().min(1),
});

const ModerationResponseSchema = z.object({
  is_approved: z.boolean(),
  risk_level: z.number().min(0).max(5),
  flags: z.array(ModerationFlagSchema),
  auto_fix_suggestion: z.string().nullable(),
  brand_alignment_score: z.number().min(0).max(1),
  requires_human_review: z.boolean(),
});

export type ModerationFlag = z.infer<typeof ModerationFlagSchema>;

export type ModerationResult = {
  isApproved: boolean;
  flags: ModerationFlag[];
  suggestion?: string;
  // Оставляем поле reason для совместимости с существующим кодом генерации.
  reason: string;
};

function buildPromptInput(text: string, brandRules?: unknown): string {
  return [
    MODERATION_PROMPT,
    "",
    `{{content_text}}: ${text}`,
    "{{content_type}}: post",
    `{{brand_rules_json}}: ${JSON.stringify(brandRules ?? {})}`,
    "{{platform_policy}}: Instagram",
  ].join("\n");
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return null;
  return raw.slice(start, end + 1);
}

function fallbackRejected(reason: string): ModerationResult {
  return {
    isApproved: false,
    flags: [
      {
        category: "moderation_error",
        severity: "high",
        quote: reason,
      },
    ],
    suggestion: "Проверьте текст вручную и повторите запрос.",
    reason,
  };
}

function fallbackApproved(reason: string): ModerationResult {
  return {
    isApproved: true,
    flags: [],
    suggestion: "Автоматическая модерация пропущена. При необходимости проверьте текст вручную.",
    reason,
  };
}

async function runGeminiModeration(
  modelName: string,
  promptInput: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY (или GEMINI_API_KEY) не задан");
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: modelName });
  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: promptInput }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json",
    },
  });

  return response.response.text();
}

async function moderateContent(
  text: string,
  brandRules?: any
): Promise<ModerationResult> {
  try {
    const tier: SubscriptionTier =
      brandRules && typeof brandRules === "object" && "tier" in brandRules
        ? (brandRules.tier as SubscriptionTier)
        : "FREE";

    const route = routeModel("moderation", tier);
    const promptInput = buildPromptInput(text, brandRules);

    let raw = "";
    try {
      raw = await runGeminiModeration(
        route.model,
        promptInput,
        route.temperature,
        route.maxTokens
      );
    } catch (primaryError) {
      if (!route.fallbackModel) {
        throw primaryError;
      }
      raw = await runGeminiModeration(
        route.fallbackModel,
        promptInput,
        route.temperature,
        route.maxTokens
      );
    }

    const jsonPayload = extractJsonObject(raw);
    if (!jsonPayload) {
      return fallbackRejected("Не удалось извлечь JSON из ответа модерации");
    }

    const parsedJson = JSON.parse(jsonPayload) as unknown;
    const validated = ModerationResponseSchema.safeParse(parsedJson);
    if (!validated.success) {
      return fallbackRejected("Ответ модерации не прошел валидацию Zod");
    }

    const normalized = validated.data;
    const hasHighFlags = normalized.flags.some((flag) => flag.severity === "high");
    const approved = normalized.is_approved && normalized.risk_level < 4 && !hasHighFlags;

    console.log(`moderation cost: $${route.estimatedCost.toFixed(6)}`);

    return {
      isApproved: approved,
      flags: normalized.flags,
      suggestion: normalized.auto_fix_suggestion ?? undefined,
      reason: approved
        ? "Content approved"
        : `Content rejected (risk_level=${normalized.risk_level})`,
    };
  } catch (error: unknown) {
    console.error("moderateContent error:", error);
    const message = error instanceof Error ? error.message : "Неизвестная ошибка модерации";

    // Для локальной разработки не блокируем генерацию, если ключ модерации не настроен.
    if (
      process.env.NODE_ENV !== "production" &&
      message.includes("GOOGLE_API_KEY (или GEMINI_API_KEY) не задан")
    ) {
      return fallbackApproved("Moderation skipped: GOOGLE_API_KEY/GEMINI_API_KEY не задан");
    }

    return fallbackRejected(
      message
    );
  }
}

export { moderateContent };

export const moderator = {
  moderateContent,
};
