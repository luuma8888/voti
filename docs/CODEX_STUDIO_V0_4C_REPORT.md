# Voti v0.4C — Studio & UX polish

Base : main `8ed468b`, v0.4B publié puis validé humainement avec réserves.
Autorité lue intégralement : VOTI_STUDIO_UX_POLISH_V0_4C_SPEC.md (926 lignes).
AGENTS, rapport final v0.4B, guides Studio/résultats/QR/UX et autorités historiques
ont été relus. Ce lot ne modifie ni les règles métier ni le relais.
Aucun commit/push/publication, aucune mutation Cloudflare, aucun appel au pilote
de production pour les tests. Profil production sans R2 conservé.

## Cause des couleurs et correction

Dans v0.4B, les champs custom restaient initialisés aux couleurs Pop même après
un changement de palette ; les modifier n’activait pas le mode personnalisé.
La secondaire n’était dessinée que dans une variante Magazine. Cela explique
les réglages sans effet et les valeurs ne correspondant pas à l’aperçu.

Fonctions pures choosePalette/customizeColor/resetPalette : huit palettes
synchronisées, première modification → Personnalisé, changement ultérieur de
palette conservant les couleurs custom, retour explicite rétablissant les trois
valeurs de la palette de référence. Mode et référence sont affichés textuellement.
Principale utilisée dans l’en-tête et le repère de question ; secondaire dans
les repères de choix de chaque layout ; fond général. Aucun remplacement
global des couleurs pour résoudre un contraste, seulement encre/barres essentielles.

## Architecture et fichiers

Créés :

- web/poster-controls.js : cartes radios typographiques et focalPicker ;
- web/poll-context.js : contexte UI local séparé ;
- tests/poster-polish.test.js : régressions pures v0.4C ;
- docs/POSTER_STUDIO_POLISH_V0.md et ce rapport.

Modifiés :

- web/poster-design.js : extension rétrocompatible et helpers de couleurs/crop ;
- web/poster-storage.js : lecture/CAS sur les designs normalisés ;
- web/print-layout.js : densité, colonnes, surfaces, en-tête, typos et cadrage ;
- web/print-renderer.js : alpha/famille par node, focales et dimensions locales ;
- web/poster-studio.js : sections, palette, typographies, réglages et médias ;
- web/sharing.js : trois accès visuels et avertissement SECRET réutilisable ;
- web/app.js et web/styles.css : badges de contexte et styles/accessibilité ;
- scripts/browser-studio.mjs, browser-qr.mjs, browser-test.mjs, test-posters.mjs ;
- scripts/audit-bundle.mjs, tests/audit-bundle.test.js, tests/build.test.js ;
- package.json, README.md, docs/POSTER_STUDIO_V0.md, RESULTS_PDF_V0.md,
  QR_AND_POSTER_V0.md et UX_FLOWS_V0.md ; index.html régénéré.

Spécification v0.4C non suivie fournie par Lu’uma, laissée intacte. Modifications
locales préexistantes des rapports v0.4A/v0.4B/v0.3E et spécification v0.3E
préservées, pas attribuées à ce lot. Aucune dépendance ajoutée, lockfile inchangé.

## Persistance sans migration métier

PosterDesign conserve formatVersion:1 et voti.poster.v1. Champs optionnels stricts
et valeurs par défaut : titleTypography/bodyTypography, headerMode, qrSurfaceMode,
textSurfaceOpacity, densityPreset, choicesPerRow, qrSize et imageSettings par
main/background/choiceId (ratio, fit, focalX, focalY). L’ancien typography reste
un champ de compatibilité et initialise titre/corps quand les nouveaux champs
manquent. Anciennes couleurs actives et références de médias sont conservées ;
couleurs inactives resynchronisées avec la palette effectivement utilisée.
Lecture en mémoire sans écriture ni effacement ; sauvegarde suivante normalisée.
CAS compare les formes normalisées, y compris ancien design sans champs nouveaux.
Versions/champs/valeurs invalides restent refusés. Pas de promesse de lecture
des champs nouveaux par le vieux code v0.4B.

