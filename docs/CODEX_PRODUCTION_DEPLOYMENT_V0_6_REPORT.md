# Déploiement contrôlé Voti v0.6

Date : 22 octobre 2026. Préflight A à D terminé ; **Gate humain n°1 explicitement
autorisé par Lu’uma**, qui confirme de nouveau le maintien de Cloudflare Free.
Autorisation courante exécutée : recontrôles/sauvegarde, **0004 seule**, Worker v0.6
puis smoke tests contrôlés. **Gate 2 technique PASS**, avec les réserves de validation
positive/humaine explicites en section 10. Arrêt effectif au Gate humain n°2, puis
**autorisation explicite de Lu’uma pour le commit des 61 fichiers, le push main et
la publication frontend v0.6**, sans autre mutation Cloudflare ni développement.
Les données finales commit/push/Pages seront ajoutées localement après publication,
**sans second commit documentaire implicite**. Aucune recette physique revendiquée.
Aucun rollback v0.5 ni restauration D1 autorisé.

## 1. Autorités et périmètre

AGENTS.md, spécification v0.6 intégrale, rapport de livraison v0.6,
PRODUCTION_DEPLOYMENT_V0, CLOUDFLARE_DEPLOYMENT_V0, DATA_MODEL_V0,
SPACES_GROUPS_V0, MEMBER_CARDS_V0, GROUP_VOTING_PRIVACY_V0, UX_FLOWS_V0 et README
lus intégralement. La demande de déploiement contrôlé prime sur les interdictions
historiques de déploiement des phases de développement. Pas de développement v0.7.

Les instructions Wrangler/Workers ont guidé la vérification des commandes et du
packaging. La politique explicite du projet de ne pas activer de logs/traces
sensibles est conservée ; aucune nouvelle observabilité n’a été activée.

## 2. État local initial — PASS

- Répertoire : `/home/luuma/IA/codex/appsweb/voti`.
- Branche : `main`, HEAD `c187b6905217889636c5e9e4c5f611d5089bfb3e`.
- `git ls-remote origin refs/heads/main` confirme exactement ce même HEAD distant.
- Aucun fichier staged. Lot v0.6 non commité ; travail local conservé intégralement.
- Les **188 fichiers de VOTI_AUDIT_V0_6.zip sont identiques octet par octet** aux
  fichiers présents au début de cette mission : zéro fichier différent/manquant.
- HTML initial : **1 580 321 octets**, SHA-256
  `91c9d6a089ea31f686470f398bc83a8868936bb521697b7b114ace40056e10db`.
- Migrations 0001/0002/0003 et configuration de production : aucun diff Git.
- Les différences métier/UI/tests sont celles du rapport audité, sans correction
  applicative supplémentaire pendant ce préflight.

Exclusions du futur commit : modifications préexistantes des rapports
CODEX_POSTER_V0_4B, CODEX_QR_V0_4A, CODEX_UX_V0_3E ; spécification utilisateur
VOTI_UX_V0_3E_SPEC non suivie ; deux captures personnelles à la racine.
La spécification v0.6 fournie est non suivie : son inclusion documentaire sera
explicitement présentée au deuxième gate, pas ajoutée implicitement ici.
Archives, sauvegardes D1, exports de gestion/cartes, PDF, caches et données locales
ne doivent pas entrer dans ce commit. Aucune suppression de ces fichiers effectuée.

Environnement : Node local **22.23.3**, Wrangler local **4.149.0**, versions du
lockfile conservées. jsQR 1.4.0 est la seule évolution de classement de dépendance
du lot (dev → runtime), déjà auditée. `npm ls --depth=0` relève aussi des paquets
extraneous locaux (@emnapi/runtime, @img/sharp-wasm32, tslib), hors manifeste et
hors Git ; aucune installation, suppression ou mise à niveau effectuée.

## 3. Revalidation locale — PASS

Exécution séquentielle : les tests régénèrent index.html, et plusieurs suites
emploient les mêmes ports locaux. Aucun chevauchement de ces suites/builds.
Les journaux sont dans `.relay-local/deployment-v06/`, ignoré par Git.

