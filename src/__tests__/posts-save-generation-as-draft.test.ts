import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, revalidatePathMock } = vi.hoisted(() => ({
  prismaMock: {
    generation: {
      findFirst: vi.fn(),
    },
    post: {
      create: vi.fn(),
    },
  },
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { saveGenerationAsDraft } from "@/lib/posts/actions";

describe("saveGenerationAsDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("сохраняет пост в статусе DRAFT", async () => {
    prismaMock.generation.findFirst.mockResolvedValue({
      id: "gen-1",
      userId: "user-1",
      brandId: "brand-1",
      output: JSON.stringify({
        hook: "Заголовок поста",
        body: "Основной текст",
        hashtags: ["#креатив", "#маркетинг"],
        cta: "Подпишитесь",
      }),
    });
    prismaMock.post.create.mockResolvedValue({ id: "post-1" });

    const mediaUrls = ["https://cdn.example.com/image-1.jpg"];
    const result = await saveGenerationAsDraft("gen-1", "user-1", "Instagram", undefined, mediaUrls);

    expect(result).toEqual({
      success: true,
      postId: "post-1",
    });
    expect(prismaMock.post.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          generationId: "gen-1",
          userId: "user-1",
          status: "DRAFT",
          scheduledAt: null,
          platform: "INSTAGRAM",
          mediaUrls,
        }),
      })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/calendar");
  });

  it("возвращает ошибку, если генерация не найдена или не COMPLETED", async () => {
    prismaMock.generation.findFirst.mockResolvedValue(null);

    const result = await saveGenerationAsDraft("gen-missing", "user-1", "Instagram");

    expect(result).toEqual({
      success: false,
      error: "Генерация не найдена или недоступна",
    });
    expect(prismaMock.post.create).not.toHaveBeenCalled();
  });

  it("возвращает ошибку для невалидных параметров", async () => {
    const result = await saveGenerationAsDraft("", "user-1", "Instagram");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("generationId");
    }
    expect(prismaMock.generation.findFirst).not.toHaveBeenCalled();
  });

  it("возвращает ошибку если mediaUrls превышает лимит", async () => {
    const mediaUrls = Array.from({ length: 11 }, (_, index) => `https://cdn.example.com/${index}.jpg`);
    const result = await saveGenerationAsDraft("gen-1", "user-1", "Instagram", undefined, mediaUrls);

    expect(result).toEqual({
      success: false,
      error: "Максимум 10 изображений",
    });
    expect(prismaMock.generation.findFirst).not.toHaveBeenCalled();
  });
});
