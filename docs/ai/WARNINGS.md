# WARNINGS

## W-01 — Contrat plugin non documenté publiquement (actif)
Le contrat TUI plugin V2 (`export default {id, setup}`, `api.markdown.*`,
shim `@opentui/core`) a été extrait du binaire opencode 2.0.30. Les typings
npm `@opencode-ai/plugin@1.19.x` décrivent l'ANCIEN format v1 (export `{tui}`)
et NE correspondent PAS au runtime 2.0.30. Toute montée d'OpenCode doit rejouer
les tests E2E (voir docs/REPORT.md §4). Zone sensible : `src/adapter/`.

## W-02 — Entrée cli.json : répertoire, pas fichier (actif)
Un spec `file://` pointant vers un FICHIER est silencieusement ignoré par la
boucle de reconciliation TUI (`stat.isFile() → continue`, aucune erreur, aucun
toast). Convention valide : répertoire contenant `tui.<ext>`. Symptôme si
violé : plugin jamais chargé, aucun message. Zone sensible : `tui.ts`,
`~/.config/opencode/cli.json`.

## W-03 — Exception dans le renderer = crash du rendu markdown (actif)
L'hôte n'intercepte pas les exceptions du callback renderer (seules
MermaidSyntaxError et une classe interne sont catchées). Toute nouvelle
fonctionnalité doit passer par le wrapper never-throw de
`src/adapter/opentui.ts` (try/catch → `ctx.defaultRender()`).

## W-04 — Harnais E2E : marqueurs non discriminants (actif, hors repo)
Les titres/corps d'un bloc invalide apparaissent aussi dans le code block
brut du repli : un marqueur (« Build », « step 1 of 3 ») présent dans la
frame ne prouve PAS le rendu inline. Vérifier (a) l'ABSENCE de
`{"component":"panel"` dans la frame finale, (b) la présence du corps peint.
Pendant le streaming, le fallback du JSON partiel est NORMAL (preuve du
repli dynamique). Zone : harnais hors repo (INDEX, section hors repo).
Leçon datée 2026-10-16 : le mock initial envoyait un JSON `Build` jamais
fermé → fallback permanent, confondu avec un rendu inline par des checks
non discriminants.
