/**
 * components/chrome.ts — Shared box chrome for components (panel, metric, table).
 *
 * Extracted in Lot 1 so every component renders the same two layout modes with
 * a single implementation:
 * - bordered (width >= 40): rounded box, optional title on the border.
 * - compact  (width < 40):  left accent rule, no box chrome.
 *
 * The chrome budget (borders + padding) comes from LayoutProfile.innerWidth —
 * single source of truth for both modes.
 *
 * Lifecycle: the host rebuilds blocks on content updates and destroys the
 * previous tree itself (verified: clearBlockStates() calls
 * destroyRecursively() on every block renderable). Our duty is to never leak
 * a PARTIALLY built tree: any construction failure destroys the box before
 * rethrowing (the adapter converts the failure into the default rendering).
 */

import { BoxRenderable, TextRenderable, createTextAttributes } from "@opentui/core";
import type { ColorValue } from "../adapter/opencode-api.ts";
import type { ComponentPalette } from "../adapter/theme.ts";
import type { RenderContextLike } from "../adapter/opencode-api.ts";
import { truncateToWidth, type LayoutProfile } from "../layout/width.ts";

export interface ChromeOptions {
  readonly profile: LayoutProfile;
  readonly palette: ComponentPalette;
  /** Optional single-line heading (border title when bordered, first line when compact). */
  readonly title?: string;
  /** Total box height in rows, chrome borders included (caller's responsibility). */
  readonly height: number;
}

/** Destroy a partially built box after a construction failure (best effort). */
export function destroyBox(box: BoxRenderable | undefined): void {
  try {
    box?.destroyRecursively();
  } catch {
    // Never mask the original construction error.
  }
}

export function createBorderedBox(
  renderer: RenderContextLike,
  options: ChromeOptions,
): BoxRenderable {
  const { profile, palette, title } = options;
  const textWidth = profile.innerWidth;
  return new BoxRenderable(renderer, {
    width: profile.width,
    height: options.height,
    border: true,
    borderStyle: "rounded",
    ...(palette.border !== undefined ? { borderColor: palette.border } : {}),
    ...(title
      ? {
          title: truncateToWidth(title, textWidth),
          ...(palette.title !== undefined ? { titleColor: palette.title } : {}),
        }
      : {}),
  });
}

export function createCompactBox(
  renderer: RenderContextLike,
  options: ChromeOptions,
): BoxRenderable {
  const { profile, palette } = options;
  return new BoxRenderable(renderer, {
    width: profile.width,
    height: options.height,
    border: ["left"],
    ...(palette.border !== undefined ? { borderColor: palette.border } : {}),
  });
}

/** One selectable multi-line text node with optional foreground color and bold. */
export function textBlock(
  renderer: RenderContextLike,
  content: string,
  color: ColorValue | undefined,
  padding: { readonly left?: number; readonly right?: number },
  options?: { readonly bold?: boolean },
): TextRenderable {
  return new TextRenderable(renderer, {
    content,
    wrapMode: "none",
    selectable: false,
    ...(options?.bold ? { attributes: createTextAttributes({ bold: true }) } : {}),
    ...(padding.left !== undefined ? { paddingLeft: padding.left } : {}),
    ...(padding.right !== undefined ? { paddingRight: padding.right } : {}),
    ...(color !== undefined ? { fg: color } : {}),
  });
}
