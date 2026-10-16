/**
 * adapter/opencode-api.ts — Structural types for the OpenCode 2.0 TUI plugin API.
 *
 * Source of truth: the opencode 2.0.30 runtime (verified against the binary's
 * plugin host implementation and a production plugin). The published npm typings
 * (@opencode-ai/plugin 1.19.x) still describe the legacy v1 shape and do NOT
 * include `markdown.registerCodeBlockRenderer`, so we type the surface we use
 * locally instead of depending on drift-prone third-party declarations.
 *
 * Runtime facts encoded here:
 * - Module contract: `export default { id: string (non-empty), setup(api) }`.
 *   Returning an async function from `setup` registers a cleanup on unload.
 * - `registerCodeBlockRenderer(lang, renderer)` returns an unregister function
 *   and throws when the language is empty or already registered.
 * - The renderer callback receives a markdown code token plus a context whose
 *   `defaultRender()` yields the host's default code-block renderable. Returning
 *   it (or undefined) falls back to the default rendering.
 * - `api.theme` is a getter over the host's reactive theme tokens.
 */

/** Minimal OpenTUI renderable contract used by the markdown block host. */
export interface RenderableLike {
  readonly width: number;
  readonly height: number;
  parent?: unknown;
  destroyRecursively(): void;
}

/** Markdown code-block token dispatched to registered renderers. */
export interface CodeBlockToken {
  readonly type: "code";
  /** Raw markdown of the block, including fences. */
  readonly raw: string;
  /** Code content (between the fences). */
  readonly text: string;
  /** Info string language as written (already dispatched to us on a normalized match). */
  readonly lang?: string;
}

/** Context handed to the renderer callback by the markdown block host. */
export interface CodeBlockRenderContext {
  /**
   * Builds the host's default code-block renderable for this token.
   * Returning it from the renderer (or returning undefined) selects the
   * default rendering path — the sanctioned fallback.
   */
  defaultRender(): RenderableLike | undefined;
}

/** Renderer callback contract for `registerCodeBlockRenderer`. */
export type CodeBlockRenderer = (
  token: CodeBlockToken,
  context: CodeBlockRenderContext,
) => RenderableLike | undefined;

export interface MarkdownApi {
  registerCodeBlockRenderer(language: string, renderer: CodeBlockRenderer): () => void;
}

/** Reactive theme token surface used by components (defensive in theme.ts). */
export interface ThemeTokens {
  readonly text: {
    readonly base?: ColorValue;
    readonly muted?: ColorValue;
  };
  readonly background: {
    readonly base?: ColorValue;
    readonly panel?: ColorValue;
    readonly element?: ColorValue;
  };
  readonly border?: ColorValue;
  readonly borderActive?: ColorValue;
}

export type ColorValue = string | import("@opentui/core").RGBA;

/** The subset of the plugin API surface consumed by this plugin. */
export interface TuiPluginContext {
  readonly renderer: RenderContextLike;
  readonly theme: ThemeTokens;
  readonly themeMode: "dark" | "light";
  readonly markdown: MarkdownApi;
  readonly app: { readonly version: string };
}

/** Structural minimum of the OpenTUI render context used to construct widgets. */
export type RenderContextLike = import("@opentui/core").RenderContext;

/**
 * Module contract enforced by the OpenCode V2 TUI plugin loader:
 * `{ id: non-empty string, setup: function }` — anything else is rejected with
 * "Invalid V2 TUI plugin module".
 */
export interface TuiPluginModule {
  readonly id: string;
  readonly setup: (context: TuiPluginContext) => Promise<(() => void) | void>;
}
