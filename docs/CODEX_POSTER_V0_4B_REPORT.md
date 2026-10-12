# Voti v0.4B — QR direct, Studio et résultats PDF

Date : 12 octobre 2026. Base main `277ca20`, v0.4A publié puis recette physique
confirmée par Lu’uma, avec réserves UX consignées dans son rapport final local.
Autorité : `VOTI_POSTER_STUDIO_V0_4B_SPEC.md`, y compris section 18 bis résultats.
Lot unique ; aucune fonctionnalité reportée artificiellement en v0.4B.1/2.
Aucun commit, push, changement GitHub Pages, déploiement ou mutation Cloudflare.
Production gratuite Workers/D1/Turnstile et absence de R2 inchangées.

## Architecture et fichiers

Créés :

- web/poster-design.js : contrat v1 pur, huit palettes, contraste, quatre
  typographies, références et calcul cover/contain ;
- web/poster-storage.js : PosterRepository, persistance séparée et cycle des médias ;
- web/print-layout.js : plans testables Studio et résultats agrégés ;
- web/print-renderer.js : décodage local, renderer commun aperçu/PDF, export A4 ;
- web/poster-studio.js : éditeur, aperçu, médias, téléchargement et panneau résultats ;
- tests/poster-studio.test.js ; scripts/browser-studio.mjs ;
- docs/POSTER_STUDIO_V0.md, RESULTS_PDF_V0.md et ce rapport.

Modifiés : web/app.js, sharing.js, poster.js, styles.css, image-ui.js, remote-storage.js ;
scripts/browser-qr.mjs, browser-test.mjs, test-posters.mjs, audit-bundle.mjs ;
tests/build.test.js, audit-bundle.test.js, relay.test.js ; package.json,
README.md, docs/QR_AND_POSTER_V0.md, UX_FLOWS_V0.md ; index.html régénéré.
La spécification v0.4B non suivie est un document fourni par Lu’uma.
Rapports locaux v0.4A/v0.3E et spécification v0.3E préexistants préservés,
pas attribués aux modifications de ce lot.

Pas de nouvelle dépendance ni modification du lockfile : Canvas, pdf-lib,
qrcode-generator, jsQR de test et esbuild déjà présents sont réutilisés.
web/poster.js demeure pour compatibilité et tests historiques v0.4A ; aucun
deuxième moteur aperçu/PDF du Studio. AssetAdapter, moteur métier, règles de
publication, schéma, backup, empreintes, RelayAdapter/HTTP et Worker inchangés.

## QR : confirmation directe et retour propre

Route conservée `#/p/<pollId>/choice/<choiceId>`. Sondage ouvert/choix valide :
session de confirmation UI en mémoire, « Tu choisis », libellé/image disponible,
« Oui, je confirme » et « Autre choix ». Aucun castVote au scan/chargement.
Le choix invalide ouvre la liste décochée et un message court ; fermé, aucun
contrôle de vote ; supprimé, introuvable.

Autre choix abandonne la session et utilise replaceState vers `#/p/<pollId>`.
Refresh et événements storage sur cette route ne réappliquent pas le QR.
Le parcours classique conserve sélection → Continuer → confirmation.
actionId aléatoire et garde de double clic existants, aucun nouveau protocole.
allowDirectChoiceQr reste false/réservé ; aucune migration ni empreinte modifiée.

Tests réels multi-clients : inspection des POST vote et COUNT D1 local
indépendant, ouvert/refresh/resize/clavier sans bulletin, confirmation initiale
exactement un bulletin, Autre choix/rerender/refresh/choix alternatif sans
mutation puis confirmation exactement un bulletin supplémentaire.

Le bouton créateur devient **QR & partager le sondage** avec SVG décoratif
construit par API DOM, trois repères et quelques carrés, non scannable,
aria-hidden, currentColor. Pas d’emoji/dépendance ; cibles et focus conservés.

## Réserve v0.4A : succès après vote

Le succès est désormais un état UI en mémoire lié au sondage et à la route,
pas un simple DOM éphémère. Un rerender ne recrée donc pas une confirmation
QR après bulletin accepté. Une navigation explicite quitte cet état ; un
refresh peut revenir au parcours, mais ne vote jamais.
Le cache des connexions distantes n’écrit plus une valeur strictement identique,
ce qui évite des événements storage inter-onglets inutiles.
Le test quota exige toujours un échec pour une véritable nouvelle écriture,
et vérifie qu’une relecture identique n’écrit rien. Ni règles de vote, ni
stockage du bulletin, ni état distant ne changent.
Tests avec événement storage et succès durable ; pas de revendication de
reproduction du comportement physique exact du téléphone de Lu’uma.
Les suggestions avertissement SECRET plus fort et Local/En ligne du rapport
v0.4A restent des points UX ouverts, hors refonte générale de ce lot.

