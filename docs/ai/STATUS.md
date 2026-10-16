# STATUS

## En cours
- **Phase graphique : TOUT EST CLÔTURÉ — ChatGPT : APPROVED + KEEP-OPT-IN durable**
- Qualification ratifiée : visuel PASS · kitty PASS · perf PASS · mémoire
  ACCEPTED sous opt-in (croissance nette 60-80 Mo / 100 rendus, pas de fuite
  monotone, GC actif — réserve notée) · **copie FAIL** · **scrollback FAIL** ·
  fallback PASS · 145/145 verts.
- **Arbitrage ratifié** : les 2 limitations kitty (copie, scrollback) sont
  BLOQUANTES pour DEFAULT-ON, pas pour l'usage volontaire. Le natif (copiable,
  persistant) reste le défaut durable ; le graphique = opt-in visualisation
  ponctuelle. PANEL/TABLE graphiques : écartés.
- Les limitations sont qualifiées « limites de l'intégration kitty observée
  dans Orca/OpenTUI » — à re-vérifier si OpenTUI/Orca évolue (persistance
  d'images ou cellules texte sous image).
- Prochaine étape éventuelle du projet : nouveaux composants natifs ou
  améliorations du rendu natif (rien d'ouvert).

## Terminé (2026-10-16, Étape 2 — METRIC graphique)
- `src/adapter/graphics.ts` (backend opt-in : preload lazy resvg au setup,
  filtre protocole ratifié, `buildGraphicRenderable` avec enforcement du
  protocole RÉSOLU), `src/components/metric-graphic.ts` (SVG → resvg → PNG,
  couleurs = tokens thème uniquement, escape XML, même sémantique delta que
  le natif), branchement `opentui.ts` (case metric, double fallback) et
  `plugin.ts` (preload). Aucune modification du contrat JSON.
- Dépendance : @resvg/resvg-js 2.6.2 (lazy — jamais dans le chemin normal).
- Tests : 111 → **145 verts** (+30 tests Tester +4 cssColor : politique
  protocole, opt-in, error paths, escaping/arrows via seam injection, double
  fallback via createRichuiRenderer ; scrub env dans plugin.test.ts).
- **BUG CONTRASTE (P0 ChatGPT) corrigé** : les tokens host sont des instances
  RGBA opentui dont les getters r/g/b exposent des floats NORMALISÉS (127 →
  0.498) — le SVG recevait rgb(0,1,1) (noir). Fix : `cssColor()` dans
  theme.ts (toInts() prioritaire, fallback avec détection de normalisation
  ≤1 → ×255, clamp). Vérifié en E2E : le PNG extrait du flux est
  #7fd88f/#808080 (méthodologie : extraction base64 des chunks kitty du
  flux réel — preuve authentique du contraste).
- E2E : filtre VERIFIÉ (blocks → FALLBACK native ×3, metric natif peint,
  0 fallback JSON, 2/2 runs) ; émission kitty VERIFIÉE (3 chunks a=t m=0,
  PNG 784×59 RGBA extrait DU FLUX réel — metric-graphic-extracted.png) ;
  timings : resvg cold 375 ms / hot 8-14 ms, svg 0-3,2 ms, raster 12,9-24
  ms, total 13-24,6 ms (seuils ChatGPT respectés).
- Harnais : e2e-drive.exp durci (vérification requête mock + abort exit 4,
  jamais de faux pass) ; mock instrumenté (request-received). Anomalie
  intermittente de boot persiste (send pendant "Finishing startup…") —
  INVESTIGATE, contournée par le check.
- Captures : metric-comparison.png (native vs graphique).

## Terminé (2026-10-16, Étape 1 spike graphics)
- `src/adapter/graphics-spike.ts` + guard env dans `renderBlock`
  (RICHUI_SPIKE_IMAGE=1, jamais actif en production). PNG de test 640×200
  généré (PIL). **Aucune dépendance ajoutée.**
- **H1 VERIFIÉE** : le dispatch markdown hôte accepte et charge un
  `ImageRenderable` — `onLoad effective=blocks px=640x200` journalisé,
  image peinte en half-blocks Unicode dans le flux PTY (411 block-chars,
  7 lignes, motif visible), zéro fallback JSON en frame finale.
- **H2 VERIFIÉE** : exit 0, 0 crash pendant stream/scroll/teardown ;
  16 constructions pour 4 blocs (re-render par delta, D6 confirmé) ;
  latence construct→onLoad < 3 ms (protocole blocks).
- **H3 VERIFIÉE** : protocole effectif observable (blocks en PTY
  xterm-256color, attendu). 1 séquence de détection kitty + 1 sixel dans
  le flux (query terminal), zéro émission de rendu kitty/sixel.
- Preuve visuelle : `spike-comparison.png` (source vs rendu blocks).
- 111/111 tests verts (spike env-gated inactif par défaut).

## Terminé (2026-10-16, après-midi)
- **Itération design ChatGPT (skill ai-cowork) : APPROVED au tour 2.**
  - Tour 1 : `VERDICT: ITERATE`, 9 points priorisés ; [P0-3] (masquer le JSON
    incomplet au streaming) **VETOED** sur règle AGENTS.md explicite (fallback
    obligatoire, contenu jamais perdu) → accepté par ChatGPT au tour 2.
  - Changements appliqués : bordures **neutres** (token border du thème, le
    tone ne porte plus que le titre — `theme.ts paletteFor`) ; metric
    same-line « value … ▲ delta » right-aligned si ça tient, 2 lignes sinon,
    value **bold** (`createTextAttributes`, API publique confirmée) ; table :
    règle interne **muted** + cellules purement numériques right-aligned
    (`/^-?\d+(?:[.,]\d+)?$/`, mono-ligne, headers exclus).
  - Tests : **111/111 verts** (1877 assertions) — +2 tests frame peinte
    (same-line + borne exactly-fits/inner−1), assertion table alignement droit
    mise à jour, test border-token neutre ajouté. tsc strict 0 erreur.
  - Review adversariale Reviewer : **mergeable**, 0 blocant (6 invariants
    vérifiés dont destroy-on-failure et exactOptionalPropertyTypes) ; R1/R3
    corrigés avant commit, R2 → W-05, R4 → cette mise à jour.
  - Preuves : sheets PNG `design-sheet{-v2}.png` (harnais, renderer pyte→PIL)
    envoyés à ChatGPT (thread dédié) ; conversation ouverte via
    browser-debug (port 9222).

## Terminé (2026-10-16, matin)
- **Lot 1 committé** : `603cc84` `feat: add Metric and Table components with
  shared box chrome` (22 fichiers, +1709/-228) sur `origin/main`.
- **Gate ratifié par l'utilisateur → Lot 1 (Metric + Table) livré.**
- Composants : `metric.ts` (value accent, delta ▲/▼ par signe, label bordure/
  muted), `table.ts` (colonnes au contenu, wrap par cellule, cap post-wrap,
  header accent + règle), `chrome.ts` (chrome bordered/compact partagé,
  extrait du panel — move pur, 60 tests Phase 0 inchangés verts).
- Parser : coercition JSON (number/boolean → texte), caps metric (80/40) et
  table (8 colonnes / 200 rows → `truncatedRows` / cellule 500), fails précis.
- Review adversariale : 2 HIGH corrigés (débordement compact multi-colonnes
  → colonnes de droite masquées ; notices non clampées → `truncateToWidth`
  au canevas, y compris notice interne de `hardWrap`), + CR→LF dans sanitize,
  titre table rendu en compact, value metric accent en compact.
- Tests : **108/108 verts** (1871 assertions) — 8 tests narrow de régression
  ajoutés après fix (frames peintes, non circulaires). tsc strict 0 erreur.
  Budget anti-complexité du test perf porté à 8 s (bruit machine mesuré
  180 ms–3,5 s ; régression quadratique ≈ 10-60 s).
- E2E Lot 1 PROUVÉ (preuve E9) : mock étendu à 4 blocs `richui` — metric ▲
  94.2% et table peints inline (balayage pyte), zéro repli textuel en frame
  finale, à 110 et 60 col.
- Docs : REPORT (§2 108 tests, E9, §6 Lot 1, §7 lots suivants), README
  (formats metric/table, 108 tests), docs/ai/.

## Bloqué
- (rien)

## Prochaine action
- Push du commit design + Lot 2 (Chart + cache last-good) si l'utilisateur
  valide ; industrialisation possible avant.
