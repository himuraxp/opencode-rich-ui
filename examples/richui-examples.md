# Exemples de blocs `richui` — Phase 0 (Panel) + Lot 1 (Metric, Table)

Ces blocs sont du Markdown ordinaire : un agent les produit sans aucun outil,
et le plugin OpenCode `opencode-rich-ui` les transforme en composants natifs
dans le TUI.

## Panel — état de déploiement

```richui
{
  "component": "panel",
  "title": "Déploiement production",
  "body": "Build #4217 déployé en 42s. Zéro downtime, healthchecks verts sur les 12 instances.",
  "tone": "success"
}
```

## Panel — alerte

```richui
{
  "component": "panel",
  "title": "Quota API",
  "body": "Le quota du provider primaire atteint 92%. Bascule sur le fallback prévue à 95%.",
  "tone": "warning"
}
```

## Panel — minimal (sans titre ni tonalité)

```richui
{
  "component": "panel",
  "body": "Un panel peut se limiter à un corps de texte simple."
}
```

## Corps multi-lignes

```richui
{
  "component": "panel",
  "title": "Résumé de session",
  "body": "3 fichiers modifiés\n12 tests ajoutés, tous verts\n1 ADR rédigé (ADR-001)"
}
```

## Metric — valeur avec delta (Lot 1)

Le `delta` avec signe en tête est rendu avec une flèche directionnelle
(`+` → ▲, `-` → ▼) ; la couleur sémantique vient du `tone`.

```richui
{
  "component": "metric",
  "label": "Couverture de tests",
  "value": "94.2%",
  "delta": "+1.3",
  "tone": "success"
}
```

## Metric — minimal (sans label ni delta)

```richui
{
  "component": "metric",
  "value": 42,
  "tone": "info"
}
```

## Table — colonnes dimensionnées au contenu (Lot 1)

Les colonnes se calent sur la plus large cellule (bornée au canevas) ;
les cellules longues wrappent dans leur colonne. L'ordre des lignes est
celui fourni (pas de tri automatique).

```richui
{
  "component": "table",
  "title": "Statut des tests",
  "columns": ["Fichier", "Statut", "Durée"],
  "rows": [
    ["parse.ts", "vert", "12ms"],
    ["width.ts", "vert", "8ms"],
    ["table.ts", "vert", "15ms"]
  ],
  "tone": "success"
}
```

## Table — nombres et booléens acceptés

Le parseur coerce les nombres et booléens JSON en texte.

```richui
{
  "component": "table",
  "columns": ["Module", "Tests", "Pass"],
  "rows": [
    ["core", 32, true],
    ["components", 18, true],
    ["adapter", 10, true]
  ]
}
```

## Comportement de repli (fallback)

Un bloc `richui` dont le contenu n'est PAS un JSON valide reste affiché comme
un code block ordinaire — le contenu n'est jamais perdu ni altéré :

```richui
ceci n'est pas du JSON — le bloc reste un code block par défaut
```

## Hors périmètre

Le composant `chart` et `review` sont prévus par l'architecture
(`src/core/schema.ts` union, couche `components/`) mais ne seront développés
que dans les lots suivants.
