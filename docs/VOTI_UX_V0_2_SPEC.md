# Voti — UX v0.2

**Statut :** spécification UX / design  
**Objectif :** faire évoluer la fondation MVP locale vers une interface agréable, compacte, claire et scalable avant l’ajout du relais Internet.

---

# 1. Problèmes observés

La fondation actuelle fonctionne mais plusieurs points UX doivent être corrigés avant d’élargir le projet.

## 1.1 Accès aux résultats

Quand les résultats deviennent disponibles, l’accueil ne propose pas d’accès direct.

L’utilisateur doit passer par « Gérer », y compris pour un sondage fermé.

Cela rend les résultats trop cachés.

## 1.2 Accueil non scalable

La présentation actuelle empile les sondages avec peu de repères.

Avec des dizaines ou centaines de sondages, il deviendrait difficile de :

- retrouver un sondage ;
- distinguer brouillon / ouvert / fermé ;
- savoir si les résultats sont disponibles ;
- repérer les sondages récents ;
- accéder directement à l’action utile.

## 1.3 Header trop haut

Le header / hero occupe une part excessive de la hauteur de l’écran, notamment sur Chromebook ou petit écran.

Le bloc encadré :

> « Et si on choisissait ensemble ? »

est trop présent et donne une impression de prototype / carte décorative plutôt qu’une véritable application.

## 1.4 Sauvegarde JSON trop technique

L’import/export JSON est important mais ne doit pas visuellement se mélanger au fonctionnement courant.

Il faut clairement identifier une section secondaire :

> Sauvegarde & transfert

L’utilisateur ordinaire ne doit pas être confronté directement à du JSON brut.

## 1.5 Style général

L’interface actuelle est agréable mais encore trop simple / prototype.

Voti doit être :

- chaleureux ;
- ludique sans être infantilisant ;
- clair ;
- moderne ;
- utilisable par des enfants comme des adultes ;
- compact ;
- visuellement identifiable.

## 1.6 Images

À terme proche, le créateur doit pouvoir associer :

- une image au sondage ;
- une image facultative à chaque choix ;

tout en conservant TOUJOURS le texte du choix.

Cela permet notamment aux jeunes lecteurs ou non-lecteurs de reconnaître les choix.

## 1.7 Thèmes

Les thèmes actuels doivent évoluer vers des apparences plus abouties sans construire un studio graphique complexe.

---

# 2. Ligne visuelle proposée

## 2.1 Identité

Nom principal :

> Voti

Le grand encadré « Et si on choisissait ensemble ? » est supprimé.

Proposition de signature discrète, affichée seulement lorsque pertinente :

> Choisir ensemble, simplement.

La signature ne doit jamais prendre la place d’un grand hero permanent.

## 2.2 Header

Objectif :

- environ 56–72 px sur ordinateur ;
- environ 52–64 px sur mobile ;
- pas plus de ~15 % de la hauteur d’un écran standard dans l’usage courant.

Contenu possible :

```text
[Voti]          [Accueil] [Nouveau sondage] [⋯]
```

Sur petit écran :

```text
[Voti]                       [+]
```

Les actions secondaires passent dans une navigation compacte.

## 2.3 Style

Direction :

- cartes légèrement arrondies ;
- ombres très discrètes ;
- fonds sobres ;
- accent coloré ;
- espacements cohérents ;
- typographie système sans police externe ;
- boutons lisibles et généreux ;
- badges de statut immédiatement reconnaissables.

Éviter :
- gros cadres décoratifs permanents ;
- gradients excessifs ;
- énormes zones vides ;
- effets gadgets ;
- interfaces ressemblant à un back-office adulte.

---

# 3. Accueil v0.2

L’accueil devient un tableau de bord simple.

## 3.1 Zone haute compacte

```text
Voti
Choisir ensemble, simplement.

[ + Nouveau sondage ]
```

La signature peut disparaître sur très petit écran.

## 3.2 Recherche

Ajouter :

```text
Rechercher un sondage…
```

