# Identités visuelles Voti — intégration locale

## État initial et audit avant modification

HEAD et origin/main locaux : `45d17a9c5e685a1de8fde6e6369d80e78fe337be`,
main synchronisée. Aucun accès réseau production pour cette mission.
Sept rapports historiques déjà modifiés, captures personnelles et archives hors
lot conservés. `byluuma/` devient un répertoire de transfert ignoré par Git.

Le ZIP fourni est lu sans modification : README_INTEGRATION, AUDIT et JSON complet.
CRC ZIP valide ; 509 lignes de CHECKSUMS.sha256 vérifiées avant copie. Inventaire :
132 membres (60 créatures, 36 enfants, 36 adultes), 36 groupes, 504 WebP,
168 variantes par niveau icon/medium/large. Le résidu de feuille exclu reste absent.
Seuls le manifeste original et les WebP sont copiés au runtime, octets identiques.

## Architecture retenue

L’ancien échafaudage attendait des catalogues vides, une seule variante carrée,
un maximum de 128 entrées et des data URLs. Il doit être adapté, pas simplement
rempli : le vrai pack compte 132 membres et les humains medium/large sont verticaux.
Le JSON fourni reste la source structurée unique ; le build en tire un catalogue
runtime et un petit module d’IDs serveur généré, dont la synchronisation est testée.
Les images restent des fichiers WebP séparés, sans image base64 intégrée.

Le contrat actuel utilise des clés d’objet strictes. Les nouveaux champs de réponse
sont donc opt-in via includeVisuals sur getSpace/getMemberHome ; les anciens clients
gardent exactement leur projection historique. Les payloads sans visualId restent
valides ; l’omission dans une mise à jour conserve le choix, null le supprime.

Migration additive suivante : 0005, deux colonnes visual_id TEXT NULL sur groups et
space_members. Les migrations 0001–0004 restent intactes ; application uniquement
en D1 local, avec registre Wrangler qui assure l’application une seule fois.
Les ID sont validés par catalogue selon leur type avant écriture. Aucune image,
URL, credential ou jointure vers les bulletins n’est ajouté au modèle.

## Offline et performance : décision

Le site actuel n’a pas de service worker : son HTML autonome ouvre déjà les parcours
locaux offline, mais ne peut plus contenir les nouvelles images en base64. Les WebP
font donc partie du dossier distribuable, avec chemins relatifs compatibles /voti/.
Le sélecteur ne charge que les icon ; medium au survol/focus/tap, large aux fiches et
cartes. Aucun service worker ou stockage de blobs n’est ajouté pour ce lot :
le dossier complet index.html + web/assets/voti-visuals est le format offline,
testé avec le réseau coupé. Copier le seul HTML ne suffit plus pour ce pack.
Le fonctionnement offline depuis une page HTTP dépend du cache du navigateur,
sans garantie de conservation : on ne revendique pas un nouveau mode PWA installé.
Ce choix conserve le fonctionnement local existant, sans mettre en cache des
API, identités ou credentials, ni précharger tous les large à l’ouverture.

## Plan des vérifications

Inventaire/hash/dimensions/alpha, migration historique, persistance/CAS et anciens
clients, sélection clavier/tactile, filtres, rechargement et deuxième session,
rôles, QR des PDF Poppler 300 dpi, captures Chromium réelles, suites existantes,
scan du build et du bundle, staging explicite puis un nouveau commit local.

## Inventaire et provenance vérifiés

ZIP source SHA-256 :
`07ee0bd125018bc2a97bd67ee1dd16d36c1fafb9aa31e379b53d63597919555e`.
509 checksums du ZIP et son CRC valides avant copie. Les 505 fichiers copiés
(manifeste + 504 WebP) sont à nouveau comparés octet par octet au ZIP.

| Contenu | Nombre / octets |
| --- | --- |
| Membres | 132 : 60 creature, 36 child, 36 adult |
| Groupes | 36 |
| icon | 168 / 1 348 360 octets, dont membres 1 103 708 |
| medium | 168 / 4 876 804 octets |
| large | 168 / 13 567 524 octets |
| WebP total | 504 / **19 792 688 octets** (18,88 Mio) |
| JSON source original | 80 026 octets |

Pillow vérifie les dimensions des 504 fichiers et l'alpha réel des 396 variantes
membres. Les humains ont bien un icon carré et medium/large verticaux ; les autres
sont carrés. Aucun PNG source, résidu de feuille, image générée ou recompressée.
Les deux anciens manifestes vides member-visuals/group-visuals sont supprimés.
Les fichiers de transfert ne sont pas copiés dans le runtime. Les sources PNG de
branding déjà existantes sont aussi exclues du nouveau bundle, pas supprimées du dépôt.

## Modèle, contrat et persistance

