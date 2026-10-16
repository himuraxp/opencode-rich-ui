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
import { paletteFor } from "./theme.ts";
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
  const parsed: ParseResult = parseRichui(content);
  if (!parsed.ok) {
    return ctx.defaultRender();
  }
  return buildRenderable(parsed.spec, context);
}

function buildRenderable(spec: RichuiSpec, context: TuiPluginContext): RenderableLike {
  const palette = paletteFor(context.theme, spec.tone ?? "neutral");
  const terminalWidth = safeTerminalWidth(context.renderer);

  switch (spec.component) {
    case "panel":
      return buildPanel({ spec, palette, terminalWidth, renderer: context.renderer });
  }
}

function safeTerminalWidth(renderer: { readonly width: number }): number {
  const width = Number(renderer?.width);
  return Number.isFinite(width) && width >= 1 ? width : 80;
}
