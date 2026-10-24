# Groupes HD V2 — intégration locale

## État initial et audit avant modification

HEAD et origin/main : `1f4df2cf2cee879904ed972c0fdb3865970da268`.
Index vide ; neuf rapports historiques déjà modifiés, cinq captures personnelles,
archives et document historique non suivi préservés. Aucun accès production.

Le chemin `/mnt/data/VOTI_GROUPS_HD_V2_CODEX.zip` n’existe pas dans cette session.
Le fichier est présent à la racine du dépôt et son SHA-256 correspond exactement :
`c7cd6d50b192824e54f4d28ec232364bbde4fdd3aa41f85a30ea0d092b7b2df7`.
Taille ZIP 20 319 142 octets. CRC de 148 entrées PASS, 147 checksums internes PASS.
README_CODEX et manifeste complets lus avant copie ; 144 WebP contrôlés avant copie,
36×128, 36×384, 36×768, 36×1024 carrés. Tailles natives déclarées dans le crop-audit fourni : 1215–1269 px ; les planches
PNG masters ne sont ni incluses ni recadrées dans ce lot.

Architecture inspectée : manifeste JSON combiné membres/groupes ; catalogue au build
via `scripts/visual-assets.mjs`, runtime `web/visual-presets.js` (API et alias plats),
serveur statique `visual-static.mjs`, sélecteur, listes/fiches et renderer commun.
Le fond actuel charge `visual.large`, 512×512, via `card-backdrop.js` pour DOM/PDF.
Le fondu validé est horizontal, uniforme sur la moitié gauche puis nul au bord droit.
Ce calcul, la mosaïque, les thèmes, l’intensité et la réserve QR restent inchangés.

## Décisions d’intégration

Une divergence réelle du ZIP concerne G01/09 : son ID source
`group_g01_09_mushroom_village` diffère de l’ID métier existant
`group_g01_09_mushroom_village_nook`. L’ID métier `_nook` est conservé sans aucune
modification de shared/Worker/D1. Ses quatre fichiers proviennent du même emplacement
G01/09 du pack V2. Aucune nouvelle identité n’est introduite. L’ordre du catalogue,
les libellés français et les métadonnées de présentation existantes sont conservés ;
les champs files et les dimensions groupes prennent les valeurs HD V2.

Les fichiers physiques portent un suffixe de SHA-256, avec correspondance dans le
manifeste. Les IDs ne dépendent jamais des noms physiques. Le nouveau catalogue
utilise de nouvelles URLs, sans réutiliser les anciennes réponses de cache. Les
108 fichiers V1 remplacés sont retirés du runtime. Comparaison V1 conservée seulement
dans `.browser-tests/voti-groups-hd-v2/before/`, ignorée et exclue des bundles.

Le runtime expose les quatre chemins dans files et conserve les alias plats pour
les appelants existants. Les membres restent strictement à trois variantes et leurs
396 WebP restent identiques. Le fond utilise exclusivement backdrop ; aucune autre
règle de carte, de lot mémoire ou de gestion de credentials n’évolue.

## Résultats

PASS technique local le 24 octobre 2026 : 36 IDs conservés, 144 WebP V2,
18 commandes de contrôle réussies, captures inspectées et QR redécodés.
Mission strictement locale : aucun push, Pages, Worker, D1 distant ou migration.
La validation visuelle humaine de ces nouvelles scènes reste à effectuer.

## Inventaire et poids

| Variante groupes | V1 octets | HD V2 octets | Dimensions V2 |
|---|---:|---:|---|
| icon | 244 652 | 172 724 | 128×128 |
| medium | 1 067 460 | 1 616 634 | 384×384 |
| large | 3 648 506 | 6 515 146 | 768×768 |
| backdrop | 0 | 11 965 080 | 1024×1024 |

Total V1 : 4 960 618 octets ; V2 : 20 269 584 octets ; différence : +15 308 966 octets.
Les icon groupes sont plus légers qu’avant ; la couche de fonds n’est pas
préchargée. Medium reste lazy dans Vignettes, icon dans la grille/listes, large
768 dans la fiche. Les 396 WebP membres restent identiques ; total runtime 540
WebP. Aucun PNG, planche 4K, ZIP, CSV de crop ou document source dans les assets.
Tous les 144 nouveaux fichiers ont aussi été entièrement décodés avec Pillow.

## Runtime, cache et compatibilité

Manifeste combiné schemaVersion 2 : entrées membres conservées, entrées groupes
conservant leurs métadonnées françaises et IDs, files remplacé par quatre variantes.
Le build vérifie les dimensions, SHA et la synchronisation avec le catalogue serveur
existant, qui reste byte-for-byte identique. Seuls les groupes exposent files en plus
des alias icon/medium/large/backdrop ; l’API et les fichiers membres restent inchangés.
`getGroupVisual(id)` et `listGroupVisuals()` résolvent les fichiers via ce catalogue.
Les suffixes SHA-256 de 12 caractères sont dérivés des octets exacts fournis, pas des IDs.
Empreintes source : docs/audit/VOTI_GROUPS_HD_V2_CHECKSUMS.sha256 ; références du
runtime : VOTI_VISUAL_CHECKSUMS.sha256, actualisées sans modifier les lignes membres.

