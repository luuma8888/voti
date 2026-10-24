# Espaces & groupes — Voti v0.6

Autorité : `VOTI_SPACES_GROUPS_V0_6_SPEC.md`. Développement et recette automatisée
locaux uniquement ; aucune migration ni publication de production dans ce lot.

## Deux usages indépendants

Le mode libre v0.5.1 reste sans compte et sans garantie d’unicité par personne.
Les anciens sondages restent libres ; aucune conversion obligatoire.
« Espaces & groupes » est une zone séparée de la bibliothèque locale.

Un Espace possède des Groupes et des Membres. Un membre peut appartenir à plusieurs
groupes. Son nom/pseudonyme est du texte Unicode de 1 à 60 caractères, non vérifié.
Deux membres peuvent avoir le même pseudonyme.

## Gestion et rôles

- Administrateur : groupes, membres, cartes, invitations, accès de gestion et sondages.
- Créateur : sondages de tout l’Espace ou des groupes attribués ; pas de gestion des membres.
- Participant : sa Carte Voti, ses sondages et ses résultats autorisés ; jamais la gestion.

Les accès de gestion sont des capacités secrètes distinctes des cartes. Leur fichier
versionné peut être exporté/importé explicitement ; l’import vérifie le relais et
ne remplace pas un accès différent sans confirmation. Aucun e-mail/mot de passe.
L’administrateur peut archiver l’Espace, sans réactivation dans cette version :
les cartes et créateurs ne peuvent plus y accéder ; un administrateur peut encore
consulter/retirer les sondages conservés. Pas de suppression totale d’Espace v0.6.

## Sondages et snapshot

Création d’un brouillon distant, édition question/description/2–6 choix/règles/audience,
puis publication. Zéro groupe sélectionné cible tout l’Espace ; sinon l’union des
groupes sélectionnés. Un créateur limité doit sélectionner des groupes autorisés.
La publication fige les membres actifs éligibles, sans doublon multi-groupe.
Les nouveaux membres/mutations de groupe ne changent pas ce snapshot.

### Interface locale v0.6.1

La création propose « Pas à pas » (question/réponses, participants, résultats,
récapitulatif) et « Création rapide ». Ce sont les mêmes champs, conservés en mémoire
en passant d'un mode/étape à l'autre, et la même construction/validation de brouillon.
Le brouillon n'est enregistré au relais qu'avec « Créer le brouillon ».
En Vote simple, la visibilité des commentaires est désactivée, sans réécrire sa valeur.

Groupes existants et ajout d'un groupe sont séparés. Les membres sont présentés en
cartes ; un changement de nom ou d'affiliation est signalé comme non enregistré.
Il faut explicitement « Enregistrer le membre ». Aucun groupe n'est inventé.
Les liens de gestion vote/partage/résultats sont des actions distinctes.

Le déplacement d’un brouillon déjà créé vers un autre Espace n’est pas implémenté :
abandon explicite et recréation dans le bon Espace. Un transfert nécessiterait une
autorisation distincte sur source et destination ; aucune délégation inter-Espaces
implicite ni nouveau protocole de double capacité n’a été inventé pour contourner cela.

L’audience de vote est figée dès publication ; les autres réglages sémantiques,
y compris audience des résultats et commentaires, restent modifiables jusqu’au
premier vote. Le premier vote verrouille immédiatement le hash, sans inclure le style.
Images métier distantes refusées ; les médias du Studio restent locaux, sans R2.

Une carte, même régénérée ou utilisée depuis plusieurs appareils, ne permet qu’une
participation **par membre et par sondage contrôlé**. Ce n’est pas une preuve d’identité
civile : un administrateur peut créer plusieurs membres pour une même personne.

## Résultats

Le plancher `minimumResponses` reste obligatoire dans les quatre modes :

| Mode | Condition supplémentaire au plancher |
| --- | --- |
| threshold | aucune |
| all_eligible | X = Y du snapshot |
| closed | sondage fermé |
| all_eligible_or_closed | X = Y ou sondage fermé |

