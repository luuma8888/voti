# Voti — Recette humaine des sondages dans un Espace

Date de consolidation : **25 octobre 2026**.

HEAD de référence vérifié : `ade085dbd7f6cb7db2760db10a4866ec3bc35ee9`, branche `main`.

## 1. Objet et statut

Ce rapport rassemble les validations humaines et les réserves exprimées par
Lu’uma pendant les deux parcours Sondage de cette conversation : création guidée,
puis création Express. Il ne constitue pas un nouvel audit général de Voti.

**Résultat : deux configurations précises validées humainement.** Des corrections
de présentation restent nécessaires ; une évolution du minimum recommandé a été
acceptée pour un prochain lot. Aucune de ces corrections ou évolutions n’est
implémentée par ce rapport.

Les observations humaines sont la source des résultats de recette. Les tests et
le code du HEAD ont servi à préparer les gestes et les attentes. Un résultat
automatisé n’est jamais compté comme une validation humaine.

## 2. Conditions de réalisation

- Espace fictif existant : **Espace test v0.6**, conservé en production pour essais humains.
- Gestion avec l’accès Administrateur existant, sur Chromebook.
- Participation sur téléphone ; cartes existantes de membres fictifs.
- QR des cartes affichés à l’écran du Chromebook : **aucune impression papier**
  réalisée pour cette passe.
- Groupe ciblé : **Groupe Soleil**, avec trois membres éligibles à chaque publication.
- Aucune création/régénération de carte nécessaire à cette recette.
- Aucun credential, QR secret, lien d’accès secret ou identifiant technique privé
  n’est reproduit dans ce document.

Les zones Membres, Groupes, identités visuelles, Liste/Vignettes, Cartes Voti,
fonds/mosaïques, lots de cartes et PDF restent hors chantier. Leur utilisation
pour entrer dans le vote ne vaut pas nouvelle recette exhaustive de ces zones.

## 3. Scénario A — Création guidée, résultats après tous ou fermeture

### Configuration

| Élément | Valeur validée |
|---|---|
| Question | Quelle activité vendredi ? |
| Réponses | Parc / Cinéma / Jeux |
| Création | Guidée, six étapes |
| Audience | Groupe Soleil uniquement |
| Éligibles à la publication | 3 |
| Participation | Anonyme, vote simple |
| Résultats | Tous les membres concernés ont participé OU fermeture |
| Minimum | 2 |
| Destinataires des résultats | Membres concernés |

### Validations humaines acquises

| Phase | Comportement observé et validé |
|---|---|
| Entrée | Écran de choix Guidée / Express / Réglages avancés, dans le bon Espace |
| Guidée | Six étapes cohérentes : question, réponses, participants, participation, résultats, vérification |
| Réponses | Ajout d’une troisième réponse ; Parc, Cinéma et Jeux correctement récapitulés |
| Audience | Sélection de Groupe Soleil uniquement |
| Participation | Vote simple ; visibilité des commentaires désactivée |
| Vérification | Résumé conforme aux choix effectués |
| Brouillon | Enregistrement, écran de gestion et statut de publication en attente |
| Publication | Sondage ouvert, compteur 0 sur 3 |
| Reprise | Après fermeture des onglets pour la nuit, sondage retrouvé ouvert à 0 sur 3 |
| Accès au vote | Présentation d’une Carte Voti requise avant les réponses |
| Carte | Pseudo Soleil A temporairement reconnu et affiché |
| Premier vote | Soleil A choisit Parc ; confirmation puis succès, pseudo effacé de l’écran ; gestion à 1 sur 3 |
| Deuxième vote | Soleil B choisit Cinéma ; succès sans pseudo résiduel ; gestion à 2 sur 3 |
| Avant fermeture | Résultats encore indisponibles à 2 sur 3 malgré le minimum de 2 atteint |
| Fermeture | Fermeture confirmée ; sondage fermé à 2 sur 3 |
| Résultats | Parc : 1 / Cinéma : 1 / Jeux : 0 ; aucune identité associée aux réponses affichées |
| Non-votant | Troisième membre ciblé : sondage fermé, aucun vote possible, résultats consultables |
| Sortie | Terminer ramène à Mes sondages, sans identité participante résiduelle affichée |