Recherche locale sur :
- question ;
- description si présente ;
- choix éventuellement.

## 3.3 Filtres rapides

Chips / boutons :

```text
Tous
Brouillons
Ouverts
Fermés
Résultats disponibles
```

Éviter une longue barre de filtres sur mobile : rendre la rangée scrollable horizontalement si nécessaire.

## 3.4 Tri

Minimum :

```text
Plus récents
Plus anciens
A–Z
```

Le tri par défaut est « Plus récents ».

## 3.5 Résumé facultatif

Une zone compacte peut afficher :

```text
12 sondages
3 ouverts
4 résultats disponibles
```

Ne pas en faire un gros dashboard analytique.

---

# 4. Représentation d’un sondage

Le mode principal doit être une liste compacte et lisible.

Éviter que chaque sondage occupe une énorme carte.

Exemple desktop :

```text
┌──────────────────────────────────────────────────────────┐
│ Quel jeu choisit-on vendredi ?        [ OUVERT ]         │
│ 3 choix · 7 réponses                                     │
│ Résultats disponibles                                    │
│                                                          │
│ [Voter] [Résultats] [Gérer]                              │
└──────────────────────────────────────────────────────────┘
```

Exemple mobile :

```text
Quel jeu choisit-on vendredi ?
[ OUVERT ]

3 choix
Résultats disponibles

[Voter] [Résultats]
[Gérer]
```

## 4.1 Statuts

Badges possibles :

```text
BROUILLON
OUVERT
FERMÉ
```

Ajouter une information distincte pour les résultats :

```text
Résultats disponibles
Résultats verrouillés
```

Ne pas confondre état du sondage et visibilité des résultats.

## 4.2 Actions contextuelles

### Brouillon

```text
Modifier
Publier
```

### Ouvert

```text
Voter
Résultats
Gérer
```

Si résultats indisponibles :

```text
Résultats 🔒
```

Le bouton peut ouvrir la page expliquant pourquoi ils sont bloqués.

### Fermé

Si résultats disponibles :

```text
Résultats
Gérer
```

`Résultats` doit être l’action la plus évidente.

Si résultats verrouillés :

```text
Résultats 🔒
Gérer
```

---

# 5. Page résultats

Lorsque les résultats sont disponibles :

- accès direct depuis accueil ;
- titre du sondage ;
- statut ;
- total de réponses ;
- graphique ;
- valeur + pourcentage ;
- bouton retour ;
- bouton gérer pour le créateur local.

Lorsque les résultats sont bloqués :

```text
Les résultats ne sont pas encore disponibles.
```

Puis expliquer simplement la règle :

```text
Ils seront visibles à partir de 5 réponses.
```

ou :

```text
Ils seront visibles lorsque le sondage sera fermé
et qu'au moins 5 réponses auront été reçues.
```

---

# 6. Sauvegarde & transfert

La sauvegarde ne doit plus ressembler à une zone métier principale.

Créer une section secondaire clairement nommée :

> Sauvegarde & transfert

Elle peut être accessible depuis :

```text
Menu / Paramètres
```

ou une zone secondaire de l’accueil.

## 6.1 Interface principale

```text
Sauvegarde & transfert

Gardez une copie de vos sondages sur votre appareil.

[ Exporter une sauvegarde ]
[ Importer une sauvegarde ]
```

Afficher éventuellement :

```text
Dernier export : non connu
```

Ne pas prétendre suivre un export si le navigateur ne peut pas le savoir de façon fiable.

## 6.2 Zone avancée

Le JSON brut n’est visible que derrière :

```text
Options avancées
```

ou :

```text
Voir les données JSON
```

Il doit être clairement identifié comme outil technique.

---

# 7. Navigation

L’utilisateur doit toujours savoir où il est.

Navigation minimale :

```text
Accueil
Nouveau sondage
Sauvegarde
```

Selon écran :

```text
← Retour
```

Éviter d’empiler de nombreux liens dans le header.

