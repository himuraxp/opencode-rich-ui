import { describe, expect, test } from "bun:test";
import { paletteFor } from "../src/adapter/theme.ts";
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
