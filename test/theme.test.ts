import { describe, expect, test } from "bun:test";
import { cssColor, paletteFor } from "../src/adapter/theme.ts";
import type { ColorValue, ThemeTokens } from "../src/adapter/opencode-api.ts";

/**
 * Host-shaped RGBA (structural — matches the runtime's token instances).
 * Cast to ColorValue: bun:test types `expected` strictly and a plain literal
 * is not assignable to the host's full RGBA interface (buffer, toInts, …).
 */
const HOST_RGBA = { r: 255, g: 128, b: 0, a: 255 } as ColorValue;

describe("paletteFor", () => {
  test("maps tone feedback to title only; border uses the neutral theme token", () => {
    const theme = {
      text: {
        base: "#ffffff",
        muted: "#888888",
        feedback: { success: { base: HOST_RGBA }, error: { base: "#ff0000" } },
      },
      background: { base: "#000000" },
    } as unknown as ThemeTokens;

    const success = paletteFor(theme, "success");
    expect(success.title).toBe(HOST_RGBA);
    expect(success.border).toBeUndefined(); // no border token in this theme
    expect(success.text).toBe("#ffffff");
    expect(success.muted).toBe("#888888");

    const error = paletteFor(theme, "error");
    expect(error.title).toBe("#ff0000");
  });

  test("border token from the theme is used when present (neutral, not tone)", () => {
    const theme = {
      text: { base: "#fff", muted: "#888", feedback: { success: { base: HOST_RGBA } } },
      background: { base: "#000" },
      border: "#444444",
    } as unknown as ThemeTokens;
    const palette = paletteFor(theme, "success");
    expect(palette.title).toBe(HOST_RGBA);
    expect(palette.border).toBe("#444444");
  });

  test("missing feedback branch → no title/border (inherits defaults)", () => {
    const theme = {
      text: { base: "#fff", muted: "#888" },
      background: { base: "#000" },
    } as ThemeTokens;
    const palette = paletteFor(theme, "warning");
    expect(palette.title).toBeUndefined();
    expect(palette.border).toBeUndefined();
    expect(palette.text).toBe("#fff");
  });

  test("no text node at all → empty palette, never throws", () => {
    expect(paletteFor({} as ThemeTokens, "info")).toEqual({});
    expect(paletteFor(undefined as unknown as ThemeTokens, "info")).toEqual({});
  });

  test("numeric token is rejected (unsound guard removed) → inherits instead of crashing", () => {
    const theme = {
      text: { base: 16711680, muted: null, feedback: { error: { base: 42 } } },
    } as unknown as ThemeTokens;
    const palette = paletteFor(theme, "error");
    expect(palette.text).toBeUndefined();
    expect(palette.muted).toBeUndefined();
    expect(palette.title).toBeUndefined();
    expect(palette.border).toBeUndefined();
  });

  test("malformed RGBA objects (missing channels) are rejected", () => {
    const theme = {
      text: { base: { r: 1 }, muted: { r: 1, g: 2 }, feedback: { info: { base: { r: 1, g: 2, b: 3 } } } },
    } as unknown as ThemeTokens;
    const palette = paletteFor(theme, "info");
    expect(palette.text).toBeUndefined();
    expect(palette.muted).toBeUndefined();
    expect(palette.title).toEqual({ r: 1, g: 2, b: 3 } as ColorValue); // structurally valid → accepted
  });
});

describe("cssColor (SVG/CSS consumers — graphics backend)", () => {
  test("hex strings pass through untouched", () => {
    expect(cssColor("#00ff88")).toBe("#00ff88");
    expect(cssColor("rgb(1,2,3)")).toBe("rgb(1,2,3)");
    expect(cssColor("")).toBeUndefined();
  });

  test("host RGBA shape {r,g,b} → valid CSS rgb()", () => {
    // This is the contrast bug caught in Étape 2: the host RGBA class exposes
    // NORMALIZED floats (r getter: 127 → 0.498) — reading them verbatim
    // rendered black. toInts() is the trusted path; plain numeric shapes are
    // rescaled when their range proves normalized.
    const shape = (o: object): ColorValue => o as unknown as ColorValue;
    expect(cssColor(shape({ r: 80, g: 200, b: 120 }))).toBe("rgb(80,200,120)");
    expect(cssColor(shape({ r: 300, g: -5, b: 12.4 }))).toBe("rgb(255,0,12)"); // clamped
    expect(cssColor(shape({ r: 0.498, g: 0.847, b: 0.56 }))).toBe("rgb(127,216,143)"); // normalized
  });

  test("host RGBA with alpha → rgba()", () => {
    const shape = (o: object): ColorValue => o as unknown as ColorValue;
    expect(cssColor(shape({ r: 10, g: 20, b: 30, a: 0.5 }))).toBe("rgba(10,20,30,0.5)");
    expect(cssColor(shape({ r: 10, g: 20, b: 30, a: 1 }))).toBe("rgb(10,20,30)");
    expect(cssColor(shape({ r: 0.04, g: 0.08, b: 0.12, a: 0.5 }))).toBe("rgba(10,20,31,0.5)");
  });

  test("malformed shapes → undefined (caller degrades to native)", () => {
    expect(cssColor({ r: 1, g: 2 } as unknown as ColorValue)).toBeUndefined();
    expect(cssColor(null as unknown as ColorValue)).toBeUndefined();
    expect(cssColor(42 as unknown as ColorValue)).toBeUndefined();
  });
});
