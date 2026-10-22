# Rapport Voti v0.6 — Espaces, groupes et cartes membre

Date : 14 octobre 2026. Base Git : `c187b69` (v0.5.1), branche main.
Autorité : `VOTI_SPACES_GROUPS_V0_6_SPEC.md`, lue intégralement avec AGENTS et les
autorités modèle/UX/participation/relais/D1/privacy. Aucun commit/push/déploiement.

**Livrable local prêt pour audit, avec les écarts/limites explicites de la section 10.
Toutes les commandes ci-dessous ont réussi. Aucune validation humaine v0.6 ni
validation de production n’est revendiquée.**

## 1. Architecture réalisée

Le mode libre v0.5.1 reste distinct, sans compte, avec commentaires/modération/QR/
Studio/PDF/localStorage/backup/thèmes préservés. Zone « Espaces & groupes » séparée
de la bibliothèque ; aucun Espace obligatoire pour les sondages historiques.

`shared/spaces.js` : credentials WebCrypto, audiences/snapshots purs, rôles et
conditions de résultats, session mémoire et URL de carte. `shared/space-wire.js` :
contrat fournisseur-neutre, validation stricte et projections nommées.
`RelayAdapter.spaceCommand` → `HttpRelayAdapter` → Worker → `SpacesService` → D1.
Aucune API Cloudflare/fetch/DOM importée par shared. La simulation InMemory historique
est conservée pour le libre ; les invariants Espaces sont testés sur D1 réel local.

Les accès de gestion restent des capacités distinctes par Espace, roles admin/creator,
globaux ou limités à des groupes. Un Member est participant via sa carte, jamais
administrateur par ce credential. Une même personne souhaitant gérer et participer
utilise deux credentials de catégories différentes, sans compte traditionnel.

Gestion minimale : noms Unicode, groupes/membres, affiliations multiples, carte/
révocation/régénération, invitations bornées, accès de gestion/export/import,
brouillon/publication/édition/règles/style/fermeture/modération/suppression. Espace
archivable, pas de suppression totale ni réactivation, comme permis par la spec.

## 2. Modèle et migration

Nouvelle migration uniquement : `relay/cloudflare/migrations/0004_spaces_groups_members.sql`.
0001/0002/0003 inchangées. Tables : spaces, groups, space_members, group_memberships,
space_access, member_credentials, invitations, poll_audiences, poll_audience_groups,
poll_member_eligibility, member_participations, controlled_vote_guards.

Décision de compatibilité : **ne pas ajouter de colonne à participations**. Le Worker
v0.5 utilise `INSERT ... SELECT` sans liste de colonnes. La liaison au membre est
matérialisée dans member_participations, exclusivement identified, UNIQUE(poll_id,
member_id), FK/cascade/immutabilité. Les trois colonnes historiques de Participation
et les colonnes Ballot/Comment restent intactes. Le Worker v0.6 précise les colonnes
de ses INSERT. Une base D1 locale chargée de lignes v0.4C/v0.5 avant 0004 conserve
exactement lignes/hashes/ballots/participations ; anciens INSERT/votes vérifiés.

Snapshot libre local toujours v3 ; sauvegardes anciennes toujours migrables par leur
voie actuelle. Poll contrôlé complet explicitement v4, contextId=spaceId, accessRules
context avec pollAudience. Pas de mélange des états contrôlés avec les bulletins
locaux ni d’import v4 silencieux dans le backup libre. PollDefinition v0.5 conservée.
Hash canonical SHA-256 existant, définition + accessRules + resultRules ; style et
credentials exclus. Aucune empreinte historique recalculée.

## 3. Credentials, cartes et sessions

Carte opaque de 256 bits générés par primitive système, token sans nom/pseudo/rôle.
Préfixes/types member/staff/invitation distincts, dérivation SHA-256 standard séparée
par relayId/type ; serveur uniquement digests. Aucune cryptographie artisanale.

