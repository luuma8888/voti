# UX_FLOWS_V0.md — Voti

## Parcours v0.6 — modes libre et Espace

Le mode libre et son Studio/QR/PDF/commentaires restent indépendants, sans compte ni
unicité par personne. L’accueil donne une zone distincte « Espaces & groupes » et
« Présenter ma Carte Voti », sans forcer un Espace.

Gestion Espace : capacité admin/créateur séparée → groupes/membres/cartes/invitations
selon rôle → brouillon distant → réglages/audience → publication/snapshot → gestion.
Un créateur limité ne gère pas les membres ni les groupes d’un autre périmètre.
Un Espace archivé désactive cartes/créateurs, conserve l’historique, reste lisible
par son administrateur ; pas de réactivation ou suppression totale dans cette version.

Sondage d’abord : QR → Présente ta Carte Voti → caméra ou photo QR traitée localement
→ vérification relais → choix/commentaire → confirmation → vote atomique → Merci !
→ carte et identité oubliées. Carte d’abord : QR carte → Mon espace → sondage → même
parcours. Aucun secret de carte gardé dans localStorage/IndexedDB/sessionStorage.
Expiration mémoire cinq minutes, Terminer et départ de page ; pas de Rester connecté.

QR choix contrôlé valide : après carte, confirmation directe. « Autre choix »
normalise la route et ouvre la liste. Aucun vote au scan/navigation. Identifié :
nom de carte automatique, explication visible ; anonyme : aucun champ nom.
Déjà participé est individuel ; sur succès le formulaire et le profil sont détruits,
« Participant suivant » remet le téléphone dans un état neutre.

Résultats privés : QR → carte → audience et seuil/règle vérifiés par le relais.
Administrateur anonyme : X/Y et commentaires, aucune liste de votants/non-votants.
Identifié : Tous / A participé / À relancer et réponses/commentaires liés.
PDF conserve les options v0.5, noms jamais publics ni automatiquement exportés.

Suppression libre : appareil / en ligne / partout, confirmations stylisées.
Le retrait local reste possible même relais absent ou distant déjà supprimé. Un
nettoyage partiel n’empêche pas de retirer la copie ; message de reprise explicite.
Sauvegarde permet aussi de retirer les designs locaux laissés après suppression
distante. Les fichiers PDF/QR déjà téléchargés restent sur leurs appareils.
Voir `MEMBER_CARDS_V0.md` : cartes/PDF sont secrets, pas des comptes classiques.

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

Depuis v0.4A, les QR sont réservés aux sondages réellement publiés en ligne.
Le mode local seul n'invente aucun lien multi-appareils. Voir `QR_AND_POSTER_V0.md`.

Après scan :

```text
QUESTION

Tu choisis :
[ CHOIX B ]

[ Oui, je confirme ]
[ Autre choix ]
```

Depuis v0.4B, le choix valide ouvre directement cette confirmation.
« Autre choix » normalise la route publique et ouvre les réponses sans choix
imposé ; un refresh/rerender ne réapplique pas le QR abandonné.
Le scan, la navigation, le refresh et Continuer n'enregistrent aucun bulletin. Un choix QR absent
laisse tous les choix décochés et explique brièvement le problème.

### Partage créateur et transfert secret v0.4A

Depuis v0.4B, la gestion propose « QR & partager le sondage » (icône décorative)
vers une vue dédiée : QR d'accès,
de choix, de résultats, exports PNG/SVG et deux affiches PDF A4. Les QR publics
restent identiques après fermeture ; après suppression, le sondage est introuvable.

