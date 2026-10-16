/**
 * Unit tests — graphics backend: opt-in policy, error paths, SVG construction.
 *
 * Covers:
 * - adapter/graphics.ts: protocolAllowsGraphics (ratified policy), graphicsOptIn,
 *   graphicsForcedProtocol, the graphicsBackend() default state, the
 *   preloadGraphics opt-in guard and GraphicsProtocolUnsupportedError.
 * - components/metric-graphic.ts: buildMetricGraphicPng error paths (no
 *   preloaded resvg, incomplete theme tokens) and, through a minimal FAKE
 *   rasterizer, the SVG construction contract (XML escaping, delta arrows).
 * - adapter/opentui.ts: the graphic METRIC path (buildMetricWithOptionalGraphics)
 *   observed through the PUBLIC createRichuiRenderer factory — the ratified
 *   double fallback: any graphic failure degrades to the native renderer and
 *   a block is never lost.
 *
 * The REAL native resvg dependency is NEVER loaded in this file (E2E/PTY
 * harness territory):
 * - every no-resvg test relies on the documented default unit state
 *   (graphicsBackend().resvg === null), re-forced in beforeAll so the file
 *   stays order-independent even if another test file preloaded real resvg
 *   under a user-exported RICHUI_GRAPHICS=1 (plugin.setup() does call
 *   preloadGraphics); the snapshot is restored in afterAll.
 * - where the SVG string must be OBSERVED (escaping, delta arrows), a fake
 *   resvg namespace is injected through the PUBLIC graphicsBackend() seam:
 *   the returned object IS the module-private state (same reference the
 *   production code reads), so assignment is the only sanctioned injection
 *   mechanism. It is always restored in a finally block, and the fake emits
 *   a 4-byte sentinel PNG so an accidental real-resvg load fails loudly.
 * - `esc` and `deltaWithArrow` are private by design: they are covered
 *   INDIRECTLY through that seam (no new export was added to src/).
 *
 * Env hygiene: every RICHUI_GRAPHICS_* / RICHUI_SPIKE_* variable is saved,
 * scrubbed, overridden and restored (withGraphicsEnv). No timing assertions
 * anywhere — only deterministic, behavioral checks.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ImageRenderable } from "@opentui/core";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import {
  GraphicsProtocolUnsupportedError,
  GraphicsUnavailableError,
  graphicsBackend,
  graphicsForcedProtocol,
  graphicsOptIn,
  preloadGraphics,
  protocolAllowsGraphics,
} from "../src/adapter/graphics.ts";
import { buildMetricGraphicPng } from "../src/components/metric-graphic.ts";
import type { MetricGraphicResult } from "../src/components/metric-graphic.ts";
import { createRichuiRenderer } from "../src/adapter/opentui.ts";
import type {
  CodeBlockToken,
  RenderableLike,
  TuiPluginContext,
} from "../src/adapter/opencode-api.ts";
import type { ComponentPalette } from "../src/adapter/theme.ts";
import type { MetricSpec } from "../src/core/schema.ts";

// ---------------------------------------------------------------------------
// Environment hygiene (save / scrub / override / restore)
// ---------------------------------------------------------------------------

const GRAPHICS_ENV_KEYS = [
  "RICHUI_GRAPHICS",
  "RICHUI_GRAPHICS_FORCE_PROTOCOL",
  "RICHUI_GRAPHICS_DEBUG",
  "RICHUI_SPIKE_IMAGE",
  "RICHUI_SPIKE_PROTOCOL",
  "RICHUI_SPIKE_DEBUG",
  "RICHUI_SPIKE_IMAGE_PATH",
] as const;

type GraphicsEnvKey = (typeof GRAPHICS_ENV_KEYS)[number];

/**
 * Run `run` with a deterministically scrubbed graphics/spike environment:
 * every managed key is saved then deleted, `overrides` are applied, and the
 * saved values are restored in a finally block (even on failure). The spike
 * keys are always scrubbed so the Étape-1 spike path can never hijack the
 * renderer-path tests.
 */