| Commande | Résultat de cette mission |
| --- | --- |
| npm test | PASS, 394 tests (394 points du reporter dot), aucun échec |
| npm run check | PASS, syntaxe de 110 fichiers JavaScript |
| npm run test:relay | PASS, 118 contrôles locaux |
| npm run test:integration | PASS, 119 HTTP/D1 + 3 134 Chromium |
| npm run test:free-pilot | PASS, 67 HTTP/D1 sans R2 + 3 136 Chromium |
| npm run test:spaces | PASS, 176 HTTP/D1 sans R2 + 225 Chromium |
| npm run test:spaces-migration | PASS, 8 contrôles, lignes/hashes v0.4C/v0.5 et INSERT historiques conservés |
| npm run test:member-cards | PASS, 12 contrôles, 2 pages A4, 9 QR fictifs décodés à 300 dpi |
| npm run test:participation | PASS, 288 Chromium, 3 PDF |
| npm run test:comments | PASS, 37 contrôles, 3 PDF, 7 QR décodés |
| npm run test:poster | PASS, 97 contrôles, 8 PDF, 30 QR décodés |
| npm run test:poster-studio | PASS, 188 contrôles, 13 PDF, 51 QR décodés |
| npm run test:poster-polish | PASS, 117 contrôles, 7 PDF, 36 QR décodés |
| npm run build:production | PASS, exécuté en dernier, 1 580 321 octets |
| git diff --check | PASS, répété après finalisation du rapport |

Les suites integration/free-pilot ont chacune exécuté le navigateur complet ; pas
de troisième exécution autonome de test:browser, redondante pour ce préflight.
Toutes les commandes demandées au minimum ont été relancées, sans échec critique.
Le build final est **identique au build audité**, SHA-256
`91c9d6a089ea31f686470f398bc83a8868936bb521697b7b114ace40056e10db`.
Configuration publique décodée : relais/URL/site key attendus, siteverify, images
distantes false ; scanner embarqué. Aucun TURNSTILE_SECRET dans le HTML. Les 188
fichiers de l’archive audité restent identiques après toutes les suites ; seul ce
nouveau rapport documentaire s’ajoute au travail local.

Scan des candidats Git et des modules HTML décodés : aucun fichier interdit
env/dev.vars/export privé/archive/cache et aucun credential littéral repéré.
Les captures personnelles identifiées restent explicitement exclues ; aucun fichier
staged. Ce scan n’est pas une promesse de détection universelle de tous les secrets.

Les suites de référence inspectent D1 **local** pour l’anonymat structurel, les
transactions/échecs injectés, la concurrence, le snapshot, les rôles, les résultats
et la compatibilité historique. Elles ne constituent pas une recette physique.

## 4. Production avant 0004 — lectures seules

Compte OAuth Wrangler et connecteur Cloudflare : compte ciblé
`1c74451e938197bbcd316939932fc778`, conforme à la configuration. Aucun credential
d’authentification n’est affiché ni exporté par cette mission.

| Élément | Observation réelle |
| --- | --- |
| D1 | voti-production |
| UUID | bb3329c1-7de3-4147-8d07-af8679b6cd12 |
| Version / juridiction | production / eu, exécution EEUR, réplication désactivée |
| Taille D1 | 135 168 octets au contrôle initial |
| Migrations appliquées | 0001_initial.sql, 0002_cleanup_indexes.sql, 0003_participation_comments.sql |
| Migration en attente | **0004_spaces_groups_members.sql seule**, confirmé par Wrangler migrations list --remote |
| Schéma | 10 tables hors internes SQLite/Cloudflare, 12 triggers, 6 index explicites |
| Intégrité | PRAGMA quick_check = ok ; foreign_key_check vide |
| État métier agrégé | 2 sondages, 5 bulletins ; 0 commentaire/Participation/préparation/relation asset/garbage |
| Structures v0.6 | absentes, aucune table Espace/éligibilité/credential v0.6 |
| Worker | voti-relay |
| Version active | 9ea6d58d-0ced-4a76-b7a1-0b5262ad5748 à 100 % |
| Deployment actif | 547c2424-b71b-4e67-8281-d67bdb96e89a, 2026-10-13T18:35:48Z |
| URL | https://voti-relay.voti-luuma8888.workers.dev |
| Cron | 17 * * * *, unique |
| Images distantes / R2 | REMOTE_ASSETS_ENABLED=false ; aucun binding R2 ; liste des buckets refusée 10042 « Please enable R2 », cohérent avec R2 non activé |
| CORS | https://luuma8888.github.io seulement |
| Turnstile | siteverify ; hostname luuma8888.github.io ; binding TURNSTILE_SECRET de type secret_text présent, **valeur jamais lue** |
| Rate limiters | LIMITER 34001 120/min ; CREATION_LIMITER 34002 30/min ; ASSET_LIMITER 34003 600/min |