Les noms réels inspectés sont `space_members` et `groups`. 0005 ajoute uniquement
`visual_id TEXT DEFAULT NULL` aux deux tables. Pas de table graphique, URL, blob,
base64, nouvelle relation ou credential. Les anciennes migrations sont inchangées.
Wrangler assure l'application unique via son registre ; le test dédié répète
migrations apply local et vérifie une seule entrée 0005. Un ALTER TABLE exécuté
manuellement deux fois n'est pas le mécanisme d'idempotence retenu par le projet.

Le catalogue `shared/visual-ids.js` est généré par
`node scripts/visual-assets.mjs --write-ids`, pas saisi manuellement. Le build/test
refuse sa désynchronisation du JSON. Le Worker ne lit pas de fichier graphique,
uniquement les 168 IDs connus répartis en deux ensembles.

createMember/updateMember et createGroup/renameGroup : visualId facultatif ; bon ID
ou null uniquement, sinon INVALID_REQUEST 400 avant mutation. À la création sans
champ, NULL. En modification sans champ, l'ID courant est conservé. Avec null,
effacement. Le même CAS de révision et les mêmes droits Administrateur s'appliquent.
Les commandes d'invitation, révocation et rotation conservent leurs contrats ;
une invitation crée toujours un membre sans illustration tant qu'un admin n'en
choisit pas une dans sa fiche. Aucun choix automatique.

Les anciennes réponses sont des objets à clés strictes : getSpace/getMemberHome
n'ajoutent donc les IDs que sur demande includeVisuals. Le nouvel HttpRelayAdapter
la fait ; le client historique, qui ne la fait pas, reçoit exactement ses anciennes
clés. Les nouveaux validateurs acceptent aussi les réponses historiques sans ID.
Le profil participant ne reçoit que son propre ID et les groupes déjà autorisés ;
aucun résultat public ne reçoit d'identité/illustration nominative supplémentaire.

Vrais tests D1/HTTP : mises à jour membre créature/enfant/adulte, groupe changé et
remis à NULL, payload historique qui conserve le choix, seconde instance d'adaptateur,
400 serveur par requête brute contournant la validation client, CAS périmé refusé,
carte participant sans accès gestion, quick_check/foreign_key_check. La migration
est aussi testée après de vraies lignes historiques pré-0005, sans modifier les
sondages, hashes et bulletins. Les tests Espaces existants gardent les preuves
snapshot/unicité/registre séparé/bulletin anonyme sans liaison membre.

## Runtime, sélecteurs et présentation

Le JSON fourni reste la source principale. `embeddedVisuals` conserve son nom
historique mais ne produit plus de data URLs : il compile seulement les métadonnées.
L'ID est indépendant du nom physique ; les chemins sûrs du manifeste sont résolus
via icon/medium/large. Les chemins absolus, distants, data URLs, traversées et SVG
sont refusés. Le dev server expose les WebP publics, y compris sous /voti/.

API runtime : getMemberVisual/getGroupVisual/listMemberVisuals/listGroupVisuals/
filterMemberVisuals. Chaque entrée garde id, kind, category, pack, label,
sourceAspect et displayMode, avec ses trois chemins. Les tableaux du catalogue
serveur et du runtime sont dérivés, jamais deux listes manuelles à maintenir.

`visual-selector.js` : dialogue natif, titre lié, aria-modal, filters/chips avec
comptes exacts, grille icon (7 colonnes courantes desktop, 4 en 390 px), aperçu
medium à côté sur desktop et en dessous sur mobile. Survol OU focus OU tap, jamais
hover seul. Choix provisoire annoncé puis Choisir ; Aucune illustration permet
NULL après validation ; Fermer/Escape/navigation annule. Focus rendu au déclencheur,
Tab/Maj+Tab bornés, flèches/Home/End et focus visible. Aucun téléchargement des
132 medium/large à l'ouverture de la grille. Les icon sont lazy/async.

`visual-field.js` ne stocke que l'ID provisoire de la fiche. La validation de la
fiche persiste le choix. Le bouton de groupe devient Enregistrer le groupe,
sans changement de commande métier renameGroup. La fiche membre garde son état
Modifications non enregistrées. La sélection est facultative à la création.

Les listes gardent les lignes compactes et icon 40 px ; pas de large chargé pour
une liste. Fiches : large avec contain, corps entier humain visible, actions de
gestion séparées. Les fiches de groupes autorisés restent lisibles pour le Créateur
sans lui donner d'édition ; les objets archivés/révoqués gardent leur visuel en lecture.
L'ancienne petite galerie inline est conservée pour les tests hérités seulement,
jamais montée comme sélecteur principal dans l'application.

## Carte Voti et PDF

