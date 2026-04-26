import { describe, expect, it } from "vitest";

import { CreateBrandSchema } from "@/lib/validation/brand";

describe("CreateBrandSchema", () => {
  it("успешно валидирует корректные данные", () => {
    const result = CreateBrandSchema.safeParse({
      name: "Creative Studio",
      tone: "Дружелюбный и профессиональный",
      vocabularyRules: ["короткие предложения", "без канцелярита"],
      forbiddenWords: ["дешево"],
      structureTemplate: "Хук -> Польза -> CTA",
      examples: '["Пример поста"]',
    });

    expect(result.success).toBe(true);
  });

  it("возвращает ошибку для пустого name", () => {
    const result = CreateBrandSchema.safeParse({
      name: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Минимум 2 символа");
    }
  });

  it("возвращает ошибку для слишком длинного tone", () => {
    const result = CreateBrandSchema.safeParse({
      name: "Creative Studio",
      tone: "a".repeat(51),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Тон не должен превышать");
    }
  });
});
