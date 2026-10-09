# Voti — contrat de relais Internet v0

Autorité : `VOTI_RELAY_V0_3A_SPEC.md`. Contrat préparatoire, sans backend, transport
HTTP, activation dans l’interface ni promesse de partage entre appareils aujourd’hui.

## Architecture et frontières

- `shared/relay.js` : interface asynchrone RelayAdapter, erreurs, génération de
  capacité et d’action, références et fragments publics.
- `shared/relay-client.js` : client sans DOM qui utilise un relais et son propre
  RemoteConnectionAdapter. Deux clients ne partagent que le relais.
- `shared/remote-state.js` : contrat de stockage des connexions et implémentation mémoire.
- `web/remote-storage.js` : implémentation locale optionnelle, non instanciée par
  l’application. Clé distincte `voti.remote.v1`, mutations sous Web Locks.
- `tests/in-memory-relay.js` : simulation complète, exclue du build autonome.
  État privé, file asynchrone sérialisée, moteur existant réutilisé.

Le modèle métier reste en schéma 2. Aucun changement des bulletins, empreintes,
sauvegardes ou du stockage local existant. Les modules du contrat sont embarqués
par le build habituel mais ne créent ni connexion ni capacité au démarrage.

## Types et références

`RemoteRef = { relayId, pollId, revision }` :

- `relayId` est une clé de configuration `[a-z0-9][a-z0-9_-]{0,63}`, pas une URL ;
- `pollId` est l’UUID v4 minuscule du sondage local, non séquentiel ;
- `revision` est un entier sûr positif après mutation ; 0 désigne la réservation
  initiale privée, avant tout upload. Une préparation avec uploads a une révision
  supérieure à 0 sans être encore publique.

Une référence n’appartient ni à PollDefinition ni à `definitionHash`.
L’identifiant public n’est pas une authentification.

`publicPollRoute(pollId, results = false)` produit `#/p/<pollId>` ou
`#/p/<pollId>/results`. Aucun secret, origine technique ou backend n’y figure.
Les fragments sont préparés seulement : aucune nouvelle vue publique dans ce lot.
Les futurs QR viseront le site Voti, pas le relais.

### Vue publique

`PublicPoll` contient exactement :

```text
remoteRef
status                 published | closed
locked                 boolean
definitionHash         null avant verrouillage, SHA-256 après
definition             définition métier, avec références d'images
style
accessRules
resultRules
results                projection filtrée
```

Pas de `stats`, liste de bulletins, capacité, dérivé de capacité, horodatage de
verrouillage ou métadonnée réseau. Toutes les réponses sont des copies isolées.
`VoteReceipt` contient uniquement `accepted`, `alreadyAccepted`, `remoteRef`,
`status`, `locked`, `results`.

## API exacte RelayAdapter

Toutes les méthodes reçoivent **un objet** et retournent une Promise. Champs
supplémentaires refusés. Dans la table, `A` représente les champs
`pollId, adminCapability, expectedRevision`. Les mutations administratives exigent
une capacité valide et la révision exacte. `getMissingAssets`, lecture authentifiée,
accepte une révision obsolète pour retrouver une préparation après perte de réponse.

| Méthode | Champs de requête | Réponse |
| --- | --- | --- |
| `preparePublication` | `poll, localBallots, adminCapability, expectedRevision` | `{ remoteRef }` |
| `getMissingAssets` | `A, assetIds` | `{ remoteRef, missingAssetIds }` |
| `putAssets` | `A, assets` | `{ remoteRef, assetIds }` |
| `publishPoll` | `A` | PublicPoll |
| `discardPublication` | `A` | `{ discarded: true }` |
| `getPoll` | `pollId` | PublicPoll |
| `updateDefinition` | `A, definition, resultRules` | PublicPoll |
| `updateStyle` | `A, style` | PublicPoll |
| `closePoll` | `A` | PublicPoll |
| `castVote` | `pollId, actionId, choiceId` | VoteReceipt |
| `getResults` | `pollId` | `{ remoteRef, ...projectionDisponible }` |
| `getAsset` | `pollId, assetId` | asset binaire validé |