Les données serveur des illustrations sont propagées à l'émission/régénération
et au profil propre issu d'invitation, via le modèle commun existant. Le QR ne
contient aucun ID visuel. Écran et PDF utilisent le même nom/Espace/groupes/thème/
IDs/options. Le texte Ma carte individuelle et les cinq thèmes sont conservés.

Membre : large, humain vertical ou créature carrée, toujours contain. Groupes :
icon 28 px à l'écran et 56 px dans le raster PDF, trois puis résumé textuel.
Aucun grand lieu de groupe, pas de cadre vide quand NULL. Les options de rendu
ne sont proposées que pour les visuels réellement présents ; elles restent
uniquement en mémoire de la carte. Options et exports sont dans le même panneau
d'outils, sans repousser l'export sous une nouvelle rangée desktop.

Le renderer PDF dessine la source entière avec une mise à l'échelle uniforme,
pas un rectangle de découpe. Une instrumentation des appels drawImage le vérifie
pour les images réelles ; la zone humaine est de 220×330 pixels dans le raster.
QR : même budget de 400 px, modules entiers, blanc opaque, quiet zone, aucun chevauchement.

Les fixtures couvrent créature avec 0/1/plusieurs groupes, enfant vertical, adulte
vertical, adulte à longue silhouette, aucun visuel membre et les cinq thèmes.
Quatre PDF dédiés : lot de 12 cartes sur 2 A4 et 3 individuels ; **15/15 QR**
décodés à 300 dpi avec Poppler. Rendus des deux pages du lot et du PDF adulte Nuit
inspectés : têtes/pieds conservés, petits groupes secondaires, QR très contrasté.
Les PDF/captures contiennent seulement des pseudonymes et credentials fictifs locaux.
Aucune impression papier ou caméra physique n'est revendiquée.

## Performances, offline et confidentialité

Sur cette machine Chromium locale, le dialogue est monté en environ 5 à 25 ms
(mesure DOM, pas un benchmark de téléphone réel). Les mesures exactes sont dans
le fichier performance.json de la revue ignorée. Les 132 icon membres pèsent
1 103 708 octets ; medium seulement pour l'aperçu, large pour fiche/carte/PDF.
L'ensemble de la revue + exports ne demande que quelques large distincts, pas 132.

Pas de service worker ajouté, pas de CacheStorage privé, pas de cookie ou nouvelle
persistance participant. Le dossier complet fonctionne offline : test Chromium
avec réseau désactivé, grille/aperçu et décodage des trois variantes locales.
Le HTML seul ne transporte pas ces images. Le cache HTTP opportuniste n'est pas
présenté comme une garantie offline complète ; distribuer le dossier du pack.
Les lectures/écritures du relais nécessitent toujours une connexion comme auparavant.

Les 504 WebP sont des ressources du site ou du dossier, aucune URL distante/CDN.
Le seul nouvel état métier est un ID texte nullable de catalogue. Pas d'image
base64, upload, R2, blob D1, nouveau stockage binaire, identifiant dans le vote,
changement de snapshot, unicité ou audience. Les options et le credential de carte
restent dans la mémoire temporaire déjà existante. Aucun nom/token ajouté aux logs.
Les fichiers d'accès/QR réels, bases, captures, PDFs, caches, env et byluuma sont
exclus du commit et du bundle. Les fixtures de tests ne sont pas des validations
humaines de production.

## Incidents corrigés sans réduire les tests

- L'ancienne grille utilisait des pistes comprimées par max-height, laissant les
  boutons déborder sur la rangée suivante : pistes explicites et assertion de
  non-chevauchement de chaque rangée, sans redimensionner les WebP.
- Un test choisissait l'illustration déjà courante puis attendait une modification :
  le scénario choisit désormais une autre illustration, en conservant le contrôle
  d'enregistrement réel et les cardinalités exactes.
- Les tests doivent attendre la résolution du dialogue et le remplacement de la
  vraie fiche SPA, pas tester un champ avant la microtâche ni celui de l'ancienne
  route. Attentes sur l'état réel du DOM et la valeur sélectionnée, pas délai arbitraire.
- Le toucher après Aucune illustration révélait un déplacement du dialogue lorsque
  l'aperçu recevait son image. La zone de prévisualisation garde maintenant sa
  hauteur, y compris sans image ; le test touchStart/touchEnd réel émulé passe.
- L'inspection des cartes a montré que les options occupaient la colonne des outils
  et repoussaient l'export : elles sont maintenant dans ce panneau avec les exports.

## Limites et futur déploiement

Le choix artistique final, lisibilité sur téléphone réel, scan papier et impression
physique restent à valider humainement. Les illustrations très détaillées restent
volontairement petites dans les listes ; le sélecteur offre le medium pour décider.
Le modèle des cartes récupérables après invitation n'est pas changé : pas de coffre,
réimpression d'une carte perdue toujours via régénération invalidant l'ancienne.

