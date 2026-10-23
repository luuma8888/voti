# DATA_MODEL_V0.md — Voti

## Extension actuelle v0.6 — Espaces (prioritaire sur les limites historiques ci-dessous)

Le snapshot local/libre reste **version 3**, avec sauvegardes historiques compatibles.
Un sondage contrôlé distant est validé explicitement comme **Poll schemaVersion 4** :
`contextId=spaceId`, `accessRules.audience=context`, `requiresAccount=false`, champ
réservé `allowDirectChoiceQr=false`, et `pollAudience={spaceId,mode,groupIds,resultsAudience}`.
`mode=space|groups`, `resultsAudience=poll_audience|admins_only`. Un Poll v4 n’est pas
insérable dans le snapshot local libre, ni importé silencieusement par son backup.

PollDefinition conserve les champs v0.5 (anonymous/identified, commentaires) ; aucune
réécriture des définitions/hashes historiques. Le hash SHA-256 canonical existant
couvre définition + accessRules (donc audience) + resultRules, jamais style/credential.
Les règles contrôlées ajoutent `all_eligible` / `all_eligible_or_closed`, seulement
pour context ; le plancher minimumResponses reste obligatoire. L’audience de vote et
le snapshot sont figés à la publication ; le reste sémantique au premier vote.

Migration additive `0004_spaces_groups_members.sql`, sans modification de 0001/0002/0003 :
spaces, groups, space_members, group_memberships, space_access, member_credentials,
invitations, poll_audiences, poll_audience_groups, poll_member_eligibility,
member_participations et garde technique controlled_vote_guards.

**Ne pas ajouter de colonne à participations** : le Worker v0.5 utilise un INSERT
sans liste de colonnes. `member_participations(participation_id,poll_id,member_id)`
matérialise seulement le lien identifié, UNIQUE(poll_id,member_id), FK et immutabilité.
Les trois colonnes historiques Participation restent compatibles. Le code Worker
v0.6 utilise désormais des listes de colonnes explicites.

Anonyme : zéro Participation et zéro member_participations ; participation_id NULL
dans ballot/commentaire. Registre d’éligibilité uniquement poll_id/member_id/consumed,
sans actionId, digest de soumission ni temps. Identifié : nom de carte copié dans
Participation à l’acceptation, liaison au membre séparée, pas de nom demandé au client.
Admin anonyme = X/Y uniquement, identifié = roster. Audience résultats = noms masqués.

Digests SHA-256 des credentials serveur, types member/staff/invitation distincts.
Cartes brutes et projection participant en mémoire temporaire client ; seuls les
accès de gestion résident dans `voti.spaces.access.v1`, hors backup général.
Voir `SPACES_GROUPS_V0.md`, `MEMBER_CARDS_V0.md`, `GROUP_VOTING_PRIVACY_V0.md`.

## 1. Principes

Pour la fondation locale, `LOCAL_MVP_DECISIONS.md` précise les arbitrages faisant autorité.

- identifiants UUID ;
- schéma versionné ;
- logique indépendante du stockage ;
- distinction forte entre définition du sondage et style ;
- bulletins append-only autant que possible ;
- préparer la future séparation identité / bulletin sans surconstruire le MVP.

## 2. Poll

Champs proposés :

```text
id: UUID
schemaVersion: integer
contextId: UUID | null
status: draft | published | closed
createdAt: ISO datetime
publishedAt: ISO datetime | null
closedAt: ISO datetime | null
lockedAt: ISO datetime | null
definitionHash: string | null
definition: PollDefinition
style: PollStyle
accessRules: PollAccessRules
resultRules: ResultPublicationRules
stats: PollStats
```

## 3. PollDefinition

```text
question: string
description: string | null
mode: single_choice
privacy: anonymous | named
choices: Choice[]
```

Règle : après `lockedAt`, cette structure ne peut plus être modifiée.
Dans la fondation historique v1/v2, `named` était réservé et refusé.
La participation déclarée v0.5 est décrite en section 20 ; elle n'est pas une identité vérifiée.

## 4. Choice

```text
id: UUID
label: string
shortLabel: string | null
emoji: string | null
imageRef: string | null
order: integer
```

## 5. PollStyle

```text
themeId: string
accent: string | null
background: string | null
layout: string
posterVariant: string
```

Modifiable après verrouillage.

