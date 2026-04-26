"use server";

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { moderator } from "@/lib/ai/moderation";
import { routeModel } from "@/lib/ai/router";
import { prisma } from "@/lib/db/prisma";

const TEXT_PROMPT_TEMPLATE = readFileSync(
  path.join(process.cwd(), "prompts", "v1_text_generator.md"),
  "utf-8"
);

const GenerateTextInputSchema = z.object({
  topic: z.string().min(3, "Тема должна содержать минимум 3 символа").max(500, "Тема слишком длинная"),
  platform: z.enum(["Instagram", "Telegram", "VK", "TikTok"]),
  brandId: z.string().min(1).optional(),
  maxLength: z.number().int().min(80).max(5000),
});

const GeneratedJsonSchema = z.object({
  hook: z.string().optional().default(""),
  body: z.string().optional().default(""),
  hashtags: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((value) => {
      if (Array.isArray(value)) {
        return value
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => (item.startsWith("#") ? item : `#${item}`));
      }
      if (typeof value === "string" && value.trim().length > 0) {
        return value
          .split(/\s+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => (item.startsWith("#") ? item : `#${item}`));
      }
      return [];
    }),
  cta: z.string().optional().default(""),
  platform_specific_notes: z.string().optional().default(""),
  word_count: z.number().optional().default(0),
  matches_brand_tone: z.boolean().optional().default(true),
});

type GenerateTextInput = z.infer<typeof GenerateTextInputSchema>;

type GenerateTextSuccess = {
  success: true;
  data: {
    generationId: string;
    text: string;
    modelUsed: string;
    tokenCost: number;
    latencyMs: number;
  };
};

type GenerateTextFailure = {
  success: false;
  error: string;
};

type GenerateTextResult = GenerateTextSuccess | GenerateTextFailure;

function buildPrompt(input: GenerateTextInput, brandVoice: Record<string, unknown> | null): string {
  const variables: Record<string, string> = {
    topic: input.topic,
    platform: input.platform,
    brand_voice_json: JSON.stringify(brandVoice ?? {}),
    max_length_chars: String(input.maxLength),
    include_hashtags: "true",
    cta_type: "оставь комментарий",
  };

  let prompt = TEXT_PROMPT_TEMPLATE;
  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replaceAll(`{{${key}}}`, value);
  }

  return prompt;
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return null;
  return raw.slice(start, end + 1);
}

function estimateTokens(prompt: string, completion: string): number {
  return Math.ceil((prompt.length + completion.length) / 4);
}

const GIGACHAT_BASE_URL = process.env.GIGACHAT_BASE_URL ?? "https://gigachat.devices.sberbank.ru";
const GIGACHAT_AUTH_URL = process.env.GIGACHAT_AUTH_URL ?? "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const GIGACHAT_SCOPE = process.env.GIGACHAT_SCOPE ?? "GIGACHAT_API_PERS";
const GIGACHAT_MODEL = process.env.GIGACHAT_MODEL ?? "GigaChat";
const GIGACHAT_ALLOW_SELF_SIGNED = process.env.GIGACHAT_ALLOW_SELF_SIGNED === "true";

async function withOptionalSelfSignedTls<T>(callback: () => Promise<T>): Promise<T> {
  if (!GIGACHAT_ALLOW_SELF_SIGNED) {
    return callback();
  }

  const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  try {
    return await callback();
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous;
    }
  }
}

type GigaChatTokenResponse = {
  access_token: string;
};

type GigaChatCompletionResponse = {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type GigaChatCompletionResult = {
  content: string;
  modelUsed: string;
};

async function getGigaChatAccessToken(): Promise<string> {
  const clientId = process.env.GIGACHAT_CLIENT_ID ?? process.env.CLIENT_ID;
  const clientSecret = process.env.GIGACHAT_CLIENT_SECRET ?? process.env.CLIENT_SECRET ?? process.env.Client_Secret;
  const explicitAuthKey = process.env.GIGACHAT_AUTH_KEY;
  const authKey =
    explicitAuthKey ??
    (clientId && clientSecret ? Buffer.from(`${clientId}:${clientSecret}`).toString("base64") : undefined);

  if (!authKey) {
    throw new Error(
      "Не задана авторизация GigaChat. Укажите GIGACHAT_AUTH_KEY или пару GIGACHAT_CLIENT_ID + GIGACHAT_CLIENT_SECRET"
    );
  }

  const response = await withOptionalSelfSignedTls(() =>
    fetch(GIGACHAT_AUTH_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "CreativeStudio/1.0",
        RqUID: randomUUID(),
      },
      body: new URLSearchParams({
        scope: GIGACHAT_SCOPE,
      }),
    })
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка авторизации GigaChat: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as GigaChatTokenResponse;
  if (!data.access_token) {
    throw new Error("GigaChat не вернул access_token");
  }

  return data.access_token;
}