Ce frontend ne doit pas être publié seul contre l'ancien Worker : un futur
 déploiement autorisé devra appliquer 0005, déployer le Worker compatible puis
Pages. Aucun déploiement, accès à l'Espace test conservé ou mutation production
n'est effectué dans cette mission. Aucun commit précédent réécrit.

## Captures de revue visuelle

38 PNG Chromium originaux dans `.browser-tests/voti-visual-assets-review/`, 19 à
1440×900 et 19 à 390×844. Aucune retouche ou annotation des images ; seuls les
fichiers WebP originaux sont utilisés. Le MANIFEST.json ignoré donne dimensions,
tailles et SHA-256 ; index.html est la planche locale, hors source/audit.

Liste exacte :

```text
card-adult-1440.png
card-adult-390.png
card-adult-night-1440.png
card-adult-night-390.png
card-child-1440.png
card-child-390.png
card-creature-1440.png
card-creature-390.png
card-groups-1440.png
card-groups-390.png
detail-adult-1440.png
detail-adult-390.png
detail-child-1440.png
detail-child-390.png
detail-creature-1440.png
detail-creature-390.png
detail-group-1440.png
detail-group-390.png
groups-1440.png
groups-390.png
members-1440.png
members-390.png
preview-adult-1440.png
preview-adult-390.png
preview-child-1440.png
preview-child-390.png
preview-creature-1440.png
preview-creature-390.png
selector-adult-1440.png
selector-adult-390.png
selector-all-1440.png
selector-all-390.png
selector-child-1440.png
selector-child-390.png
selector-creature-1440.png
selector-creature-390.png
selector-group-1440.png
selector-group-390.png
```

Chaque capture a été inspectée. Grille icon sans chevauchement, filtres lisibles,
focus/sélection visibles, preview medium corps entier ; fiches sans déformation,
listes toujours compactes. Les captures Carte viennent du vrai parcours de
régénération local, pas de maquettes ; membre et QR dominent, groupes petits et
secondaires, Nuit garde la zone QR blanche. Les outils restent à côté sur desktop
et suivent la carte sur mobile sans barre globale fixe concurrente. Les fiches
et cartes longues défilent normalement sur téléphone ; cela n’empêche aucune action.

La revue est technique/visuelle Codex ; aucune validation humaine ou papier nouvelle
n’est revendiquée. Les credentials visibles dans les QR sont exclusivement fictifs
et locaux. Les PNG et les PDFs ne sont ni staged ni inclus dans le bundle source.

## Résultats finaux des tests

23 commandes distinctes de livraison, toutes terminées avec code 0 ; les relances
ciblées sont consignées dans `.browser-tests/visual-release-results.json` (ignoré).
Aucun test supprimé ou affaibli. Les chiffres ci-dessous sont les résultats réels.

| Commande | Résultat PASS |
| --- | --- |
| npm test | 408 tests unitaires |
| npm run check | 136 fichiers JavaScript syntaxiquement valides |
| npm run test:visual-api | **212 contrôles dédiés** + 2 contrôles de pilote/migrations locales |
| npm run test:visual-identities | 1007 contrôles Chromium ; 38 captures ; API initiale également exécutée, puis renforcée dans test:visual-api |
| npm run test:visual-pdf | 94 contrôles ; 4 PDF ; **15 QR** décodés à 300 dpi |
| npm run test:browser | 2966 contrôles |
| npm run test:space-ui | 2845 contrôles + 2 pilote local, 46 captures de non-régression |
| npm run test:spaces-ux | 368 contrôles + 2 pilote local |
| npm run test:spaces | 368 contrôles navigateur + 188 HTTP/D1 local |
| npm run test:member-cards | 30 contrôles, 2 A4, 9 QR décodés à 300 dpi |
| npm run test:card-polish | 66 contrôles, 6 PDF, 10 QR décodés à 300 dpi |
| npm run test:spaces-migration | 16 contrôles : 8 historiques 0004 + 8 additifs 0005 |
| npm run test:participation | 294 contrôles ; 3 PDF |
| npm run test:comments | 37 contrôles ; 3 PDF ; 7 QR décodés |
| npm run test:relay | 118 contrôles HTTP locaux |
| npm run test:integration | 119 contrôles HTTP locaux + 3136 Chromium |
| npm run test:free-pilot | 67 contrôles HTTP/D1 sans R2 + 3138 Chromium |
| npm run test:poster | 97 contrôles ; 8 PDF ; 30 QR décodés |
| npm run test:poster-studio | 188 contrôles ; 13 PDF ; 51 QR décodés |
| npm run test:poster-polish | 117 contrôles ; 7 PDF ; 36 QR décodés |
| npm run test:member-scanner | 11 contrôles locaux |
| npm run build | HTML local + pack WebP, réussi |
| npm run build:production | Réussi **en dernier**, après le dernier test API renforcé |

