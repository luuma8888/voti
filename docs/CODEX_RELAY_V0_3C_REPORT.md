# Voti v0.3C — durcissement pré-déploiement et cycle de vie

Autorité : `VOTI_RELAY_V0_3C_SPEC.md`. Backend v0.3B conservé et étendu, pas réécrit.
Les autorités demandées, celles des images et l'audit indépendant v0.3B ont été
lus avant modification. `git status -sb` initial : main, seulement les deux
documents fournis v0.3C/audit non suivis ; ils sont préservés sans modification.

**Aucun commit, push, déploiement, secret distant, widget Turnstile distant,
création/migration D1 distante, bucket R2 distant ou modification GitHub Pages.**
Toutes les bases, objets, profils et captures des tests sont locaux et ignorés.

## Résultat

- Nouvelle création : Turnstile vérifié côté Worker et quota edge fixe indépendant
  de la capacité. Régénérer des capacités ne crée plus de nouveaux quotas.
- Vote, résultats et administration existante sans Turnstile ; moteur local intact.
- Images : quota par poll/asset, cache privé navigateur et durcissement serveur.
- Suppression : transaction D1, public inaccessible, garbage R2 durable/rejouable.
- Rétention explicite, cron principal, aucun cleanup après requête HTTP.
- Export/import SECRET d'administration, vérification distante et conflit confirmé.
- Livraison HTML autonome par défaut sans relais, documentation et ZIP d'audit.

## Architecture conservée / extensions

HTML → RelayClient → HttpRelayAdapter → Worker /api/v1 → D1/R2.
shared n'importe aucune API Cloudflare. Aucun changement de schéma métier 2,
bulletins, empreinte sémantique ou sauvegarde générale. Pas de framework ni de
nouvelle dépendance npm. Node/Wrangler déjà verrouillés en v0.3B sont réutilisés.

Contrat étendu :

| Opération | Arguments | Retour |
| --- | --- | --- |
| deletePoll | pollId, adminCapability, expectedRevision | deleted:true |
| verifyAdmin | pollId, adminCapability | projection PublicPoll filtrée |
| preparePublication | arguments existants + humanVerificationToken optionnel selon relais | remoteRef |

HTTP : DELETE /api/v1/polls/:id et GET /api/v1/polls/:id/admin.
La lecture admin prouve réellement la capacité mais ne donne pas accès aux
résultats sous seuil. Les douze anciennes opérations restent disponibles ; aucune
route ballots/rawBallots/listBallots. La simulation mémoire implémente les deux
nouvelles méthodes ; elle accepte la preuve optionnelle sans prétendre fournir
une protection humaine. Le transport valide les réponses et retire toujours
la capacité du corps/URL au profit d'Authorization.

Codes ajoutés : HUMAN_VERIFICATION_REQUIRED, HUMAN_VERIFICATION_FAILED,
CREATION_RATE_LIMITED et CAPABILITY_CONFLICT pour conflit local de clé.
NOT_FOUND suffit après suppression publique ; aucun POLL_DELETED révélant le passé.
Mapping français des nouvelles erreurs dans l'UI. Les autres erreurs sont conservées.

## Turnstile

Worker : vérification Siteverify par POST, secret de runtime uniquement, timeout
8 s, réponse ≤16 Ko, validation success/hostname exact/action voti-publication,
challenge de moins de 5 minutes (petite tolérance pour horloge future). Absence
de token → 403 REQUIRED ; invalide/expiré/rejoué → 403 FAILED ; secret/configuration
ou service absents → 503, échec fermé. Pas de secret ni token dans D1, URL, HTML
ou logging volontaire. Aucun remoteip transmis.

Le token est un champ transitoire du POST prepare, retiré avant le domaine et
les écritures. Une préparation déjà existante est authentifiée et se reprend
sans nouveau challenge. La limite de création protège en amont du parsing et
de Siteverify, et compte aussi conservativement les retries prepare.

UI : chargement du script officiel seulement à l'action Publier en ligne si
une nouvelle préparation est nécessaire. Challenge flexible, annulé au changement
de route ; service absent expliqué simplement. Aucun challenge au chargement,
création locale, vote, résultats, import de clé ou administration. Dépendance
réseau explicitement limitée à ce parcours ; HTML local reste autonome/offline.

Mode local : override CLI local-test, loopback obligatoire, tokens éphémères
horodatés/UUID, refus replay/expiration en mémoire. Pas de vrai secret dans Git.
Ce n'est pas une protection humaine réelle et ce mode est interdit en production.
Siteverify réel est testé avec réponses injectées ; aucune vérification Internet
ni widget réellement provisionné dans ce lot. Clés factices officielles refusées
par le mode production, pas de bypass lorsque le secret manque.