AssetAdapter et IndexedDB affiche-only inchangés. Aucun déplacement des blobs,
upload ou activation R2. Les métadonnées locales servent au ratio Original ;
les images métier sont seulement lues. Sweeps/rollback/références partagées
conservés ; cadrages de choix retirés purgés à la réouverture. Aucun ajout au
backup général. Aucune capacité, bulletin, secret ou donnée réseau dans le design.

## UX et accessibilité

Partager : trois grandes cartes/boutons Un QR pour chaque choix, QR des résultats,
Créer une affiche PDF ; focus vers la section ouverte, ouverture directe du Studio,
icônes vectorielles décoratives, sous-textes simples. Toutes fonctions précédentes
restent : accès, liens, PNG/SVG, QR choix/résultats, Studio et transfert admin.

Studio : sections Couleurs personnalisées, Choisir des images, Cadrage,
Surfaces et lisibilité ; grille desktop/deux colonnes si place, mobile/une colonne.
Fond accessible directement, hors petit details technique. Six styles de titre
et quatre de corps, noms/échantillons dans leur propre police, radios natives
et légendes ; pas de police externe. Header Normal/Discret/Masqué dans aperçu/PDF.

Focales individuelles : déplacement souris/tactile, curseurs horizontaux/verticaux,
boutons Gauche/Droite/Haut/Bas, reset centre. Letterboxing exclu du calcul ;
pointer capture sur événements réels. Simulation PointerEvent tactile testée ;
pas de geste sur téléphone physique revendiqué. requestAnimationFrame coalesce
les rendus ; enregistrement à la fin du drag ou au changement validé du curseur,
pas de génération PDF en continu. Ajuster montre l’image entière et conserve
le point pour un retour à Remplir, expliqué dans l’UI. Ratios Original/1:1/16:9/
9:16/3:4/4:3, frame proportionnel dans zone bornée, aucun étirement proposé.

Statut Brouillon/Ouvert/Fermé distinct du contexte Local/En ligne/Publication
en attente. Suppression via Voti → Copie locale · ancien lien supprimé, grâce à
voti.ui.context.v1 (identifiants publics seulement, 200 repères maximum).
Ce repère non métier n’est pas une réplication du relais, ni une preuve de
disponibilité réseau. La bibliothèque garde le dernier état distant connu.
Une suppression faite ailleurs n’est pas déduite artificiellement d’un manque
de référence ; historique local de contexte non inclus dans le backup métier.

SECRET : rouge/danger contrasté des cinq thèmes, fond teinté, icône cachée aux
technologies d’assistance car texte explicite adjacent, avertissement renforcé
également sur l’import QR. Masqué par défaut ; affichage volontaire et vérification
admin identiques. Aucun secret dans URL HTTP, logs ou PDF ajouté.

## Plan commun, pagination et contrastes

Aperçu et PDF partagent toujours makeStudioPlan/paintPrintPage. Quatre layouts
distincts, colonnes Auto/1/2/3, densité Compact/Équilibré/Aéré et QR Petit/Moyen/
Grand. Trois choix illustrés vérifiés sur une page, trois en ligne ou 2+1.
QR quantifiés en pixels entiers, au moins 400 px (environ 34 mm à 300 dpi) et
5 px/module, quiet zone de quatre modules. Largeur impossible → colonnes réduites
avec avertissement ou refus explicite. Cible trop grande → adaptation annoncée,
jamais sous le minimum sûr. Pagination conservée pour longs textes, huit pages max.

Surface QR Large/Compacte/Minimal, blanc opaque autour de chaque code. Opacité
des textes bornée, ajustée par safeSurfaceOpacity contre les deux extrêmes
noir/blanc sous-jacents ; au moins 4,5:1. Le renforcement est annoncé à l’aperçu,
les textes d’accent utilisent l’encre sûre en translucide. QR jamais transparent
ou recoloré ; barres essentielles >=3:1. Les images/canvases/URLs et ResizeObserver
sont libérés à la fermeture. Une seule surface pleine résolution pour chaque PDF,
aperçu réduit à 620 px, sans nouvelle bibliothèque lourde.

PDF résultats : seuls les styles transverses changent (palette, titre/corps,
header/cadrage). Même authorizedResults, mêmes agrégats, threshold/closed/available,
pas d’accès aux bulletins et pas de refonte des vues Synthèse/Rapport.