Les suites relay/integration utilisent le simulateur R2 historique de leur config
**locale** ; aucun binding ou service distant ajouté. Le profil Free sans R2 est
vérifié séparément par free-pilot et les suites Espaces/identités.

Preuve supplémentaire avec profils réellement illustrés : deux membres, snapshot
2, minimum 2, votes et commentaires anonymes. D1 : deux bulletins, deux commentaires,
participation_id NULL, zéro Participation/member_participations ; aucun des 168 IDs
visuels dans les lignes ou résultats. Administration : X/Y, members=null. Après
changement d'illustration du premier membre : retry de la même action accepté une
seule fois, nouvelle action refusée ALREADY_PARTICIPATED, COUNT bulletins toujours 2.
Cela complète la preuve structurelle, sans prétendre à un anonymat cryptographique.

## Build final et distribution

**1 790 490 octets**, SHA-256 :
`b67f7a18554b9093024d45a79debbe3a38d662ea4834ba7c9abe60e7c04d4e86`.

Référence initiale 1 669 112 octets : **+121 378 octets**, pour le catalogue de
métadonnées/IDs, les sélecteurs, styles et rendu des variantes. Les images ne sont
pas encodées dans le HTML. WebP + manifeste séparés : **19 872 714 octets** ;
HTML + pack complet : **21 663 204 octets**. Aucun CDN ou dépendance ajouté.

Le build production conserve relayId/baseUrl/site key publics et
REMOTE_ASSETS_ENABLED=false. Aucune clé serveur. Les nouveaux assets n'ont aucun
chunk EXIF/XMP : 504 VP8, 396 VP8X/ALPH uniquement. Le code de vote, les définitions,
hashes, règles de résultats et sessions temporaires restent fonctionnellement
inchangés ; les suites D1/participation/scanner/concurrence les revérifient.

## Manifeste prévu du nouveau commit local

Parent : `45d17a9c5e685a1de8fde6e6369d80e78fe337be`.
Message : `feat: intégrer les identités visuelles Voti`.
Pas d'amend, rebase, squash, push, déploiement ou commande production.
Le SHA nouveau est relevé après commit dans la réponse finale.

**551 fichiers** : 505 fichiers du pack (JSON original et 504 WebP, liste exacte
avec empreintes dans `docs/audit/VOTI_VISUAL_CHECKSUMS.sha256`) et les 46 chemins
code/documentation/tests ci-dessous, dont suppression des deux manifestes vides.
Staging explicite, jamais git add . ; l'index est comparé à cette liste complète.

```text
.gitignore
README.md
docs/CODEX_V0_6_2_VISUAL_IDENTITIES_REPORT.md
docs/DATA_MODEL_V0.md
docs/MEMBER_CARDS_V0.md
docs/MEMBER_VISUALS_V0.md
docs/SPACES_GROUPS_V0.md
docs/UX_FLOWS_V0.md
docs/PRIVACY_AND_ABUSE_V0.md
docs/RELAY_CONTRACT_V0.md
docs/audit/VOTI_VISUAL_CHECKSUMS.sha256
index.html
package.json
relay/cloudflare/migrations/0005_visual_identities.sql
relay/cloudflare/spaces-service.js
scripts/audit-bundle.mjs
scripts/browser-space-layout.mjs
scripts/browser-space-polish.mjs
scripts/browser-test.mjs
scripts/browser-visual-identities.mjs
scripts/build.mjs
scripts/dev.mjs
scripts/free-pilot-integration.mjs
scripts/run-visual-review.mjs
scripts/spaces-migration-checks.mjs
scripts/test-visual-cards.mjs
scripts/visual-assets.mjs
scripts/visual-identities-checks.mjs
scripts/visual-static.mjs
shared/space-wire.js
shared/visual-ids.js
tests/audit-bundle.test.js
tests/member-presentation.test.js
tests/visual-identities.test.js
web/assets/member-visuals/manifest.json
web/assets/group-visuals/manifest.json
web/http-relay.js
web/member-card-view.js
web/member-cards.js
web/space-management.js
web/spaces-ui.js
web/styles.css
web/visual-field.js
web/visual-gallery.js
web/visual-presets.js
web/visual-selector.js
```

Les sept rapports historiques initialement modifiés restent exclus, identiques à
leur état initial, ainsi que les captures personnelles, anciennes archives et spec
UX hors lot. byluuma, PDF/QR/exports, caches, profils, bases, env et ZIP n'entrent pas
au commit. Aucun changement de package-lock, configurations Cloudflare ou anciennes
migrations ; le seul fichier Worker métier modifié est spaces-service.js, localement.
Les changements shared sont exclusivement le contrat optionnel et le catalogue d'IDs.