## 6. PollAccessRules

Préparer les champs futurs sans forcément tout activer dans le MVP :

```text
audience: public | context
requiresAccount: boolean
allowDirectChoiceQr: boolean
```

Pour le MVP local :
- `audience = public`
- `requiresAccount = false`
- `allowDirectChoiceQr = false`, valeur toujours forcée pour compatibilité avec le schéma historique.

Ce champ est actuellement réservé : il n'est pas utilisé comme politique
d'autorisation opérationnelle. Depuis v0.4A, un QR par choix peut présélectionner
une réponse, modifiable avant une confirmation explicite. Cette présélection
ne constitue jamais un vote direct automatique : ni le scan, ni le chargement,
ni la navigation ne créent un bulletin.

La sémantique future de `allowDirectChoiceQr` devra être décidée avant d'en
faire une véritable règle configurable. Cette clarification documentaire ne
change ni sa valeur, ni le schéma, ni les validateurs, ni l'empreinte métier ;
elle ne nécessite aucune migration. Voir `QR_AND_POSTER_V0.md`.

## 7. ResultPublicationRules

```text
minimumResponses: integer
releaseMode: threshold | closed | manual | date
releaseAt: ISO datetime | null
manualReleased: boolean
showResponseCountBeforeRelease: boolean
```

MVP minimum :
- `minimumResponses`
- `releaseMode = threshold | closed`

Valeur par défaut : `minimumResponses = 5`.
Le seuil est un plancher obligatoire pour tous les modes. `closed` exige fermeture ET seuil. `showResponseCountBeforeRelease = false` par défaut. Les modes manual/date ne sont pas actifs dans cette fondation. Toutes les règles de résultats et d’accès sont immuables après premier bulletin accepté.

## 8. Ballot

Le bulletin ne doit pas être conçu autour de l’identité.

```text
id: UUID
pollId: UUID
choiceId: UUID
```

Le bulletin historique v1/v2 contient uniquement ces trois identifiants, sans horodatage ni source. Le contrat v0.5 et son reçu de soumission sont précisés en section 20. Aucun champ arbitraire d’identité ou de métadonnées n’est accepté à l’import.

Pour un futur sondage anonyme :
- aucun `userId` dans Ballot ;
- aucune IP ;
- aucun fingerprint ;
- aucune donnée de session d’identité.

Pour un futur sondage nominatif, la liaison devra être conçue séparément afin de ne pas contaminer le modèle anonyme.

## 9. VoteEligibility — futur

```text
id: UUID
pollId: UUID
subjectRef: opaque
used: boolean
usedAt: ISO datetime | null
```

Cette entité sert à savoir qu’un droit de vote a été utilisé sans obligatoirement relier ce droit au bulletin.

Non requise dans le premier prototype local.

## 10. PollStats

État dérivable, donc ne pas considérer comme source ultime de vérité :

```text
totalBallots: integer
countsByChoice: map<choiceId, integer>
```

Le moteur doit pouvoir recalculer ces statistiques depuis les bulletins.

## 11. Context — futur

```text
id: UUID
name: string
visibility: public | private
createdAt: ISO datetime
```

## 12. Group — futur

```text
id: UUID
contextId: UUID
name: string
```

## 13. User — futur

```text
id: UUID
contextId: UUID
username: string
credentialRef: opaque
status: active | disabled
```

Aucun mot de passe en clair.

## 14. Role — futur

```text
admin
creator
user
```

## 15. SyncEvent — futur

```text
id: UUID
schemaVersion: integer
originId: UUID
entityType: string
entityId: UUID
eventType: string
createdAt: ISO datetime
payload: object
```

## 16. Invariants essentiels

1. un Poll publié possède au moins 2 choix ;
2. chaque Choice appartient à un seul Poll ;
3. un Ballot référence un Poll existant ;
4. un Ballot référence un Choice de ce Poll ;
5. premier Ballot accepté => `lockedAt` défini ;
6. après verrouillage, PollDefinition est immuable ;
7. PollStyle reste modifiable ;
8. résultats non publiables si règles non satisfaites ;
9. fermeture interdit de nouveaux bulletins ;
10. un QR pré-sélectionné ne constitue jamais un Ballot en lui-même.

## 17. definitionHash