`poll` est un sondage complet du schéma 2. `localBallots` contient uniquement ses
bulletins : il doit être vide. Le client valide d’abord l’ensemble de son snapshot.
Le relais refuse aussi un sondage verrouillé ou annonçant des votes. Cela n’est pas
une attestation cryptographique de l’histoire d’un client malveillant : aucun
protocole ne peut prouver ici que celui-ci n’a pas effacé ses anciennes données.

`updateDefinition` remplace intégralement définition et règles de résultats ; pas
de patch ni fusion. Les seules règles d’accès disponibles restent publiques et
anonymes, identiques au moteur local. Elles ne sont pas éditables dans ce contrat.
Une préparation se modifie en l’abandonnant puis la recréant ; cette méthode
d’édition s’applique à un sondage déjà publié.

### Client fourni

`new RelayClient(relay, connections)` propose :

- `preparePublication(state, pollId)` : sauvegarde la capacité avant d’appeler le relais ;
- `uploadMissingAssets(pollId, assetIds, assetAdapter)` : ne lit/envoie que les absents ;
- `publishPoll(pollId)`, `discardPublication(pollId)`, `getPoll(pollId)` ;
- `updateDefinition(pollId, definition, resultRules)`, `updateStyle(pollId, style)` ;
- `closePoll(pollId)`, `castVote(pollId, choiceId, actionId)` ;
- `getResults(pollId)`, `getAsset(pollId, assetId)`.

Le client ne tranche jamais un verrouillage à partir du cache. Il transmet les
mutations au relais. Sur conflit, le demandeur recharge et décide explicitement ;
aucune relance automatique d’une modification. `actionId` est fourni explicitement
au vote pour que la même confirmation soit réessayée avec le même identifiant.
Le client ne génère pas automatiquement une nouvelle action après une erreur.

## Publication en deux phases et assets

1. Générer puis conserver localement la capacité créateur.
2. `preparePublication` valide le sondage sans bulletins. Brouillon ou publication
   locale sans vote acceptés, sondage fermé refusé. L’heure distante fait autorité.
3. `getMissingAssets` puis `putAssets` : envoi des images absentes, par sondage.
4. `publishPoll` vérifie toutes les références avant de rendre le sondage public.

La préparation est invisible à toutes les lectures publiques et au vote. Répéter
exactement la préparation initiale à révision 0 est idempotent ; définition
différente : `PUBLICATION_CONFLICT`. Après uploads, reprendre par la lecture
authentifiée des assets, pas par une nouvelle préparation.

Les assets utilisent le contrat binaire existant :
`{ id, formatVersion, mimeType, width, height, byteLength, blob }`. Les identifiants
restent `sha256-...`. Les octets, hash, format normalisé, dimensions et taille
annoncée sont vérifiés avant tout commit d’un lot. PNG/WebP normalisés seulement,
comme le stockage actuel ; les JPEG sélectionnés localement ont déjà été réencodés.
L’usage vérifie aussi les limites : sondage 1600 px / 1 000 000 octets ; choix
1000 px / 600 000 octets. Un asset manquant interdit publication et modification.

Limites propres à cette simulation : 65 536 caractères pour l’enveloppe JSON
(blobs exclus), 14 assets au maximum par sondage y compris staging, chaque blob
au plus 1 000 000 octets. Les métadonnées et contenus invalides sont rejetés avant
écriture. Un lot ne peut pas contenir deux fois le même identifiant. Réenvoyer un
lot déjà présent est sans effet et ne change pas la révision.

Le contrôle partagé inspecte le format binaire et les métadonnées, sans décodage
des pixels sous Node. Ce n’est pas un filtre d’upload de production : le futur
backend devra décoder effectivement et valider/réencoder les images dans une
limite de ressources sûre. Le navigateur local effectue déjà un vrai décodage.