## Bundle source

Le bundle `VOTI_AUDIT_V0_6_2.zip` est reconstruit via le mécanisme existant après ce
rapport. Il contient les WebP optimisés nécessaires, pas le ZIP de transfert,
captures, PDF/QR, source PNG, base/backup/env/cache/profil/node_modules ou export privé.
Le contrôle final vérifie CRC, manifeste, octets sources, 504 WebP originaux et
secrets dans les fichiers texte et modules HTML décodés. Taille/hash du ZIP sont
relevés après sa dernière reconstruction, hors du rapport pour éviter une empreinte
autoréférente. Aucun déploiement distant n'est nécessaire à ces vérifications.

Contrôles de livraison exécutés : **PASS**. Index exact de 551 chemins, dont 504
WebP et le manifeste original ; octets staged comparés aux fichiers locaux.
176 fichiers suivis hors lot restent identiques à l'état initial, y compris les
sept rapports déjà modifiés, anciennes migrations, configurations, Worker d'entrée
et lockfile. `git diff --check` et `git diff --cached --check` passent.
Scan raisonnable des textes et **65 modules** HTML décodés : aucun credential
littéral, clé privée, token GitHub ou clé AWS détecté. Les 505 fichiers du pack
restent identiques au ZIP source ; aucun EXIF/XMP dans les WebP.

Bundle vérifié : **723 entrées**, dont les **504 WebP originaux**. CRC de chaque
entrée, décompression Python, manifeste auditPaths et comparaison aux octets du
working tree réussis. Aucun PNG, PDF, CSV, ZIP récursif, base ou transfert byluuma.
La dernière reconstruction inclut ce constat ; ses taille/SHA sont donnés dans la
réponse finale. Le mécanisme historique inclut aussi les documents locaux
préexistants admissibles, qui restent exclus du nouveau commit et non modifiés.
Le ZIP demeure ignoré/non commité. Les captures sont également hors Git/audit.


## Publication contrôlée — 23 octobre 2026

Publication autorisée explicitement par Lu’uma : migration 0005 seule, Worker
compatible, contrôles API, puis push du commit déjà audité et GitHub Pages.
Aucun correctif produit/UX n’a été apporté pendant cette publication. Aucun nouveau
commit, amend, rebase ou squash. Les sept rapports historiques déjà modifiés et
les fichiers personnels restent hors commit ; l’index reste vide. Cette section
post-publication est ajoutée localement, sans commit documentaire supplémentaire.

### Préflight, sauvegarde et migration

HEAD local initial/final : `9dad05b11cd5e4ec2be7e24749ad0656d8e4a7b5`.
Parent et main distante avant push : `45d17a9c5e685a1de8fde6e6369d80e78fe337be`.
Working tree applicatif identique au commit audité ; build inchangé, index vide,
`git diff --check` valide. Wrangler installé 4.149.0, Node 22.23.3. Syntaxe export,
migrations apply et deploy vérifiée dans l’aide du CLI installé.

Cible vérifiée réellement : compte `1c74451e938197bbcd316939932fc778`,
D1 `voti-production` / `bb3329c1-7de3-4147-8d07-af8679b6cd12`, Worker `voti-relay`.
Avant écriture : migrations 0001–0004, seule 0005 en attente. Export D1 privé créé
avant migration dans un répertoire ignoré, permissions restreintes ; reconstruction
SQLite locale réussie, quick_check ok et aucune violation FK. Sauvegarde conservée,
contenu non affiché et absent du dépôt/bundle. Compteurs revérifiés immédiatement
avant application.

Commande exécutée avec configuration production explicite :

```sh
node_modules/node/bin/node node_modules/wrangler/bin/wrangler.js d1 migrations apply voti-production --remote --config relay/cloudflare/wrangler.production.jsonc
```

0005_visual_identities.sql appliquée et enregistrée exactement une fois. Deux
colonnes `visual_id TEXT DEFAULT NULL`, nullables ; anciens membres et groupes
restés à NULL. Export après migration reconstruit localement : données des 21 tables
historiques comparées sans afficher leur contenu, toutes identiques ; index et
triggers inchangés. Aucun bulletin brut interrogé directement en production.
`PRAGMA quick_check = ok`, `foreign_key_check` vide.

Avant/après puis contrôle final : 2 sondages, 5 bulletins, 0 commentaire,
0 Participation, 1 Espace, 2 groupes, 5 membres, 5 affiliations,
2 accès de gestion, 5 credentials membres, 1 invitation, 0 audience de sondage
Espace. Aucun choix visuel attribué automatiquement. Aucune fixture créée,
aucune modification des membres/groupes de l’Espace test.