## Rate limiting et confidentialité

| Binding / usage | Quota par 60 s | Clé |
| --- | ---: | --- |
| CREATION_LIMITER | 30 | relayId:creation fixe |
| LIMITER vote | 120 | pollId:castVote |
| LIMITER lecture poll/résultats | 120 chacun | pollId:catégorie |
| LIMITER admin existant | 120 partagé | dérivé SHA-256 contextualisé de capacité |
| ASSET_LIMITER | 600 par image | pollId:assetId |

Namespaces séparés. 429 + Retry-After:60, codes structurés. Capacités A/B/C
partagent la création ; les opérations d'administration d'un sondage existant
continuent lorsque la création sature. Groupe testé : 30 clients × 7 images =
210 réponses 200, sans quota partagé abusivement entre images.

« Global création » signifie partagé entre capacités au point de présence : le
binding Cloudflare n'est pas un compteur mondial exact. Pas de plafond financier,
unicité par personne ou anti-DoS absolu ; multi-régions et challenges résolus peuvent
encore générer des coûts. Aucune IP lue ni persistée par l'application ; Cloudflare
traite ses compteurs/challenges et métadonnées réseau. Aucun journal applicatif
de capacité, Authorization, IP, User-Agent, vote ou image. La rétention des logs
fournisseur n'est pas garantie/configurée par ce lot.

## Assets et validation serveur

GET asset reste contextualisé par sondage public et référence utilisée. R2 privé,
pas de déduplication globale ni découverte par hash seul. Après contrôle :
Cache-Control private,max-age=300,immutable et ETag sha256. HttpRelayAdapter utilise
le cache navigateur pour cette méthode uniquement ; pas de cache edge permettant
de contourner la vérification. Copie déjà reçue non révocable et cache frais
jusqu'à 5 minutes après suppression/retrait ; les nouvelles demandes réseau
retournent NOT_FOUND. Aucun changement des octets ou de leur identité.

Validation de base hash/MIME/signature/dimensions/taille conservée, puis module
serveur supplémentaire appliqué à tout le lot avant écriture, image par image :

- WebP : RIFF exact, un bitstream VP8/VP8L, VP8X premier et unique, dimensions du
  bitstream égales au canvas, flags réservés/padding nuls, alpha/ICC cohérents,
  chunks dupliqués/inconnus/animés ou EXIF/XMP refusés.
- PNG : CRC de chaque chunk, ordre/présence/unicité, whitelist et cohérence des
  chunks normalisés, 8 bits fixe non entrelacé, inflation zlib native en streaming
  bornée au nombre exact de lignes, filtres 0–4 et longueur contrôlés.
- 1 Mo, 1600 px, 2 560 000 pixels ; choix 600 Ko/1000 px au commit. 14 assets max.

**Pas de décodage complet VP8/VP8L ni reconstruction des pixels PNG.** Le navigateur
continue le vrai décodage/réencodage. Workers possède les primitives de compression
nécessaires ; le service/binding Images apporterait un décodeur supplémentaire,
avec coûts et architecture non retenus ici. Pas de grosse dépendance WASM/native.
Un WebP structurellement plausible mais indécodable demeure une limite connue.
Les limites de streaming ne sont pas un audit exhaustif CPU/mémoire du runtime.
Les profils ICC ne sont pas intégralement décodés. Ces garanties sont explicites
dans PRIVACY_AND_ABUSE_V0.md avec les sources primaires consultées.

## Suppression, concurrence, rétention et cleanup

La garde transactionnelle D1 v0.3B est réutilisée. deletePoll vérifie capacité et
révision, puis le même batch retire ballots et polls. Les cascades retirent
publications, relations et références ; le trigger asset_deleted réserve les
objets R2 dans garbage dans cette transaction. Aucun PUT/DELETE R2 n'est requis
pour rendre le sondage immédiatement inaccessible. Après suppression, les quatre
accès publics sondage/vote/résultats/asset renvoient NOT_FOUND. La connexion locale
créateur est retirée après succès ; NOT_FOUND au retry permet aussi de conclure
après perte de réponse. La copie locale sans bulletins distants est conservée.

Premier vote, verrouillage, révisions non consécutives et idempotence restent ceux
de v0.3B. Une suppression obsolète est refusée ; aucune fusion silencieuse. Aucune
nouvelle histoire locale ou republication automatique d'un état distant disparu.

Politique : préparation 24 h ; publié sans expiration ; fermé accessible jusqu'à
suppression explicite. Échéance refuse le commit avant nettoyage physique.
Garbage R2 survive aux pannes/restarts ; aucune résurrection par R2.

