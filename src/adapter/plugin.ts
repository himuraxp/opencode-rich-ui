/**
 * adapter/plugin.ts — OpenCode 2.0 TUI plugin entry (V2 module contract).
 *
 * export default { id, setup } — validated by the loader ("Invalid V2 TUI
 * plugin module" otherwise). setup() registers the `richui` code-block
 * renderer and returns the unregister function as cleanup, so plugin
 * reload/unload tears the registration down deterministically.
 *
 * Robustness rules (verified against the 2.0.30 runtime):
 * - setup() never throws: a failing registration degrades to "plugin without
 *   markdown integration" instead of failing the whole TUI startup.
 * - The registration call may throw for empty/duplicate language: we surface a
 *   warning and return cleanly.
 */

import { RICHUI_LANGUAGE } from "../core/schema.ts";
import { createRichuiRenderer } from "./opentui.ts";
import { debug } from "./debug.ts";
import type { TuiPluginContext, TuiPluginModule } from "./opencode-api.ts";

export const PLUGIN_ID = "richui";

debug("module-import");

async function setup(context: TuiPluginContext): Promise<(() => void) | void> {
  debug("setup-called", `version=${context?.app?.version ?? "unknown"}`);
  try {
    const unregister = context.markdown.registerCodeBlockRenderer(
      RICHUI_LANGUAGE,
      createRichuiRenderer(context),
    );
    debug("register-ok", `lang=${RICHUI_LANGUAGE}`);
    return () => {
      try {
        unregister();
        debug("unregister-ok");
      } catch {
        // The host clears registrations on unload anyway; never throw in cleanup.
      }
    };
  } catch (error) {
    debug("register-failed", (error as Error).message);
    console.warn(`[richui] markdown renderer registration failed: ${(error as Error).message}`);
    return;
  }
}

const plugin: TuiPluginModule = { id: PLUGIN_ID, setup };

export default plugin;