async function withGraphicsEnv(
  overrides: Partial<Record<GraphicsEnvKey, string>>,
  run: () => void | Promise<void>,
): Promise<void> {
  const saved = new Map<string, string | undefined>();
  for (const key of GRAPHICS_ENV_KEYS) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
  for (const key of Object.keys(overrides) as GraphicsEnvKey[]) {
    const value = overrides[key];
    if (value !== undefined) process.env[key] = value;
  }
  try {
    await run();
  } finally {
    for (const [key, previous] of saved) {
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Fake rasterizer injection through the public graphicsBackend() seam
// ---------------------------------------------------------------------------

type ResvgNamespace = typeof import("@resvg/resvg-js");

/** 4-byte PNG magic — sentinel proving the FAKE (never real resvg) served. */
const FAKE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

interface InjectedRasterizer {
  readonly svgs: readonly string[];
  restore(): void;
}

function injectFakeResvg(): InjectedRasterizer {
  const svgs: string[] = [];
  const fake = {
    Resvg: class {
      constructor(svg: string) {
        svgs.push(svg);
      }
      render(): { asPng(): Uint8Array } {
        return { asPng: () => FAKE_PNG };
      }
    },
  };
  const backend = graphicsBackend();
  const savedResvg = backend.resvg;
  const savedLoadError = backend.loadError;
  const savedLoadMs = backend.loadMs;
  // The object returned by graphicsBackend() IS the module-private state —
  // assigning through it is the sanctioned injection seam. Always paired
  // with restore() in the same test.
  backend.resvg = fake as unknown as ResvgNamespace;
  return {
    svgs,
    restore(): void {
      backend.resvg = savedResvg;
      backend.loadError = savedLoadError;
      backend.loadMs = savedLoadMs;
    },
  };
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const FULL_PALETTE: ComponentPalette = {
  title: "#00ff88",
  text: "#e0e0e0",
  muted: "#888888",
  border: "#00ff88",
};

// ---------------------------------------------------------------------------
// Headless harness (OFFICIAL OpenTUI test renderer — native widget construction)
// ---------------------------------------------------------------------------

let setup: TestRendererSetup | undefined;

async function getSetup(): Promise<TestRendererSetup> {
  if (!setup) {
    setup = await createTestRenderer({ width: 60, height: 30 });
  }
  return setup;
}

/** Snapshot of the module-private graphics state, restored in afterAll. */
const ORIGINAL_BACKEND = { ...graphicsBackend() };

beforeAll(() => {
  // Re-force the documented default unit state: NO preloaded resvg. Protects
  // against file-order effects (e.g. plugin.test.ts's setup() preloading the
  // real resvg when the user shell exports RICHUI_GRAPHICS=1).
  const backend = graphicsBackend();
  backend.resvg = null;
  backend.loadError = null;
  backend.loadMs = null;
});

afterAll(async () => {
  const backend = graphicsBackend();
  backend.resvg = ORIGINAL_BACKEND.resvg;
  backend.loadError = ORIGINAL_BACKEND.loadError;
  backend.loadMs = ORIGINAL_BACKEND.loadMs;
  await setup?.dispose();
});

// ---------------------------------------------------------------------------
// 1. protocolAllowsGraphics — ratified protocol policy
// ---------------------------------------------------------------------------

describe("protocolAllowsGraphics (ratified protocol policy)", () => {
  test("kitty → allowed", () => {
    expect(protocolAllowsGraphics("kitty")).toBe(true);
  });

  test("sixel → allowed", () => {
    expect(protocolAllowsGraphics("sixel")).toBe(true);
  });

  test("auto → refused (a runtime-resolved 'auto' is not a graphics guarantee)", () => {
    expect(protocolAllowsGraphics("auto")).toBe(false);
  });

  test("blocks → refused (blocks never triggers the graphic mode)", () => {
    expect(protocolAllowsGraphics("blocks")).toBe(false);
  });

  test("unknown protocol → refused", () => {
    expect(protocolAllowsGraphics("webgpu")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. graphicsOptIn — RICHUI_GRAPHICS opt-in gate (native by default)
// ---------------------------------------------------------------------------

describe("graphicsOptIn (RICHUI_GRAPHICS opt-in gate)", () => {
  test("RICHUI_GRAPHICS=1 → true", async () => {
    await withGraphicsEnv({ RICHUI_GRAPHICS: "1" }, () => {
      expect(graphicsOptIn()).toBe(true);
    });
  });

  test("unset → false (native by default)", async () => {
    await withGraphicsEnv({}, () => {
      expect(graphicsOptIn()).toBe(false);
    });
  });

  test("RICHUI_GRAPHICS=0 → false (exact string match, not truthiness)", async () => {
    await withGraphicsEnv({ RICHUI_GRAPHICS: "0" }, () => {
      expect(graphicsOptIn()).toBe(false);
    });
  });

  test("process.env is restored after the run (save/restore discipline)", async () => {
    const previous = process.env["RICHUI_GRAPHICS"];
    await withGraphicsEnv({ RICHUI_GRAPHICS: "1" }, () => {
      expect(graphicsOptIn()).toBe(true);
    });
    expect(process.env["RICHUI_GRAPHICS"]).toBe(previous);
  });
});

// ---------------------------------------------------------------------------
// 3. graphicsForcedProtocol — test-only protocol override
// ---------------------------------------------------------------------------

describe("graphicsForcedProtocol (test-only RICHUI_GRAPHICS_FORCE_PROTOCOL)", () => {
  test("kitty → 'kitty'", async () => {
    await withGraphicsEnv({ RICHUI_GRAPHICS_FORCE_PROTOCOL: "kitty" }, () => {
      expect(graphicsForcedProtocol()).toBe("kitty");
    });
  });

  test("sixel → 'sixel'", async () => {
    await withGraphicsEnv({ RICHUI_GRAPHICS_FORCE_PROTOCOL: "sixel" }, () => {
      expect(graphicsForcedProtocol()).toBe("sixel");
    });
  });

  test("blocks → 'blocks' (headless emission-audit path)", async () => {
    await withGraphicsEnv({ RICHUI_GRAPHICS_FORCE_PROTOCOL: "blocks" }, () => {
      expect(graphicsForcedProtocol()).toBe("blocks");
    });
  });

  test("unset → null", async () => {
    await withGraphicsEnv({}, () => {
      expect(graphicsForcedProtocol()).toBeNull();
    });
  });

  test("invalid value 'webgpu' → null (never anything else)", async () => {
    await withGraphicsEnv({ RICHUI_GRAPHICS_FORCE_PROTOCOL: "webgpu" }, () => {
      expect(graphicsForcedProtocol()).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// 4. graphicsBackend default state + preloadGraphics guard (no real resvg)
// ---------------------------------------------------------------------------

describe("graphicsBackend default state (unit-test invariant)", () => {
  test("no resvg is preloaded in the unit-test run (load state clean)", () => {
    const backend = graphicsBackend();
    expect(backend.resvg).toBeNull();
    expect(backend.loadError).toBeNull();
    expect(backend.loadMs).toBeNull();
  });
});

describe("preloadGraphics (setup-time opt-in guard)", () => {
  test("without the opt-in it is a strict no-op: nothing loads, nothing fails", async () => {
    await withGraphicsEnv({}, async () => {
      expect(graphicsBackend().resvg).toBeNull();
      await preloadGraphics();
      expect(graphicsBackend().resvg).toBeNull();
      expect(graphicsBackend().loadError).toBeNull();
    });
  });
});

describe("GraphicsProtocolUnsupportedError", () => {
  test("carries the offending protocol in .protocol and in the message", () => {
    const error = new GraphicsProtocolUnsupportedError("blocks");
    expect(error.protocol).toBe("blocks");
    expect(error.message).toContain("not allowed");
    expect(error.message).toContain("blocks");
  });
});

// ---------------------------------------------------------------------------
// 5. buildMetricGraphicPng — error paths without preloaded resvg (default state)
// ---------------------------------------------------------------------------

describe("buildMetricGraphicPng without preloaded resvg (default error path)", () => {
  test("throws GraphicsUnavailableError ('resvg not preloaded')", () => {
    expect(graphicsBackend().resvg).toBeNull(); // explicit precondition
    const build = (): MetricGraphicResult =>
      buildMetricGraphicPng({
        spec: { component: "metric", value: "87%" },
        palette: FULL_PALETTE,
        terminalWidth: 60,
        resolution: null,
      });
    expect(build).toThrow(GraphicsUnavailableError);
    expect(build).toThrow("resvg not preloaded");
  });

  test("the opt-in alone is not enough: RICHUI_GRAPHICS=1 still throws (preload is the gate)", async () => {
    await withGraphicsEnv({ RICHUI_GRAPHICS: "1" }, () => {
      expect(graphicsBackend().resvg).toBeNull(); // explicit precondition
      expect(() =>
        buildMetricGraphicPng({
          spec: { component: "metric", value: "87%" },
          palette: FULL_PALETTE,
          terminalWidth: 60,
          resolution: null,
        }),
      ).toThrow(GraphicsUnavailableError);
    });
  });
});

// ---------------------------------------------------------------------------
// 6 + 7. SVG construction — escaping & delta arrows, observed through the
// graphicsBackend() injection seam (fake rasterizer, restored in finally)
// ---------------------------------------------------------------------------

function renderOnceWithFakeResvg(spec: MetricSpec): { svg: string; result: MetricGraphicResult } {
  const injected = injectFakeResvg();
  try {
    const result = buildMetricGraphicPng({
      spec,
      palette: FULL_PALETTE,
      terminalWidth: 60,
      resolution: null,
    });
    expect(injected.svgs).toHaveLength(1);
    return { svg: injected.svgs[0] ?? "", result };
  } finally {
    injected.restore();
  }
}

describe("buildMetricGraphicPng SVG construction (fake rasterizer injected via graphicsBackend)", () => {
  test("serves the injected fake (sentinel PNG bytes) with bounded cell geometry", () => {
    const { result } = renderOnceWithFakeResvg({ component: "metric", value: "87%" });
    expect(result.png).toEqual(FAKE_PNG); // a real resvg render would differ
    expect(result.widthCells).toBeGreaterThanOrEqual(24);
    expect(result.widthCells).toBeLessThanOrEqual(56);
    expect(result.heightCells).toBeGreaterThanOrEqual(2);
  });

  test("agent-provided label and value are XML-escaped (& < > \")", () => {
    const { svg } = renderOnceWithFakeResvg({
      component: "metric",
      label: "cpu&mem",
      value: 'a<b>&"c',
    });
    expect(svg).toContain("CPU&amp;MEM");
    expect(svg).toContain("a&lt;b&gt;&amp;&quot;c");
    expect(svg).not.toContain("a<b>"); // raw value never leaks into the SVG
    expect(svg).not.toContain('&"c');
  });

  test("delta '+1.3' renders '▲ 1.3' (native parity: sign dropped, up arrow)", () => {
    const { svg } = renderOnceWithFakeResvg({ component: "metric", value: "87", delta: "+1.3" });
    expect(svg).toContain("▲ 1.3");
    expect(svg).not.toContain("+1.3");
  });

  test("delta '-2ms' renders '▼ 2ms' (native parity: sign dropped, down arrow)", () => {
    const { svg } = renderOnceWithFakeResvg({ component: "metric", value: "42ms", delta: "-2ms" });
    expect(svg).toContain("▼ 2ms");
    expect(svg).not.toContain("-2ms");
  });

  test("unicode minus delta '−5ms' renders '▼ 5ms' too", () => {
    const { svg } = renderOnceWithFakeResvg({ component: "metric", value: "42ms", delta: "−5ms" });
    expect(svg).toContain("▼ 5ms");
    expect(svg).not.toContain("−5ms");
  });

  test("unsigned delta 'stable' renders as-is (no arrow)", () => {
    const { svg } = renderOnceWithFakeResvg({ component: "metric", value: "42ms", delta: "stable" });
    expect(svg).toContain("stable");
    expect(svg).not.toContain("▲");
    expect(svg).not.toContain("▼");
  });

  test("incomplete theme tokens (no title/muted) degrade with GraphicsUnavailableError", () => {
    const injected = injectFakeResvg();
    try {
      expect(() =>
        buildMetricGraphicPng({
          spec: { component: "metric", value: "1" },
          palette: {},
          terminalWidth: 60,
          resolution: null,
        }),
      ).toThrow(GraphicsUnavailableError);
    } finally {
      injected.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Graphic METRIC path through the PUBLIC renderer factory
//    (buildMetricWithOptionalGraphics observed via createRichuiRenderer)
// ---------------------------------------------------------------------------

function metricToken(text: string): CodeBlockToken {
  return { type: "code", raw: "```richui\n" + text + "\n```", text, lang: "richui" };
}

function makeSentinel(): RenderableLike {
  return { width: 1, height: 1, destroyRecursively() {} };
}

function pluginContext(renderer: TestRendererSetup["renderer"]): TuiPluginContext {
  return {
    renderer,
    theme: {
      text: { base: "#ffffff", muted: "#888888" },
      background: { base: "#000000" },
      border: "#444444",
    },
    themeMode: "dark",
    markdown: {
      registerCodeBlockRenderer: () => () => undefined,
    },
    app: { version: "2.0.30-test" },
  };
}

describe("metric graphic path via the public renderer (double fallback, opentui.ts)", () => {
  test("RICHUI_GRAPHICS=1 + no preloaded resvg → degrades to the NATIVE metric (block never lost)", async () => {
    await withGraphicsEnv({ RICHUI_GRAPHICS: "1" }, async () => {
      const h = await getSetup();
      const sentinel = makeSentinel();
      const render = createRichuiRenderer(pluginContext(h.renderer));
      const out = render(metricToken(JSON.stringify({ component: "metric", value: "87%" })), {
        defaultRender: () => sentinel,
      });
      expect(out).toBeDefined();
      expect(out).not.toBe(sentinel); // not the default fallback either
      expect(out).not.toBeInstanceOf(ImageRenderable); // the graphic path did not succeed
      expect(out!.height).toBeGreaterThan(0);
    });
  });

  test("the failed graphic attempt is journaled as FALLBACK with the resvg reason", async () => {
    const debugDir = mkdtempSync(join(tmpdir(), "richui-graphics-test-"));
    const debugPath = join(debugDir, "graphics.log");
    try {
      await withGraphicsEnv({ RICHUI_GRAPHICS: "1", RICHUI_GRAPHICS_DEBUG: debugPath }, async () => {
        const h = await getSetup();
        const render = createRichuiRenderer(pluginContext(h.renderer));
        render(metricToken(JSON.stringify({ component: "metric", value: "87%" })), {
          defaultRender: () => makeSentinel(),
        });
      });
      const log = readFileSync(debugPath, "utf8");
      expect(log).toContain("metric-graphic FALLBACK");
      expect(log).toContain("resvg not preloaded");
    } finally {
      rmSync(debugDir, { recursive: true, force: true });
    }
  });

  test("opt-in off → the graphic path is never attempted (no journal line at all)", async () => {
    const debugDir = mkdtempSync(join(tmpdir(), "richui-graphics-test-"));
    const debugPath = join(debugDir, "graphics.log");
    try {
      await withGraphicsEnv({ RICHUI_GRAPHICS_DEBUG: debugPath }, async () => {
        const h = await getSetup();
        const sentinel = makeSentinel();
        const render = createRichuiRenderer(pluginContext(h.renderer));
        const out = render(metricToken(JSON.stringify({ component: "metric", value: "42" })), {
          defaultRender: () => sentinel,
        });
        expect(out).toBeDefined();
        expect(out).not.toBe(sentinel);
        expect(out).not.toBeInstanceOf(ImageRenderable);
      });
      expect(existsSync(debugPath)).toBe(false); // graphicsLog was never called
    } finally {
      rmSync(debugDir, { recursive: true, force: true });
    }
  });

  test("invalid JSON → defaultRender even with the opt-in active (parse gate first)", async () => {
    await withGraphicsEnv({ RICHUI_GRAPHICS: "1" }, async () => {
      const h = await getSetup();
      const sentinel = makeSentinel();
      const render = createRichuiRenderer(pluginContext(h.renderer));
      const out = render(metricToken("this is not json"), { defaultRender: () => sentinel });
      expect(out).toBe(sentinel);
    });
  });
});
