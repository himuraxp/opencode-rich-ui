/**
 * Plugin contract tests — mirror the loader's module validation (`ePt`) and the
 * registerCodeBlockRenderer lifecycle against a faithful mock of the verified
 * OpenCode 2.0.30 runtime API. Widget construction uses the OFFICIAL headless
 * test renderer (@opentui/core/testing) as render context.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import plugin from "../src/index.ts";
import { PLUGIN_ID } from "../src/index.ts";
import { graphicsBackend } from "../src/adapter/graphics.ts";
import type {
  CodeBlockRenderer,
  CodeBlockToken,
  TuiPluginContext,
} from "../src/adapter/opencode-api.ts";
import { parseRichui } from "../src/core/parse.ts";

let harness: TestRendererSetup | undefined;

// Env hygiene (Tester finding F4): a user shell exporting RICHUI_GRAPHICS=1
// would make plugin.setup() preload the REAL resvg in this shared test
// process. Scrub before any setup() runs and reset the backend state.
beforeAll(() => {
  delete process.env.RICHUI_GRAPHICS;
  delete process.env.RICHUI_GRAPHICS_FORCE_PROTOCOL;
  delete process.env.RICHUI_GRAPHICS_DEBUG;
  delete process.env.RICHUI_SPIKE_IMAGE;
  const backend = graphicsBackend();
  backend.resvg = null;
  backend.loadError = null;
  backend.loadMs = null;
});

async function getHarness(): Promise<TestRendererSetup> {
  if (!harness) harness = await createTestRenderer({ width: 60, height: 20 });
  return harness;
}

afterAll(async () => {
  await harness?.dispose();
});

function token(text: string, lang = "richui"): CodeBlockToken {
  return { type: "code", raw: "```" + lang + "\n" + text + "\n```", text, lang };
}

type Register = TuiPluginContext["markdown"]["registerCodeBlockRenderer"];

interface MockRegistry {
  renderers: Map<string, CodeBlockRenderer>;
  context: TuiPluginContext;
}

async function mockContext(): Promise<MockRegistry> {
  const renderers = new Map<string, CodeBlockRenderer>();
  const h = await getHarness();
  const context: TuiPluginContext = {
    renderer: h.renderer,
    theme: {
      text: { base: "#ffffff", muted: "#888888" },
      background: { base: "#000000" },
      border: "#444444",
    },
    themeMode: "dark",
    markdown: {
      registerCodeBlockRenderer: ((language, renderer) => {
        if (!language) throw new Error("Markdown code-block language is required");
        if (renderers.has(language)) {
          throw new Error(`Markdown code-block renderer already registered: ${language}`);
        }
        renderers.set(language, renderer);
        return () => {
          renderers.delete(language);
        };
      }) as Register,
    },
    app: { version: "2.0.30-test" },
  };
  return { renderers, context };
}

describe("V2 module contract (loader ePt equivalence)", () => {
  test("default export is { id: non-empty string, setup: function }", () => {
    expect(typeof plugin).toBe("object");
    expect(plugin).not.toBeNull();
    expect(typeof plugin.id).toBe("string");
    expect(plugin.id.length).toBeGreaterThan(0);
    expect(typeof plugin.setup).toBe("function");
  });

  test("plugin id is the expected stable id", () => {
    expect(PLUGIN_ID).toBe("richui");
    expect(plugin.id).toBe("richui");
  });
});

describe("setup() lifecycle", () => {
  test("registers a renderer for 'richui' and returns a cleanup that unregisters", async () => {
    const { renderers, context } = await mockContext();
    const cleanup = await plugin.setup(context);

    expect(renderers.has("richui")).toBe(true);
    expect(typeof cleanup).toBe("function");

    (cleanup as () => void)();
    expect(renderers.has("richui")).toBe(false);
  });

  test("setup never throws when registration is refused (duplicate)", async () => {
    const { renderers, context } = await mockContext();
    // Pre-occupy the slot — host throws "already registered".
    renderers.set("richui", () => undefined);
    const cleanup = await plugin.setup(context);
    expect(cleanup).toBeUndefined(); // graceful degradation, no throw
  });
});

describe("registered renderer behavior (fallback contract)", () => {
  test("valid richui block → custom renderable (not the default)", async () => {
    const { renderers, context } = await mockContext();
    const cleanup = (await plugin.setup(context)) as () => void;
    const renderer = renderers.get("richui")!;

    const sentinel = { width: 1, height: 1, destroyRecursively() {} };
    const out = renderer(token(JSON.stringify({ component: "panel", body: "hi" })), {
      defaultRender: () => sentinel,
    });

    expect(out).toBeDefined();
    expect(out).not.toBe(sentinel);
    expect(out!.height).toBeGreaterThan(0);
    cleanup();
  });

  test("invalid richui block → returns ctx.defaultRender() (exact fallback)", async () => {
    const { renderers, context } = await mockContext();
    const cleanup = (await plugin.setup(context)) as () => void;
    const renderer = renderers.get("richui")!;

    const sentinel = { width: 1, height: 1, destroyRecursively() {} };
    const out = renderer(token("this is not json"), {
      defaultRender: () => sentinel,
    });

    expect(out).toBe(sentinel);
    cleanup();
  });

  test("renderer never throws even when defaultRender is unavailable", async () => {
    const { renderers, context } = await mockContext();
    const cleanup = (await plugin.setup(context)) as () => void;
    const renderer = renderers.get("richui")!;

    expect(() =>
      renderer(token("broken"), { defaultRender: () => undefined }),
    ).not.toThrow();
    expect(renderer(token("broken"), { defaultRender: () => undefined })).toBeUndefined();
    cleanup();
  });

  test("hostile defaultRender (throws) is contained — never propagates", async () => {
    const { renderers, context } = await mockContext();
    const cleanup = (await plugin.setup(context)) as () => void;
    const renderer = renderers.get("richui")!;

    const hostile: Parameters<NonNullable<typeof renderer>>[1] = {
      defaultRender: () => {
        throw new Error("hostile host context");
      },
    };
    expect(() => renderer(token("also broken"), hostile)).not.toThrow();
    expect(renderer(token("also broken"), hostile)).toBeUndefined();
    // A VALID block with a hostile defaultRender still renders the component.
    const out = renderer(token(JSON.stringify({ component: "panel", body: "ok" })), hostile);
    expect(out).toBeDefined();
    cleanup();
  });

  test("renderer never throws on malformed tokens", async () => {
    const { renderers, context } = await mockContext();
    const cleanup = (await plugin.setup(context)) as () => void;
    const renderer = renderers.get("richui")!;

    const sentinel = { width: 1, height: 1, destroyRecursively() {} };
    const adversarial = ["", "\u0000", JSON.stringify({ component: "panel", body: 1 })];
    for (const text of adversarial) {
      expect(() => renderer(token(text), { defaultRender: () => sentinel })).not.toThrow();
    }
    cleanup();
  });
});

describe("format guarantee: agents need no tooling", () => {
  test("the block is plain JSON — parseable without any OpenCode API", () => {
    const block = '{\n  "component": "panel",\n  "title": "T",\n  "body": "B"\n}';
    expect(parseRichui(block).ok).toBe(true);
  });
});
