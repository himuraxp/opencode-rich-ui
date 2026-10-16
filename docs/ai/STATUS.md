# STATUS

## En cours
- (rien — Lot 1 clôturé et poussé)

## Terminé (2026-10-16)
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
- Lot 2 (Chart + cache last-good) si l'utilisateur valide ; industrialisation possible avant.