La lecture publique exige **sondage publié + référence présente dans sa définition**.
Il n’existe ni méthode globale de recherche d’asset par hash ni liste publique.
La recherche des absents est également propre au sondage et authentifiée.

Les uploads destinés à une prochaine modification restent privés jusqu’au commit
de cette définition. Les assets non référencés sont éliminés après un commit métier
réussi ou un nouveau vote. Un upload valide en attente n’est pas un échec partiel.
En cas d’abandon d’une préparation, `discardPublication` supprime sa réservation
et ses assets. Les préparations laissées en attente n’expirent pas automatiquement
dans cette simulation ; prévoir expiration/quota dans le backend réel.

## Autorité, concurrence et révisions

Le relais possède son snapshot privé et valide chaque mutation sur une copie.
La file sérialise aussi les lectures : aucun lecteur ne voit un état à moitié
verrouillé ou publié. Les entrées sont copiées dès l’appel, avant les attentes.

Chaque mutation effective et chaque nouveau vote augmentent la révision ; lecture
et retry idempotent ne la changent pas. Les révisions sont **monotones mais non
consécutives** : la simulation ajoute un pas aléatoire positif, afin qu’une
soustraction de révisions ne donne pas directement un total caché. On compare
uniquement l’égalité pour les conflits, jamais un nombre de votes déduit du delta.
Les révisions et le flag de verrouillage ne rendent toutefois pas l’activité
inobservable à un client qui interroge continuellement le relais.

Ordre d’administration : existence, capacité, révision, contraintes métier. Une
capacité invalide ne reçoit pas la révision actuelle dans son erreur.

Course critique testée : le premier vote gagne → état et empreinte verrouillés →
ancienne modification refusée par `REVISION_CONFLICT` → après rechargement,
modification refusée par `POLL_LOCKED`. Si la modification gagne d’abord, le premier
vote verrouille la nouvelle définition. Le hash couvre définition, privacy/mode,
références d’images, accès et règles de résultats ; jamais style ou RemoteRef.
Style et fermeture restent possibles après verrouillage.

## Vote et résultats

`createVoteActionId()` utilise `crypto.randomUUID()`. L’unicité est strictement
`(pollId, actionId)`. Le bulletin privé est celui du moteur existant :
`{ id: actionId, pollId, choiceId }`, sans autre champ.

- Même action + même choix : reçu `alreadyAccepted: true`, aucun nouveau bulletin.
- Même action + autre choix : `IDEMPOTENCY_CONFLICT`.
- Nouvelle action : nouveau bulletin, y compris pour une même personne.
- Retry d’un bulletin accepté avant fermeture : toujours idempotent.
- Nouvelle action après fermeture : `POLL_CLOSED`.

Les résultats sont calculés **dans le relais**, avec les règles partagées.
`threshold` exige le minimum ; `closed` exige fermeture **et** minimum.
Avant disponibilité : `{ available: false, minimumResponses, releaseMode }`, plus
`totalBallots` uniquement lorsque `showResponseCountBeforeRelease` est vrai.
Aucune distribution. Après disponibilité : `{ available: true, totalBallots,
choices: [{ id, label, count, percentage }] }`.

`getPoll` et `castVote` incluent cette projection. `getResults` rejette avec
`RESULTS_LOCKED` et la même projection filtrée dans `details`, plus `remoteRef`.
Le créateur n’a pas de passe-droit sur les résultats bloqués.

## Capacités, confidentialité et limites de sécurité

`createAdminCapability()` génère 32 octets via `crypto.getRandomValues`, encodés
avec le préfixe `voti-admin-v1.`. Le relais conserve seulement un SHA-256 de la
capacité, séparé par domaine et lié au relayId/pollId. Primitive Web Crypto standard,
aucune cryptographie artisanale. Le secret passe transitoirement dans les requêtes
d’administration ; ne jamais journaliser ces requêtes ou leurs corps.