Migration 0002 ajoute deux index d'échéance, sans changement des tables métier.
Cron horaire minute 17, commande locale worker:cleanup, aucun nettoyage opportuniste
HTTP. Bornes inchangées : 25 préparations/100 objets ; ordre déterministe des tâches.
Une panne sur un objet conserve son entrée et permet aux autres de progresser ;
résumé technique retourné par cleanup, scheduled échoue génériquement si nécessaire.
Pas de transaction ACID D1/R2 ; suppression physique R2 éventuelle, backlog à surveiller.

## Clé d'administration

Gestion : Exporter la clé d’administration et Supprimer en ligne ; import en
gestion ou Sauvegarde & transfert. Avertissement : « Cette clé permet d’administrer
ce sondage. Toute personne qui la possède peut le modifier ou le supprimer.
Conservez-la en lieu sûr. » Suppression nécessite confirmation explicite.

JSON SECRET ≤4096 octets, exactement version:1, relayId, pollId, adminCapability.
Filename voti-admin-<pollId>.json. Validation stricte, puis GET admin authentifié
réel avant écriture locale. Autre capacité connue : erreur CAPABILITY_CONFLICT,
confirmation puis comparaison atomique avec l'ancienne clé sous Web Lock. Refus
ou annulation ne modifient rien. Administrations retrouvées visibles à l'accueil
même sans snapshot local. Aucun ajout à la sauvegarde générale/.sondagebox.
Fichier non chiffré, accessible à son détenteur ; pas de compte de récupération.

## Configuration, commandes et fichiers

Configuration publique centralisée dans relay-config/build : VOTI_RELAY_ID,
VOTI_RELAY_URL, VOTI_TURNSTILE_SITE_KEY et VOTI_TURNSTILE_MODE. Default null pour
mode local ; local-test autorisé seulement en HTTP loopback. Worker secret
TURNSTILE_SECRET et hostname/action contrôlés. Wrangler livré fail-closed en
siteverify ; seul wrapper dev ajoute l'override de simulation, jamais deploy.

Commandes conservées : test, check, build, dev, test:browser, worker:local,
worker:migrate, worker:cleanup, test:relay, test:integration. Nouvelle commande
audit:bundle, à exécuter seulement après tests/rapport. Aucune dépendance ajoutée.

Créés :

- relay/cloudflare/abuse.js, image-validation.js, migrations/0002_cleanup_indexes.sql ;
- shared/admin-key.js, web/human-verification.js ;
- scripts/browser-hardening.mjs, audit-bundle.mjs ;
- tests/relay-hardening.test.js, image-fixtures.js, audit-bundle.test.js ;
- docs/PRIVACY_AND_ABUSE_V0.md et le présent rapport ;
- VOTI_AUDIT_V0_3C.zip, artefact ignoré, hors index Git.

Modifiés :

- relay/cloudflare/worker.js, service.js, wrangler.jsonc ;
- shared/relay.js, relay-wire.js, relay-client.js, remote-state.js ;
- web/http-relay.js, remote-storage.js, app.js, styles.css ;
- scripts/build.mjs, relay-local.mjs, relay-integration.mjs, browser-test.mjs ;
- tests/in-memory-relay.js, http-relay.test.js, build.test.js ;
- .gitignore, package.json, README.md ;
- docs/CLOUDFLARE_RELAY_V0.md, CLOUDFLARE_DEPLOYMENT_V0.md, RELAY_CONTRACT_V0.md ;
- index.html régénéré, 475 630 octets et 25 modules, sans relais configuré.

Les documents historiques, fichiers branding, schéma et moteur local sont inchangés.
Un git diff --exit-code ciblant modèle/moteur/validation/résultats/assets/backup/
image-format/stockage métier/traitement local des images a confirmé cette absence
de modification. Les deux documents fournis restent tels quels.

## Tests et résultats exacts

