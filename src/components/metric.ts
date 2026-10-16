/**
 * components/metric.ts — Lot 1 visual component: Metric (label / value / delta).
 *
 * Reuses the shared chrome (components/chrome.ts) with the panel's two layout
 * modes:
 * - bordered (>= 40): label on the border, value in the accent color, delta
 *   below.
 * - compact  (< 40): left rule, label as the first accent line.
 * In BOTH modes the delta gets a directional arrow derived from its leading
 * sign (the arrow is delta semantics, not layout chrome).
 *
 * Semantic mapping (defensive palette — missing theme tokens inherit):
 * - label → border title (bordered) / muted first line (compact).
 * - value → palette.title (accent) in BOTH modes — it is the component's core.
 * - delta → palette.text.
 *
 * The arrow is presentation only (▲ for leading "+", ▼ for leading "-"); the
 * semantic color stays the agent's choice via `tone`.
 */

import type { BoxRenderable } from "@opentui/core";
import type { MetricSpec } from "../core/schema.ts";
import { layoutFor, truncateToWidth } from "../layout/width.ts";
import type { ComponentPalette } from "../adapter/theme.ts";
import type { RenderContextLike } from "../adapter/opencode-api.ts";
import {
  createBorderedBox,
  createCompactBox,
  destroyBox,
  textBlock,
} from "./chrome.ts";

export function buildMetric(options: {
  spec: MetricSpec;
  palette: ComponentPalette;
  terminalWidth: number;
  renderer: RenderContextLike;
}): BoxRenderable {
  const { spec, palette, terminalWidth, renderer } = options;
  const profile = layoutFor(terminalWidth);
  const inner = profile.innerWidth;
  const accent = palette.title ?? palette.text;

  const valueLine = truncateToWidth(spec.value, inner);
  const deltaLine = spec.delta !== undefined ? deltaWithArrow(spec.delta, inner) : undefined;

  if (profile.bordered) {
    let box: BoxRenderable | undefined;
    try {
      const contentLines = deltaLine !== undefined ? 2 : 1;
      box = createBorderedBox(renderer, {
        profile,
        palette,
        ...(spec.label !== undefined ? { title: spec.label } : {}),
        height: contentLines + 2,
      });
      box.add(textBlock(renderer, valueLine, accent, { left: 1, right: 1 }));
      if (deltaLine !== undefined) {
        box.add(textBlock(renderer, deltaLine, palette.text, { left: 1, right: 1 }));
      }
      return box;
    } catch (error) {
      destroyBox(box);
      throw error;
    }
  }

  let box: BoxRenderable | undefined;
  try {
    const heading = spec.label !== undefined ? truncateToWidth(spec.label, inner) : undefined;
    const height = (heading !== undefined ? 1 : 0) + 1 + (deltaLine !== undefined ? 1 : 0);
    box = createCompactBox(renderer, { profile, palette, height });
    if (heading !== undefined) {
      box.add(textBlock(renderer, heading, palette.muted, { left: 1 }));
    }
    box.add(textBlock(renderer, valueLine, accent, { left: 1 }));
    if (deltaLine !== undefined) {
      box.add(textBlock(renderer, deltaLine, palette.text, { left: 1 }));
    }
    return box;
  } catch (error) {
    destroyBox(box);
    throw error;
  }
}

/** Prefix a direction arrow from the delta's leading sign (presentation only). */
function deltaWithArrow(delta: string, maxWidth: number): string {
  const trimmed = delta.trim();
  if (trimmed.startsWith("+")) return truncateToWidth(`▲ ${trimmed.slice(1).trim()}`, maxWidth);
  if (trimmed.startsWith("-") || trimmed.startsWith("−")) {
    return truncateToWidth(`▼ ${trimmed.slice(1).trim()}`, maxWidth);
  }
  return truncateToWidth(trimmed, maxWidth);
}