QR membre/invitation dans fragment client, retiré immédiatement de location/history
avant tout fetch. Bearer seulement pour l’authentification des lectures/soumissions.
Caméra ou photo JPEG/PNG/WebP décodée localement avec jsQR ; limites 10 Mo / 16 MP,
signature/type vérifiés avant pixels ; aucune image envoyée. Dialogue natif accessible,
Annuler/Escape, focus restauré, pistes caméra et pixels libérés.

Carte/profil participant en mémoire seulement, durée maximale cinq minutes, aucune
case de connexion persistante ni localStorage/sessionStorage/IndexedDB participant.
Effacement au succès/Terminer/départ/expiration ; neutralisation des autres onglets
participants par message BroadcastChannel sans identité/token. Les callbacks périmés
ne réinstallent pas une carte après navigation. Succès durable sans profil/formulaire.
Profil de gestion conseillé séparé du profil collectif : Voti n’est pas un kiosque
neutralisant les capacités du propriétaire déjà présentes dans localStorage.

Cartes A4 explicites : huit par page, nom/pseudo, Espace, QR noir/blanc M + quiet zone,
« Garde cette carte pour toi ». File d’émission en mémoire, pas de coffre de cartes.
Révocation/régénération conserve le même membre et sa consommation ; aucune recherche
du bulletin anonyme d’une carte volée. Fichier accès de gestion v1 séparé, vérifié
auprès du relais et conflit confirmé ; erreurs de parse ne reprennent pas de secret.

## 4. Snapshot, atomicité et confidentialité

Publication transactionnelle de l’union des membres actifs, distincts entre groupes.
Le 11e membre ajouté après une publication à 10 n’entre pas dans ce snapshot, mais
dans les suivants. Y ne dépend jamais des affiliations actuelles ; révocation ne
réduit pas le dénominateur. Pas d’audience changée après publication ni d’éligibilité
modifiée rétroactivement. Les autres règles se verrouillent au premier vote.

Registre d’éligibilité : seulement poll_id, member_id, consumed. Pas de ballot/action/
digest/heure dans ce registre. Anonyme : zéro Participation et liaison membre, champs
participation_id NULL dans bulletin/commentaire. Aucun memberId/carte/nom ajouté aux
bulletins/commentaires. Le commentaire peut être associé à son bulletin, pas au membre.

Batch D1 : revalidation carte/membre/Espace/snapshot/statut/hash → consommation →
Participation et liaison uniquement identified → bulletin/commentaire → verrouillage/
révision → retrait des gardes. CHECK/FK/UNIQUE/triggers autoritaires ; rollback intégral
si n’importe quelle écriture échoue. Garde transitoire non nominative, supprimée dans
le même batch. Deux appareils pour une carte : un vote accepté, autre ALREADY_PARTICIPATED,
sans choix révélé. Retry exact sans seconde soumission ; nouvel actionId ne contourne
pas la consommation. Les garanties transactionnelles sont documentées par
[D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/).

Protection supplémentaire de consentement : expectedDefinitionHash dans la soumission
contrôlée, calculée depuis les règles réellement affichées, pas la révision de vote.
Anonyme → identifié pendant confirmation : REVISION_CONFLICT, zéro bulletin/commentaire/
Participation/liaison/consommation ; nouvel écran et confirmation explicite obligatoire.
Même protection pour labels/commentVisibility/résultats changés avant premier vote.
Cette extension concerne seulement la nouvelle API contrôlée, pas le vote libre v0.5.

Administration anonyme : X/Y seulement et commentaires sans identité ; aucun roster
de votants/non-votants. Identifié : nom issu du registre de carte, association privée
et filtre Tous/A participé/À relancer. Deux pseudonymes égaux acceptés ; identité non
vérifiée. Noms jamais dans les résultats de l’audience ; modération v0.5 intacte,
supprimer un commentaire ne change ni vote ni consommation.

**Limites** : ce n’est pas E2E/cryptographique. L’émetteur copiant une carte peut
utiliser sa projection individuelle ; un opérateur D1 peut lire le registre interne.
Petits groupes, contenu des commentaires, timings/logs hébergeur permettent des
déductions. Pas de garantie d’identité civile : une participation par membre, pas une
preuve une-personne-réelle-un-vote. Voir GROUP_VOTING_PRIVACY_V0.md.

