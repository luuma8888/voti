# Studio d’affiches Voti — v0.4B

Cette page décrit la fondation v0.4B. Depuis v0.4C, voir
`POSTER_STUDIO_POLISH_V0.md` pour les couleurs synchronisées, typographies
titre/corps, sections visibles, densité, surfaces et cadrage focal. Le contrat
de stockage v1 demeure rétrocompatible ; le backup général reste inchangé.

## Parcours

Gestion d’un sondage en ligne → **QR & partager le sondage** → Affiche PDF →
**Créer une affiche**. Le symbole QR du bouton est décoratif, non scannable,
et masqué aux technologies d’assistance. Les téléchargements QR individuels
PNG/SVG restent disponibles dans le centre de partage, indépendamment du Studio.

Le Studio `#poster/<pollId>` exige un sondage réellement publié et une capacité
créateur déjà conservée ; aucune capacité n’est transmise à la génération PDF.
Le téléchargement relit le sondage public : une suppression distante refuse
l’export, sans inventer un nouveau lien. Fermeture/verrouillage n’interdisent
pas de modifier le design local. Aucune mutation du relais dans le Studio.

## Réglages

Type indépendant de la disposition : accès unique ou QR par choix.
Consigne des affiches QR par choix : « Ce QR ouvre directement la confirmation
de ce choix. Le vote n’est envoyé qu’après validation. » Aucun bulletin au scan.

- Essentielle : liste structurée et QR dominant ; QR par choix en lignes
  associant image/libellé à gauche et QR à droite.
- Cartes : grille portrait de deux colonnes, images au-dessus des libellés,
  QR par choix dans la même carte ; accès avec choix en cartes et grand QR.
- Magazine : composition éditoriale asymétrique, QR d’accès latéral ; première
  réponse pleine largeur puis grille dans le mode QR par choix.
- Mosaïque : paysage A4, grille de trois colonnes adaptée à 2–6 choix,
  zones d’images compactes, pagination lorsque les QR ne tiennent plus.

Huit palettes indépendantes du thème de l’application : Voti Pop, Lagon,
Jardin, Lavande, Pêche solaire, Nuit élégante, Ivoire premium, Minimal noir & blanc.
Trois couleurs personnalisables (principale, secondaire, fond), avec choix
automatique de texte contrasté et correction de la couleur des textes d’accent.
Les barres des résultats conservent également un contraste d’au moins 3:1
contre leur piste ; un accent custom trop clair reste décoratif.
QR exclusivement noir/blanc sur une surface blanche et quiet zone de 4 modules.

Typographies locales : Moderne (system-ui), Douce (Trebuchet MS avec repli),
Éditoriale (Georgia avec repli serif), Affiche (Verdana avec repli).
Pas de fichier de police, CDN ou service de génération.

Options avancées : image de fond, Remplir/Ajuster, Haut/Centre/Bas,
intensité 0–60 %, voile clair/sombre, images du sondage disponibles sur l’appareil,
image principale et une image affiche-only par réponse. Texte et QR reposent
sur des surfaces opaques ; ratios préservés, cover centré et coins arrondis
pour les médias principaux/choix. Pas de cropper libre.

## Architecture du rendu

`poster-design.js` : contrat versionné, palettes, contraste, typographies, crop.
`print-layout.js` : plan pur de coordonnées, textes mesurés, images et QR.
`print-renderer.js` : renderer commun Canvas, résolution réduite pour aperçu,
pleine résolution pour PDF. `poster-studio.js` : contrôles et orchestration.
Le même plan dessine l’aperçu et le PDF ; aucune génération PDF à chaque réglage.
L’aperçu fait 620 px de large. Le PDF A4 fait 2480×3508 ou 3508×2480 pixels
(environ 300 dpi), PNG sans perte embarqué par pdf-lib.

Une surface pleine résolution à la fois ; libération des canvases, bitmaps
et URLs objet en sortie. Une ancienne réponse d’aperçu ne remplace pas une
nouvelle. Les QR PDF sont dessinés en pixels entiers sans antialiasing.
L’aperçu conserve leurs proportions mais n’est pas un original d’impression.
Retour à la ligne mesuré, accents français et pagination, limite de huit pages.
Les exports historiques de `poster.js` restent pour compatibilité/recette v0.4A,
mais l’UI du Studio utilise le nouveau renderer partagé aperçu/PDF.

## Stockage et cycle de vie

LocalStorage **voti.poster.v1** : `{ formatVersion: 1, designs: { [pollId]: PosterDesign } }`.
Chaque design v1 contient layout, mode, palette, typography, customColors,
background (assetId/fit/position/intensity/veil), media (main/choices), usePollImages.
Champs inconnus/version inconnue refusés ; aucun secret, bulletin, URL réseau,
blob ou base64 accepté dans ce format. Première version : pas de migration
des données métier ni des snapshots existants ; l’absence de design donne les défauts.

AssetAdapter existant réutilisé dans une **base IndexedDB dédiée** :
`voti.assets.v1:poster`, ou le nom isolé par fichier suivi de `:poster` en file://.
Même store assets et contrat atomique putMany/deleteMany. Le sweep métier ne
voit jamais ces blobs et ne peut pas les supprimer comme orphelins.
Les images sémantiques du sondage sont lues dans le store métier, sans déplacement,
sans mutation de PollDefinition ou definitionHash. REMOTE_ASSETS_ENABLED reste false.

Pipeline processImage existant : JPEG/PNG/WebP décodés et réencodés localement,
orientation normalisée et métadonnées retirées. Fond/principale : 1600 px,
1 Mo maximum ; choix : 1000 px, 600 Ko maximum. Stockage affiche borné à
200 images / 24 Mo, et 200 designs. Les quotas réels du navigateur restent possibles.
Les préparations sont sérialisées dans le Studio. Au rendu, hash/type/dimensions
des médias sont revérifiés avant décodage, puis dimensions réelles comparées.
Les références affiche-only de réponses retirées sont purgées à la réouverture
du Studio, sans supprimer un asset encore utilisé par un autre design.

Sous Web Lock distinct voti.poster.v1 : validation complète, vérification des
références/quota, écriture atomique des blobs, puis snapshot des designs.
Conflit avec un autre onglet refusé, pas d’écrasement silencieux.
Il n’existe pas de transaction ACID commune IndexedDB/localStorage : échec de
snapshot → nettoyage ; interruption → reprise du sweep dédié au démarrage.
Nettoyage seulement des blobs sans référence dans aucun design ; partage entre
designs protégé. Remplacement/retrait ne laisse pas d’asset référencé indéfiniment.
Réinitialiser le design retire ses références ; après suppression distante,
le design reste local et peut être retiré depuis la gestion de la copie locale.

## Sauvegarde et limites

Le backup général est **inchangé** : design et médias affiche-only en sont exclus.
Les PDF téléchargés constituent des exports, pas une sauvegarde éditable du Studio.
Le stockage navigateur n’est pas durable. Format de backup Studio dédié à décider
dans un futur lot, pas ajouté silencieusement ici.
PDF raster non balisé, texte non sélectionnable, rendu de police variable selon
les polices système. Impression à 100 % ; la pagination privilégie la lisibilité.
La recette caméra/papier réelle de v0.4B reste à faire après audit et publication autorisée.