## Studio premium

Niveau simple : Type, Disposition, Palette, Typographie, Aperçu, Télécharger.
Avancé : custom couleurs/hex visibles, fond, fit/focale/voile/intensité,
images métier disponibles localement, principale et images affiche-only.
Les palettes sont nommées, sélection native explicite, pas uniquement des pastilles.
Quatre compositions réellement différentes, 2–6 réponses et pagination :
Essentielle en lignes/QR central, Cartes en grille portrait, Magazine
asymétrique, Mosaïque en grille paysage. Huit palettes et quatre piles locales.
Texte automatiquement contrasté, QR noir/blanc sur surface dédiée, pas de logo
dans les modules. Pas d’éditeur libre/cropper ou police téléchargée.
Contrastes automatiques : texte au moins 4,5:1, barres au moins 3:1 face
à leur piste, y compris avec couleurs custom ; accents décoratifs conservés.

Le plan contient coordonnées, retours mesurés, surfaces, images, QR et barres.
Le même renderer sert un aperçu 620 px et le PDF pleine résolution ; une
modification ne génère pas de PDF. Ancienne réponse d’aperçu invalidée par séquence.
Les QR de l’aperçu gardent leurs proportions ; pixels entiers/sans antialiasing
garantis dans le PDF final. Images cover sans étirement, arrondis, groupes
image/libellé/QR clairs ; portrait/paysage/carré et fonds clair/sombre testés.
Pagination jusqu’à huit pages, question continuée plus compacte plutôt que
QR réduits. Un export peut comporter une page d’introduction si le contexte
est particulièrement long : nombre de pages annoncé dans l’aperçu.

## Images et persistance locale séparée

PosterDesign v1 dans voti.poster.v1 ; format inconnu et champs inattendus refusés.
Pas de PollDefinition, ballot, capacité, URL réseau, blob/base64 dans le design.
Une absence de design initialise les défauts, sans migration du modèle métier.
Les données métier actuelles restent compatibles.

IndexedDB dédié `assetDatabaseName() + ':poster'`, mêmes transactions et
implémentation AssetAdapter. Le sweep métier ne connaît pas ce store.
Médias sémantiques seulement lus dans la base métier ; affiche-only dans la
base d’affiche. Aucune écriture relay, aucun upload, REMOTE_ASSETS_ENABLED=false.
Les images du sondage manquantes sont optionnelles, texte et QR restent utilisables.

Pipeline existant JPEG/PNG/WebP, décodage, orientation, normalisation par
réencodage local, métadonnées supprimées. Principale/fond : 1600 px/1 Mo ;
réponse : 1000 px/600 Ko. Traitements du Studio sérialisés pour ne pas décoder
plusieurs entrées de 24 MP simultanément. Pas de compression externe.
Hash/type/dimensions structurelles revérifiés avant chaque décodage de rendu,
puis dimensions réelles comparées. Références affiche-only de choix retirés
purgées à la réouverture du Studio et sweep dédié protégeant tous les autres designs.

Web Lock distinct + file de sauvegardes : validation/références/quota,
putMany atomique, puis snapshot local ; conflit d’onglet explicite.
Pas de transaction ACID commune aux deux API. Échec snapshot → cleanup ;
échec cleanup signalé et reprise au démarrage. Orphelins collectés selon toutes
les références de tous les designs ; partage protégé, remplacement/retrait
nettoyés, reset complet et retrait du design conservé après suppression distante.
Limites : 200 designs, 200 images/24 Mo dans le store affiche ; quota navigateur
réel possible. Corruption du design ne doit pas rendre les votes/résultats métier
inutilisables ; le PDF seul est alors indisponible. Aucun effacement silencieux.

Backup général inchangé : design et médias affiche-only exclus, limite annoncée
dans l’UI et le guide. Pas de prétention de sauvegarde durable du navigateur.

## PDF détaillé des résultats