## 5. Résultats, PDF et suppression

threshold/all_eligible/closed/all_eligible_or_closed utilisent le snapshot figé.
minimumResponses reste obligatoire, sans baisse automatique si groupe trop petit ou
membre révoqué. poll_audience exige la carte et le snapshot ; admins_only bloque les
agrégats des participants. Sous disponibilité : aucune distribution/commentaire caché.
Admin peut lire les commentaires immédiatement, comme v0.5.

PDF repose exclusivement sur projection autorisée. Synthèse sans identité ; Rapport
commentaires visibles sur option, identités admin identified OFF par défaut et averties.
Palettes/typos/QR/Studio existants conservés ; aucun média distant ni R2 activé.

Libre : suppression appareil / en ligne / partout. Retrait local réellement complet
dans le repository, puis design/médias/rattachement/repères ; nettoyage secondaire
qui échoue ne bloque plus la copie et déclenche un avertissement. Relais indisponible
ou lien déjà supprimé n’empêche jamais l’action locale. Designs orphelins retirables
dans Sauvegarde. Espace sans copie métier locale : supprimer en ligne cascade sur
bulletins/commentaires/participations/liaisons/snapshot ; Partout retire aussi design.
Les fichiers déjà téléchargés ne peuvent pas être supprimés à distance.

## 6. Anti-abus, rétention et limites techniques

Création Espace : Turnstile + bucket global de création existant. Groupes/polls d’un
Espace existant exigent une gestion autorisée et sont bornés ; aucune création via
carte participant. Limiter par catégorie de commande/digest, sans IP persistée ;
nouveau vote contrôlé = une soumission, sans challenge. Pas de logs volontaires de
carte/capacité/nom/commentaire, ni nouveau fingerprint/métadonnée dans les bulletins.

