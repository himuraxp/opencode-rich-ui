/**
 * components/metric.ts — Lot 1 visual component: Metric (label / value / delta).
 *
 * Reuses the shared chrome (components/chrome.ts) with the panel's two layout
 * modes:
 * - bordered (>= 40): label on the border, then ONE line "value … delta" with
 *   the delta right-aligned when it fits (design review P0-1); otherwise the
 *   delta wraps to its own line.
 * - compact  (< 40): left rule, label as the first muted line.
 * In BOTH modes the delta gets a directional arrow derived from its leading
 * sign (the arrow is delta semantics, not layout chrome).
 *
 * Semantic mapping (defensive palette — missing theme tokens inherit):
 * - label → border title (bordered) / muted first line (compact).
 * - value → accent in BOTH modes, bold — it is the component's core.
 * - delta → accent tone when provided by the agent (semantic, never a
 *   sign→color guess: a rising error rate is bad), otherwise text.
 */

import type { BoxRenderable } from "@opentui/core";
import type { MetricSpec } from "../core/schema.ts";
import { layoutFor, truncateToWidth, visualLength } from "../layout/width.ts";
import type { ComponentPalette } from "../adapter/theme.ts";
import type { RenderContextLike } from "../adapter/opencode-api.ts";
import {
  createBorderedBox,
  createCompactBox,
  destroyBox,
  textBlock,
} from "./chrome.ts";

/** Same-line layout requires at least 2 separating cells between value and delta. */
const SAME_LINE_GAP = 2;

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
  // The agent's `tone` IS the delta semantics (it knows whether a rise is
  // good): delta inherits the tone accent, never a sign→color guess.
  const deltaColor = accent;

  const valueLine = truncateToWidth(spec.value, inner);
  const deltaLine = spec.delta !== undefined ? deltaWithArrow(spec.delta, inner) : undefined;

  // Same-line layout: "value … delta" with the delta right-aligned.
  const sameLine =
    deltaLine !== undefined &&
    visualLength(valueLine) + SAME_LINE_GAP + visualLength(deltaLine) <= inner;
  const valueRow =
    sameLine && deltaLine !== undefined
      ? (valueLine +
        " ".repeat(inner - visualLength(valueLine) - visualLength(deltaLine)) +
        deltaLine).trimEnd()
      : valueLine;

  if (profile.bordered) {
    let box: BoxRenderable | undefined;
    try {
      const contentLines = sameLine || deltaLine === undefined ? 1 : 2;
      box = createBorderedBox(renderer, {
        profile,
        palette,
        ...(spec.label !== undefined ? { title: spec.label } : {}),
        height: contentLines + 2,
      });
      if (sameLine || deltaLine === undefined) {
        box.add(textBlock(renderer, valueRow, accent, { left: 1, right: 1 }, { bold: true }));
      } else {
        box.add(textBlock(renderer, valueLine, accent, { left: 1, right: 1 }, { bold: true }));
        box.add(textBlock(renderer, deltaLine, deltaColor, { left: 1, right: 1 }));
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
    const bodyLines = sameLine || deltaLine === undefined ? 1 : 2;
    const height = (heading !== undefined ? 1 : 0) + bodyLines;
    box = createCompactBox(renderer, { profile, palette, height });
    if (heading !== undefined) {
      box.add(textBlock(renderer, heading, palette.muted, { left: 1 }));
    }
    if (sameLine || deltaLine === undefined) {
      box.add(textBlock(renderer, valueRow, accent, { left: 1 }, { bold: true }));
    } else {
      box.add(textBlock(renderer, valueLine, accent, { left: 1 }, { bold: true }));
      box.add(textBlock(renderer, deltaLine, deltaColor, { left: 1 }));
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
