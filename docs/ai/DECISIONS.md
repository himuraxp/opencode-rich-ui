# DECISIONS

## 2026-10-16 — D1 : rendu inline via registerCodeBlockRenderer (ADR-001)
Choisi : `api.markdown.registerCodeBlockRenderer("richui", fn)` (API publique,
dispatch code-block-only du runtime). Rejetés comme stratégie primaire :
panneaux de session (`ui.panel.open`) et routes natives (`ui.router.register`)
— pas de rendu inline dans le flux ; conservés comme extensions post-Phase 0.
→ docs/adr/ADR-001-inline-rendering.md (D1)

## 2026-10-16 — D2 : repli total never-throw (ADR-001)
Le callback renderer encapsule tout ; toute erreur (parse, construction widget)
→ `ctx.defaultRender()`. Justification : l'hôte ne catche pas les exceptions
du renderer (vérifié dans le binaire : seuls MermaidSyntaxError et une classe
interne le sont). → docs/adr/ADR-001-inline-rendering.md (D2)

## 2026-10-16 — D3 : format déclaratif JSON strict (ADR-001)
`richui` = JSON validé champ par champ, zéro exécution de code agent.
Satisfait la contrainte « pas d'outil externe pour les agents ».
→ docs/adr/ADR-001-inline-rendering.md (D3)

## 2026-10-16 — D4 : widgets OpenTUI résolus côté hôte (ADR-001)
Bare import `@opentui/core` redirigé vers l'instance hôte par le chargeur
(`opentui:runtime-module:`). node_modules local = typage seul.
→ docs/adr/ADR-001-inline-rendering.md (D4)

## 2026-10-16 — D5 : couche layout dédiée, seuil bordered/compact 40 col (ADR-001)
Toute largeur passe par layout/width.ts en **cellules terminales** (CJK/emoji
double-largeur, combining marks — correction post-review du comptage par
graphèmes). E2E 60 col + tests headless compact. → docs/adr/ADR-001-inline-rendering.md (D5)

## 2026-10-16 — D6 : composants = fonctions pures, reconstruction au flux (ADR-001)
Le runtime rebuild les blocs custom à chaque delta (canUpdateInPlace=false) ;
pas d'état dans les composants. Preuve teardown hôte : `clearBlockStates()`
→ `destroyRecursively()` sur tous les block renderables → **jamais de cache
d'objets renderables** ; destroy-on-failure pour les arbres partiels. Cache
last-good type merman = optimisation future. → docs/adr/ADR-001-inline-rendering.md (D6)

## 2026-10-16 — D7 : chrome de composants partagé (chrome.ts)
Extraction du chrome bordered/compact du panel vers `components/chrome.ts`
(createBorderedBox/createCompactBox/textBlock/destroyBox) — 3 composants
l'utilisent (panel, metric, table). Extraction faite en move pur (60 tests
Phase 0 inchangés verts). Budget chrome = LayoutProfile.innerWidth, source
unique. → docs/REPORT.md §6

## 2026-10-16 — D8 : dégradation narrow de la table (zéro débordement prime)
En narrow, le nombre de colonnes visibles est plafonné
(floor((innerWidth+gap)/(1+gap))) et les colonnes de droite sont masquées
avec notice, plutôt que de déborder. Toutes les notices sont clampées au
canevas (truncateToWidth) — y compris la notice interne de hardWrap. Le
contrat zéro-débordement prime sur l'informativité des notices (2 asserts de
tests assouplies en conséquence). → docs/REPORT.md §4/§6

## 2026-10-16 — Convention cli.json : répertoire + tui.ts
Découverte empirique : `file://` vers un fichier est ignoré silencieusement
(`stat.isFile() → continue` dans la boucle de reconciliation). Entrée valide =
répertoire avec `tui.<ext>` (résolu via Bun.resolveSync). → docs/ai/WARNINGS.md W-02