### État final rapporté

**Fermé — 2 participations sur 3**, résultats disponibles. Le sondage est conservé.

La distinction entre minimum de confidentialité et condition d’affichage a été
discutée et comprise : le minimum de 2 reste utile en cas de fermeture anticipée.
Le blocage à 2 sur 3 avant fermeture n’est pas une anomalie de calcul.

## 4. Scénario B — Express, brouillon modifiable, résultats pendant l’ouverture

### Configuration

| Élément | Valeur validée |
|---|---|
| Question initiale | Quelle activité vendredi ? — Express |
| Question après édition | Quelle activité pour vendredi ? — Express |
| Réponses | Parc / Cinéma |
| Création | Express |
| Audience choisie | Groupe Soleil uniquement |
| Éligibles à la publication | 3 |
| Participation | Anonyme, vote simple |
| Résultats | À partir du minimum de participations (`threshold`) |
| Minimum Express actuel | 2 |
| Destinataires des résultats | Membres ciblés (`poll_audience`) |

### Validations humaines acquises

| Phase | Comportement observé et validé |
|---|---|
| Express | Question, réponses et audience ; pas de formulaire complet de réglages |
| Explication | Note annonçant anonyme, vote simple, résultats après au moins 2 réponses |
| Brouillon | Création et récupération des réglages recommandés dans la gestion |
| Édition | Modification de la question puis Enregistrer les règles ; nouveau titre conservé, brouillon et autres réglages conformes |
| Publication | Nouveau sondage ouvert à 0 sur 3 ; aucun vote du premier sondage repris |
| Premier vote | Soleil A : Parc ; compteur 1 sur 3, résultats indisponibles |
| Deuxième vote | Soleil B : Cinéma ; compteur 2 sur 3 |
| Différence décisive | Résultats disponibles immédiatement à 2 sur 3 alors que le sondage reste ouvert |
| Résultats | Parc : 1 / Cinéma : 1, sans noms de participants |

Le premier vote a été une mise en place nécessaire, pas une nouvelle validation
du mécanisme de vote déjà acquis. La nouvelle couverture porte sur Express,
l’édition du brouillon et la libération des résultats au seuil sans fermeture.

### État final rapporté

**Ouvert — 2 participations sur 3**, résultats disponibles. Le sondage est conservé.
La fermeture et le troisième vote ne sont pas réalisés pour ce scénario.

## 5. Corrections UX à traiter dans un prochain lot

Ces neuf sujets sont des observations ou demandes humaines. Ils n’annulent pas
les validations fonctionnelles ci-dessus et ne doivent pas conduire à modifier
silencieusement les règles métier.

### UX-01 — Espacement des boutons et contrôles

**Observation :** des boutons se touchent ou sont trop rapprochés, avec une
impression visuelle maladroite. Le problème est signalé sur plusieurs pages.

Exemples confirmés :

- Publier pour les membres / Abandonner le brouillon ;
- Continuer au contact du dernier choix radio de la liste de réponses ;
- Résultats / Terminer sur l’écran participant du sondage fermé.

**Attendu :** espacement cohérent des contrôles voisins sur les pages concernées,
y compris les groupes d’actions et les limites de formulaires. Vérifier desktop
et téléphone. Ne pas se limiter à corriger les trois exemples isolément.

### UX-02 — Disponibilité directement liée à l’action Résultats

**Observation :** le bouton reste cliquable sans signal clair de disponibilité.
Un message comme « Minimum de confidentialité non atteint » existe ailleurs,
mais son lien avec Résultats n’est pas compris. Il faut encore ouvrir la page
pour découvrir si elle est utile.

