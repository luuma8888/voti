# DATA_MODEL_V0.md — Voti

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
`named` est réservé au futur et refusé dans les données actives du prototype local.

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
- `allowDirectChoiceQr = false` (QR non implémentés).

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

Le bulletin MVP contient uniquement ces trois identifiants, sans horodatage ni source. Aucun champ supplémentaire d’identité ou de métadonnées n’est accepté à l’import.

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