Une fixture de cache utilise les vrais octets V1 depuis l’historique Git initial,
pas une dépendance à un fichier de transfert privé. Le navigateur conserve réellement
l’ancienne URL de 512 en cache (une seule requête). Après changement simulé du
serveur, le même ID avec son nouveau catalogue charge les nouvelles URLs 768 et
1024. Les URLs hashées sont immuables sur le dev server ; les en-têtes Pages ne
sont pas modifiés. Un onglet encore ouvert conserve son ancien catalogue jusqu’à
chargement du nouveau HTML ; aucun reload forcé qui détruirait ses cartes mémoire.

Le test D1 local crée des groupes avec des IDs historiques G01, G02, G03 et `_nook`,
puis vérifie leur lecture inchangée dans deux sessions et leur résolution V2 sans
rename/réassignation intermédiaire. Aucune intervention sur les groupes production.
Les 36 IDs serveur, le contrat Worker et les migrations existantes sont inchangés.

## Fonds et PDF

La seule modification du renderer est `load(v.backdrop)` à la place de `load(v.large)` :
le reste du fichier est strictement identique au HEAD initial. Le dessin partagé,
les gradients, l’alpha, les rectangles, le QR, les thèmes et le traitement cover
restent donc exactement ceux validés. Les fonds chargés sont mesurés à 1024 :
deux groupes chargent deux images, les cas jusqu’à six groupes n’en chargent que
quatre uniques, avec réutilisation du cache. Le sélecteur ne charge ni large ni
backdrop. Les tests de dossier offline vérifient aussi les quatre variantes groupes.

La définition du fond passe de 512² à 1024², soit 2× en dimension et 4× en pixels.
Les masters du pack sont supérieurs à 1024 ; aucune image n’est reconstruite ou
recompressée. Le raster PDF reste à 300 dpi et effectue le même redimensionnement
de dessin qu’avant, avec une source plus définie. Les scènes sont plus détaillées ;
l’effet final reste atténué par la transparence et le fondu volontairement conservés.
La planche des 36 large a été inspectée : sujets cohérents, pas de séparation
blanche ou bord de planche visible. Inspection des cartes/PDF détaillée après les suites.

La comparaison technique V1/V2 est une comparaison de définition et d’usage ;
les nouvelles générations ont aussi une composition différente. Elle ne prétend
pas être une mesure de netteté pixel à pixel d’une même image. Les exemples source
et les rendus sont conservés seulement dans la revue ignorée.

## Tests exécutés

Node v22.23.3 du dépôt ; Poppler pdftoppm 25.03.0. Toutes les opérations HTTP/D1
des tests concernent les serveurs locaux et des fixtures fictives. Les sorties
détaillées sont ignorées sous `.browser-tests/groups-hd-*.log` ; les résultats
complets sont dans `groups-hd-main-results.json`, le dernier passage ciblé dans
`groups-hd-results.json`.

| Commande | Résultat |
|---|---|
| npm test | PASS, 419 tests, dont deux nouveaux tests HD V2 |
| npm run check | PASS, 149 fichiers JavaScript |
| npm run test:groups-hd-v2 | PASS, 114 contrôles Chromium + 2 contrôles pilote local |
| npm run test:groups-hd-v2-pdf | PASS, 45 contrôles, 9/9 QR à 300 dpi |
| npm run test:browser | PASS, 2966 contrôles, dont Mode libre/offline |
| npm run test:space-ui | PASS, 2855 contrôles, rôles, shell et responsive |
| npm run test:spaces-ux | PASS, 368 contrôles Chromium + 2 pilote |
| npm run test:spaces | PASS, 368 contrôles Chromium + 188 pilote |
| npm run test:visual-identities | PASS, 212 D1, 1376 Chromium, 215 pilote |
| npm run test:visual-pdf | PASS, 94 contrôles, 15/15 QR à 300 dpi |
| npm run test:member-cards | PASS, 30 contrôles, 9/9 QR à 300 dpi |
| npm run test:card-polish | PASS, 66 contrôles, 10/10 QR à 300 dpi |
| npm run test:card-ux | PASS, 279 contrôles Chromium + 2 pilote |
| npm run test:card-ux-pdf | PASS, 10 contrôles, 2/2 QR à 300 dpi |
| npm run test:card-background-batch | PASS, 175 contrôles + 2 pilote |
| npm run test:card-background-pdf | PASS, 65 contrôles, 17/17 QR à 300 dpi |
| npm run test:spaces-migration | PASS, 16 contrôles des migrations existantes, local seulement |
| npm run build:production | PASS, configuration publique habituelle, médias distants désactivés |

Soit 62 QR redécodés sur les six suites PDF, dont les neuf cartes de la matrice HD
(1/2/3/4/6 groupes, humains/créatures, cinq thèmes). Aucun test supprimé ou affaibli.
Les attentes 504 → 540 reflètent uniquement les 36 nouveaux fichiers backdrop ;
la fixture de catalogue synthétique groupe possède désormais cette quatrième variante.
Après avoir rendu le test de cache autonome via Git, le test HD, son PDF, check et
le build production ont été relancés avec succès. `git diff --check` est PASS.