Au verrouillage, calculer une représentation canonique de `{ definition, accessRules, resultRules }`, puis son SHA-256 avec une primitive standard. Mode/privacy sont inclus via la définition. Style, statistiques et état du cycle de vie sont exclus.

Objectifs :
- détecter modification accidentelle ;
- audit ;
- futur contrôle de synchronisation.

Ne pas utiliser ce hash comme mécanisme de sécurité autonome.

## 18. Contrat exécuté par la fondation locale

Cette section décrit le contrat historique v1. L'évolution v0.2B.2 est en section 19, le contrat v0.5 en section 20.

La sauvegarde JSON version 1 contient `{ schemaVersion: 1, polls: Poll[], ballots: Ballot[] }`.
Les validateurs de `shared/validation.js` constituent le contrat exécutable de cette livraison.
Champs inconnus, versions inconnues, identifiants dupliqués entre objets, références étrangères,
chronologie incohérente et empreinte invalide sont refusés avant écriture.

Limites techniques du prototype : question non vide de 240 caractères maximum ; description
facultative de 1 000 caractères maximum ; choix non vide de 100 caractères maximum ; seuil entier
de 1 à 100 000 ; JSON limité à 2 millions de caractères (sélection de fichier limitée à 2 Mo).
Ces limites bornent le stockage et ne constituent pas de nouveaux modes de vote.

Les styles actifs sont `mint`, `lavender`, `peach`, avec `layout = cards` et `posterVariant = none`.
Pas d'image, couleur CSS arbitraire ou référence réseau. `contextId = null`. Les règles futures
`manual`, `date`, les comptes et `named` sont refusés pour les données actives du prototype.

Les statistiques présentes dans le JSON sont un cache de forme contrôlée, toujours recalculé
depuis les bulletins à la lecture, l'import et l'export. L'import initialise uniquement un espace
vide ; toute importation dans un espace contenant déjà un sondage est refusée, sans fusion.

Le moteur conserve son état d'entrée intact et prépare un nouvel état. Le premier bulletin,
le verrouillage, l'empreinte et les statistiques sont sauvegardés dans un seul snapshot. Une
nouvelle tentative avec le même identifiant et le même choix est idempotente ; réutiliser cet
identifiant pour un autre choix est refusé. Un nouvel identifiant reste un nouveau bulletin,
sans garantie d'unicité par personne.

## 19. Évolution explicite v0.2B.2 — schéma 2 et assets

Autorité : `VOTI_UX_V0_2B_2_SPEC.md`. Le snapshot métier devient
`{ schemaVersion: 2, polls: Poll[], ballots: Ballot[] }`, chaque Poll étant en version 2.
`PollDefinition` ajoute `pollImageAssetId: string | null` ; `Choice.imageRef` accepte
désormais un identifiant d'asset ou `null`. Ces deux références sont sémantiques,
incluses dans l'empreinte existante et verrouillées dès le premier bulletin accepté.

Un identifiant d'asset est `sha256-` suivi du SHA-256 hexadécimal des octets normalisés.
Les UUID des sondages, choix et bulletins ne changent pas. Cette adresse de contenu
lie l'empreinte du sondage aux octets de l'image, pas à une URL remplaçable. Aucun
blob ni base64 dans le snapshot ; aucun champ d'image dans le style.

Migration v1 → v2 : validation exhaustive du v1 et de ses anciennes empreintes,
copie sans mutation de la source, ajout de `definition.pollImageAssetId = null`,
passage des versions à 2, recalcul de l'empreinte des seuls sondages déjà verrouillés,
puis validation v2. `Choice.imageRef` reste `null` pour tout v1 accepté. Les bulletins,
UUID, dates, statuts, styles et règles sont conservés. Le recalcul des statistiques
reste inchangé. Version inconnue, champ inattendu ou empreinte v1 altérée = refus.
La lecture migre en mémoire ; le prochain enregistrement persiste le v2 dans la clé
historique `voti.local.v1`. L'ancien fichier v1 n'ouvre pas des données v2.

Les assets utilisateur sont stockés dans IndexedDB `voti.assets.v1`, store `assets`
(en `file://`, le nom est suffixé par `:file:` et le chemin encodé pour isoler les documents) :
`{ id, formatVersion: 1, mimeType, width, height, byteLength, blob }`.
Sortie normalisée WebP, ou PNG de repli natif. Limites : 1600 px / 1 000 000 octets
pour le sondage, 1000 px / 600 000 octets pour le choix ; si une image est partagée,
la contrainte la plus stricte s'applique. Au plus 200 assets référencés distincts
et 24 000 000 octets binaires par bibliothèque. Les assets de marque restent dans le build.