Le Worker correspond à la version v0.5 documentée, compatible avec v0.5.1 ; pas
de déploiement v0.6 découvert. La liste des bindings est identique à la configuration
production, sans ajout de service. workers.dev actif, previews désactivées.

Limite de vérification du forfait : GET subscriptions refusé en **403**, l’OAuth ne
disposant pas de Billing Read. `usage_model=standard` et les settings Workers ne
prouvent pas le forfait Free. La dernière confirmation Free reste celle de Lu’uma
documentée dans PRODUCTION_DEPLOYMENT_V0 ; aucune preuve d’upgrade découverte,
aucune modification de forfait effectuée. Ne pas présenter le forfait comme
revérifié par l’API. Lu’uma a **explicitement confirmé son maintien en Free** en
autorisant le Gate n°1 avant les mutations de la section 9 ; cette réserve est levée
par sa confirmation, pas par une preuve API inventée.
Aucune session de navigateur contrôlable n’est disponible pour vérifier autrement
le tableau de bord. Aucun nouveau token Billing ni changement d’autorisation demandé.

Contrôles HTTP sans fixture ni vote : identifiant inexistant → NOT_FOUND 404,
origine Pages autorisée avec Vary: Origin, localhost et origine étrangère refusées
403, OPTIONS 204 avec Authorization/Content-Type, aucun cookie/credentials CORS.
Cela vérifie disponibilité/CORS, pas un vote réel ni un challenge humain.

Pages sert encore **v0.5.1**, HTTP 200, **1 287 141 octets**, SHA-256
`61749ed2c7f34d84c4fe1032cfa3d77e19ba63afeed9215a5fcbbdfcc6255c1f`,
identique au rapport v0.5.1 et distinct du build v0.6. Aucun changement Pages.
Contrôle de clôture du préflight : migrations toujours 0001–0003, 2 sondages et
5 bulletins, zéro table spaces ; version/deployment Worker toujours identiques.
Après rebuild final, scan du HTML **et des modules décodés** : aucun marqueur
TURNSTILE_SECRET ni credential member/staff/invitation/admin littéral.

## 5. Sauvegarde pré-migration — PASS

Syntaxe vérifiée dans l’aide du Wrangler installé et la documentation officielle.
Export complet schéma + données effectué sur la base explicitement ciblée, sans
no-data/no-schema et sans afficher son contenu :

```sh
WRANGLER_WRITE_LOGS=false WRANGLER_SEND_METRICS=false node_modules/node/bin/node node_modules/wrangler/bin/wrangler.js d1 export voti-production --remote --config relay/cloudflare/wrangler.production.jsonc --output .relay-local/deployment-v06/backups/voti-production-pre-0004-20261022.sql --skip-confirmation
```

Emplacement local : `.relay-local/deployment-v06/backups/voti-production-pre-0004-20261022.sql`.
Horodatage fichier : **2026-10-22T14:13:05.653712558Z**, avant 0004.
Fichier mode **0600**, dossier privé mode 0700,
exclu par Git et par le mécanisme d’audit. Taille **11 185 octets**, SHA-256
`84b5d03fad0dfd3f224c94c6ce5ca37ee60ea5292065ce9666da8cc47d7f205e`.
**Aucun contenu de sauvegarde dans ce rapport**, aucune lecture de bulletins bruts
vers le terminal. Aucun export de secret Turnstile. Sauvegarde conservée.