async function generateWithModel(
  modelName: string,
  prompt: string,
  temperature: number,
  maxTokens: number
): Promise<GigaChatCompletionResult> {
  const accessToken = await getGigaChatAccessToken();
  const response = await withOptionalSelfSignedTls(() =>
    fetch(`${GIGACHAT_BASE_URL}/api/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "CreativeStudio/1.0",
      },
      body: JSON.stringify({
        model: modelName || GIGACHAT_MODEL,
        stream: false,
        temperature,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    })
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка запроса к GigaChat: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as GigaChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("GigaChat вернул пустой ответ");
  }

  const modelUsed = data.model ?? modelName ?? GIGACHAT_MODEL;

  return { content, modelUsed };
}

export async function generateText(
  input: { topic: string; platform: string; brandId?: string; maxLength: number },
  userId: string
): Promise<GenerateTextResult> {
  try {
    const parsedInput = GenerateTextInputSchema.safeParse(input);
    if (!parsedInput.success) {
      return {
        success: false,
        error: parsedInput.error.issues[0]?.message ?? "Некорректные входные данные",
      };
    }

    if (!userId) {
      return { success: false, error: "Пользователь не определен" };
    }

    const safeInput = parsedInput.data;
    const userWithSubscription = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: {
        subscriptions: true,
      },
    });

    if (!userWithSubscription) {
      return { success: false, error: "Пользователь не найден" };
    }

    let subscription = userWithSubscription.subscriptions[0] ?? null;
    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          userId,
          tier: "FREE",
          status: "ACTIVE",
          generationLimit: 100,
          postLimit: 50,
        },
      });
    }

    const tier = subscription?.tier ?? "FREE";
    const creditsLeft = subscription?.generationLimit ?? 0;
    if (creditsLeft <= 0) {
      return { success: false, error: "Недостаточно кредитов для генерации" };
    }

    let brandVoice: Record<string, unknown> | null = null;
    if (safeInput.brandId) {
      const brand = await prisma.brand.findFirst({
        where: {
          id: safeInput.brandId,
          userId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          voice: true,
          tone: true,
          description: true,
        },
      });

      if (!brand) {
        return { success: false, error: "Бренд не найден или недоступен" };
      }

      brandVoice = {
        id: brand.id,
        name: brand.name,
        voice: brand.voice,
        tone: brand.tone,
        description: brand.description,
      };
    }

    const prompt = buildPrompt(safeInput, brandVoice);
    const route = routeModel("text", tier);

    const startedAt = Date.now();
    const gigachatResponse = await generateWithModel(
      GIGACHAT_MODEL,
      prompt,
      route.temperature,
      route.maxTokens
    );
    const rawResponse = gigachatResponse.content;
    const modelUsed = gigachatResponse.modelUsed;
    const latencyMs = Date.now() - startedAt;

    if (/gemini|google/i.test(modelUsed)) {
      return {
        success: false,
        error: "Ответ получен не от GigaChat. Проверьте конфигурацию провайдера.",
      };
    }

    const jsonPayload = extractJsonObject(rawResponse);
    if (!jsonPayload) {
      return { success: false, error: "Модель вернула невалидный JSON" };
    }

    const parsedGeneration = GeneratedJsonSchema.safeParse(
      JSON.parse(jsonPayload) as unknown
    );
    if (!parsedGeneration.success) {
      return {
        success: false,
        error: parsedGeneration.error.issues[0]?.message ?? "Ответ модели не прошел валидацию",
      };
    }

    const generated = parsedGeneration.data;
    const text = `${generated.hook}\n\n${generated.body}\n\n${generated.hashtags.join(" ")}\n\n${generated.cta}`;

    const moderation = await moderator.moderateContent(text, { tier, brandRules: brandVoice });
    if (!moderation.isApproved) {
      await prisma.generation.create({
        data: {
          userId,
          brandId: safeInput.brandId ?? null,
          type: "text_generation",
          prompt,
          output: text,
          status: "FAILED",
          error: moderation.reason,
          model: modelUsed,
          tokens: 0,
          metadata: {
            moderation,
          } as Prisma.InputJsonValue,
        },
      });

      return { success: false, error: "Контент не прошел модерацию" };
    }

    const estimatedTokens = estimateTokens(prompt, text);
    const tokenCost = route.estimatedCost;

    const generation = await prisma.$transaction(async (tx) => {
      if (!subscription) {
        throw new Error("Подписка пользователя не найдена");
      }

      const created = await tx.generation.create({
        data: {
          userId,
          brandId: safeInput.brandId ?? null,
          type: "text_generation",
          prompt,
          output: text,
          status: "COMPLETED",
          model: modelUsed,
          tokens: estimatedTokens,
          metadata: {
            tokenCost,
            latencyMs,
            modelUsed,
            moderation,
            platform: safeInput.platform,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.subscription.update({
        where: { id: subscription.id },
        data: { generationLimit: { decrement: 1 } },
      });

      return created;
    });

    return {
      success: true,
      data: {
        generationId: generation.id,
        text,
        modelUsed,
        tokenCost,
        latencyMs,
      },
    };
  } catch (error: unknown) {
    console.error("generateText error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Ошибка генерации текста",
    };
  }
}
