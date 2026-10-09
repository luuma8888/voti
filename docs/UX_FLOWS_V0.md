# UX_FLOWS_V0.md — Voti

## 1. Principes

- mobile-first ;
- création compréhensible vers 10 ans ;
- vote compréhensible vers 6 ans ;
- une décision principale par écran ;
- gros boutons tactiles ;
- vocabulaire quotidien ;
- options expertes séparées ;
- pas de jargon électoral inutile.

## 2. Accueil

Actions principales :

```text
Créer un sondage
Voter
Mes sondages
```

Pour le MVP local, `Mes sondages` liste les sondages de démonstration/localement disponibles.

## 3. Création simplifiée

### Écran 1 — Question

Titre :
`Que veux-tu demander ?`

Exemple :
`Quel jeu choisit-on vendredi ?`

Action :
`Continuer`

### Écran 2 — Choix

Titre :
`Quelles réponses proposes-tu ?`

Afficher 2 choix minimum.

Actions :
- ajouter une réponse ;
- supprimer une réponse tant qu’aucun bulletin n’a été accepté, même après publication ;
- réordonner.

Limiter à 6 dans le MVP.

### Confidentialité du prototype

Pas de choix nominatif. Indiquer simplement : aucun nom demandé ; les données restent dans ce navigateur et peuvent être inspectées par le propriétaire de l’appareil. Ne pas promettre un secret fort.

### Écran 4 — Résultats

Titre :
`Quand montrer les résultats ?`

Option MVP principale :

`À partir de [5] réponses`

Autre option :
`Quand le sondage est terminé ET le minimum de réponses atteint`

### Écran 5 — Vérification

Résumé :
- question ;
- choix ;
- limites du prototype local, sans nom demandé ;
- règle de résultats.

Boutons :
`Modifier`
`Créer le sondage`

## 4. Écran sondage créé

Afficher :

- état ;
- indication que le vote fonctionne dans ce navigateur uniquement ;
- bouton `Ouvrir le vote` ;
- bouton `Voir les résultats` ;
- bouton `Modifier`.

Si aucun vote :
`Modifier` permet le fond.

Après premier vote :
`Modifier` devient `Modifier l'apparence` pour les propriétés verrouillées.

## 5. Vote enfant

Écran unique autant que possible :

```text
QUESTION

[ grande carte choix A ]
[ grande carte choix B ]
[ grande carte choix C ]

[ Continuer ]
```

Puis confirmation :

```text
Tu choisis :
CHOIX B

[ Oui, je confirme ]
[ Retour ]
```

Puis :

```text
Merci !
Ton vote a bien été enregistré.
```

Éviter d’afficher immédiatement les résultats sauf règle explicite.

## 6. QR pré-sélectionné

Parcours futur : aucun QR n’est généré dans la fondation locale. Voir `LOCAL_MVP_DECISIONS.md`.

Après scan :

```text
QUESTION

Tu as scanné :
[ CHOIX B ]

[ Confirmer mon vote ]
[ Voir les autres choix ]
```

Le choix doit rester modifiable avant confirmation si le sondage l’autorise.

## 7. Résultats verrouillés

Exemple :

```text
Les résultats ne sont pas encore disponibles.

Ils apparaîtront à partir de 5 réponses.
```

Si configuré pour masquer le compteur actuel, ne pas afficher :
`3 réponses reçues`.
Ce masquage est le comportement par défaut, y compris dans la liste et l’espace créateur. La fermeture ne dispense jamais du seuil.

## 8. Résultats disponibles

Afficher :
- question ;
- total ;
- barres ou anneau simple ;
- nombre + pourcentage ;
- aucune animation trompeuse.

## 9. Téléphone collectif — futur

Écran spécial après vote :

```text
Merci !

[ Participant suivant ]
```

Retour automatique possible après quelques secondes.

## 10. Administration adulte — futur

Ne pas mélanger avec le parcours enfant.

Sections futures :
- contexte ;
- groupes ;
- comptes ;
- droits ;
- sauvegardes ;
- synchronisation ;
- relais.

## 11. Accessibilité

Prévoir dès le prototype :
- cible tactile large ;
- contrastes suffisants ;
- texte redimensionnable ;
- pas d’information portée uniquement par la couleur ;
- focus visible clavier ;
- labels accessibles ;
- possibilité future de lecture vocale.

## 12. Test UX initial

Faire tester le prototype sans expliquer.

Observer :
- où l’utilisateur clique en premier ;
- hésitation ;
- erreurs ;
- compréhension de « secret » ;
- compréhension de la confirmation ;
- compréhension du seuil de résultats.