Reconstruction SQL réelle dans SQLite **en mémoire, localement** : succès ;
quick_check ok, foreign_key_check vide, registre 0001–0003 et compteurs 2/5/0/0
retrouvés. Aucune importation/restauration distante effectuée. Une restauration
production exigerait un accord distinct et une revue des écritures intervenues.

Time Travel : commande info réussie, bookmark pré-migration conservé uniquement
dans le dossier privé de préflight. Il ne remplace pas l’export. La limite documentée
est **7 jours en Free** (30 jours Paid), pas une rétention de 30 jours revendiquée
pour ce pilote. Aucune commande restore exécutée.

## 6. Repli v0.6-compatible — référence locale figée

**Interdiction absolue de redéployer le Worker v0.5/v0.5.1 après 0004**, notamment
après création de données Espace : ses routes ignorent les nouvelles audiences.
Le backup pré-0004 ne justifie pas d’effacer des données Espace ultérieures.

Copie complète des sources auditées extraite localement dans
`.relay-local/deployment-v06/audited-source/`, ignorée. Bundle du Worker v0.6
produit par `deploy --dry-run` (sans upload), **113 097 octets**, SHA-256
`f83d656018e8a234b014a890f97b9171e68ff6c4243007e23c1813ffe9aa4473` :
`relay/cloudflare/.relay-local/deployment-v06/worker-package/worker.js`.
Il conserve SpacesService, gardes des anciennes routes publiques, contrôle de carte,
autorisations staff et résultats privés. Configuration/bindings de production inchangés.

Commande de redéploiement de cette référence, **non exécutée sans autorisation** :

```sh
WRANGLER_WRITE_LOGS=false WRANGLER_SEND_METRICS=false node_modules/node/bin/node node_modules/wrangler/bin/wrangler.js deploy /home/luuma/IA/codex/appsweb/voti/relay/cloudflare/.relay-local/deployment-v06/worker-package/worker.js --no-bundle --config relay/cloudflare/wrangler.production.jsonc --no-autoconfig
```

La même commande avec `--dry-run` a réussi sans upload. Au préflight, cette base
était connue/testée **localement**, sans version v0.6 déjà déployée. Après les
contrôles du Gate 2, la version v0.6 `31ad3d94-8e25-4490-91f5-125c58552e79`
constitue aussi une référence de reprise compatible (limites des smoke tests en
section 10), **jamais une version v0.5**. En cas de bug de cette base elle-même : arrêt avant
Pages, diagnostic et **forward-fix compatible v0.6**, accord ciblé et tests ; redéployer
le même bundle n’est pas présenté comme un remède à un défaut logique. Aucun rollback
automatique, aucune restauration D1 destructrice, aucune version antérieure v0.5.

## 7. Gate humain n°1 — AUTORISÉ

Résultats locaux et empreinte finale confirmés ; arrêt effectif avant migration,
puis accord explicite de Lu’uma pour 0004 et Worker, avec maintien du forfait Free
confirmé humainement compte tenu du refus Billing OAuth. Recontrôles immédiats et
nouvelle sauvegarde horodatée avant exécution de la commande autorisée :

```sh
WRANGLER_WRITE_LOGS=false WRANGLER_SEND_METRICS=false node_modules/node/bin/node node_modules/wrangler/bin/wrangler.js d1 migrations apply voti-production --remote --config relay/cloudflare/wrangler.production.jsonc
```

Migration attendue : **0004_spaces_groups_members.sql exclusivement**, SHA-256
`8ed8c6de2ed3ebede5bbf9aa91e780df867ffc14b9b1eaf70284bc369500c8c7`.
Uniquement CREATE TABLE/INDEX/TRIGGER, aucune modification des lignes/hashes ni des
colonnes historiques. Si une autre migration apparaît : STOP.
Revérifier cible, version, unique migration en attente et fraîcheur de la sauvegarde
au début de la reprise ; si des écritures ont eu lieu ou si la reprise est différée,
faire un nouvel export privé horodaté, sans écraser ni effacer celui-ci.