**Attendu :** présenter disponibilité et motif directement au niveau de l’action
Résultats, de manière compréhensible sans clic exploratoire.

**À concevoir :** état du bouton, statut associé et accès éventuel à l’explication.
La désactivation systématique du bouton n’a pas été décidée ; ne pas la présenter
comme une spécification déjà validée.

### UX-03 — Remonter le suivi des participations

**Observation :** « 0 participations sur 3 » est tout en bas, après une édition
très haute ; l’information de suivi est difficile à trouver.

**Attendu exprimé :** placer ce bloc en haut de la gestion, avant l’action
Fermer le sondage, avec les informations d’état utiles.

### UX-04 — Édition repliable, fermée par défaut

**Observation :** le formulaire d’édition occupe une grande hauteur et masque
les fonctions de suivi et d’administration courantes.

**Attendu exprimé :** bloc d’édition pliable/dépliable, fermé par défaut.
Préserver toutes les capacités et les règles existantes d’édition/verrouillage.

### UX-05 — Message concret sur l’attente des résultats

**Observation :** « Le minimum de confidentialité est atteint » donne l’impression
que plus rien ne devrait bloquer les résultats. La condition complémentaire est
mal comprise malgré la présence du texte explicatif.

**Formulation proposée et acceptée pour le cas testé :**

> 2 personnes sur 3 ont participé. Les résultats seront disponibles après la dernière participation, ou si tu fermes le sondage.

**Attendu :** distinguer clairement la protection minimale et le moment de
publication des résultats, sans changer le calcul. Adapter le texte aux compteurs
et à la règle réelle ; ne pas appliquer ce message au mode threshold ou aux
résultats réservés à l’administration.

### UX-06 — Expliquer que les réglages Express sont ajustables ensuite

**Observation :** le fait de pouvoir modifier les réglages recommandés sur
l’écran suivant n’est découvert qu’après création du brouillon. Cette possibilité
est appréciée une fois comprise.

**Attendu :** compléter la note Express pour annoncer cette possibilité avant
la création. Le texte exact reste à rédiger ; exemple de sens attendu :
« Tu pourras ajuster ces réglages sur l’écran suivant, avant de publier. »

### UX-07 — Distinguer résumé du sondage et bloc d’édition

**Observation :** la lecture du sondage et les champs qui permettent de le
modifier ne sont pas assez séparés visuellement.

**Attendu :** identifier clairement le résumé/l’état courant et l’espace de
modification. À articuler avec UX-03 et UX-04, sans refaire l’architecture Espace.

### UX-08 — Distinguer essentiels et réglages d’affinage

**Observation :** question/réponses et paramètres plus avancés ont une
présentation trop uniforme.

**Attendu :** hiérarchiser les éléments courants/essentiels et les réglages
d’affinage. Lu’uma évoque des blocs ou couleurs différents ; aucune solution
graphique précise n’est encore arrêtée. La distinction doit rester compréhensible
sans dépendre uniquement de la couleur.

### UX-09 — Rendre l’enregistrement évident et confirmer son résultat

**Observation :** il faut chercher Enregistrer tout en bas. Le bouton blanc est
peu saillant ; le besoin d’enregistrer n’est pas clair. L’action donne l’impression
d’un rechargement, sans confirmation de succès autre que la valeur retrouvée.

**Attendu :**

- rendre perceptible qu’une modification attend un enregistrement ;
- rendre l’action d’enregistrement visible et accessible sans recherche en bas ;
- afficher clairement la progression, le succès ou l’échec de l’enregistrement ;
- conserver les saisies en cas d’erreur et éviter les ambiguïtés après actualisation.

La cause technique d’un éventuel rechargement complet n’a pas été diagnostiquée
pendant cette recette. Le code appelle une actualisation de la vue après mise à
jour ; le constat humain porte sur l’effet perçu et l’absence de retour clair.
Aucun choix entre barre sticky, action en tête ou autre dispositif n’est acté ici.

## 6. Évolution produit acceptée — minimum recommandé proportionnel

