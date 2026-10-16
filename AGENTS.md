# OpenCode Rich UI — conventions projet

## Stack
- Runtime : Bun 1.3.x (tests : `bun test`)
- Cible : OpenCode 2.0.x (TUI), `@opentui/core` 0.6.x (types uniquement — le runtime utilise
  l'instance hôte via le shim `opentui:runtime-module:` du chargeur de plugins)
- TypeScript strict, ESM (`"type": "module"`), pas de build obligatoire pour le dev :
  `cli.json` charge le fichier `.ts` directement (chargeur Bun avec transpilation TS/JSX)

## Contrat plugin (vérifié sur le binaire opencode 2.0.30)
- `export default { id: string, setup: (api) => Promise<(() => void) | void> }`
- `api.markdown.registerCodeBlockRenderer(lang, fn)` → retourne un `unregister()`
- Callback : `(token: {type:"code", raw, text, lang}, ctx: {defaultRender()}) => Renderable | undefined`
- Fallback OBLIGATOIRE : tout contenu non valide → `ctx.defaultRender() ?? undefined`.
  Le callback ne doit JAMAIS throw (exception non catchée = crash du rendu markdown).
- Langage de bloc : `richui` (normalisation OpenCode : trim, 1er token, lowercase)

## Règles
- Pas de `any`. Types locaux structuraux dans `src/adapter/opencode-api.ts` (les typings
  npm `@opencode-ai/plugin` 1.19.x décrivent l'ancienne API v1 et ne couvrent pas
  `markdown.registerCodeBlockRenderer`).
- Le contenu Markdown ordinaire doit rester intact : on ne touche qu'aux blocs `richui`.
- Lisibilité terminal étroit : toute largeur passe par `src/layout/width.ts`.
- Aucune exécution de JavaScript fourni par un agent : le format `richui` est du JSON
  déclaratif, parse + validation stricte, aucune évaluation.
- Tests : `bun test` (unit + rendu headless via `@opentui/core/testing`).
- Mémoire de session : `docs/ai/` (STATUS, PLAN, WARNINGS, INDEX, BUFFER, DECISIONS, CHANGELOG).