Après accord seulement : migration → contrôles schéma/intégrité/historique → Worker
v0.6 → compatibilité Mode libre avant frontend → smoke API ciblés. Un challenge
Turnstile réel exige Lu’uma, jamais une validation inventée. Avant commit/push/Pages,
**deuxième gate humain obligatoire**, avec diff exact, exclusions, version Worker,
fixtures éventuelles, tests et build destinés à Pages.

## 8. Incidents et limites du préflight

- Premier appel Wrangler de version : tentative de log hors dossier autorisé refusée ;
  aucun effet distant. WRANGLER_WRITE_LOGS=false ensuite vérifié dans le CLI installé.
- Une requête de compteurs en UNION a été refusée par D1 (too many terms) ; reprise
  en sous-requêtes SELECT seulement, succès, aucune écriture métier.
- Premier dry-run de reprise : chemin relatif mal résolu par Wrangler ; chemin
  absolu vérifié ensuite avec succès. Aucun upload ni changement applicatif.
- Accès Billing OAuth insuffisant : limite explicitement signalée ci-dessus.
- Réserve auditée v0.6 conservée : transfert inter-Espaces d’un brouillon non
  implémenté, abandon/recréation requis. Aucune correction UX/métier dans ce lot.

## 9. Traçabilité de la reprise après Gate n°1

Au démarrage de cette reprise, migration 0004 **non appliquée** et Worker v0.6
**non déployé**. Recontrôle compte/UUID/juridiction/bindings/version : conformes à
l’état du préflight ; les 188 fichiers audités restent identiques, aucun code modifié.
Le déroulement effectif de migration/déploiement est consigné ci-dessous.
Fixtures de cette mission : **aucune**. Commit frontend/push : **aucun**.
Pages v0.6 : **NON PUBLIÉ**. Rapport non commité.

### Recontrôles et sauvegarde juste avant écriture — PASS

Wrangler OAuth : compte attendu, scopes D1 write et Workers Scripts write présents,
aucune valeur de credential lue. API D1 et Worker : nom/UUID/juridiction/bindings et
version v0.5 inchangés. `migrations list --remote` confirme 0004 seule.

Nouvel export privé, sans écraser l’ancien :
`.relay-local/deployment-v06/gate2-20261022-NNXc31/voti-production-pre-0004-20261022T143531Z.sql`.
11 185 octets, mode 0600 ; SHA-256
`84b5d03fad0dfd3f224c94c6ce5ca37ee60ea5292065ce9666da8cc47d7f205e`.
Identique au premier export : aucune différence de schéma/données au point de
sauvegarde. Reconstruction SQLite locale réussie, quick_check ok, FK vide, 2/5.

### Migration 0004 effectuée — PASS

Commande validée de la section 7 exécutée sur la cible explicite. Le terminal
interactif affiche **une migration, 0004 uniquement** ; confirmation donnée seulement
après cette vérification. Wrangler : **31 commandes, succès**, aucune autre migration.
Registre D1 : id 4, `0004_spaces_groups_members.sql`, appliquée le
**2026-10-22 à 14:36:37 UTC**. 0001/0002/0003 non rejouées et non modifiées.

Contrôles avant tout nouveau Worker : quick_check **ok**, foreign_key_check **vide** ;
**12 nouvelles tables, 14 triggers et 4 index** conformes au SQL audité. Schéma de
tous les objets historiques inchangé ; aucun objet supplémentaire inattendu.
Les 12 tables nouvelles sont vides, aucune donnée Espace créée.

