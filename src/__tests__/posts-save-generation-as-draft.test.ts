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
      output: "Заголовок поста\n\nОсновной текст",
    });
    prismaMock.post.create.mockResolvedValue({ id: "post-1" });

    const result = await saveGenerationAsDraft("gen-1", "user-1", "Instagram");

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
});
