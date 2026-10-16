# INDEX

## Modules clés
| Chemin | Rôle |
|---|---|
| `tui.ts` | entrypoint convention chargeur (`<dir>/tui.*`) → re-export default |
| `src/index.ts` | entrée publique (plugin + parse + layout + panel) |
| `src/core/schema.ts` | union specs (`panel` Phase 0 ; metric/table/chart/review prévus), TONES, RICHUI_LANGUAGE |
| `src/core/parse.ts` | parseur total (ParseResult discriminé), caps 64 Ko/200 lignes/80 car titre |
| `src/layout/width.ts` | largeur en cellules terminales (CJK/emoji, combining marks), hardWrap O(n) + cap MAX_WRAPPED_LINES, truncateToWidth, layoutFor (seuil 40 col) |
| `src/components/panel.ts` | Panel : bordered (≥40) / compact (<40), Box+Text purs |
| `src/adapter/opencode-api.ts` | types structuraux du contrat runtime 2.0.30 (RenderContextLike = @opentui/core RenderContext) |
| `src/adapter/opentui.ts` | createRichuiRenderer : never-throw, fallback `ctx.defaultRender()` |
| `src/adapter/theme.ts` | paletteFor : tokens texte/muted + feedback par tone, défensif |
| `src/adapter/plugin.ts` | export default {id:"richui", setup}, cleanup = unregister, debug markers env OPENCODE_RICHUI_DEBUG |

## Fichiers de test
`test/parse.test.ts` (15), `test/width.test.ts` (23), `test/render.test.ts` (7,
headless `@opentui/core/testing`), `test/theme.test.ts` (5, tokens RGBA hôte),
`test/plugin.test.ts` (10, contrat + cycle). Total 60.

## Artefacts
`docs/REPORT.md`, `docs/adr/ADR-001-inline-rendering.md`,
`examples/richui-examples.md`, `README.md`, `AGENTS.md`.

## Hors repo (harnais E2E, temporaire)
`/private/var/folders/ts/.../T/opencode/rui-e2e/` : mock-server.ts (SSE
openai-compatible), opencode.json (provider richui-mock), e2e-drive.exp /
narrow-test2.exp / reload-test2.exp (expect), replay.py (pyte), captures
e2e-debug3.log / narrow-raw2.log / richui-debug.log.
