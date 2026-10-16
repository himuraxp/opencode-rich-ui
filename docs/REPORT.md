# Rapport Phase 0 — POC `opencode-rich-ui`

**Date** : 2026-10-16 · **Runtime** : OpenCode 2.0.30 · Bun 1.3.14 · @opentui/core 0.6.6 · macOS arm64

## Gate de validation : **PASSÉ**

Le renderer inline produit un composant OpenTUI natif depuis un bloc
` ```richui ` **via l'API publique**, pendant et après le streaming.
Preuves : captures PTY re-jouées via émulateur de terminal (pyte), journal
de cycle de vie du plugin, et suite de tests automatisée. Aucune
fonctionnalité n'est déclarée validée sans preuve d'exécution ci-dessous.

## 1. Fonctionnalités implémentées

| Livrable | État |
|---|---|
| Repository initialisé et structuré (4 couches) | ✅ |
| Plugin CLI chargeable (`cli.json` → répertoire + `tui.ts`) | ✅ |
| Renderer Markdown pour `richui` (API publique) | ✅ |
| Composant visuel Panel (couleurs du thème) | ✅ |
| Exemple Markdown `richui` | ✅ `examples/richui-examples.md` |
| Tests automatisés (60, 5 fichiers) | ✅ `bun test` |
| ADR rendu inline + fallback | ✅ `docs/adr/ADR-001-inline-rendering.md` |

Architecture en 4 couches :

```txt
src/
├── core/         parse.ts, schema.ts      parsing JSON total, validation, normalisation
├── components/   panel.ts                 widgets OpenTUI (Box+Text), pure fonction
├── layout/       width.ts                 graphèmes, wrap, troncature, seuil 40 col
├── adapter/      opencode-api.ts          types structuraux du contrat vérifié
│                 opentui.ts               bridge spec→renderable, never-throw
│                 theme.ts                 accès défensif aux tokens du thème
│                 plugin.ts                export default {id, setup} + cycle de vie
└── index.ts                               entrée publique (re-exports)
tui.ts                                      entrypoint convention chargeur (<dir>/tui)
```

## 2. Tests exécutés et résultats

**`bun test` — 60 pass / 0 fail / 176 assertions** (5 fichiers) :

- `test/parse.test.ts` (15) : parse/validate/normalise, caps (64 Ko, 200 lignes,
  2000 car/ligne, titre 80), tone insensible à la casse, sanitisation
  (strip ANSI/C0, tabs → 2 espaces), adversarial never-throw.
- `test/width.test.ts` (23) : largeur en **cellules terminales** (CJK/emoji
  double-largeur, combining marks), troncature exacte, wrap mots + rupture
  dure O(n) avec cap `MAX_WRAPPED_LINES`, newlines/vides préservés, seuils layout.
- `test/render.test.ts` (7) : rendu **headless officiel**
  (`@opentui/core/testing` → `createTestRenderer` + `captureCharFrame`) —
  bordered, wrap in-box, compact < 40 col, sans titre, garde anti-complexité
  (corps pathologique 200 lignes × 2000 car, plafond 1,5 s — mesuré 180-640 ms
  selon charge ; hauteur ≤ cap + 3, notice de troncature peinte dans un
  viewport dédié).
- `test/theme.test.ts` (5) : tokens RGBA du thème hôte (accès structurel,
  branches manquantes, objets malformés rejetés).
- `test/plugin.test.ts` (10) : contrat module V2 (`{id, setup}` ≡ `ePt`),
  cycle register→unregister, dégradation en cas de refus (doublon), repli
  exact (`ctx.defaultRender()` retourné tel quel), never-throw sur tokens
  hostiles, garanties « sans outil » du format.

**Preuves E2E (opencode TUI réel, provider mock OpenAI-compatible SSE)** :

| # | Scénario | Preuve |
|---|---|---|
| E1 | Chargement du plugin | journal debug : `module-import` → `setup-called version=2.0.30` → `register-ok lang=richui` |
| E2 | Rendu inline **pendant** streaming | frame @95000 : Panel `Checks` peint + spinner + `esc interrupt` (stream actif), « All done. » non encore reçu |
| E3 | Rendu **après** streaming | frame final : Panel stable |
| E4 | Repli sur JSON invalide | bloc `Build` → code block par défaut, contenu brut intact |
| E5 | Markdown ordinaire intact | paragraphes et fences hors `richui` rendus normalement |
| E6 | Rechargement à chaud + nettoyage | modif `tui.ts` → `module-import` → `unregister-ok` → `setup-called` → `register-ok` |
| E7 | Terminal étroit (60 col) | panel borné au canevas, corps wrappé, zéro débordement |
| E8 | Re-validation post-refactor (largeur cellules + cap) | transition dynamique prouvée : fallback code block @21499 B (JSON partiel, stream vivant `esc interrupt`) → Panel `Build` inline @51060 B ; frame finale : 2 Panels inline, zéro fallback, à 110 **et** 60 col |

## 3. API OpenCode utilisées (toutes publiques, v2.0.30)

| API | Rôle |
|---|---|
| `cli.json` → `plugins: ["file://<dir>"]` | enregistrement (convention `<dir>/tui.*`, résolu par `Bun.resolveSync`) |
| export default `{ id, setup }` | contrat module V2 TUI (validateur `ePt` du runtime) |
| `api.markdown.registerCodeBlockRenderer(lang, fn)` | enregistrement renderer code block → `unregister()` |
| callback `(token, ctx)` + `ctx.defaultRender()` | dispatch `type==="code"` + repli standard |
| `api.renderer`, `api.theme` (tokens réactifs), `api.app.version` | contexte de rendu |
| `@opentui/core` (bare import) | redirigé vers l'instance **hôte** (`opentui:runtime-module:`) — BoxRenderable, TextRenderable |
| `@opentui/core/testing` (dev) | `createTestRenderer`, `captureCharFrame` — preuves headless |

Références croisées : code du plugin builtin `opencode.merman` (mermaid) et
`opencode.latex` extraits du binaire ; plugin de production
`orca-opencode-status-tui` (format V2 vivant).

## 4. Limitations

1. **Contrat non documenté publiquement** — extrait du binaire 2.0.30 ; une
   montée de version d'OpenCode exige de rejouer les tests E2E (la page
   `docs/tui-plugins` n'existe pas au 2026-10-16 ; typings npm 1.19.x =
   ancien format v1).
2. **Reconstruction du bloc à chaque delta de stream** — conforme au modèle
   du runtime (custom ≠ default ⇒ rebuild). Pas de cache d'objets renderables
   possible : l'hôte détruit les anciens arbres (`clearBlockStates()` →
   `destroyRecursively()` sur chaque block renderable) ; en cas d'échec de
   construction, le composant détruit ce qu'il a partiellement ajouté
   (destroy-on-failure) avant de replier. Un cache last-good comme `merman`
   reste une optimisation candidate (reporté).
3. **wcwidth maison** — largeur en cellules terminales via plages Unicode
   large (CJK, emoji, combining marks) — correction post-review du comptage
   par graphèmes ; caractères zéro-largeur exotiques hors plages couvertes
   non traités (à raffiner si besoin post-Phase 0).
4. **Debug markers** — journal de cycle de vie conditionné par
   `OPENCODE_RICHUI_DEBUG` (dev uniquement, coût nul sinon).
5. **Un seul composant** (Panel) — gate de la mission : les 4 autres
   (Metric, Table, Chart, Review) attendent la ratification du POC.

## 5. Décisions d'architecture

Voir `docs/adr/ADR-001-inline-rendering.md` (D1→D6) :
rendu inline via `registerCodeBlockRenderer` (D1) ; repli total never-throw
(D2) ; format déclaratif JSON strict sans exécution (D3) ; widgets résolus
côté hôte (D4) ; couche layout dédiée (D5) ; composants = fonctions pures
reconstruites au flux (D6). Les panneaux de session (`ui.panel`) et routes
(`ui.router`) sont répertoriés comme extensions futures, pas comme
stratégie primaire — le POC inline étant validé, la condition de repli du
gate n'a pas eu à s'appliquer.

## 6. Prochain lot recommandé

1. **Lot 1 (MVP visuel)** : `Metric` (valeur+delta+tonalité) et `Table`
   (colonnes wrappées, trié statique) — réutilisent 100 % de core/layout/theme.
2. **Lot 2** : `Chart` (barres/sparkline ASCII via grille OpenTUI) + cache
   last-good anti-flicker pendant le streaming.
3. **Lot 3** : `Review` (verdict + checklist) + `ui.panel.open` en vue
   détaillée (interaction clavier), si l'usage le justifie.
4. **Industrialisation** : publication npm (build `bun build --target=bun`
   vers `dist/`, entrypoint `tui.js`), CI GitHub Actions (typecheck+tests),
   test E2E rejoué automatiquement sur montée d'OpenCode.