Préparations 24 h, rendues invisibles à expiration et nettoyées par cron ; invitations
1–30 jours et 1–200 usages, fermables et nettoyées par lots de 25. Pas de cleanup
systématique sur GET/lecture. Sondages publiés/fermés sans expiration automatique,
révocation conserve l’historique ; Space archivable. Limites par Space : 200 membres/
polls, 20 groupes/accès, 40 invitations en attente de nettoyage. Groupes validés par
un SELECT borné ; projections sans N+1. Cas vingt groupes testé réellement.
Le budget Free courant de
[50 requêtes D1 par invocation](https://developers.cloudflare.com/d1/platform/limits/)
a guidé le bornage des batchs et projections ; aucun binding/quota production changé.

## 7. Fichiers créés/modifiés par ce lot

Créés :

- shared/spaces.js, shared/space-wire.js, shared/poll-deletion.js.
- relay/cloudflare/spaces-service.js et migrations/0004_spaces_groups_members.sql.
- web/spaces-ui.js, space-storage.js, member-scanner.js, member-cards.js, local-deletion.js.
- vendor/scanner.js, JSQR_LICENSE.txt.
- scripts/spaces-checks.mjs, spaces-migration-checks.mjs, browser-spaces.mjs,
  test-member-cards.mjs ; tests/spaces.test.js.
- docs/SPACES_GROUPS_V0.md, MEMBER_CARDS_V0.md, GROUP_VOTING_PRIVACY_V0.md et ce rapport.

Modifiés :

- shared/validation.js, poll-engine.js, relay.js, relay-wire.js.
- relay/cloudflare/service.js, worker.js, abuse.js.
- web/app.js, http-relay.js, participation-ui.js, sharing.js, print-layout.js,
  poll-context.js, styles.css, index.template.html.
- scripts/build.mjs, browser-test.mjs, browser-navigation.mjs,
  free-pilot-integration.mjs, audit-bundle.mjs ; package.json/package-lock.json,
  tests/confirmation.test.js, audit-bundle.test.js, .gitignore, index.html.
- README, DATA_MODEL, UX_FLOWS, RELAY_CONTRACT, CLOUDFLARE_RELAY/DEPLOYMENT,
  PRIVACY_AND_ABUSE, PARTICIPATION, COMMENTS_AND_IDENTITY, RESULTS_PDF,
  QR_AND_POSTER et THIRD_PARTY_LICENSES.

Les modifications déjà présentes des rapports v0.4A/v0.4B/v0.3E, les deux captures
personnelles et les specs utilisateur non suivies n’ont pas été réécrites par ce lot.
Rien staged/commité. Archives et captures non ajoutées à Git.

## 8. Dépendances et commandes

jsQR **1.4.0**, déjà en dev pour les vérifications QR, passe au runtime pour le scan
local caméra/photo de carte. Apache-2.0 intégrale embarquée dans le HTML et vendor.
Aucune autre dépendance ajoutée, aucun CDN/service de scan/police distante.
pdf-lib/qrcode-generator/esbuild/Wrangler versions conservées.

Commandes supplémentaires : test:spaces, test:spaces-migration, test:member-cards.
Tous les tests Worker utilisent --local et des répertoires .relay-local ignorés ;
aucune commande deploy/migration remote/Pages/Turnstile/R2 production exécutée.

## 9. Tests et résultats

| Commande | Résultat |
| --- | --- |
| npm test | succès, 394 tests Node, 0 échec |
| npm run check | succès, 110 fichiers JS |
| npm run build | succès, HTML autonome 1 580 073 octets |
| npm run build:production | succès, 1 580 321 octets, profil sans R2 |
| npm run test:browser | succès, 2 964 contrôles, file/offline/mobile/thèmes/QR/PDF |
| npm run test:poster | succès, 97 contrôles, 8 PDF A4, 30 QR décodés |
| npm run test:poster-studio | succès, 188 contrôles, 13 PDF, 51 QR |
| npm run test:poster-polish | succès, 117 contrôles, 7 PDF, 36 QR |
| npm run test:participation | succès, 288 contrôles Chromium et 3 PDF |
| npm run test:comments | succès, 37 contrôles, 3 PDF, 7 QR à 300 dpi |
| npm run test:relay | succès, 118 contrôles Worker/D1/R2/CORS/persistance locaux |
| npm run test:integration | succès, 119 contrôles HTTP + 3 134 contrôles Chromium |
| npm run test:free-pilot | succès, 67 contrôles HTTP/D1 sans R2 + 3 136 Chromium |
| npm run test:spaces | succès, 176 contrôles HTTP/D1 et 225 contrôles Chromium |
| npm run test:spaces-migration | succès, 8 contrôles migration/lignes/hashes/INSERT historiques |
| npm run test:member-cards | succès, 12 contrôles, 2 pages A4, 9 QR fictifs à 300 dpi |
| git diff --check | succès, contrôle de livraison répété après finalisation documentaire |

D1 : contraintes/rôles/capacités, union et snapshot 10→11, 3-membres/quatre modes,
seuil obligatoire, audience privée, premier-vote/édition, idempotence, double-Emma,
nom historique sur retry, modération sans variation de votes, injections d’échec
Participation/liaison/bulletin/commentaire et COUNT zéro orphelin, anonymat inspecté
dans les tables (pas seulement DOM), révocation/régénération/archivage/invitations,
vingt groupes/limites, suppression identified et cascades, gardes vidées.

Chromium : création/édition/publication Espace par UI, A puis B sur même appareil,
QR photo local et QR choix sans vote, noms automatiques/absents en anonyme, succès
durable, cinq thèmes, 320/360/1200, carte invalide, expiration, tentative de gestion
par carte refusée, URLs nettoyées avant fetch, zéro requête externe, COUNT D1 avant
confirmation/double clic ; consentement périmé refusé sans écriture, puis nouvelle
confirmation explicite acceptée. Le scénario est vérifié en 320/360/1200 avec COUNT D1.

PDF de cartes inspecté visuellement après Poppler : huit cartes alignées, textes,
marges, QR et consigne sans chevauchement. QR redécodés, pas d’impression papier.
La recette PDF a suivi le protocole de vérification/rasterisation ; Workers/Wrangler
ont guidé les transactions et la séparation des paramètres locaux/production.

Échecs intermédiaires corrigés : ancien INSERT Participation à colonnes implicites,
quota initial trop collectif, navigation CDP supposant le fragment secret conservé,
description vide devant être null, attentes DOM trop précoces. Un test Node relancé
en parallèle avait remplacé l’HTML connecté de la recette : relance séquentielle
obligatoire, production build en dernier. Ne pas interpréter ces tentatives comme
des validations réussies ; le tableau final indique les commandes réellement vertes.

## 10. Limites/écarts et validations humaines restantes

- Changer l’Espace d’un brouillon déjà créé n’a pas d’opération de transfert
  inter-Espaces : abandon explicite et nouveau brouillon dans l’Espace choisi.
  Les groupes et règles du brouillon restent éditables. Ce point est un écart à
  la possibilité générale de changer l’Espace avant publication décrite par la spec.
- Accès de gestion par fichier secret, cartes réservées au Participant ; pas de
  session/compte/enregistrement enfant classique. Valider l’ergonomie de remise
  d’un accès Créateur à un jeune ; aucun QR staff supplémentaire inventé.
- Espace archivable, pas réactivable/supprimable totalement ; limites MVP ci-dessus.
  Pas d’export complet Espace/D1 intégré à l’interface. Backup libre inchangé et
  sensible, hors cartes/accès/designs et données distantes ; exports séparés explicites.
- Caméra réelle, téléphone physique, scanner système et scan papier non validés
  dans ce développement local. Tests 320/360/1200 et photo synthétique uniquement.
- Pas de lecteur d’écran matériel ni jugement par enfants réalisé ; vérifier mots,
  focus scanner, invitation, autonomie et état neutre sur vrai appareil collectif.
- Copies de cartes par l’émetteur/opérateur et corrélations réseau ne sont pas
  neutralisées cryptographiquement ; procédures d’émission/stockage des cartes à
  valider avant données réelles, particulièrement pour les petits groupes.
- Révocation ne retire pas un ancien vote anonyme, ni ne réduit Y ; all_eligible
  peut rester bloqué. Aucune baisse automatique d’un seuil historique.
- Après création de données Espace, **ne pas revenir au Worker v0.5** : il ignore
  les gardes d’audience. Toute version de repli doit conserver les protections v0.6.

## 11. Production, audit et suite

Zéro mutation production, zéro commit/push. Configuration/bindings sans R2, Worker
de production, Turnstile et migrations 0001–0003 inchangés. GitHub Pages non modifié.
Le HTML production est un livrable préparé, pas publié ; la production reste v0.5.1.
Un déploiement futur requiert un nouvel accord et l’ordre sauvegarde/migration 0004/
Worker compatible/contrôles libre/Pages en dernier, puis recette physique.

Build production final (généré après les suites navigateur, pas publié) :
1 580 321 octets ; SHA-256
`91c9d6a089ea31f686470f398bc83a8868936bb521697b7b114ace40056e10db`.
Archive de livraison : VOTI_AUDIT_V0_6.zip, générée après ce rapport et les derniers contrôles.
Mécanisme git ls-files -co --exclude-standard, exclusions explicites archives/PDF/
captures/médias privés/exports d’accès/cartes/env/bases/caches/node_modules ; pas de ZIP
récursif. Aucun export sensible ni secret réel dans le rapport ou archive.

Contrôle du premier bundle : 188 fichiers, manifest identique à l’allowlist Git,
zéro archive récursive, export privé/PDF/capture/cache et zéro credential littéral
dans les sources ou modules décodés du HTML. Aucun ZIP/capture/export de gestion
suivi par Git. L’archive est régénérée après cette mention de contrôle pour inclure
l’état documentaire final ; sa taille exacte est donnée au rendu de livraison.

Future couche Android/Room : reprendre contrats purs et garanties transactionnelles,
ne pas dupliquer les règles ni enregistrer une session participant persistante.
Aucune couche Android/Room/LAN/Capacitor, compte classique, E2E ou signature aveugle
n’a été implémentée. Audit ChatGPT et décisions humaines précèdent toute exposition.