Export privé de contrôle post-migration :
`.relay-local/deployment-v06/gate2-20261022-NNXc31/voti-production-post-0004-20261022T143719Z.sql`,
18 803 octets, mode 0600 ; SHA-256
`9f88eea24e4c29843667aeb88c7e505c8c991bcc073101f918589c98cdc973b3`.
Comparaison algorithmique locale des exports reconstruits en mémoire : **les lignes
complètes des neuf tables historiques hors registre de migrations sont identiques**,
y compris définitions, hashes, révisions et bulletins. Aucun contenu privé affiché
ou transcrit dans le rapport. Compteurs avant/après : **2 sondages / 5 bulletins**,
0 commentaire/Participation. Aucun vote ajouté ou supprimé.

Le Worker ancien était encore actif pendant ces contrôles ; aucune donnée Espace
n’existait à ce stade. **Revenir à ce Worker après 0004 reste interdit.**

### Worker v0.6 effectué — PASS

Nouveau dry-run avant upload : même bundle audité, 113 097 octets / gzip 25,62 KiB,
SHA-256 `f83d656018e8a234b014a890f97b9171e68ff6c4243007e23c1813ffe9aa4473`.
Configuration/anciennes migrations et sources applicatives inchangées. Puis :

```sh
WRANGLER_WRITE_LOGS=false WRANGLER_SEND_METRICS=false node_modules/node/bin/node node_modules/wrangler/bin/wrangler.js deploy --config relay/cloudflare/wrangler.production.jsonc --no-autoconfig
```

Wrangler exit 0, upload 7,06 s, triggers 3,38 s. Identité vérifiée par l’API après
déploiement, **100 % du trafic** :

- Version : **31ad3d94-8e25-4490-91f5-125c58552e79**.
- Deployment : **67074c50-987e-431e-85d8-85ba216f6c35**.
- Création deployment : **2026-10-22T14:39:53.295899Z**.
- URL : `https://voti-relay.voti-luuma8888.workers.dev`, workers.dev actif,
  previews désactivées, compatibility_date conservée à 2026-10-01.

Bindings réellement relus : D1 UUID attendu ; LIMITER 34001 120/min,
CREATION_LIMITER 34002 30/min, ASSET_LIMITER 34003 600/min ; RELAY_ID voti-production,
REMOTE_ASSETS_ENABLED=false, CORS uniquement https://luuma8888.github.io,
PREPARATION_TTL_SECONDS=86400, TURNSTILE_MODE=siteverify,
TURNSTILE_HOSTNAMES=luuma8888.github.io. Binding secret_text TURNSTILE_SECRET toujours
présent, **aucune valeur lue/extraite/modifiée**. Aucun binding R2 ajouté.
Cron unique `17 * * * *` conservé, mêmes dates de configuration. Script settings :
logpush=false, tail_consumers=null, observability=null ; aucune activation de logs
ou traces. Aucun upgrade, nouveau service, ressource R2 ou modification Turnstile.

## 10. Smoke tests production et limites — PASS ciblé

**Aucune fixture créée, aucun vote accepté/tenté sur les deux sondages historiques,
aucune donnée Espace créée, aucune action admin authentifiée sur leurs données.**
Les identifiants des sondages historiques ont été utilisés uniquement pour leurs
lectures publiques, pas comme fixtures modifiables. Aucun bulletin brut lu via API.

### Mode libre avec le frontend v0.5.1 encore publié

- Baseline après 0004 et avant Worker : six réponses publiques (sondage, résultats,
  commentaires pour chacun des deux sondages) validées, empreintes conservées sans
  stocker leur contenu dans le rapport.
- Après Worker : **six réponses strictement identiques**, statuts et projections
  validés ; définitions/règles/révisions/masquage/résultats publics inchangés.
- Chromium réellement connecté à Pages → Worker production : **29 contrôles PASS**.
  Accueil, première étape de création libre (sans soumission), deux sondages publics
  et leurs résultats, desktop 1200 et mobile 360 ; aucun overflow, erreur runtime ou
  réseau. Toutes les méthodes hors GET/OPTIONS étaient bloquées **avant envoi** par
  le harnais : **zéro mutation tentée** et zéro requête bloquée.