### État actuel réellement testé

- Express : minimum proposé fixe de **2**.
- Guidée / Avancé : minimum initial historique de **5**, modifiable.
- Dans le scénario guidé, le minimum a été réglé manuellement à 2.

### Décision retenue pour un futur lot

Remplacer ces valeurs par défaut fixes par :

```text
minimum recommandé = max(2, ceil(0.25 × N))
N = nombre de membres éligibles distincts de l’audience ciblée
```

- **25 %**, arrondi au supérieur ; la proposition initiale de 10 % est remplacée.
- Plancher du calcul recommandé : **2**, sans réduction automatique à 1.
- Pas de double comptage des personnes appartenant à plusieurs groupes ciblés.
- Recommandation modifiable avant publication.
- Cela remplace les défauts 2 et 5 ; la règle n’est pas encore implémentée.
- Avec un seul éligible, la recommandation reste 2 : la participation de tous ou
  une fermeture ne doit pas contourner ce minimum.

| Éligibles distincts | Minimum recommandé futur |
|---:|---:|
| 0 ou 1 | 2 ; aucune réduction automatique pour rendre les résultats possibles |
| 3 | 2 |
| 8 | 2 |
| 9 | 3 |
| 12 | 3 |
| 20 | 5 |
| 21 | 6 |
| 100 | 25 |

### Détails restant à spécifier avant implémentation

- Moment du calcul pendant le brouillon et synchronisation avec l’audience
  effectivement figée à publication.
- Comportement si l’audience change après proposition de la valeur.
- Conservation d’un minimum choisi manuellement : ne pas l’écraser silencieusement.
- Présentation d’une audience vide ou dont le nombre est inférieur au plancher.
- Pas de recalcul rétroactif des sondages déjà publiés ou fermés.
- Tests de dédoublonnage multi-groupes, arrondi, petites audiences et modification
  manuelle à prévoir dans le futur lot.

La décision concerne la valeur proposée à la création, pas un remplacement des
conditions threshold / all_eligible / closed / all_eligible_or_closed. Aucune
modification des validations serveur, de l’anonymat, du snapshot ou des autorisations
n’a été décidée ou réalisée dans cette recette.

## 7. Preuves automatisées et code consulté

### Tests locaux exécutés pendant la préparation de la recette

Commandes terminées avec succès, sans échec rapporté :

```text
node_modules/node/bin/node --test --test-reporter=spec tests/space-ux.test.js tests/spaces.test.js tests/participation.test.js tests/participation-relay.test.js tests/poll-engine.test.js

node_modules/node/bin/node --test --test-reporter=spec tests/space-ux.test.js tests/spaces.test.js tests/poll-engine.test.js
```

Les sorties du lanceur indiquaient respectivement cinq puis trois fichiers PASS ;
ces nombres ne sont pas présentés comme le nombre d’assertions internes.
Ces commandes n’ont pas été relancées pour rédiger le présent rapport.

### Références du HEAD

| Référence | Comportements concernés |
|---|---|
| `web/space-poll-form.js` | Choix de parcours, six étapes, trois sections Express, validations de présentation |
| `web/space-poll-editor.js` | Champs, audience, participation et récapitulatif communs |
| `web/space-ux.js` | Défauts Express actuels, constructeur commun et motifs de résultats |
| `web/space-management.js` | Entrée Sondages et création à la demande |
| `web/spaces-ui.js` | Brouillon, publication, édition, fermeture, participant et résultats |
| `scripts/browser-space-layout.mjs` | Guidée/Avancé équivalents, Express et ses défauts, modification du brouillon |
| `scripts/browser-spaces-ux.mjs` | Guidée, publication et motifs de résultats |
| `scripts/browser-spaces.mjs` | Administration, reconnaissance de carte, vote, identité temporaire et sortie |
| `scripts/spaces-checks.mjs` | Règles sur D1 local, résultats à 2/3, fermeture, snapshot et rôles |
| `tests/space-ux.test.js` | Défauts Express, seuils, motifs, minimum 2 avec snapshot 1 |
| `tests/spaces.test.js` | Snapshot, audiences, droits et sessions |
| `tests/poll-engine.test.js` | Brouillon, publication, vote et verrouillage |
| `tests/participation.test.js` / `participation-relay.test.js` | Participation, anonymat/identifié et moteur/relais en mémoire |

