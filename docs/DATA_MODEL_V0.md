# DATA_MODEL_V0.md — Voti

## 1. Principes

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

## 8. Ballot

Le bulletin ne doit pas être conçu autour de l’identité.

```text
id: UUID
pollId: UUID
choiceId: UUID
createdAt: ISO datetime
source: web | local_android | relay | import
```

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

Au verrouillage, calculer une représentation canonique de `PollDefinition`, puis son hash.

Objectifs :
- détecter modification accidentelle ;
- audit ;
- futur contrôle de synchronisation.

Ne pas utiliser ce hash comme mécanisme de sécurité autonome.
