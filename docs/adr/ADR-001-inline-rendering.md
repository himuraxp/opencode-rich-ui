# ADR-001 — Stratégie de rendu inline et de repli pour les blocs `richui`

- **Statut** : Accepté (Phase 0 — POC validé par exécution)
- **Date** : 2026-10-16
- **Décideurs** : Aurora (orchestrateur), validé par preuves E2E
- **Contexte** : Mission `opencode-rich-ui` MVP / Phase 0

## Contexte

Le plugin doit transformer des blocs Markdown ` ```richui ` en composants
OpenTUI natifs, inline dans la conversation, pendant ET après le streaming,
sans fork d'OpenCode, sans API interne, sans exécuter du JavaScript fourni
par un agent, et sans dégrader le Markdown ordinaire.

## Décision

### D1 — Rendu inline via `api.markdown.registerCodeBlockRenderer` (API publique)

Le contrat vérifié sur le runtime opencode 2.0.30 (extraction du binaire +
plugin de production `orca-opencode-status-tui` comme témoin vivant) :

```txt
export default { id: string, setup: async (api) => cleanup? }
api.markdown.registerCodeBlockRenderer(lang, fn) → unregister()
fn(token: {type:"code", raw, text, lang}, ctx: {defaultRender()})
  → Renderable | undefined
```

- La fonction est invoquée uniquement pour les tokens `type === "code"` dont
  le langage normalisé (trim, 1er token, lowercase, table d'alias) correspond.
- `OZ()` (dispatcher du binaire) : `i.codeBlockOnly = true` — aucun autre type
  de bloc ne transite par le renderer → **le Markdown ordinaire est
  structurellement intact**.
- Le retour d'un renderable remplace le code block ; retourner
  `ctx.defaultRender()` ou `undefined` sélectionne le rendu par défaut.

**Rejeté** : panneau de session (`ui.panel.open`) et routes natives
(`ui.router.register`) comme stratégie primaire — ils existent dans l'API
(sérés pour des UX futures) mais n'offrent pas le rendu **inline dans le
flux de la réponse**, qui est l'exigence de la mission. Ils restent des
extensions candidates post-Phase 0 (ex. vue détaillée d'un Chart).

### D2 — Repli total, jamais d'exception

Contrainte du runtime : une exception non interceptée depuis le renderer
remonte dans la pile de rendu markdown (pas de filet côté hôte). En
conséquence, le contrat interne du plugin est :

1. Le callback `createRichuiRenderer` encapsule TOUT dans try/catch ; en
   dernier recours il retourne `ctx.defaultRender()`.
2. Le parser (`core/parse.ts`) est total : jamais de throw, toujours un
   `ParseResult` discriminé avec raison stable.
3. Toute construction de widget échouée → repli (jamais de rendu partiel).

Preuve E2E : un bloc `richui` au JSON invalide streaming s'affiche comme code
block par défaut (contenu brut intact) tandis qu'un bloc valide devient un
Panel natif — les deux chemins observés dans le même flux.

### D3 — Format déclaratif strict (JSON), zéro exécution

Le contenu `richui` est un objet JSON validé champ par champ (union de specs,
`component` discriminant). Aucune évaluation, aucun import, aucun callback
agent. Les agents produisent le format sans outil externe (simple fenced
block), ce qui satisfait la contrainte « pas d'outil externe ».

### D4 — Widgets OpenTUI résolus côté hôte

Le plugin importe `@opentui/core` en bare specifier : le chargeur OpenCode
(plugin Bun `bun-plugin-opentui-runtime-modules`) redirige l'import vers
**l'instance hôte** (module virtuel `opentui:runtime-module:`). Notre
`node_modules/@opentui/core` ne sert qu'au typage. Aucune divergence de
classe/instance possible.

### D5 — Largeur pilotée par une couche layout dédiée

Toute passe par `layout/width.ts`. Mesure en **cellules terminales** (non en
graphèmes) : plages Unicode large — CJK, emoji, combining marks — pour que la
colonne peinte corresponde à la cellule réservée (correction post-review :
un emoji compte 2, un combining mark 0). Wrap à coupure de mots + rupture
dure en O(n), cap `MAX_WRAPPED_LINES` appliqué **après** wrap avec notice de
troncature, troncature ellipsoïdale, seuil bordered/compact à 40 colonnes.
Preuves : headless — hauteur ≤ cap + 3 et notice peinte pour un corps
pathologique 200 lignes × 2000 car (garde anti-complexité à 1,5 s ; mesuré
180-640 ms selon charge) ; E2E — rendu correct à 60
colonnes ; mode compact (< 40) prouvé en rendu headless.

### D6 — Streamabilité par reconstruction

Le runtime re-invoque le renderer à chaque mise à jour du bloc et reconstruit
le bloc custom (identité ≠ default ⇒ `canUpdateInPlace: false`). Le composant
est donc une **fonction pure** (spec, palette, largeur) sans état ni timers ;
c'est le même modèle que le builtin `opencode.merman` (mermaid), qui ajoute
un cache last-good — optimisation reportée au-delà de la Phase 0.

Preuve de nettoyage côté hôte (binaire 2.0.30) : `clearBlockStates()` appelle
`destroyRecursively()` sur tous les block renderables → tout cache d'objets
renderables serait dangereux (références détruites réutilisées). En cas
d'échec de construction, le composant détruit lui-même les renderables
partiellement ajoutés (destroy-on-failure) avant de replier.

## Conséquences

- Phase 0 livrée avec un seul composant (Panel) ; l'union `schema.ts` accueille
  Metric/Table/Chart/Review sans rupture.
- La maintenance du contrat repose sur un test d'équivalence `ePt` (forme du
  module) + tests de repli — toute dérive du runtime casse ces tests d'abord.
- Le contrat étant extrait d'un binaire non documenté publiquement (page
  docs TUI plugins inexistante au 2026-10-16), une surveillance de version
  (tests E2E rejoués à chaque montée d'OpenCode) est requise.

## Preuves d'exécution (2026-10-16, opencode 2.0.30, Bun 1.3.14)

| Preuve | Résultat |
|---|---|
| Chargement cli.json (répertoire + `tui.ts`) | debug log : `module-import` → `setup-called version=2.0.30` → `register-ok lang=richui` |
| Rendu inline pendant streaming | frame @95000 : Panel `Checks` peint, spinner actif, `esc interrupt` visible, « All done. » pas encore streamé |
| Rendu après streaming | frame final : Panel stable + « All done. » |
| Repli | pendant le streaming : JSON partiel invalide → code block par défaut (contenu brut intact), stream vivant (`esc interrupt`) ; complétion valide → Panel inline — les deux chemins dans le même flux (fallback @21499 B → Panel A inline @51060 B ; re-validation post-refactor 2026-10-16) |
| Markdown ordinaire | « Deploying now: », « Status: », « All done. » rendus normalement |
| Rechargement à chaud | modification de `tui.ts` → `module-import` → `unregister-ok` → `setup-called` → `register-ok` |
| Terminal étroit | capture 60 col : panel borné, corps wrappé, zéro débordement |