- Pages toujours HTTP 200, **1 287 141 octets**, SHA-256
  `61749ed2c7f34d84c4fe1032cfa3d77e19ba63afeed9215a5fcbbdfcc6255c1f` :
  frontend v0.5.1 inchangé, pas encore d’entrée Espaces v0.6 servie.

La compatibilité **lecture/projections/UI v0.5.1 en production est confirmée**.
Les soumissions libres, commentaires/modération et suppressions ont passé les suites
locales complètes du préflight. **Pas de nouveau test positif de publication/vote/
modération/fermeture/suppression en production pendant ce Gate** : il nécessiterait
une fixture dédiée et un vrai challenge Turnstile, donc intervention humaine. Les
tests ci-dessus ne sont pas présentés comme une nouvelle validation de ces écritures.

### HTTP, CORS, Turnstile et routes v0.6

**29 cas HTTP/API PASS**, avec UUID inexistants et credentials fictifs générés
en mémoire, non enregistrés, jamais imprimés ni conservés :

- GET sondage/résultats inexistants → NOT_FOUND ; assets désactivés → NOT_FOUND.
- Aucune route ballots/rawBallots/listBallots ; query refusée ; payload >65 536
  octets refusé 413, sans bulletin.
- Origine Pages autorisée, Vary: Origin, OPTIONS POST avec Authorization et
  Content-Type ; localhost et fausse origine refusés ; aucun cookie/credentials CORS.
- Création libre **et** Espace sans jeton → HUMAN_VERIFICATION_REQUIRED ; jeton
  volontairement invalide → HUMAN_VERIFICATION_FAILED via Siteverify réel.
  **Aucun challenge humain positif simulé, résolu ou revendiqué**.
- Carte/staff/invitation non enregistrés et types croisés refusés ; lectures membre,
  sondage/résultats/commentaires et vote contrôlé protégés.
- Carte incapable de créer Groupe/accès admin ; acceptation d’invitation inconnue/
  mauvais type refusée ; commande inconnue NOT_FOUND. Ces requêtes n’ont créé aucun
  membre, credential, invitation, participation ou Espace.

Le fonctionnement positif des rôles/snapshots/anonymat/concurrence/résultats/révocation/
invitations reste prouvé par **D1 local** (176 HTTP/D1 + 225 Chromium) et par le
schéma déployé vérifié, **pas par une fixture Espace de production**. Cette limite
est volontaire pour éviter des données inutiles avant la recette réelle.
Les rate limiters ont été vérifiés dans les bindings, sans épuiser leurs quotas
en production ni revendiquer de test de charge/anti-abus exhaustif.

### Intégrité après les smoke tests

Relecture finale D1 : quick_check **ok**, foreign_key_check **vide**, registre
0001–0004. Toujours **2 sondages / 5 bulletins**, 0 commentaire, Participation,
préparation et mutation_guard ; **toutes les 12 tables v0.6 vides**, gardes comprises.
Donc aucun résidu de fixture ni donnée nominative Espace à supprimer.