| Commande | Résultat |
| --- | --- |
| npm test | Code 0, 13 fichiers de tests |
| Import direct de tests/*.test.js avec Node local | 174 tests, 174 succès, 0 échec/annulé/ignoré |
| npm run check | Code 0, 56 fichiers JavaScript |
| npm run build | Code 0, HTML autonome 475 630 octets, 25 modules |
| npm run test:relay | Code 0, 72 contrôles HTTP/Worker/D1/R2 |
| npm run test:integration | Code 0, 73 contrôles : 72 relais + recette navigateur |
| Chromium intégré | 543 contrôles, deux contextes indépendants, vrai HTTP local |
| npm run test:browser sans relais | Code 0, 499 contrôles, file:// offline et /voti/ |
| git diff --check | Code 0, aucune erreur |

Base 150 tests conservée ; ajout 22 durcissement et 2 archive. Total explicite
obtenu par import direct des fichiers avec node_modules/node/bin/node, car le
runner de cet environnement présente les fichiers comme unités.

Tests ajoutés : Siteverify valide/absent/invalide/secret absent/service en erreur,
hostname/action/expiration/replay, mode local fermé hors loopback, quotas A/B/C,
429 structuré et admin indépendante, 30×7 assets, cache/contextes, PNG CRC/zlib/
scanlines/expansion excessive, WebP réel et structures ambiguës, suppression
capacité/révision/lock, clés versions/relais/poll/capacité/conflit/CAS, ZIP UTF-8/CRC.

Bindings locaux : D1 et R2 réels, préparation avec token puis upload/commit,
corruption structurelle sans écriture partielle, sept assets, suppression après
vote, compteurs D1 polls/ballots/liens/références/préparations à zéro et sept garbage,
restart avant cleanup, GET sans consommation du garbage, scheduled le vide,
26 préparations expirées traitées en deux passages, ancien fermé toujours présent,
rate limiting création réel sous nouvelles capacités puis administration possible.
Panne R2 injectée en unitaires, pas panne volontaire du binding Wrangler réel.

Navigateur : clé exportée via téléchargement intercepté local, mauvaise clé refusée
par HTTP, conflit annulé puis confirmé, administration retrouvée sans snapshot,
360 px, aucun Turnstile à l'import/admin/vote, suppression annulée puis confirmée,
connexion retirée et vote public inaccessible. Régressions conservées : offline,
images, cinq thèmes, clavier, responsive, publication/vote/idempotence/seuils,
verrouillage, CORS, routes et absence de ressources externes en mode local/test.

Échecs intermédiaires résolus : méthodes nouvelles manquant dans le simulateur ;
fixture six choix aux anciens compteurs ; attente de test d'accueil satisfaite
par le DOM précédent ; spawnSync git interdit sous sandbox remplacé par execFile
asynchrone ; champ optionnel devenu obligatoire dans le validateur de simulation.
Le CRC serveur a aussi découvert une ancienne fixture PNG incorrecte ; seuls
les tests HTTP utilisent désormais un PNG généré valide. Aucune régression métier
masquée ni test ignoré. Tests/builds avec HTML partagé exécutés séquentiellement.

## ZIP d'audit

Créé à la toute fin par npm run audit:bundle, après tests et rapport, via
git ls-files -co --exclude-standard -z (équivalent robuste avec séparateur NUL).
Liste dédupliquée/triée, fichiers ordinaires seulement, ZIP UTF-8 standard Deflate,
pas de manifeste supplémentaire ni dépendance. CRC de conteneur, pas cryptographie.
node_modules, runtime local, cache npm, .wrangler, D1/R2 locaux, profils, captures
et fichiers ignorés sont exclus. Le nouveau ZIP est ignoré et n'est pas ajouté à Git.

**Attention : VOTI_AUDIT_V0_3B.zip était déjà suivi par Git au début du lot.**
Il est donc inclus conformément à la liste imposée, ce qui augmente la taille
de v0.3C. Son contenu a été listé : uniquement sources/docs/branding antérieurs,
pas de caches/bases/profils. Aucun détracking/suppression ou changement d'index
réalisé sans demande. Le script affiche taille et nombre exacts à sa génération.

## Écarts, limites et validations avant déploiement

Écarts documentés : simulation Turnstile offline au lieu d'un appel réel aux clés
officielles ; cache privé court plutôt qu'edge/public long ; pas de décodeur complet
serveur, durcissement structurel/zlib natif ; aucun cleanup opportuniste (optionnel).
Ils respectent les alternatives/périmètre demandés. Aucun développement exclu.

Restent à valider humainement avant toute opération distante : compte/domaine/noms
et juridictions EU D1/R2, widget/sitekey/secret/hostnames Turnstile, quotas/coûts et
alertes opérateur, revue des limites images avant ouverture large, journaux/copies
fournisseur et procédures de rétention/effacement, cron/backlog/sauvegardes,
UX de conservation/transfert du fichier secret. Une juridiction de stockage EU
ne garantit pas un traitement réseau ou des logs exclusivement européens.

Non exécutés : recette Turnstile provisionné, déploiement réel, téléphone physique,
Safari/Firefox/lecteur d'écran et scénario d'attaque distribué. Le pilote contrôlé
doit inclure ces recettes et vérification des coûts avant ouverture plus large.
Le guide de déploiement prépare ces instructions ; leur exécution exige une
autorisation explicite distincte. Pas de QR/PDF/comptes/groupes/Android/Capacitor,
unicité par personne, nouveaux modes, commentaires, synchro offline ou E2E.
