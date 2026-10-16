/**
 * adapter/opentui.ts — Bridges parsed specs to OpenTUI renderables.
 *
 * This is the ONLY module allowed to construct widgets, so every construction
 * path is wrapped: a widget-constructor failure must degrade to the default
 * code-block rendering, never crash the markdown host.
 */

import type { ParseResult, RichuiSpec } from "../core/schema.ts";
import { parseRichui } from "../core/parse.ts";
import { buildPanel } from "../components/panel.ts";
import { buildMetric } from "../components/metric.ts";
import { buildTable } from "../components/table.ts";
import { paletteFor } from "./theme.ts";
import { buildSpikeImage, spikeEnabled } from "./graphics-spike.ts";
import {
  buildGraphicRenderable,
  graphicsLog,
  graphicsOptIn,
  GraphicsProtocolUnsupportedError,
} from "./graphics.ts";
import { buildMetricGraphicPng } from "../components/metric-graphic.ts";
import type {
  CodeBlockRenderContext,
  CodeBlockRenderer,
  RenderableLike,
  TuiPluginContext,
} from "./opencode-api.ts";

/**
 * Build the code-block renderer bound to a live plugin context.
 *
 * Guarantees (contract of the OpenCode markdown host):
 * - NEVER throws: any unexpected error falls back to `ctx.defaultRender()`.
 * - Valid spec   → custom renderable (Panel).
 * - Invalid spec → `ctx.defaultRender()` (default code block, exact fallback).
 */
export function createRichuiRenderer(context: TuiPluginContext): CodeBlockRenderer {
  return (token, ctx) => {
    try {
      return renderBlock(token.text, context, ctx);
    } catch {
      // Last resort: fall back to the default block. Even this is guarded —
      // a failing defaultRender() must not propagate into the markdown host
      // (the host does not catch renderer exceptions).
      try {
        return ctx.defaultRender();
      } catch {
        return undefined;
      }
    }
  };
}

function renderBlock(
  content: string,
  context: TuiPluginContext,
  ctx: CodeBlockRenderContext,
): RenderableLike | undefined {
  // POC graphics — Étape 1 spike (env-gated, jamais actif en production):
  // each `richui` block becomes a static-PNG ImageRenderable so the host
  // dispatch itself is what we test. Any failure → native path below.
  if (spikeEnabled()) {
    spikeBlockIndex += 1;
    return buildSpikeImage(context, spikeBlockIndex);
  }
  const parsed: ParseResult = parseRichui(content);
  if (!parsed.ok) {
    return ctx.defaultRender();
  }
  return buildRenderable(parsed.spec, context);
}

let spikeBlockIndex = 0;

function buildRenderable(spec: RichuiSpec, context: TuiPluginContext): RenderableLike {
  const palette = paletteFor(context.theme, spec.tone ?? "neutral");
  const terminalWidth = safeTerminalWidth(context.renderer);

  switch (spec.component) {
    case "panel":
      return buildPanel({ spec, palette, terminalWidth, renderer: context.renderer });
    case "metric":
      return buildMetricWithOptionalGraphics({ spec, palette, terminalWidth, context });
    case "table":
      return buildTable({ spec, palette, terminalWidth, renderer: context.renderer });
  }
}

/**
 * Étape 2 POC: opt-in graphic METRIC (same JSON, alternate backend) with the
 * ratified double fallback — ANY graphic failure degrades to the native
 * renderer, never to a lost block.
 */
function buildMetricWithOptionalGraphics(options: {
  spec: Extract<RichuiSpec, { component: "metric" }>;
  palette: ReturnType<typeof paletteFor>;
  terminalWidth: number;
  context: TuiPluginContext;
}): RenderableLike {
  const { spec, palette, terminalWidth, context } = options;
  if (graphicsOptIn()) {
    try {
      const graphic = buildMetricGraphicPng({
        spec,
        palette,
        terminalWidth,
        resolution: context.renderer?.resolution ?? null,
      });
      const renderable = buildGraphicRenderable({
        png: graphic.png,
        widthCells: graphic.widthCells,
        heightCells: graphic.heightCells,
        renderer: context.renderer,
      });
      graphicsLog(
        `metric-graphic ok cells=${graphic.widthCells}x${graphic.heightCells} ` +
          `accent=${JSON.stringify(palette.title)} muted=${JSON.stringify(palette.muted)} ` +
          `svg=${graphic.timings.svgMs.toFixed(1)}ms raster=${graphic.timings.rasterMs.toFixed(1)}ms ` +
          `total=${graphic.timings.totalMs.toFixed(1)}ms`,
      );
      return renderable;
    } catch (error) {
      const reason = error instanceof GraphicsProtocolUnsupportedError
        ? `protocol=${error.protocol} → native`
        : `error=${(error as Error).message}`;
      graphicsLog(`metric-graphic FALLBACK: ${reason}`);
      // Double fallback (ratified): valid JSON + graphic failure → native.
    }
  }
  return buildMetric({ spec, palette, terminalWidth, renderer: context.renderer });
}

function safeTerminalWidth(renderer: { readonly width: number }): number {
  const width = Number(renderer?.width);
  return Number.isFinite(width) && width >= 1 ? width : 80;
}