Sauvegarde unique : `{ format: "voti-backup", backupVersion: 1, state, assets }`.
Dans `assets`, `blob` est remplacé par `base64`. Une seule entrée par ID référencé ;
assets absents, dupliqués, non référencés, corrompus, de taille/type/dimensions incohérents
ou indécodables = refus. Limite de fichier : 40 000 000 octets ; les données métier
conservent leur limite de 2 millions de caractères. Les snapshots historiques v1
et les snapshots v2 sans assets restent importables, dans un espace métier vide uniquement.

Les écritures de blobs sont atomiques dans IndexedDB, suivies de l'écriture unique du
snapshot localStorage sous Web Lock partagé. Les assets devenus orphelins sont nettoyés
après publication ; ceux d'une écriture échouée sont nettoyés avant de retourner l'erreur.
Une reprise au démarrage traite les orphelins après interruption. Il n'existe pas de
transaction ACID couvrant les deux API : les cas de nettoyage impossible sont signalés
et réessayés au prochain démarrage. Voir le rapport de lot pour les limites exactes.

## 20. Évolution v0.5 — participation et commentaires

Autorité : `VOTI_PARTICIPATION_COMMENTS_V0_5_SPEC.md`.
Snapshot v3 : `{schemaVersion:3,polls,ballots,comments,participations}`.
Un Poll peut être historique v2 ou nouveau v3. V2 reste anonymous/disabled/private,
sans ajout de champs dans sa définition ni réécriture de son hash. V2 → v3 ajoute
seulement les deux tableaux vides après validation. Versions inconnues refusées.

Les Poll v3 ajoutent à PollDefinition :
`participationIdentityMode: anonymous | identified`, `commentMode: optional | disabled`,
`commentVisibility: private | public_with_results`. Défauts nouveaux sondages :
anonymous/optional/private. Privacy reste anonymous en anonyme, named en identified.
`identified != verified identity`, sans compte, pas de garantie une personne = un vote.
Ces trois règles sont incluses dans semanticHash et verrouillées au premier vote.

Participation : `{participationId,pollId,displayName}`, nom libre 1–60 points de code,
trim, Unicode, aucune unicité du texte. Aucune Participation en anonymous.
Ballot v3 : `{id,pollId,choiceId,submissionDigest}`, participationId seulement identified.
SubmissionDigest est un reçu SHA-256 par action (pollId/actionId/choix/contenu normalisé),
pas un identifiant stable de personne. Bulletin historique v2 inchangé.
Comment : `{commentId,pollId,ballotId,choiceId,text,moderationStatus,revision}`,
participationId seulement identified. Texte facultatif 300 points de code, trim ;
espaces seuls absents. Pas d'horodatage individuel, IP, UA ou donnée de session.

Modération pending/visible/hidden ; aucun texte modifiable. Suppression définitive
du commentaire conserve le bulletin et son reçu idempotent. Révision de commentaire
distincte de la révision publique du sondage. Public : visible uniquement avec les
résultats publiables, sans identité, existence/counter masqués avant publication.

Migration D1 additive `0003_participation_comments.sql`. Tables séparées, FK/cascades,
batch transactionnel et gardes de soumission. Aucune migration déjà appliquée modifiée.
BackupVersion 1 conservée avec snapshotVersion 3 explicite et données locales sensibles.
Voir `PARTICIPATION_V0.md` et `COMMENTS_AND_IDENTITY_V0.md`.

## Identités visuelles prédéfinies — extension locale v0.6.2

Migration additive 0005 (non appliquée en production) : `space_members.visual_id`
et `groups.visual_id`, TEXT nullable. NULL par défaut, aucun choix automatique.
Seul l'ID stable du catalogue fourni est stocké, jamais image, URL ou blob. Aucun
champ ajouté à PollDefinition, ballot, commentaire, participation ou snapshot.
Modification de profil via CAS/rôles existants, indépendamment de l'historique
anonyme. Voir `MEMBER_VISUALS_V0.md` et le rapport d'intégration dédié.