### Worker compatible déployé avant le frontend

Worker précédent : version `31ad3d94-8e25-4490-91f5-125c58552e79`,
deployment `67074c50-987e-431e-85d8-85ba216f6c35`.
Dry-run du package audité réussi (116,67 Kio, gzip 27,06 Kio), puis :

```sh
node_modules/node/bin/node node_modules/wrangler/bin/wrangler.js deploy --config relay/cloudflare/wrangler.production.jsonc --no-autoconfig
```

Nouvelle version : `71281198-44dc-4454-9243-1a7fcc688f3f`.
Deployment : `a5380ae2-05c3-4c5c-abf1-485e95722b4d`, 100 % du trafic.
URL : https://voti-relay.voti-luuma8888.workers.dev

Bindings vérifiés après déploiement : D1 attendue ; LIMITER 120/60 s,
CREATION_LIMITER 30/60 s, ASSET_LIMITER 600/60 s ; namespaces inchangés.
relayId voti-production ; REMOTE_ASSETS_ENABLED=false ; CORS limité à
https://luuma8888.github.io ; TURNSTILE_MODE=siteverify ; hostname
luuma8888.github.io ; TTL 86400 ; cron `17 * * * *`. Secret Turnstile : présence
vérifiée uniquement par métadonnées, jamais valeur lue/copiée/régénérée.
Aucun R2, aucune modification du forfait Free confirmé par Lu’uma.

Smoke API : 16 contrôles réussis, GET/OPTIONS et commandes de lecture seulement,
credentials aléatoires inexistants en mémoire ; refus correct des accès invalides,
includeVisuals accepté syntaxiquement sans contourner l’autorisation, CORS strict,
aucun cookie. Six projections publiques des deux sondages libres comparées avant
et après Worker : mêmes statuts, mêmes empreintes ; résultats historiques disponibles
ou 423 RESULTS_LOCKED selon leurs règles. Le premier helper de smoke ignorait le
statut historique 423 : assertion du helper privé corrigée, aucun code produit changé.
Aucun vote de production soumis et aucun challenge Turnstile simulé.

Repli : ne jamais revenir à un Worker v0.5/v0.5.1 après v0.6. En cas d’incident,
arrêt et diagnostic, forward-fix compatible avec les gardes d’audience v0.6 ; pas
de restauration destructive ni rollback automatique effectué.

### Push et publication Pages vérifiés

Après vérification de main distante sans concurrence, push normal du seul commit
`9dad05b11cd5e4ec2be7e24749ad0656d8e4a7b5`. SHA distant identique. Aucun force-push.
Mécanisme Pages existant conservé, aucun workflow modifié.

Déploiement Pages `7286501901`, état success, commit observé
`9dad05b11cd5e4ec2be7e24749ad0656d8e4a7b5`.
URL : https://luuma8888.github.io/voti/
Propagation effective constatée après quatre lectures bornées : HTTP 200,
HTML **1 790 490 octets**, SHA-256
`b67f7a18554b9093024d45a79debbe3a38d662ea4834ba7c9abe60e7c04d4e86`,
strictement identique octet par octet au build audité.
Configuration publique relayId/baseUrl/site key attendue, images distantes désactivées,
scanner local embarqué ; aucun secret/credential dans les modules servis, aucun script
CDN ajouté.

505 fichiers publiés vérifiés (manifeste + 504 WebP), HTTP 200 et SHA-256 identiques
aux fichiers locaux : 19 872 714 octets, 132 illustrations membres et 36 groupes.
Aucune recompression d’asset.

### Smoke navigateur publié et limites humaines

107 contrôles Chromium réussis à 1200 et 360 px : accueil, création libre sans
soumission, Espaces, présentation de carte vide, sauvegarde, lecture des deux
sondages publics et de leurs résultats. Aucune exception JS, erreur réseau,
requête mutante, origine inattendue, cookie ou session participant créée. Toutes
les méthodes hors GET/OPTIONS bloquées avant réseau dans ce navigateur de smoke.

Les sélecteurs sont aussi ouverts directement comme composants dans le DOM publié,
sans accès Espace et sans écriture : 132 options membres, filtres Tous 132 /
Créatures 60 / Enfants 36 / Adultes 36, 36 options groupes, images icon et medium
chargées, humains medium verticaux en contain, validation provisoire de l’ID en
mémoire, fermeture correcte. Ceci vérifie le rendu du composant livré, pas sa
persistance dans un Espace authentifié.