« Créer une affiche » ouvre le Studio local : type, disposition, palette,
typographie et aperçu. Depuis v0.4C : trois gros accès de partage, typographies
titre/corps prévisualisées, couleurs personnalisées explicites et sections
images/cadrage/surfaces accessibles. La correction autorisée après retour humain
organise uniquement le formulaire sur une colonne : panneau gauche étroit avec
six catégories repliables et aperçu à droite utilisant la hauteur disponible.
Le formulaire défile indépendamment. Sur petit écran, bascule Réglages / Aperçu.
Sur le partage, le QR de vote reste visible au-dessus
des boutons ; choix/résultats s’affichent dans un panneau autonome, pas un accordéon.
Aucune image du
Studio ne modifie le sondage public. La vue Résultats offre un PDF détaillé
Synthèse/Rapport uniquement lorsque les résultats sont autorisés.

Le transfert d'administration est une zone séparée SECRET, cachée par défaut.
Depuis v0.4C, l’avertissement est renforcé visuellement, sans changement des droits.
Le destinataire reçoit un fragment contenant la même clé que le fichier admin.
Le fragment est retiré immédiatement de l'URL/historique, avant toute requête.
L'écran « Clé d’administration détectée » offre Annuler et une importation
explicite ; vérification distante avant stockage, conflit confirmé par le
dialogue v0.3E. Annuler ne conserve rien. Une clé ne recrée jamais un sondage supprimé.

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

Depuis v0.4C, accueil et gestion distinguent état (Brouillon/Ouvert/Fermé) et
contexte (Local/En ligne/Publication en attente). Après suppression via Voti,
la copie conservée indique explicitement que l’ancien lien a été supprimé.
Le repère est local, distinct du modèle métier et de ses sauvegardes.

Faire tester le prototype sans expliquer.

Observer :
- où l’utilisateur clique en premier ;
- hésitation ;
- erreurs ;
- compréhension de « secret » ;
- compréhension de la confirmation ;
- compréhension du seuil de résultats.

## Participation enrichie v0.5 — locale avant audit/déploiement

Création : étape des règles → Participation Anonyme/Identifiée (non vérifiée),
Vote + commentaire facultatif/Vote simple, Privés/Publics avec résultats après
approbation. Nouveaux défauts anonymous/optional/private ; anciens sondages inchangés.

Vote normal : choix → confirmation avec commentaire facultatif et, si identified,
nom/pseudonyme obligatoire → Oui, je confirme. QR choix : même écran directement,
Autre choix retourne à la liste. Aucun envoi au scan/navigation/refresh/saisie.
Notices personnelles visibles. Contenu figé pour retry après premier envoi ; aucun
faux succès ni vote local distant de secours. Succès durable avec état du commentaire.

Gestion : Commentaires / Participations & commentaires, regroupés par choix,
lecture admin avant seuil ; public_with_results : Afficher/Masquer/Supprimer,
privés : lecture et suppression seulement. Suppression avec dialogue v0.3E,
irréversible, aucun changement des quantités de votes. Pas d'édition du texte.
Résultats : commentaires visibles sous leur choix uniquement au seuil (+ fermeture
si closed), jamais de nom public. Aucune section vide/pending/counter sous seuil.

PDF : Synthèse inchangée ; Rapport peut inclure les commentaires approuvés publics.
Identités seulement admin identified et opt-in OFF par défaut, avertissement explicite.
Les règles de résultats ne sont jamais contournées. Aucune identité vérifiée ni unicité
par personne prétendue. Voir `COMMENTS_AND_IDENTITY_V0.md`.

## Ajustements locaux v0.6.1 après recette Espaces

- Groupes existants en cartes, ajout séparé ; membres avec cases proches de leur libellé
  et message « Modifications non enregistrées » jusqu'à Enregistrer le membre.
- Création Espace : Pas à pas (question/réponses → participants → résultats →
  vérification), ou Création rapide, avec mêmes champs/validations et saisies conservées.
- Vote simple désactive la visibilité des commentaires, aussi dans le mode libre.
- Gestion : vote, QR/partage, résultats sont des boutons séparés ; état des résultats
  lisible directement. Le minimum reste obligatoire après fermeture/participation de tous.
- Participant : « À toi de participer » ; pseudo de la carte reconnu avant vote,
  uniquement dans la session mémoire existante, oublié après succès ou fin de parcours.