Les nouveaux tests vérifient chaque octet fourni contre le checksum source, tous
les chemins/dimensions/hashs, zéro orphelin, les IDs historiques, les alias de
runtime, le refus d’un backdrop membre et le dossier offline complet.
Le test de cache s’appuie sur le commit initial disponible dans l’historique Git ;
il ne nécessite pas le ZIP de transfert ni la sauvegarde privée de comparaison.

## Captures et inspection visuelle

Répertoire ignoré : `.browser-tests/voti-groups-hd-v2/`.
15 captures Chromium réelles (1440×900 sauf les deux vues 390×844), puis deux
extraits de cartes du PDF rendu à 300 dpi :

- `groups-list-v2.png`
- `groups-tiles-v2.png`
- `group-detail-v2.png`
- `group-selector-v2.png`
- `card-one-group-v2.png`
- `card-one-group-night-v2.png`
- `card-two-groups-v2.png`
- `card-three-groups-v2.png`
- `card-four-groups-v2.png`
- `card-more-than-four-v2.png`
- `card-nature-v2.png`
- `card-douceur-v2.png`
- `card-minimal-v2.png`
- `groups-tiles-v2-390.png`
- `group-detail-v2-390.png`
- `pdf-one-group-v2.png`
- `pdf-mosaic-v2.png`

Compléments : les deux pages A4 `backgrounds-1.png` / `backgrounds-2.png`, deux
extraits PDF identiques sous les noms génériques du test, les planches
`pack-contact.png` (36 scènes), `review-contact.png` et `comparison-v1-v2.png`.
Tous restent locaux, hors Git et hors bundle source.

Inspection réelle des planches, captures et extraits PDF : scènes nettes et
cohérentes dans Vignettes, pas de bord blanc ni trait de planche repéré ; détail
carré non déformé ; mobile sans débordement. La carte montre le décor à gauche
et son fondu vers la droite dès la moitié, exactement comme auparavant. Les
personnages restent au premier plan et les vignettes groupes restent secondaires.
Les mosaïques conservent leurs raccords fondus ; aucun cadre dur ajouté. Nuit et
Minimal restent volontairement discrets ; la réserve QR est blanche et opaque.
La meilleure définition n’annule pas l’atténuation graphique voulue. Aucune
retouche esthétique supplémentaire n’a été effectuée.

## Build et distribution

HTML production : **1 861 858 octets**.
SHA-256 : `a10b4242841adb05bc3e252ac67864fc38d4f428a6c1c07802bd45b52b57aef9`.
HTML initial : 1 836 094 octets ; variation : +25 764 octets, principalement les
chemins des fichiers hashés et la quatrième variante dans le catalogue intégré.
Les images ne sont pas converties en base64 dans le HTML.

Pack WebP complet membres + groupes : **35 101 654 octets**, dont groupes HD V2
20 269 584 octets. La distribution inclut le HTML et le dossier de visuels ; le
seul HTML ne fournit pas les images offline. Les backdrops augmentent le poids
installé mais ne sont pas préchargés en navigation normale. Aucun service worker,
nouveau cache global ou mécanisme réseau n’a été ajouté.

## Confidentialité, périmètre et commit local

Seuls les fichiers runtime officiels, leurs catalogues/checksums, les tests,
le build et la documentation du lot appartiennent au manifeste de commit.
Manifeste explicite : 275 chemins (108 suppressions V1, 144 ajouts V2 et
23 fichiers texte/build/tests/docs), en comptant sans détection de renommages.
L’outil de bundle accepte les backdrops publics et exclut les chemins supprimés,
sans relâcher ses exclusions de fichiers privés. Aucun ZIP source, CSV de crop,
capture, PDF fixture, export ou sauvegarde n’est intégré au runtime/commit.

Les 396 fichiers membres et leurs entrées de manifeste sont identiques à l’état
initial. Aucun changement shared/, relay/, migration, configuration Cloudflare,
package-lock, branding, modèle de carte ou CSS. Aucune persistance nouvelle,
aucun upload, CDN, cookie ou tracking. Les tests de confidentialité existants
restent PASS ; les données de carte/credentials des fixtures restent uniquement
dans les sorties ignorées. Aucun secret de production n’a été lu.

Les neuf rapports historiques et les fichiers personnels préexistants restent
hors commit. Le commit local prévu est `feat: améliorer les visuels HD des groupes Voti`,
avec parent `1f4df2cf2cee879904ed972c0fdb3865970da268`, sans amend/rebase/squash.
origin/main reste à cette référence initiale ; aucune commande push ni déploiement.

Limites : pas de vérification distante de Pages/Worker/D1 pendant cette mission ;
pas de recette physique ni validation humaine des scènes nouvelles. Un onglet
ancien doit charger le nouveau HTML pour utiliser son nouveau catalogue. Le ZIP
fourni contient un ID source divergent G01/09, résolu explicitement sans changer
l’ID métier existant. Aucune nouvelle migration.
