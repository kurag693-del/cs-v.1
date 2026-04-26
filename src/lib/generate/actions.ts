"use server";

import { readFileSync } from "node:fs";
import path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
  hook: z.string(),
  body: z.string(),
  hashtags: z.array(z.string()),
  cta: z.string(),
  platform_specific_notes: z.string(),
  word_count: z.number(),
  matches_brand_tone: z.boolean(),
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

async function generateWithModel(
  modelName: string,
  prompt: string,
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
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json",
    },
  });

  return response.response.text();
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
    let rawResponse = "";
    let modelUsed = route.model;
    try {
      rawResponse = await generateWithModel(
        route.model,
        prompt,
        route.temperature,
        route.maxTokens
      );
    } catch (primaryError) {
      if (!route.fallbackModel) throw primaryError;
      rawResponse = await generateWithModel(
        route.fallbackModel,
        prompt,
        route.temperature,
        route.maxTokens
      );
      modelUsed = route.fallbackModel;
    }
    const latencyMs = Date.now() - startedAt;

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