`resultsAudience=poll_audience` autorise les membres du snapshot munis d’une carte
active ; `admins_only` réserve les résultats à la gestion autorisée. Une personne
hors snapshot ne reçoit pas la définition privée ni les résultats. Un QR résultats
demande la carte ; il n’est pas un accès public inconditionnel.

Un minimum supérieur à Y peut rendre les résultats indisponibles définitivement.
Révoquer un membre non-votant conserve Y et peut empêcher `all_eligible` : aucune
réduction automatique du seuil/snapshot. Choisir explicitement une règle adaptée
avant le premier vote. L’administration anonyme voit X/Y, jamais une liste nominative.

L'écran de gestion indique l'état des résultats sans changer l'autorisation serveur.
Le participant voit un message spécifique si les résultats sont réservés à
l'administration. Sans compteur autorisé, les messages exposent les conditions
(minimum et participation de tous/fermeture), pas un décompte caché ni une déduction.
« Quand tous ont participé, ou dès la fermeture » remplace le raccourci « OU clôture » ;
le minimum de confidentialité reste obligatoire dans les deux cas.

## Invitations et bornes

Invitations individuelles : maximum une utilisation. Invitations de groupe : 1–200
utilisations, fermeture explicite, expiration choisie 1–30 jours. L’acceptation crée
atomiquement le membre, ses affiliations et sa carte. Retry du même dossier idempotent.
Les secrets d’invitation ne sont pas récupérables depuis leur digest ; distribuer le
QR lors de la création, sinon créer une nouvelle invitation.

v0.6.1 : un récapitulatif puis une confirmation indiquent les groupes ciblés, le
maximum d'usages et la durée. Sans groupe, il est écrit explicitement que le membre
sera dans l'Espace uniquement. Après création, le QR SVG et le lien SECRET peuvent
être téléchargés/copiés pendant cet écran ; leur indisponibilité ultérieure est annoncée.
« Retour à l'Espace » fonctionne aussi lorsque l'URL cible est déjà la route courante.
Les exports de gestion distinguent Espace, Administrateur/Créateur et périmètre dans
leur nom de fichier, jamais la capacité.

Bornes techniques v0.6 par Espace : 200 membres (y compris révoqués), 20 groupes
(y compris archivés), 20 accès de gestion, 40 invitations non nettoyées, 200 sondages.
Ces limites bornent les projections et les transactions ; ce ne sont pas des quotas
commerciaux. Le cron nettoie les invitations fermées/expirées par lots de 25.

## Suppression et sauvegarde

Libre : « Supprimer de cet appareil », « Supprimer en ligne », « Supprimer partout ».
Le retrait local fonctionne même sans réseau ou après disparition distante ; il
retire réellement votes/commentaires/participations locaux et le rattachement.
Le nettoyage d’un média qui échoue n’empêche pas le retrait de la copie : avertissement
de reprise. Les designs restants sont supprimables dans Sauvegarde.

Espace : pas de copie métier locale ni de bulletins locaux ; suppression en ligne
supprime aussi snapshot/consommations/participations/commentaires. « Partout » retire
en plus le design local. Les PDF/cartes déjà téléchargés ne peuvent pas être effacés
à distance. Abandon d’un brouillon et expiration des préparations 24 h conservés.

Le backup JSON général reste celui du mode libre : Espaces, cartes, accès de gestion,
designs d’affiches et historique distant ne sont pas inclus. Exporter séparément les
accès de gestion ; conserver les cartes imprimées comme des secrets.

Voir `MEMBER_CARDS_V0.md` et `GROUP_VOTING_PRIVACY_V0.md` pour les limites de sécurité.
## Gestion de l’Espace — présentation v0.6.2 locale

L’ouverture d’un Espace mène à un **Aperçu**, avec ses groupes, membres et sondages
ouverts. La navigation sépare **Sondages, Membres, Groupes, Invitations et Accès**.
Une seule section est affichée à la fois. **Réglages** rassemble le nom de l’Espace,
l’export de son accès personnel et l’archivage.

