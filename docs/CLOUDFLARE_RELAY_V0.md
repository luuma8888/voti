# Voti — relais Cloudflare v0.3C

Cette implémentation est testée avec Worker, D1 et R2 **locaux**. Elle n'est pas
déployée. `VOTI_RELAY_V0_3C_SPEC.md` autorise ce lot au-delà des exclusions des
anciennes fondations. `RelayAdapter` reste le contrat indépendant du fournisseur.

## Architecture

```text
HTML Voti → RelayClient → HttpRelayAdapter → /api/v1 → Worker
                                                       ├─ D1 : état, révisions, bulletins
                                                       └─ R2 : images privées
```

`shared/` n'importe aucune API Cloudflare. Le protocole transportable est défini
dans `shared/relay-wire.js`. L'implémentation fournisseur est exclusivement dans
`relay/cloudflare/`. Le moteur local reste inchangé ; le simulateur mémoire suit
aussi les extensions suppression/admin. L'application reste un HTML autonome.

## Lancement entièrement local

Après `npm install` :

```sh
npm run worker:migrate
npm run worker:local
```

Dans un second terminal, pour le site connecté au Worker local :

```sh
VOTI_RELAY_ID=voti-local VOTI_RELAY_URL=http://127.0.0.1:8787 VOTI_TURNSTILE_MODE=local-test npm run dev
```

Ouvrir `http://127.0.0.1:4173/voti/`. Ne pas ouvrir le HTML `file://` pour joindre
ce Worker : son origine opaque n'est volontairement pas autorisée par CORS.
`file://` continue de fonctionner pour le mode local sans relais.

Commandes de validation :

```sh
npm test
npm run check
npm run build
npm run test:browser
npm run test:relay
npm run test:integration
git diff --check
```

Ne pas exécuter simultanément les tests/builds : ils régénèrent le même
`index.html`, avec ou sans configuration relais. Après les tests connectés,
`npm run build` sans variables produit de nouveau la livraison locale par défaut.

Les scripts Wrangler n'acceptent que des actions locales. Toutes leurs bases,
caches et journaux sont sous `.relay-local/`, ignoré par Git. Les tests utilisent
un répertoire neuf par exécution puis redémarrent le Worker avec le même chemin
pour vérifier la persistance. Ils n'effacent pas les données de développement.
Les profils/captures Chromium restent dans `.browser-tests/`.

## D1 et atomicité