Projection available:true uniquement ; contrôle de cohérence total/somme,
choix, compte, pourcentage et état threshold/closed+seuil. Le créateur n’obtient
pas un accès caché aux données sous seuil. Le panneau désactive l’export et
explique le blocage. Relecture publique au téléchargement, refus si supprimé
ou indisponible. Aucun accès aux bulletins pour fabriquer le document.

Synthèse (classement et barres), Rapport (ordre des choix, cartes détaillées).
Question/description, statut, total, chaque choix/nombre/pourcentage,
date locale explicitement d’export et QR/lien résultats si distant présent.
Ouvert : « Résultats au moment de l’export » ; fermé : état final connu,
sans certification. Égalité et 100 %/0 % testés, tous les choix restent présents.
Palettes/typos partagées, médias métier optionnels ; médias affiche-only sous
opt-in distinct désactivé par défaut. Jamais de requête image upload.

PDF A4 raster PNG sans perte à environ 300 dpi, même renderer, pagination,
QR redécodés après Poppler. Pas de texte sélectionnable ou balisage PDF.
Une surface RGBA pleine résolution d’environ 35 Mo à la fois ; les bitmaps
locaux bornés et buffers codecs/PDF s’ajoutent. Bitmaps/canvases/URLs libérés,
pas de promesse de consommation universelle sur tout téléphone ancien.

## Tests, commandes et résultats

Tests Node ajoutés : design strict/version/presets, contrastes, layouts
2/3/4/5/6 et deux modes, crop/focale, plans longs, absence de mutation/secret,
persistance/conflit, quota/rollback, orphelins partagés, résultats/seuil/closed,
cohérence des agrégats, inclusion explicite des médias.
Chromium : contrôles réels, cinq thèmes et 320/360/1200, médias locaux,
aperçu/persistance, retraits, sauvegarde métier inchangée, téléchargements PDF
réels/double clic, export résultats bloqué/relecture avant export.
Régressions v0.3E/v0.4A, file:// offline et /voti/, multi-client D1/HTTP,
assets locaux, QR secret et absence de vote préalable conservés.

Nouvelle commande : npm run test:poster-studio, après test:browser.
Elle rasterise les vrais PDF Studio/résultats avec Poppler à 300 dpi,
vérifie A4/pages et redécode les QR depuis les pixels finaux via jsQR de test.
Les fixtures sont synthétiques, ignorées sous .browser-tests, jamais des
sondages/exports admin de production.

Résultats de l’audit technique initial, avant la correction de vocabulaire ci-dessous :

| Commande | Résultat exact |
| --- | --- |
| npm test | Succès : 288 tests Node, 288 passés, 0 échec/sauté/annulé ; décompte confirmé par reporter spec |
| npm run check | Succès : 82 fichiers JavaScript |
| npm run build | Succès : HTML autonome local 1 183 721 octets |
| npm run build:production | Succès : HTML connecté gratuit 1 183 969 octets, 38 modules, sans R2 |
| npm run test:browser | Succès : 2 470 contrôles Chromium |
| npm run test:poster | Succès : 67 contrôles, 8 PDF A4 historiques et 30 QR décodés |
| npm run test:poster-studio | Succès : 115 contrôles, 13 PDF A4 Studio/résultats et 43 QR décodés |
| npm run test:relay | Succès : 72 contrôles HTTP/Worker/D1/R2 locaux |
| npm run test:integration | Succès : 73 contrôles HTTP + 2 620 contrôles Chromium multi-contextes |
| npm run test:free-pilot | Succès : 21 contrôles HTTP/D1 sans R2 + 2 622 contrôles Chromium |
| git diff --check | Succès |

La relance finale ajoute un vrai parcours Gestion → action QR avec SVG →
Partager → Créer une affiche → Studio/aperçu. COUNT D1 reste à zéro.
Les téléchargements UI PDF réels sont contrôlés avec double clic et relecture
de la projection avant l’export résultats, en plus des exports raster indépendants.

Les 13 PDF nouveaux comprennent 8 affiches (quatre layouts × deux modes,
2/3/6 choix) et 5 résultats (Synthèse/Rapport, cinq palettes, 2/3/6 choix,
égalité, 100 %/0 %, textes longs et ouvert/fermé). 21 pages au total :
Essentielle 2 choix sur une page, autres affiches illustrées de recette
sur deux pages ; résultats courts sur une page, 6 choix sur deux pages.
Le lot historique ajoute 8 PDF/10 pages : total 21 PDF et 73 QR décodés.
Inspection visuelle des PNG finaux sur les quatre compositions et les résultats,
dont pages continuées, 100 %/0 % et rapport long : pas de chevauchement ou
QR rogné observé. Fixtures colorées synthétiques, pas de validation de photos
réelles ou de caméra/imprimante revendiquée.