- Résultats admins_only : « Résultats réservés à l'administration », sans données admin.
  Pour les autres modes, conditions expliquées sans révéler de compteur masqué.
- Invitation : groupes/usages/durée récapitulés avant confirmation ; lien/QR secret
  partageables pendant l'écran, indisponibilité après sortie annoncée ; retour SPA corrigé.
- Carte : statut révoqué visible, révocation désactivée après succès, régénération possible.
  PDF individuel et lot mémoire explicitement distingués, fichiers nommés sans credential.
- Scanner : cadre et guidage rapproche/agrandis/stabilise, analyse locale bornée,
  pistes vidéo libérées à la sortie. Aucune validation physique v0.6.1 revendiquée.
## Gestion des Espaces — évolution locale v0.6.2

`Espaces → Espace → Aperçu` puis une section : **Sondages, Membres, Groupes,
Invitations, Accès**. Navigation latérale sur ordinateur, grille courte sur
téléphone. Les listes restent compactes, sans édition permanente. **Voir / Gérer**
ouvre la fiche ; **Ajouter / Nouveau** ouvre la tâche. **Réglages** rassemble nom,
export personnel et archivage. Les actions dangereuses sont repliées dans les
fiches et gardent leurs dialogues de confirmation.

Sondages → Nouveau sondage → choix **Création guidée**, **Express** ou **Réglages
avancés** (secondaire). Guidée : six étapes, question/réponses/qui/comment/résultats/
vérifier. Express : question, réponses, audience ; défauts anonyme/vote simple
sans commentaire/minimum 2/seuil/membres concernés. Aucun abaissement à 1 pour
un seul membre éligible. Avancé : tous les paramètres.
Un seul constructeur et validations ; retour entre étapes sans perte. Quitter la tâche abandonne
les saisies non créées. Les parcours participant, scanner, QR, résultats, session
temporaire et les règles serveur v0.6.1 sont conservés.

Cette présentation reste locale. La refonte visuelle est validée par Lu’uma avant
le dernier ajustement des défauts Express ; cela ne constitue pas une publication
ni une recette physique.

### Polissage local post-commit v0.6.2

Espaces & groupes → **Mes Espaces** → **Ouvrir**. Le retrait de l’accès de cet
appareil est secondaire dans **Plus d’actions**, avec confirmation. La création
d’un Espace s’ouvre à la demande ; l’import est séparé et utilise un sélecteur de
fichier accessible stylisé. Les noms de fichiers sélectionnés restent locaux.

Les transitions internes d’un même Espace gardent la coque header/navigation et
rechargent seulement la section centrale, sans cache d’autorisation. Les retours
du navigateur restent utilisables. Quitter ce contexte ou passer au participant
ne conserve pas le shell de gestion.

Émission/régénération/invitation → aperçu **Ma carte individuelle** → choix éventuel
d’un des cinq thèmes → PDF individuel ou lot disponible pendant la visite. Le nom
est dominant ; Espace/groupes secondaires ; le QR reste opaque et contrasté. Le
thème est uniquement dans la carte en mémoire. Ni coffre de credentials ni nouvelle
persistance participant. Les galeries des futurs packs prédéfinis sont masquées
tant que les vrais assets intégrés ne sont pas fournis ; aucune image personnelle
pour les membres/groupes. Voir `MEMBER_VISUALS_V0.md`.

## Identités visuelles prédéfinies — intégration locale

Fiche membre/groupe → Choisir une illustration → Tous/Créatures/Enfants/Adultes
(membres), grille icon → aperçu medium au focus/survol/tap → Choisir → Enregistrer
le membre/groupe. Fermer/Escape annule ; Aucune illustration puis validation efface
le choix. Images large verticales pour les humains sur fiche/carte ; groupes en
petites vignettes sur carte. Aucun upload ou image personnelle. Le choix reste
facultatif. Voir `MEMBER_VISUALS_V0.md` pour les conditions offline et de déploiement.