Migrations : `relay/cloudflare/migrations/0001_initial.sql`, puis
`0002_cleanup_indexes.sql` (index d'échéance des préparations et du garbage).

| Table | Rôle |
| --- | --- |
| `polls` | Définition/style/accès/règles JSON validés, hash sémantique, statut, verrouillage, révision, dérivé de capacité et dates du sondage |
| `publications` | Préparation privée : expiration et signature de préparation, reliée au sondage draft |
| `ballots` | Seulement `poll_id`, `action_id`, `choice_id` ; clé primaire composée poll/action |
| `asset_links` | Métadonnées validées et clé R2 par poll/asset |
| `asset_refs` | Références réellement utilisées par la définition ; alimentées par triggers |
| `r2_garbage` | Objets à nettoyer et échéance technique, sans donnée votant |
| `mutation_guards` | Garde transactionnelle temporaire ; aucune ligne après succès/rollback |

Le modèle accepté reste le schéma métier 2. Les timestamps sont ceux du cycle de
vie du sondage ou des tâches techniques, jamais ceux d'un bulletin individuel.

### Premier vote

L'INSERT conditionnel vérifie dans SQL le statut publié, l'appartenance du choix
à la définition **courante** et l'absence de la même action. La clé composée impose
l'unicité. Un trigger BEFORE INSERT valide aussi statut/choix. Le trigger AFTER
INSERT verrouille le sondage et augmente sa révision dans la **même transaction**.
Le hash a été calculé sur la définition/règles/accès validés avant leur commit ;
au verrouillage il devient l'empreinte publique. Un trigger interdit toute
modification sémantique d'un sondage déjà verrouillé.

L'INSERT et la lecture du reçu appartiennent à un batch transactionnel D1. Il
n'existe pas de fenêtre SELECT → INSERT → verrouillage applicatif séparé. D1
garantit le rollback du batch lorsqu'une instruction échoue.
[Garantie officielle des batchs D1](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).

### Mutations administratives

La validation métier peut lire l'état en amont, mais ne l'autorise pas seule.
Le batch commence par une insertion `mutation_guards` avec CHECK : sondage,
dérivé de capacité, révision attendue et préparation non expirée doivent toujours
correspondre. Sinon tout le batch échoue. L'état est relu pour produire le code
approprié, sans analyser les textes d'erreur SQL. Les changements de définition,
références, style, fermeture et révision sont dans ce même batch.

Si le premier vote gagne la course, il augmente la révision ; l'édition ancienne
échoue donc avec `REVISION_CONFLICT`, puis avec `POLL_LOCKED` après relecture.
Si l'édition gagne, le vote valide/verrouille la nouvelle définition.

Chaque mutation effective ou nouveau vote augmente la révision d'un pas positif
non consécutif. Le delta n'est pas un compteur exact de bulletins. Les retries
d'une même action/choix ne modifient pas la révision ; autre choix pour cette
action → `IDEMPOTENCY_CONFLICT`. Une nouvelle action reste un nouveau vote.
Ce dispositif ne garantit pas une voix par personne, ni l'invisibilité de l'activité.

## R2, staging et nettoyage

Les clés sont `polls/<pollId>/<assetId>/<uploadUUID>`. Le suffixe isole les tentatives
concurrentes : le rollback d'une tentative ne supprime jamais l'objet d'une autre.
Pas de déduplication entre sondages, pas d'URL publique R2.

Flux : préparation privée → interrogation des absents → upload → commit public.
Les métadonnées, signatures binaires, dimensions, tailles et SHA-256 sont validés.
Le commit vérifie toutes les références et lit les objets R2. Le Worker sert une
image uniquement si elle est référencée par ce sondage publié. Ni recherche
globale par hash ni liste de bulletins ne sont exposées.

Limites : 65 536 octets JSON standard ; 20 Mo pour le lot d'assets encodé ; au
plus 14 assets par sondage, staging compris ; 1 Mo/1600 px pour une question,
600 Ko/1000 px pour un choix. Les uploads JSON/base64 facilitent l'atomicité du
lot ; le surcoût de taille est assumé pour ce prototype. Le transport conserve
les octets normalisés WebP/PNG, sans réencodage distant ni modification du hash.

Le contrôle serveur v0.3C renforce conteneurs WebP/PNG, CRC PNG et inflation zlib
bornée avec vérification des scanlines/filtres. **Pas de décodage complet WebP**
ni reconstruction des pixels PNG. Le navigateur réalise toujours le vrai décodage
et réencodage. Garanties et limites exactes dans `PRIVACY_AND_ABUSE_V0.md`.

Avant chaque PUT R2, une ligne durable de garbage est réservée (échéance d'une
heure). La transaction D1 qui lie l'objet efface cette réservation. Échec :
l'objet reste nettoyable, immédiatement lorsqu'une erreur est interceptée.
Un crash avant commit laisse une réservation récupérable ; aucun rollback par
hash global. Les suppressions de liens déclenchent leur mise en garbage.

Les préparations expirent après **24 heures**, configurables. Leur commit vérifie
l'échéance dans la transaction. Le nettoyage supprime d'abord les préparations
expirées dans D1, puis leurs objets via la file garbage. Il traite au plus 25
préparations et 100 objets par passage. Il est rejouable et idempotent.

Le cron horaire à la minute 17 est le seul déclencheur automatique. Aucun cleanup
après GET poll/résultats/assets, vote ou mutation HTTP. Les échéances sont indexées
et les lots ordonnés. Une panne R2 laisse le garbage, sans empêcher les autres
objets ; le scheduled signale ensuite une erreur générique. En local :

```sh
npm run worker:cleanup
```

Cela appelle seulement le point de test local Wrangler `/__scheduled`. Ce n'est
pas une route d'administration publique ajoutée au Worker. D1 et R2 n'ont pas de
transaction commune ; le protocole est une publication ordonnée avec reprise,
pas une atomicité distribuée ni une garantie face à toute panne prolongée.

## HTTP /api/v1

| Méthode / route | RelayAdapter |
| --- | --- |
| POST `/publications` | preparePublication |
| POST `/publications/:id/missing-assets` | getMissingAssets |
| PUT `/publications/:id/assets` | putAssets, lot atomique |
| POST `/publications/:id/commit` | publishPoll |
| DELETE `/publications/:id` | discardPublication |
| GET `/polls/:id` | getPoll |
| PATCH `/polls/:id/definition` | updateDefinition |
| PATCH `/polls/:id/style` | updateStyle |
| POST `/polls/:id/close` | closePoll |
| DELETE `/polls/:id` | deletePoll, capacité + expectedRevision |
| GET `/polls/:id/admin` | verifyAdmin, lecture authentifiée |
| POST `/polls/:id/votes` | castVote |
| GET `/polls/:id/results` | getResults |
| GET `/polls/:id/assets/:assetId` | getAsset |

Le préfixe `/api/v1` s'applique à toutes les routes. L'adaptateur retire pollId du
corps lorsqu'il est dans le chemin et retire toujours adminCapability du JSON :
elle est uniquement dans `Authorization: Bearer …`. Les query strings sont refusées.
Les assets sont des métadonnées et un champ base64 validé ; jamais un blob JSON implicite.

Erreurs : `{ error: { code, message, details } }`. Principaux statuts : 400 données
invalides, 403 capacité/origine refusée, 404 absent, 409 conflit/verrouillage,
413 taille, 423 résultats bloqués, 429 rate limit, 503 indisponibilité.
Une erreur inattendue ne renvoie pas de pile, requête SQL ou secret.

`HttpRelayAdapter` impose HTTPS, sauf localhost/127.0.0.1, interdit credentials
dans l'URL, query/fragment, redirections et cookies. Timeout AbortController 15 s,
lectures bornées, validation stricte des réponses publiques et assets. Un timeout
ne prouve pas que le serveur n'a rien commité : conserver l'actionId lors du retry.
Aucun fallback vers un vote local et aucune file offline.

## Résultats, CORS, rate limiting et confidentialité

Un SELECT cohérent rassemble état et agrégats privés ; seules les projections
autorisées sortent. Minimum obligatoire ; closed exige aussi fermeture. Sous le
seuil : pas de distribution, pas de total si compteur masqué. Le créateur ne
reçoit pas de privilège sur les résultats. `RESULTS_LOCKED` respecte ces mêmes règles.

Origines exactes configurées dans `ALLOWED_ORIGINS` : production
`https://luuma8888.github.io`, développement localhost/127.0.0.1:4173. Preflight
limité aux méthodes nécessaires et en-têtes Authorization/Content-Type,
`Vary: Origin`, aucun cookie ni Allow-Credentials. Les clients sans Origin sont
possibles : **CORS n'est pas une authentification**.

Trois bindings, namespaces distincts, période 60 s : CREATION_LIMITER 30 appels
prepare (clé fixe relayId:creation) ; LIMITER 120 appels poll/catégorie public ou
dérivé contextualisé de capacité admin ; ASSET_LIMITER 600 lectures par poll/asset.
La création compte aussi les retries, conservativement. Les autres opérations
admin n'y participent pas. Aucune IP lue/persistée. HTTP 429 + Retry-After: 60,
CREATION_RATE_LIMITED pour création, RATE_LIMITED ailleurs. Frein collectif local
au point de présence, pas plafond financier mondial exact ni anti-DoS absolu.
[Limites du binding Cloudflare](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

Le code du Worker ne journalise ni Authorization, capacité, IP, User-Agent, corps
de vote ou image. Observability est désactivé dans la configuration fournie.
Wrangler peut afficher les routes/statuts des fixtures locales ; l'infrastructure
Cloudflare peut traiter ou journaliser des métadonnées réseau indépendamment de
l'application. Pas de garantie d'anonymat réseau, d'une-personne-un-vote,
de comptes, de récupération par compte ou de chiffrement E2E.

Le dérivé SHA-256 reste lié au relayId/pollId avec Web Crypto. Comparaison native
`crypto.subtle.timingSafeEqual` dans Workers. Le client conserve la capacité dans
son stockage séparé, pas dans PollDefinition, Ballot, URL ou sauvegarde JSON.

## UI et configuration

`web/relay-config.js` vaut null par défaut. Le build substitue relayId/baseUrl et
turnstileSiteKey/turnstileMode, paramètres publics centralisés. Aucun secret Worker.

Sondage local publié sans votes : Publier en ligne. Avec bulletins locaux : refus
expliqué. Publication préparée : blocage des écritures locales sous le verrou du
repository ; reprise ou abandon explicite. Publication réussie : En ligne, lien
public/copier, résultats et gestion. Dès rattachement, tous les votes, résultats,
éditions, styles et fermetures passent par le relais.

`#/p/<pollId>` charge la vue publique, affiche question/images, puis sélection,
confirmation et vote HTTP. `#/p/<pollId>/results` charge les résultats distants.
Le votant n'écrit aucun bulletin local. L'édition distante réutilise le formulaire
et le traitement d'images ; une révision obsolète recharge sans renvoyer l'édition.
La sauvegarde locale affiche un avertissement : ni capacités ni bulletins distants
ne sont inclus. Les clés disposent désormais d'un export/import SECRET séparé.

## Turnstile et configuration v0.3C

Nouvelle préparation : humanVerificationToken dans le JSON du POST, retiré avant
la logique métier/D1. Siteverify Worker : POST avec secret, timeout 8 s, réponse
bornée, hostname exact autorisé, action `voti-publication`, âge ≤5 minutes.
Token absent/échoué : HUMAN_VERIFICATION_REQUIRED/FAILED (403). Secret/service
absents : RELAY_UNAVAILABLE, échec fermé. Pas de remoteip envoyé. Préparation
existante : capacité requise, reprise sans nouveau challenge.

Le script Turnstile est chargé seulement après Publier en ligne nécessitant une
nouvelle préparation. Jamais au chargement, vote, résultats ou administration.
Dépendance réseau volontaire de ce seul parcours, pas un CDN nécessaire au mode
local offline. Le vote reste sans compte/challenge. Publication indisponible :
message simple et mode local conservé, sans faux succès.

Variables publiques : VOTI_RELAY_ID, VOTI_RELAY_URL, VOTI_TURNSTILE_SITE_KEY,
VOTI_TURNSTILE_MODE (`siteverify` par défaut). Worker : TURNSTILE_SECRET via secret,
TURNSTILE_HOSTNAMES (liste exacte), TURNSTILE_MODE=siteverify. Secret jamais lu au build.

Le wrapper ajoute `--var TURNSTILE_MODE:local-test` seulement à wrangler dev.
Ce simulateur offline exige token horodaté/UUID, vérifie expiration et replay en
mémoire et refuse une URL non loopback. Il ne protège pas contre des robots réels :
jamais en production. Siteverify est aussi testé avec réponses injectées, sans
appel Internet ; les clés officielles factices sont refusées en production.

## Suppression, rétention et clé secrète

deletePoll : garde capacité/révision du batch D1 existant, DELETE ballots puis poll.
Cascades : relations et préparations ; triggers : garbage R2 réservé dans cette
transaction. Pas de dépendance R2 avant succès : panne R2 ne ressuscite pas le
sondage. Les nouvelles lectures/votes/résultats/assets renvoient NOT_FOUND. Le
client retire sa connexion après succès ou NOT_FOUND au retry. Copie locale
conservée sans bulletins distants ; une nouvelle publication reste une action explicite.

Préparations : 24 h ; publiés/fermés : aucune expiration automatique. Garbage
repris au cron/commande locale après panne/redémarrage. Pas de journaux personnels
applicatifs, aucune durée de rétention promise pour les logs propres à Cloudflare.

Assets : réponse contextualisée puis `Cache-Control: private, max-age=300, immutable`,
ETag sha256 ; HttpRelayAdapter autorise ce cache navigateur. Pas de cache edge
court-circuitant l'autorisation ni de R2 public. Chaque requête réseau vérifie les
références. Une copie reçue n'est pas révocable : cache frais jusqu'à 5 minutes
après suppression/retrait, durée volontairement courte malgré les octets immuables.

Clé : fichier version 1, exactement version/relayId/pollId/adminCapability.
Gestion → Exporter ; Gestion/Sauvegarde → Importer. Limite 4096 octets, structure
stricte, GET admin réellement authentifié avant stockage, confirmation en cas
d'autre clé puis comparaison atomique sous Web Lock. Aucune inclusion au backup
ou URL. Toute personne possédant ce fichier peut modifier/fermer/supprimer.
Pas de compte ni chiffrement du fichier ; conserver en lieu sûr. Les administrations
importées restent accessibles à l'accueil même sans snapshot local.
