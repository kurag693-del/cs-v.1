import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
    },
    brand: {
      findFirst: vi.fn(),
    },
    generation: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn(),
}));

vi.mock("@/lib/ai/moderation", () => ({
  moderator: {
    moderateContent: vi.fn(),
  },
}));

vi.mock("@/lib/ai/router", () => ({
  routeModel: vi.fn(() => ({
    model: "gemini-1.5-flash",
    fallbackModel: null,
    temperature: 0.7,
    maxTokens: 512,
    estimatedCost: 0.01,
  })),
}));

import { generateText } from "@/lib/generate/actions";

describe("generateText", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      subscriptions: [{ id: "sub-1", tier: "PRO", generationLimit: 10 }],
    });
    prismaMock.brand.findFirst.mockResolvedValue({
      id: "brand-1",
      name: "Brand",
      voice: "calm",
      tone: "expert",
      description: "desc",
    });
    prismaMock.generation.create.mockResolvedValue({ id: "gen-1" });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        generation: { create: vi.fn().mockResolvedValue({ id: "gen-2" }) },
        subscription: { update: vi.fn().mockResolvedValue({}) },
      })
    );
  });

  it("возвращает ошибку валидации для невалидного topic", async () => {
    const result = await generateText(
      {
        topic: "ab",
        platform: "Instagram",
        maxLength: 200,
      },
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Тема");
    }
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('возвращает "Пользователь не определен" если userId не передан', async () => {
    const result = await generateText(
      {
        topic: "Корректная тема для генерации",
        platform: "Instagram",
        maxLength: 200,
      },
      ""
    );

    expect(result).toEqual({
      success: false,
      error: "Пользователь не определен",
    });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("корректно обрабатывает отсутствие бренда без падения", async () => {
    prismaMock.brand.findFirst.mockResolvedValueOnce(null);

    const result = await generateText(
      {
        topic: "Полноценная тема для генерации поста",
        platform: "Instagram",
        brandId: "missing-brand",
        maxLength: 300,
      },
      "user-1"
    );

    expect(result).toEqual({
      success: false,
      error: "Бренд не найден или недоступен",
    });
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.brand.findFirst).toHaveBeenCalledTimes(1);
  });
});