Sur mobile, une navigation simple ou menu compact est acceptable.

---

# 8. v0.2A — périmètre immédiat

Le sous-lot v0.2A implémente :

1. header compact ;
2. suppression du grand encadré « Et si on choisissait ensemble ? » ;
3. identité Voti plus propre ;
4. accueil scalable ;
5. recherche ;
6. filtres ;
7. tri ;
8. badges de statuts ;
9. informations de résultats disponibles / verrouillés ;
10. bouton Résultats directement depuis l’accueil ;
11. actions contextuelles selon statut ;
12. section Sauvegarde & transfert clairement séparée ;
13. JSON brut déplacé dans une zone avancée ;
14. amélioration générale du style ;
15. responsive ;
16. accessibilité clavier / focus / contrastes ;
17. tests automatiques adaptés.

Ne PAS ajouter dans v0.2A :

- images ;
- assets ;
- IndexedDB ;
- relais Internet ;
- QR ;
- PDF ;
- comptes ;
- Android.

---

# 9. v0.2B — images et thèmes

À réaliser après validation de v0.2A.

## 9.1 Image du sondage

Optionnelle.

Utilisations :
- couverture ;
- vignette dans la liste ;
- affiche future ;
- page de vote.

## 9.2 Image d’un choix

Optionnelle.

Le texte reste obligatoire.

Exemple :

```text
[ image Uno ]

UNO
```

L’image ne remplace jamais le libellé.

## 9.3 Stockage

Ne pas stocker naïvement de grosses images base64 dans `localStorage`.

Avant implémentation, définir :

- AssetAdapter ;
- stratégie IndexedDB Web ;
- export/import des assets ;
- limites de taille ;
- redimensionnement ;
- compression ;
- futur mapping vers stockage relais / Android.

## 9.4 Thèmes

Premiers thèmes possibles :

```text
Clair
Pop
Nature
Nuit
Douceur
Minimal
```

Chaque thème peut définir :
- palette ;
- fond ;
- coins ;
- surface ;
- accents ;
- traitement visuel des choix.

Ne pas intégrer de police distante.

---

# 10. Scalabilité

L’accueil doit rester utilisable avec :

- 5 sondages ;
- 20 sondages ;
- 100 sondages ;
- 500 sondages.

Pour v0.2A, il n’est pas nécessaire d’implémenter une virtualisation.

Mais :
- les cartes doivent être compactes ;
- recherche / filtre / tri doivent fonctionner ;
- ne pas charger des blocs visuels énormes.

Une pagination ou virtualisation pourra être ajoutée ultérieurement si nécessaire.

---

# 11. Accessibilité

Préserver :

- boutons tactiles suffisamment grands ;
- focus visible ;
- navigation clavier ;
- statuts non indiqués uniquement par couleur ;
- texte lisible ;
- contraste suffisant ;
- responsive 360 px ;
- aucune information uniquement visuelle.

---

# 12. Tests humains v0.2A

Après livraison :

1. créer 10 à 20 sondages fictifs ;
2. rechercher par mot ;
3. filtrer Brouillons / Ouverts / Fermés ;
4. trier ;
5. accéder directement à un résultat disponible ;
6. ouvrir un résultat bloqué ;
7. vérifier la section Sauvegarde ;
8. tester écran Chromebook ;
9. tester téléphone réel via GitHub Pages ;
10. vérifier que le header ne monopolise plus l’écran.

---

# 13. Critères d’acceptation v0.2A

Le lot est validé si :

- aucun gros hero ne domine l’écran ;
- l’accueil reste lisible avec au moins 20 sondages ;
- un résultat disponible est accessible directement ;
- les statuts sont visibles sans ouvrir « Gérer » ;
- recherche, filtres et tri sont fonctionnels ;
- Sauvegarde & transfert est clairement séparé du reste ;
- le JSON brut n’est plus une information principale ;
- l’interface reste légère, chaleureuse et compréhensible ;
- aucun comportement métier existant n’est cassé ;
- les tests existants restent verts.
