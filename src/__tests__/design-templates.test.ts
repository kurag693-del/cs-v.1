import { describe, expect, it } from "vitest";

import { coverSourceRect, wrapTextLines } from "@/lib/design/canvas-layout";
import {
  DESIGN_PRESETS,
  MAX_EXPORT_SIDE,
  clampCanvasDimensions,
  getDesignPresetById,
} from "@/lib/design/templates";

describe("design/templates", () => {
  it("getDesignPresetById returns preset or null", () => {
    expect(getDesignPresetById("instagram_square")?.width).toBe(1080);
    expect(getDesignPresetById("unknown")).toBeNull();
  });

  it("clampCanvasDimensions caps max side", () => {
    const a = clampCanvasDimensions(3000, 2000);
    expect(Math.max(a.width, a.height)).toBeLessThanOrEqual(MAX_EXPORT_SIDE);
    expect(a.width).toBe(Math.round((3000 * MAX_EXPORT_SIDE) / 3000));
  });

  it("DESIGN_PRESETS are unique ids", () => {
    const ids = DESIGN_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("design/canvas-layout", () => {
  it("wrapTextLines respects max width", () => {
    const measure = (s: string) => s.length * 8;
    const maxWidth = 40;
    const lines = wrapTextLines(measure, "one two three four five six", maxWidth);
    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((ln) => expect(measure(ln)).toBeLessThanOrEqual(maxWidth));
  });

  it("wrapTextLines hard-breaks a single long token", () => {
    const measure = (s: string) => s.length;
    const lines = wrapTextLines(measure, "abcdefghij", 4);
    expect(lines.every((ln) => measure(ln) <= 4)).toBe(true);
    expect(lines.join("")).toBe("abcdefghij");
  });

  it("coverSourceRect centers crop", () => {
    const r = coverSourceRect(2000, 1000, 1080, 1080);
    expect(r.sw).toBeCloseTo(1080 / (1080 / 1000));
    expect(r.sx + r.sw).toBeLessThanOrEqual(2000 + 0.001);
  });
});