Build production exécuté en dernier. SHA-256 :
`e4e8ef8e9493a495c341a72c3a80bd2d2639b751a36fc63ce5786ecbc12b2af3`.
Croissance par rapport à v0.4A publié : 57 018 octets, environ 5,1 %.
Comparaison Git : backend, migrations, modèle/validation/empreintes, moteur,
assets partagés, backup, contrat/client relais, config production et lockfile
inchangés. Le cache local de connexion est le seul ajustement de stockage
hors Studio, limité à ne pas réécrire un snapshot identique.

## Incidents et limites de validation

- Premier lancement sous sandbox : processus de tests retournant un échec
  générique ; relance hors restrictions pour workerd/Chromium locaux.
- Test de contraste custom gris révélé insuffisant : choix de texte noir/blanc
  lorsque l’encre structurale ne suffit pas, sans assouplir l’exigence 4,5:1.
- Deux layouts trop proches : Magazine reçoit une vraie première carte pleine
  largeur en QR choix, Cartes/Mosaïque une grille distincte en accès.
- Test de persistance attendait le rendu plutôt que la fin de l’écriture async :
  attente de la valeur réellement conservée, sans délai arbitraire.
- Ancien test quota demandait un échec même pour le cache identique : nouvelle
  assertion sans écriture, puis vrai changement de révision exigé en échec quota.
- Fixture de résultat utilisait « summary » comme mode de design d’affiche :
  les deux intentions ont été séparées, pas d’assouplissement du validateur.
- Première intégration : comparaison du libellé avec textContent du parent
  incluant un repli d’image masqué. Assertion corrigée vers l’identifiant exact
  du choix, COUNT D1 et inspection réseau inchangés.
- Le test long étendu aux quatre layouts a révélé que le grand QR paysage
  ne tenait pas après une question longue répétée. Zone adaptée à 1000 px
  maximum, sans diminuer les modules sous leur minimum, et titres continués
  compacts ; pagination et tests longs conservés.
- Une relance Node supplémentaire exécutée pendant l’intégration a régénéré
  index.html sans relais : collision de builds dans le harnais, pas une
  mutation de backend. Les deux intégrations sont relancées séquentiellement
  sans build/test Node concurrent. Cette discipline figure déjà dans README.

La compétence PDF a imposé la recette sur les fichiers réellement exportés,
avec inspection des PNG Poppler. La compétence Wrangler a guidé le contrôle
des profils/configurations locaux existants : bindings remote:false, --local,
persistance isolée .relay-local ; aucune nouvelle commande distante ni secret.

Aucune fonctionnalité annoncée comme validée physiquement pour v0.4B.
À valider humainement après audit : parcours QR direct/Autre choix et succès
multi-onglets, vocabulaire et ergonomie Studio, photos réelles, compositions,
impression A4 et scans depuis les deux types de PDF, lecture des résultats.
Pas de décision métier manquante bloquant le périmètre demandé.
Backup Studio versionné/portabilité Android éventuelle à décider ultérieurement,
sans implémenter Android ou synchro maintenant.

## Audit et garde-fous

VOTI_AUDIT_V0_4B.zip recréé après tests et rapport via mécanisme Git admissible.
Toutes archives VOTI, PDF, exports admin, fichiers ignorés/runtime/caches/
profils/captures/bases locales exclus. CRC et octets sources vérifiés ensuite.
Pas de commit du ZIP, ni de commit/push de ce lot. Les documents préexistants
admissibles de l’espace de travail peuvent faire partie du bundle sans être
attribués à ce développement. Aucun secret réel récupéré ou recopié.
Préflight : 143 fichiers admissibles, 133 textes et 38 modules HTML décodés
contrôlés. Trois littéraux factices Siteverify historiques acceptés seulement
après comparaison avec les sources HEAD ; aucun nouveau littéral secret,
capacité complète ou clé privée détecté. Pas de comparaison avec des secrets
réels : contrôle de provenance/motifs, pas une garantie magique de détection.
La première comparaison Git synchronisée du scanner a été refusée par le
sandbox ; la variante asynchrone a terminé le même contrôle, sans modifier
de fichier ni exclure globalement les tests.
L’archive est ignorée par Git ; aucune ancienne archive, export de clé admin,
PDF ou média temporaire de .browser-tests dans les chemins admissibles.
La vérification du conteneur/CRC et des octets sources suit la génération.
Chemin et taille exacts indiqués en sortie, sans modifier ensuite ce rapport
inclus dans l’archive. Lot prêt pour audit, pas pour publication automatique.

