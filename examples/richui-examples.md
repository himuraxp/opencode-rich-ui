# Exemples de blocs `richui` — Phase 0 (Panel)

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

## Comportement de repli (fallback)

Un bloc `richui` dont le contenu n'est PAS un JSON valide reste affiché comme
un code block ordinaire — le contenu n'est jamais perdu ni altéré :

```richui
ceci n'est pas du JSON — le bloc reste un code block par défaut
```

## Hors périmètre Phase 0

Les composants `metric`, `table`, `chart` et `review` sont prévus par
l'architecture (`src/core/schema.ts` union, couche `components/`) mais ne
seront développés qu'après ratification du POC (gate de validation).