La comparaison des dérivés de cette simulation est une égalité JavaScript, pas
une garantie de temps constant. Pour le backend réel : HTTPS obligatoire,
comparaison sûre fournie par la plateforme, erreurs et logs expurgés, limitation
des tentatives. Aucun secret réel n’est livré dans le HTML ni commité.

Le stockage local privé contient :

```text
formatVersion: 1
relayId
pollId
remoteRevision
adminCapability: secret créateur ou null pour votant
lastKnownRemoteState: null ou { status, locked, definitionHash, resultsAvailable }
```

`RemoteConnectionAdapter` expose `get(ref)`, `put(connection)`, `delete(ref)`,
`list()`. Les records sont validés, versions inconnues refusées, régressions de
révision et remplacement silencieux d’une capacité existante interdits.
`delete` est une suppression locale explicite, pas une suppression du sondage distant.

L’adaptateur localStorage optionnel utilise Web Locks et une enveloppe
`{ formatVersion: 1, connections }`, bornée à un million de caractères. Quota,
corruption ou absence de verrou empêchent l’écriture. Les données métier et
exports actuels n’incluent **jamais** ces records. Ce stockage n’est ni sécurisé
contre le propriétaire de l’appareil/XSS, ni une sauvegarde durable. Une capacité
perdue n’est récupérable par aucun compte ; son transfert/sauvegarde reste à concevoir.
Si le relais a commité mais que l’écriture du cache échoue, le client signale
l’échec : recharger l’état public ou, pour une préparation, sa lecture d’assets
authentifiée. Aucun rollback distant implicite.

**Anonymat applicatif, pas anonymat réseau :** les bulletins ne contiennent pas
userId, IP, User-Agent, fingerprint, session, origine ou horodatage précis.
L’infrastructure peut voir et journaliser IP, heures de connexion et requêtes.
Le fait de ne pas les copier dans les bulletins n’efface pas ces logs. Pas de
comptes, pas de garantie une-personne-un-vote, pas de chiffrement des bulletins ou
d’anonymat fort contre l’opérateur. Le relais applique des règles de visibilité,
ce n’est pas une protection cryptographique des résultats contre son administrateur.

## Erreurs

`RelayError` : `name`, `code`, `message`, `details` ; `toJSON()` retourne seulement
`{ code, message, details }`. La logique dépend de `code`, jamais du texte.

Codes obligatoires : `NOT_FOUND`, `POLL_CLOSED`, `POLL_LOCKED`,
`REVISION_CONFLICT`, `INVALID_CHOICE`, `INVALID_DEFINITION`, `RESULTS_LOCKED`,
`INVALID_CAPABILITY`, `ASSET_MISSING`, `ASSET_INVALID`, `PAYLOAD_TOO_LARGE`,
`RATE_LIMITED`, `RELAY_UNAVAILABLE`.

Codes complémentaires : `LOCAL_VOTES_PRESENT`, `IDEMPOTENCY_CONFLICT`,
`INVALID_REQUEST`, `PUBLICATION_CONFLICT`. `RATE_LIMITED` est réservé au futur
backend : pas de simulateur de trafic ni de rate limiter dans ce lot. Les méthodes
abstraites et défaillances imprévues signalent `RELAY_UNAVAILABLE` sans exposer leurs
détails internes. Les erreurs de stockage des connexions sont également structurées.

## Avant le backend réel

Décider hébergement, stockage transactionnel, configuration relayId/origine,
politique de logs/rétention, limites de trafic et de staging, expiration des
préparations, validation des pixels et gestion des capacités perdues/transférées.
Tester les transactions réelles (verrouillage + bulletin + idempotence + révision),
les interruptions réseau, CORS/HTTPS et les uploads bornés. Aucun de ces composants
n’est implémenté dans v0.3A. Android pourra implémenter le même contrat et conserver
ses capacités dans un stockage natif adapté ; aucune couche Android créée ici.