Incident de harnais uniquement : la première tentative Chromium attendait un nouveau
document lors d’un simple changement de fragment SPA (#new). Navigation adaptée dans
le script de contrôle privé, relance verte ; **aucun code Voti modifié**, aucun
incident applicatif observé, aucune tentative échouée présentée comme PASS.

## 11. Manifeste du Gate humain n°2 — publication AUTORISÉE

État Git présenté au Gate : main à `c187b6905217889636c5e9e4c5f611d5089bfb3e`, lot v0.6 non
commité, rien staged. Seul fichier du dépôt modifié par cette mission de déploiement :
ce rapport (nouveau/non suivi). Scripts et journaux de contrôle restent privés dans
`.relay-local/deployment-v06/gate2-20261022-NNXc31/`, exclus de Git et de l’audit.
Sources du lot audité et build index.html inchangés, aucune régénération du frontend
pendant cette reprise. `git diff --check` PASS.

Build destiné à une future publication autorisée : **1 580 321 octets**, SHA-256
`91c9d6a089ea31f686470f398bc83a8868936bb521697b7b114ace40056e10db`.
Message autorisé : `feat: ajouter les Espaces, groupes et cartes Voti v0.6`.

Manifeste exact proposé (**61 fichiers**, y compris la spécification v0.6 fournie ;
aucun fichier staged à ce stade) :

```text
.gitignore
README.md
docs/CLOUDFLARE_DEPLOYMENT_V0.md
docs/CLOUDFLARE_RELAY_V0.md
docs/CODEX_PRODUCTION_DEPLOYMENT_V0_6_REPORT.md
docs/CODEX_SPACES_GROUPS_V0_6_REPORT.md
docs/COMMENTS_AND_IDENTITY_V0.md
docs/DATA_MODEL_V0.md
docs/GROUP_VOTING_PRIVACY_V0.md
docs/MEMBER_CARDS_V0.md
docs/PARTICIPATION_V0.md
docs/PRIVACY_AND_ABUSE_V0.md
docs/QR_AND_POSTER_V0.md
docs/RELAY_CONTRACT_V0.md
docs/RESULTS_PDF_V0.md
docs/SPACES_GROUPS_V0.md
docs/THIRD_PARTY_LICENSES.md
docs/UX_FLOWS_V0.md
docs/VOTI_SPACES_GROUPS_V0_6_SPEC.md
index.html
package-lock.json
package.json
relay/cloudflare/abuse.js
relay/cloudflare/migrations/0004_spaces_groups_members.sql
relay/cloudflare/service.js
relay/cloudflare/spaces-service.js
relay/cloudflare/worker.js
scripts/audit-bundle.mjs
scripts/browser-navigation.mjs
scripts/browser-spaces.mjs
scripts/browser-test.mjs
scripts/build.mjs
scripts/free-pilot-integration.mjs
scripts/spaces-checks.mjs
scripts/spaces-migration-checks.mjs
scripts/test-member-cards.mjs
shared/poll-deletion.js
shared/poll-engine.js
shared/relay-wire.js
shared/relay.js
shared/space-wire.js
shared/spaces.js
shared/validation.js
tests/audit-bundle.test.js
tests/confirmation.test.js
tests/spaces.test.js
vendor/JSQR_LICENSE.txt
vendor/scanner.js
web/app.js
web/http-relay.js
web/index.template.html
web/local-deletion.js
web/member-cards.js
web/member-scanner.js
web/participation-ui.js
web/poll-context.js
web/print-layout.js
web/sharing.js
web/space-storage.js
web/spaces-ui.js
web/styles.css
```

Explicitement exclus et préservés : les deux captures personnelles de la racine,
les rapports historiques CODEX_POSTER_V0_4B/CODEX_QR_V0_4A/CODEX_UX_V0_3E déjà
modifiés avant ce lot, VOTI_UX_V0_3E_SPEC non suivie et sans rapport avec v0.6,
tous les ZIP, backups D1, profils, PDF, cartes/exports/secrets/env/caches/node_modules.
Aucun ZIP d’audit recréé pendant le Gate 2. L’autorisation explicite distincte de
publication a ensuite été donnée par Lu’uma : manifeste ci-dessus strictement figé,
recontrôles Git/build/Worker/D1 obligatoires avant staging. Résultats de publication
à ajouter après exécution, localement sans second commit. Recette humaine interdite
à l’agent, toutes les validations ci-dessous restent en attente.

Toutes les validations physiques v0.6 restent **NON VALIDÉES HUMAINEMENT** : création
Espace/deux Groupes, pseudonymes/cartes fictifs, caméra/papier, sondage→carte et
carte→Mon espace, téléphone partagé A/B et effacement, refus deuxième participation,
agrégats anonymes/roster identifié, snapshot, quatre modes de résultats/seuil/audience,
révocation/régénération/invitations, accès staff par fichier et trois suppressions.
La recette sera menée séparément avec Lu’uma, une manipulation à la fois.

Sources officielles consultées : [import/export D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/),
[Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/),
[limites D1](https://developers.cloudflare.com/d1/platform/limits/),
[rollback Workers](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).
Les aides du Wrangler installé font autorité pour les flags réellement disponibles.
