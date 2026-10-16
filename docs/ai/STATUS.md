# STATUS

## En cours
- (rien — itération design committée en attente de push)

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