## Tests et incidents documentés

Tests Node : ancien v1 sans perte et CAS, huit palettes, personnalisation/retour,
secondaire dans quatre layouts, six/quatre styles indépendants, 36 combinaisons
colonnes/densité/taille QR, trois choix illustrés sur une page, longs textes,
surfaces et contrastes pessimistes, ratios/focales/contain sans étirement,
contexte local/distants/suppression et projections résultats inchangées.

Chromium : scénario Lagon → Jardin → Secondaire → Personnalisé → nouvelle
palette sans écrasement → Revenir à la palette ; effet secondaire vérifié sur
les pixels du canvas, huit palettes, choix typographiques, gestes simulés,
ratios/reset, persistance, quotas/cleanup, cinq thèmes, 320/360/1200, focus et
cibles >=44 px. Partage/avertissement SECRET, imports/votes/résultats inchangés,
suppression réelle locale puis badge de copie locale. Offline file:// et /voti/.

PDF : 8 historiques, 13 Studio/résultats et 7 polish, rasterisés avec Poppler
à 300 dpi et redécodés via jsQR indépendant de l’encodeur. Nouveaux scénarios :
trois choix/3 colonnes, 2+1, six choix, quatre layouts, six titres/quatre corps,
en-tête masqué/discret/normal, trois surfaces QR, opacité, médias colorés directionnels.

Incidents corrigés sans modifier domaine/relais :

- assertion thème assimilant tout badge à un statut : filtrer statuts et tester
  séparément le contexte textuel ;
- attente de changement sur une radio déjà cochée : ne pas attendre un événement
  change que le navigateur n’émet pas ;
- deux fixtures PDF Cartes avaient le même nom : noms incluant colonnes/header ;
- découpe trop exacte du raster A4 paysage : conserver deux pixels de la vraie
  marge opaque, sans binarisation, reconstruction de matrice ou retouche de l’image.
  Contrôle des centres de modules : zéro divergence ; les vrais pixels conservés
  se redécodent. Bornes du crop explicitement testées ;
- assertion copie locale effectuée après browserDelete, qui termine sur la route
  publique NOT_FOUND : revenir sur l’accueil réellement chargé avant l’assertion ;
- essais Node sous sandbox affichaient uniquement le fichier de test ; les suites
  détaillées sont exécutées avec les permissions des outils locaux nécessaires.

## Résultats exacts

Toutes les commandes demandées ont été exécutées. Les intégrations ont été
relancées après correction de l’assertion de copie locale. Décompte Node confirmé
en fin de lot avec le reporter spec ; build production réexécuté en dernier.

| Commande | Résultat final |
| --- | --- |
| npm test | 340 tests Node ; 340 passés, 0 échec, 0 sauté, 0 annulé, 0 todo |
| npm run check | 85 fichiers JavaScript, succès |
| npm run build | 1 215 996 octets, HTML autonome local sans ressource externe |
| npm run build:production | 1 216 244 octets, 40 modules, profil gratuit sans R2 |
| npm run test:browser | 2 664 contrôles Chromium, succès |
| npm run test:poster | 97 contrôles, 8 PDF A4, 30 QR redécodés |
| npm run test:poster-studio | 144 contrôles, 13 PDF A4, 39 QR redécodés |
| npm run test:poster-polish | 101 contrôles, 7 PDF A4, 32 QR redécodés |
| npm run test:relay | 72 contrôles HTTP/Worker/D1/R2 locaux, succès |
| npm run test:integration | 73 contrôles HTTP + 2 818 contrôles Chromium, succès |
| npm run test:free-pilot | 21 contrôles HTTP/D1 sans R2 + 2 820 contrôles Chromium, succès |
| git diff --check | Succès |