Les suites navigateur/D1 ont été inspectées, pas relancées pendant cette recette
humaine. Leurs anciens PASS ne sont pas réattribués à cette passe. Aucun nouveau
build, audit bundle ou test PDF n’a été produit pour ce rapport.

## 8. Couverture acquise et limites

### Automatique et humaine pour les configurations décrites

Création guidée et Express, brouillon, modification de la question d’un brouillon
Express, publication pour un groupe, anonymat visible, vote simple à choix unique,
reconnaissance temporaire du pseudo, sortie sans identité visible, deux branches
de disponibilité des résultats, agrégats corrects et administration de fermeture.

### Automatisée, mais non revalidée humainement dans cette passe au HEAD actuel

- Réglages avancés et équivalence avec Guidée.
- Conservation des saisies lors d’un changement de présentation.
- Participation identifiée et affichage privé des identités en gestion.
- Commentaires, visibilité et modération.
- Résultats réservés à l’administration.
- Règles all_eligible seule et closed seule.
- Libération par la dernière participation dans all_eligible_or_closed.
- Snapshot maintenu malgré une évolution ultérieure des membres/groupes.
- Seconde participation refusée sur ce nouveau sondage.
- Verrouillage des modifications de fond après premier vote et style encore modifiable.
- Périmètre d’un Créateur limité et autres audiences.
- Éligible unique sous minimum 2, fermeture sous minimum et autres cas limites.

Il ne s’agit pas d’annuler les anciennes validations humaines d’autres versions.
Ces variantes ne sont simplement pas démontrées par les deux scénarios décrits ici.

### Limites de preuve

- L’absence de nom dans les résultats et dans l’interface de sortie est validée
  humainement ; ce n’est pas une inspection forensique du stockage ou de D1.
- L’anonymat structurel, les credentials et les contraintes transactionnelles
  reposent sur les contrôles techniques existants, pas sur le seul écran humain.
- Le non-votant a consulté les résultats après fermeture dans le scénario A ;
  cela ne vaut pas validation de toutes les audiences ou de tous les états.
- Pas de contrôle humain exhaustif de toutes les combinaisons règles/rôles/appareils.
- Les choix multiples ne sont pas disponibles : `shared/validation.js` impose
  `single_choice`. Ce n’est pas une branche omise de la recette d’un mode existant.
- Aucun nouveau manque de couverture automatique précis n’a été démontré par
  cette inspection ciblée ; elle ne certifie pas une couverture exhaustive.

## 9. État conservé et traçabilité

| Sondage fictif | Dernier état confirmé par Lu’uma |
|---|---|
| Quelle activité vendredi ? | Fermé ; 2/3 ; Parc 1, Cinéma 1, Jeux 0 |
| Quelle activité pour vendredi ? — Express | Ouvert ; 2/3 ; Parc 1, Cinéma 1 |

Ce tableau restitue les dernières confirmations humaines ; aucune nouvelle lecture
de production n’a été effectuée pour rédiger ce fichier.

Les créations, publications, votes et fermeture décrits ont été réalisés par
Lu’uma pendant la recette. L’assistant n’a exécuté aucune mutation de production,
aucun déploiement, aucun commit ni push pendant cette recette et sa consolidation.

Les neuf rapports historiques déjà modifiés et les fichiers personnels/non suivis
préexistants sont préservés. **Seul ce nouveau document est créé pour ce compte
rendu.** Aucun code applicatif, schéma, Worker, asset, build ou configuration n’est
modifié. Les dix sujets ci-dessus restent à traiter séparément, après cadrage du
prochain lot.