Aucun navigateur utilisateur connecté ni fichier d’accès à l’Espace test disponible.
Après demande de chemin d’accès sans secret, Lu’uma a répondu « Non, c’est pas grave,
ignore. » Les vérifications privées sont donc explicitement laissées humaines :
accès à l’Espace existant, fiches membre/groupe depuis cet Espace, enregistrement
visualId puis reload, Carte Voti réelle avec illustration et QR réellement scanné.
Aucun accès n’a été créé/récupéré et aucune carte existante régénérée pour contourner
ce manque. L’Espace test conservé n’a pas été muté.

Les tests locaux déjà audités de persistance, rôles, anonymat, snapshot et PDF
restent valides : 15/15 QR illustrés redécodés à 300 dpi, corps entiers non recadrés,
miniatures groupes secondaires. Ils ne sont pas présentés comme des validations
humaines/privées de production. Aucun vote/anonymat/résultat métier n’a été rejoué
avec une carte réelle pendant le déploiement.

Contrôle D1 final : 0001–0005, une seule entrée 0005, quick_check ok,
foreign_key_check vide ; toujours 2 sondages / 5 votes, 1 Espace / 2 groupes /
5 membres, zéro visual_id non NULL. Aucun incident produit ni correctif UX après
déploiement. Publication techniquement cohérente ; recette privée/humaine à faire.
Le bundle d’audit pré-publication est conservé sans réécriture.


## Correctif local — sélection explicite des illustrations

Retour humain après publication : cliquer une illustration ne fixe pas le choix,
qui suit encore la dernière vignette survolée. Cause : le même helper `show`
affectait `candidate` sur mouseenter, focus et click. Traverser la grille pour
rejoindre le bouton de validation remplaçait donc le choix fait au clic.

Correction frontend ciblée dans `web/visual-selector.js` : aperçu séparé de la
sélection provisoire. Le survol/focus actualise seulement l’image medium ; clic,
toucher ou activation native au clavier fixe l’ID et le marquage aria-pressed.
Sortir de la grille ou mettre le focus sur la validation réaffiche le choix fixé.
Le texte « Sélection : … » reste lié au choix explicite, et le bouton devient
« Valider mon choix ». Filtres, suppression d’illustration, annulation et stockage
de l’ID après enregistrement de fiche conservent leur fonctionnement.

Test ajouté à `scripts/run-visual-review.mjs` : vrai pointeur Chromium, membre et
groupe, 1440 et 390 px ; survol d’une autre vignette avant/après clic, traversée
de la grille jusqu’à Valider, changement de filtre et ID finalement transmis à
la fiche. Le test échoue bien sur le code publié avec « Un survol a écrasé le choix
cliqué ». L’ancien test de focus clavier est adapté au comportement attendu :
flèche = aperçu sans sélection, Entrée = choix ; toucher testé sur un autre ID.
La simulation Entrée CDP inclut son caractère natif, comme les autres tests clavier.

Vérifications locales : npm test PASS (408 tests) ; npm run check PASS
(136 fichiers) ; syntaxe des deux fichiers modifiés vérifiée à nouveau.
Le premier lancement sandbox des tests workerd/D1 échouait au démarrage ; relance
avec autorisation pour les processus/ports locaux réussie, sans accès production.
La suite visuelle complète valide également le catalogue, les autorisations,
la persistance, l’annulation, les filtres, le clavier, le tactile et l’offline.
Les captures de revue existantes sont régénérées par la suite, avec fixtures
fictives locales ; les sélecteurs 1440 et 390 px sont inspectés sans débordement.

Aucun changement shared, relay, migration, contrat ou credential. Aucun appel
production, nouveau commit, staging, push ou déploiement pendant ce correctif.
Le bundle d’audit pré-publication reste celui de la version déjà publiée.
Les résultats définitifs de la suite visuelle et du build sont consignés ci-dessous.

Résultats définitifs : `npm run test:visual-identities` PASS, 1 372 contrôles
Chromium / 38 captures, 215 contrôles HTTP/D1 locaux (dont 212 spécifiques),
aucune ressource distante. `npm run build:production` PASS,
**1 791 014 octets**, SHA-256
`25ba827e52aefdae697d0f8b16e5a8e22cdae6ff3ef28aa252b420ff6424f487`. Variation par rapport au build publié :
+524 octets, due à la séparation aperçu/choix et à ses messages.
`git diff --check` PASS. HEAD reste
`9dad05b11cd5e4ec2be7e24749ad0656d8e4a7b5`, index vide, aucune publication
du correctif. Suites PDF/Worker complètes non relancées : rendu PDF, API et backend
inchangés ; la suite visuelle couvre les interactions et les écritures locales
concernées. Le correctif reste à commiter/publier avec accord explicite.

Publication du correctif autorisée explicitement par Lu’uma après validation locale.
Livraison frontend seule : sélecteur, test navigateur, build et présent rapport ;
aucun autre rapport historique, média personnel ou fichier privé dans le commit.
Worker, D1 et configuration Cloudflare hors de cette publication.