Les premiers builds locaux/production faisaient 1 215 904 / 1 216 152 octets.
Un texte d’aide explicite sur Remplir/Ajuster a été précisé ensuite ; les deux
intégrations Chromium ont testé ce dernier code et les builds finaux ci-dessus
l’incluent. Aucun changement de logique PDF après les validations Poppler.
Au total : 28 PDF, 38 pages, 101 QR réellement redécodés, aucun secret imprimé.
Inspection visuelle des PNG finaux : Cartes trois colonnes/header masqué/surface
Minimal et 2+1/header discret/surface Compacte, Nuit, Mosaïque paysage et Rapport
résultats avec couleurs custom. Pas de chevauchement, QR coupé ou image étirée
observé ; images Original parfois petites dans leurs zones bornées, limite
signalée ci-dessous. Les illustrations de recette restent synthétiques.

Compétence PDF : vérification sur les exports finaux rasterisés, pas uniquement
les plans. Compétence Wrangler : inspection des scripts/configurations/aide
locale (--local, --persist-to, --test-scheduled), bindings remote:false,
profils/caches/logs confinés au dépôt. Pas de nouvelle configuration distante.

SHA-256 du build final :
`ca2e6929f6c9d265cd6866f1fe3e271d771f5f04ba9812374631d704c7e46397`.
Croissance de 32 163 octets par rapport au v0.4B publié, environ 2,7 %.
Contrôle Git : shared/ (modèle, hash, moteur, votes, résultats, contrats relais),
Worker/migrations/configs, HttpRelayAdapter, configuration production et lockfile
inchangés. HEAD reste `8ed468b`. Rapports préexistants non réécrits par ce lot.

## Limites et validation humaine

Aucune recette physique v0.4C effectuée ; polices réellement installées, photos
réelles, gestes tactiles natifs et impression/scans papier restent à valider.
Les photos de test sont synthétiques, jamais celles de Lu’uma. Les frames sont
bornées par la densité : un ratio portrait/Original peut produire un média plus
petit pour conserver une page lisible. Pas de réglage libre de chaque hauteur
ni cropper Photoshop, conformément aux presets simples retenus.

Pas de garantie universelle de scan : caméra, papier et imprimante interviennent.
PDF raster non balisé/texte non sélectionnable, limitations v0.4B conservées.
Une opacité choisie peut être renforcée pour la lisibilité, explicitement annoncé.
LocalStorage/IndexedDB ne constituent pas une sauvegarde durable ; média/design
hors backup métier. Repères de suppression limités aux suppressions effectuées
sur cet appareil via Voti, non synchronisés entre appareils.

Pas de décision métier manquante bloquante. Avant publication, validation humaine
recommandée du comportement palette/custom, typos locales, taille des médias,
cadrage et hiérarchie des trois cartes. Aucun déploiement autorisé dans ce lot.

## Audit

Le ZIP v0.4C est créé après tests et finalisation de ce rapport. Exclusion de toutes
archives Voti, PDF temporaires, exports admin, médias utilisateur, profils/captures,
caches, node_modules, .wrangler, .relay-local et bases locales. Archive non commitée.
Les fichiers de marque sont les seuls médias source admissibles ; les documents
préexistants peuvent figurer dans le bundle sans être attribués à ce développement.
Préflight de chemins/motifs sensibles et contrôle CRC/identité sources du ZIP,
sans récupérer/comparer/exposer de secret réel. Taille exacte fournie en sortie.
Préflight final : 149 fichiers admissibles, six médias de marque seulement,
40 modules JavaScript intégrés au HTML décodés et contrôlés. Aucune archive
Voti récursive, clé admin exportée ou photo de recette admissible. Ce contrôle
de motifs/provenance n’est pas une garantie absolue de détection de tout secret.
Archive ignorée par Git, HEAD conservé et aucun staging/commit/push effectué.

## Publication après audit technique

Audit ChatGPT v0.4C validé par Lu’uma, sans bloqueur technique. Lu’uma autorise
explicitement commit/push sur main, propagation GitHub Pages et comparaison
du build servi avec le build local (taille/SHA-256/identité binaire).
Les interdictions de publication mentionnées plus haut décrivent le développement
avant cet accord. Worker, D1, Turnstile, bindings et configuration sans R2 restent
hors des modifications autorisées.

Recette humaine ciblée A à L à effectuer après propagation, une manipulation
à la fois. Aucune confirmation physique v0.4C revendiquée à ce stade ; retours
et réserves seront consignés sans correctif silencieux. Le ZIP final sera recréé
après cette recette et la documentation finale, sans être ajouté à Git.