## Correction de vocabulaire après audit technique validé

À la demande de Lu’uma, les textes utilisateur actuels ne décrivent plus le
parcours historique « présélection puis liste de choix ». L’écran dit :
« Choix proposé par le QR : <choix>. Confirme-le ou choisis une autre réponse. »
Le partage et les affiches Studio disent : « Ce QR ouvre directement la
confirmation de ce choix. Le vote n’est envoyé qu’après validation. »
Le générateur historique encore disponible utilise la même consigne, en deux lignes.
Les passages documentaires explicitement historiques v0.4A restent inchangés.

Fichiers de cette correction : web/app.js, web/sharing.js, web/print-layout.js,
web/poster.js, scripts/browser-qr.mjs, tests/poster-studio.test.js,
docs/QR_AND_POSTER_V0.md, docs/POSTER_STUDIO_V0.md, ce rapport et index.html régénéré.
Assertion Chromium adaptée au texte exact ; test Node ajouté sur la consigne
de chaque page des quatre compositions QR par choix.
Uniquement vocabulaire : comportement de vote, routes, PollDefinition,
definitionHash, schéma, migrations, Worker et ressources Cloudflare inchangés.
Aucune dépendance ajoutée. Publication explicitement autorisée par Lu’uma
après validation de l’audit technique et correction du vocabulaire.

L’archive décrite dans la section précédente correspond à l’audit antérieur
à cette correction. Elle est volontairement conservée sans régénération et
ne représente donc pas les derniers textes. Le ZIP final sera recréé après
la recette humaine et sa documentation, conformément à la demande de Lu’uma.

### Contrôles après correction de vocabulaire

Toutes les commandes demandées ont été relancées séquentiellement, sans
build concurrent avec les tests navigateur. Résultats exacts :

| Commande | Résultat |
| --- | --- |
| npm test | Succès : 289 tests ; reporter spec supplémentaire : 289 passés, 0 échec, 0 sauté, 0 annulé, 0 todo |
| npm run check | Succès : 82 fichiers JavaScript |
| npm run build | Succès : HTML autonome local 1 183 833 octets |
| npm run build:production | Succès : HTML production 1 184 081 octets, sans images distantes/R2 |
| npm run test:browser | Succès : 2 470 contrôles Chromium |
| npm run test:poster | Succès : 67 contrôles, 8 PDF A4, 30 QR décodés |
| npm run test:poster-studio | Succès : 115 contrôles, 13 PDF A4, 43 QR décodés |
| npm run test:integration | Succès : 73 contrôles HTTP locaux et 2 620 contrôles Chromium |
| npm run test:free-pilot | Succès : 21 contrôles HTTP/D1 sans R2 et 2 622 contrôles Chromium |
| git diff --check | Succès |

Le build production a été réexécuté après les suites et le décompte Node.
SHA-256 final : `611ae3bbdbc55d1e657a9fb8d2745b3db1c01c35ce982c97159fc28ab1943e33`.
Inspection visuelle Poppler des affiches QR choix : générateur historique,
Studio Essentielle portrait et Mosaïque paysage ; nouvelle consigne lisible,
sans chevauchement avec le QR résultats ou les liens. Aucun déplacement ou
changement de layout n’a été nécessaire. La compétence PDF a guidé cette
vérification sur les pixels réellement exportés, pas seulement les plans.
La compétence Wrangler a guidé la vérification des bindings remote:false
et des commandes --local ; aucune ressource distante sollicitée/modifiée.

L’archive antérieure est inchangée, SHA-256 vérifié avant/après :
`5731505c71f1fec9becab61ccb4cb61fd1c54dd6febca294ede98bedf5144a12`.
La recette physique v0.4B reste à effectuer après publication ; aucun scan
humain supplémentaire revendiqué ici. Lu’uma a autorisé commit/push sur main
et contrôle d’identité du HTML servi par GitHub Pages. Aucun déploiement Worker,
changement D1/Turnstile/binding ou activation R2 autorisé ni nécessaire.