Les listes montrent des lignes compactes. **Voir / Gérer** ouvre une fiche dédiée ;
les champs et actions de révocation restent dans cette fiche, avec les confirmations
existantes. Les boutons d’ajout ouvrent une tâche distincte : les formulaires ne
restent plus sous les listes. Les liens natifs permettent de revenir sans reload.

Les Créateurs ne voient que leurs groupes et sondages autorisés. Aucun compteur
de membres n’est inventé lorsqu’ils n’ont pas accès à cette liste. Les informations
complémentaires des vingt premiers sondages sont chargées par les lectures de
gestion déjà autorisées ; au-delà, ouvrir **Gérer**. Aucun contrat serveur ne change.

La création propose **Guidée** (question, réponses, qui participe, comment participer,
résultats, vérifier), **Express** (question/réponses/audience) et **Réglages avancés**
en secondaire. Express prépare un vote anonyme simple, sans commentaire, avec
résultats après au moins 2 réponses pour les membres concernés. Le minimum reste
2 même pour un seul membre éligible : les résultats restent alors protégés.
Un même formulaire
et constructeur servent les trois présentations ; changer de mode conserve les
saisies, y compris les réglages personnalisés si l’on revient à Guidée/Avancé.
Quitter la tâche ne sauvegarde pas un brouillon intermédiaire. Cette présentation
est locale ; sa refonte visuelle a été validée par Lu’uma avant le dernier
ajustement des défauts Express. Aucun déploiement v0.6.2 n’est effectué.

### Polissage local post-commit

L’entrée propose une liste **Mes Espaces** : nom et rôle, **Ouvrir** en premier,
retrait de l’accès dans **Plus d’actions**, avec confirmation conservée. Créer un
Espace s’ouvre à la demande ; l’import reste distinct avec un vrai sélecteur de
fichier natif présenté par un label stylisé accessible.

Dans le même Espace, header/navigation et emplacement central restent montés :
une lecture asynchrone remplace seulement le contenu central par un chargement
local. Chaque section relit les données et les droits ; aucune autorisation n’est
mise en cache pour éviter le flash. Historique et contrôles Créateur sont conservés.
Les largeurs partagées et le footer suivent les pages fluides, avec formulaires
bornés. Les tests locaux ne remplacent pas une nouvelle recette humaine.

## Illustrations intégrées — évolution locale

Créer/ouvrir une fiche membre ou groupe → Choisir/Changer l'illustration → dialogue
visuel → valider le choix provisoire → Enregistrer la fiche. NULL/Aucune illustration
reste possible et aucune attribution automatique n'est faite. Les listes utilisent
les icon compacts ; les fiches les large, humains verticaux sans crop. Le bouton du
groupe devient Enregistrer le groupe (nom et illustration), commande renameGroup
inchangée avec champ optionnel visualId. Rôles et périmètres restent inchangés.


## Présentation locale et modifications de fiche

Membres et Groupes proposent Liste (icon compact) ou Vignettes (medium en contain,
lazy/async). Deux préférences locales séparées mémorisent uniquement le mode, pas
les noms, IDs de membres ou credentials. Aucun large n’est utilisé dans les listes.

Les fiches existantes modifiables comparent nom, illustration et affiliations à
leur état persisté. Une barre de sauvegarde apparaît dès qu’une valeur diffère,
sticky en haut sur ordinateur et en bas sur téléphone. Annuler restaure toutes
les valeurs de cette fiche. Une erreur conserve les saisies et le message dans
la barre ; une réussite revient clean. Changer de section ou quitter une fiche
dirty demande de continuer ou d’abandonner ; recharger/fermer utilise la confirmation
native du navigateur. Les rôles et le CAS serveur existants restent inchangés.

## Cartes d’une session administrateur

Membres distingue le lot de cartes déjà disponibles (réimpression sans mutation)
et **Gérer les cartes** (sélection volontaire pour créer/remplacer après confirmation).
La sélection survit au changement Liste/Vignettes. L’émission s’arrête au premier
échec et affiche les réussites partielles ; une carte non confirmée est exclue du
PDF jusqu’à vérification. Le lot mémoire reste disponible après navigation SPA,
pas après rechargement. Aucun credential brut n’est persisté. Voir MEMBER_CARDS_V0.
