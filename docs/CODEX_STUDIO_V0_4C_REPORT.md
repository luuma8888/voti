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

### Publication et contrôle Pages

Commit `a1ffca6`, poussé sur main sur accord explicite de Lu’uma. 28 fichiers
v0.4C inclus ; rapports locaux antérieurs laissés hors du commit, aucun ZIP suivi.
Préflight du commit et des 40 modules HTML : aucun fichier backend ni littéral
secret identifié. Aucun changement Cloudflare Worker/D1/Turnstile/binding ou R2.

GitHub Pages a d’abord servi v0.4B, puis la lecture de
`https://luuma8888.github.io/voti/` a renvoyé HTTP 200 et les mêmes 1 216 244
octets que le build local. Comparaison binaire réussie ; SHA-256 commun :
`ca2e6929f6c9d265cd6866f1fe3e271d771f5f04ba9812374631d704c7e46397`.

Recette humaine A à L commencée : retours exacts de Lu’uma ci-dessous,
distincts des contrôles automatisés. Le suivi documentaire reste local jusqu’à la clôture.
Le ZIP existant correspond à l’audit pré-publication ; pas de régénération avant
la recette finale. Aucun nouveau commit/push de ce suivi à ce stade.

### Premiers retours physiques — recette non validée

A — Lu’uma valide l’apparence des trois boutons (« super »), pas leur fonctionnement.
Ils ne font qu’ouvrir les accordéons, toujours perçus comme techniques. Attente :
chaque bouton ouvre un panneau autonome clairement identifié, par exemple des
onglets ; Lien et QR de vote toujours visible sans plier/déplier, au-dessus des
trois boutons. Lu’uma demande explicitement de corriger à la fin des tests dans
v0.4C, pas au prochain lot. Aucune correction applicative effectuée à ce stade.

Entrée dans B — Retour négatif majeur avant jugement des couleurs :
« C’est horrible, terrible ! ça va pas du tout, c’est pire ! »
Le formulaire prend trop de largeur, l’aperçu est trop petit et illisible,
les réglages imposent beaucoup de défilement et l’aperçu ne reste pas visible.
Lu’uma indique qu’il y a beaucoup à changer. Les couleurs Lagon/Jardin/custom
ne sont donc PAS validées humainement, ni déclarées défectueuses sur ce seul retour.

Inspection en lecture seule : la règle CSS finale donne 1.15fr aux contrôles
contre .85fr à l’aperçu (57,5 % / 42,5 % hors espacement), dans un contenu plafonné
à 1080 px. Les nombreux contrôles sont affichés ensemble ; aucun sticky ou
défilement indépendant ne garde l’aperçu visible. À <=1000 px, l’aperçu est placé
après tout le formulaire. Ces choix expliquent la régression d’ergonomie signalée,
sans prétendre connaître la résolution exacte de son Chromebook.

La recette Studio est interrompue pour clarifier une correction de disposition.
Proposition à faire valider : réglages plus étroits et organisés par catégories,
aperçu dominant restant visible, zoom/agrandissement, navigation mobile adaptée.
L’autorisation différée pour la page de partage ne vaut pas autorisation implicite
de cette réorganisation du Studio. Aucun changement de code, commit/push ou
ZIP supplémentaire ; aucune mutation Cloudflare.

### Correction ergonomique autorisée après ces retours

Lu’uma rejette explicitement la disposition en deux colonnes et autorise la
correction du Studio ET du partage : « Oui, tu peux corriger cela incluant la
correction du partage. » Il demande des catégories repliables compréhensibles
et un aperçu restant visible avec une largeur suffisante. Cette instruction
remplace la proposition précédente de panneau latéral et la recommandation
initiale de deux colonnes dans la spécification. L’autorité historique n’est
pas réécrite. Cette autorisation porte sur les corrections, pas sur un nouveau
commit/push : elles restent locales, en attente d’accord de publication.

#### Studio corrigé

- Une seule colonne : aperçu au-dessus, réglages en dessous. Plus de partage
  horizontal de la largeur entre formulaire et aperçu.
- Aperçu sticky pendant le défilement des réglages, utilisant la largeur utile.
  Zone de lecture à défilement interne, accessible au clavier/souris/tactile ;
  bouton Voir la page entière / Agrandir pour lire pour alterner les deux usages.
  Sur mobile, lecture à 600 pixels avec défilement interne, sans overflow de la
  page. La vue entière permet de vérifier la composition globale.
- Six catégories natives details/summary : Composer l’affiche, Choisir les
  couleurs, Choisir les écritures, Choisir des images, Cadrer les images,
  Surfaces et lisibilité. Repère décoratif, titre simple, explication et signe
  d’ouverture. Composition seule ouverte au départ ; groupe natif exclusif
  lorsque le navigateur le supporte, repli fonctionnel sinon.
- Téléchargement placé dans le bandeau de l’aperçu, toujours accessible pendant
  les réglages. Sélection de page explicite pour les affiches multipages.
- Un seul canvas d’aperçu de 900 pixels de large, y compris pour une affiche
  longue : les autres pages sont rendues à la demande. Les surfaces précédentes
  sont libérées ; pas de multiplication de la mémoire par le nombre de pages.
- Hauteur réelle suivie par ResizeObserver ; marge de défilement et correction
  de focus empêchent les contrôles de passer derrière l’aperçu. Observer libéré
  à la sortie. Cartes typographiques en une colonne sur mobile pour garder les
  noms lisibles. Pas de nouvelle animation ou dépendance.

Les valeurs, couleurs, typographies et médias persistés sont conservés. Aucun
nouveau champ PosterDesign, migration, changement d’AssetAdapter ou de backup.
Le plan et le rendu du PDF final ne changent pas : seul l’aperçu est agrandi
et sa navigation est revue. Aucune génération PDF pendant le réglage/zoom.

#### Partage corrigé

Lien et QR de vote visible en permanence, au-dessus des trois cartes dont
l’apparence a été validée par Lu’uma. Les deux premières affichent un panneau
autonome exclusif choix/résultats, avec titre focalisé, région nommée, aria-controls
et état aria-expanded sur le bouton. Ce sont des boutons de sélection de panneau,
pas un faux tablist ARIA. La troisième ouvre directement le Studio. Le transfert
SECRET reste séparé et repliable, QR caché par défaut. Liens, PNG/SVG, destinations
textuelles, routes et protocole secret inchangés.

#### Fichiers de cette correction

web/poster-studio.js, web/sharing.js, web/styles.css ; scripts/browser-studio.mjs,
scripts/browser-qr.mjs, scripts/browser-test.mjs ; index.html régénéré ; ce
rapport, POSTER_STUDIO_POLISH_V0.md, POSTER_STUDIO_V0.md, QR_AND_POSTER_V0.md
et UX_FLOWS_V0.md. Aucun fichier créé, aucune dépendance ajoutée.
Les modifications antérieures des rapports v0.4A/v0.4B/v0.3E et la spécification
v0.3E non suivie sont préservées, hors de cette correction.

#### Vérifications et limites

Les tests ajoutés couvrent l’ordre aperçu/réglages, largeur, maintien visible
pendant le défilement, focus non masqué, groupe repliable au clavier, vue entière
et lecture, sélection de page avec un seul canvas, boutons/panneaux de partage,
QR de vote permanent et cibles tactiles. Les scénarios couleurs, images,
typographies, secret et absence de mutation métier restent testés.
Captures inspectées à 1365×768, 360×740 et 320×640 dans la largeur réelle de main,
ainsi que la page de partage du parcours HTTP local. Les captures restent ignorées.

Deux incidents de mise au point : le premier contrôle mobile a révélé un bandeau
trop haut masquant le titre d’une catégorie (corrigé par grille compacte et marge
calculée). Le test de touches nécessite de remettre l’onglet CDP au premier plan
avec Page.bringToFront ; les touches natives sont ensuite vérifiées réellement.
L’inspection visuelle a également fait corriger les noms typographiques découpés
sur mobile. Aucun test échoué n’est présenté comme un succès final.

Résultats des commandes exécutées pendant cette correction (toutes sorties
finales avec code 0) :

| Commande | Résultat |
| --- | --- |
| npm test | 340 tests Node, aucun échec |
| npm run check | 85 fichiers JavaScript, syntaxe valide |
| npm run build | 1 223 704 octets, HTML autonome |
| npm run build:production | 1 223 952 octets, profil gratuit sans images distantes |
| npm run test:browser | Dernière exécution : 2 778 contrôles Chromium réussis |
| npm run test:integration | 73 contrôles HTTP locaux + 2 932 contrôles Chromium |
| npm run test:free-pilot | 21 contrôles HTTP/D1 sans R2 + 2 934 contrôles Chromium |
| git diff --check | Aucune erreur |

Les intégrations ont précédé la dernière optimisation consistant à ne rendre
qu’un canvas d’aperçu. Cette optimisation, sans changement HTTP, est couverte
par la dernière exécution complète test:browser (lecture/sélection de pages,
clavier, exports, offline et serveur /voti/). Les constructions sont exécutées
séquentiellement, et le build de production est régénéré en dernier.

SHA-256 du build production prêt, non publié :
`b159b0ce4ddf88d5d5741c945f9969d6ebf7628c77a6376fb4e6878cbe77f828`.

Pas de relance séparée des trois suites de rasterisation Poppler : le générateur
PDF, les plans et agrégats n’ont pas été modifiés. Le CSS d’impression de l’éditeur
masque son bandeau et rend l’aperçu non sticky ; l’impression navigateur montre
la page consultée, le téléchargement PDF produit toujours toutes les pages. Les suites
Node et Chromium gardent les tests et générations PDF existants. Pas de relance
HTTP seule supplémentaire : test:integration couvre déjà son scénario complet.
Tests locaux uniquement, avec bindings remote:false ; aucun accès au relais réel.

Il reste à faire juger l’ergonomie par Lu’uma sur son Chromebook : lisibilité,
défilement de l’aperçu, organisation des catégories, logique des couleurs puis
suite de la recette A à L. Aucune validation humaine de cette correction ou
impression papier revendiquée. La largeur physique d’un téléphone implique un
choix entre vue globale réduite et lecture avec défilement ; ce compromis est
explicite dans l’interface. Le comportement du groupe exclusif dépend du support
du name natif des details, sans perte de réglage sur un navigateur plus ancien.

Aucun commit/push, aucune publication Pages, aucune modification du Worker,
de D1, Turnstile, bindings ou du profil sans R2. Le ZIP final n’est pas recréé
avant la reprise et la validation de la recette humaine.

### Autorisation de publication de la correction

Après remise du correctif et de ses résultats, Lu’uma répond « oui » à la demande
explicite de commit/push pour tester le nouveau rendu en ligne. Publication
autorisée uniquement pour les douze fichiers de cette correction et son suivi
v0.4C ; les autres rapports locaux et la spécification v0.3E restent hors commit.
Le build production attendu est celui de 1 223 952 octets et du SHA-256 indiqué
ci-dessus. Vérification Pages à effectuer après push, puis reprise de la recette
humaine, sans en revendiquer la validation. Aucun ZIP final ni déploiement
Cloudflare dans cette publication.

### Correction publiée — contrôle GitHub Pages

Commit `6b476fd`, poussé sur main sur l’accord explicite de Lu’uma. Douze fichiers
inclus, aucun fichier backend/configuration distante, aucun ZIP suivi. Les trois
autres rapports locaux et la spécification v0.3E sont laissés intacts hors commit.
Le build a été reproduit avant commit et comparé au build testé : 40 modules,
1 223 952 octets et SHA-256 identique. Le contrôle de littéraux sensibles dans
le HTML et ses modules n’a trouvé aucun secret identifié ; il ne constitue pas
une garantie universelle de détection de secrets.

Après push, les deux premières lectures de `https://luuma8888.github.io/voti/`
servaient encore l’ancien build. La troisième a renvoyé HTTP 200, exactement
1 223 952 octets, et une comparaison binaire identique au build local ; SHA-256 :
`b159b0ce4ddf88d5d5741c945f9969d6ebf7628c77a6376fb4e6878cbe77f828`.
Aucune mutation Cloudflare, aucun déploiement Worker ou changement du profil R2.

La correction est publiée, pas encore validée humainement. Recette ciblée à
reprendre avec Lu’uma, d’abord le partage puis l’ergonomie du Studio et les couleurs.
Ce suivi de propagation reste local jusqu’au prochain suivi documentaire autorisé ;
pas de second commit/push ni de régénération de l’archive avant la recette finale.

### Reprise de la recette humaine après correction

A — Après publication du correctif, Lu’uma répond « oui » à la vérification :
le bouton Un QR pour chaque choix affiche un panneau autonome clair, sans
accordéon. Ce parcours est confirmé humainement. Cette réponse ne vaut pas
validation des autres panneaux, de l’ergonomie du Studio ou des couleurs ;
la recette continue, une manipulation à la fois. Aucun nouveau changement de code.

### Clarification humaine — formulaire gauche, aperçu droite

Lu’uma rejette le Studio empilé publié dans `6b476fd` : l’aperçu ne prend qu’environ
30 % de la hauteur et l’A4 portrait reste trop petit. Il précise : « L’idée était
une seule colonne pour le formulaire pas pour l’ensemble. Formulaire à gauche,
Aperçu à droite toujours disponible. » Puis : le formulaire précédent avait
deux colonnes dans certaines sections et était trop large. La première correction
du Studio résulte donc d’une mauvaise interprétation par Codex ; ni sa publication
ni ses tests automatiques ne valent validation humaine de son ergonomie.

Lu’uma valide en revanche les accordéons : « Le système d’accordéon est en revanche
bien je pense : conserve le tel quel. Le rendu et manipulation semble bien. »
Les éléments summary, explications, ouverture exclusive et interactions sont
conservés. Le partage validé reste également inchangé.

Correction de disposition, encore locale :

- >=960 pixels : formulaire à gauche, 300 pixels de large, TOUS les champs et
  cartes typographiques en une colonne ; aperçu à droite. Seul le Studio peut
  utiliser jusqu’à 1480 pixels de largeur, sans élargir les autres vues.
- Espace de travail borné à la hauteur réellement disponible sous le header,
  titres et avis. Formulaire à défilement indépendant ; il ne déplace pas l’aperçu.
  Focus clavier maintenu dans la zone visible du formulaire.
- A4 entier par défaut, utilisant la hauteur de l’aperçu, et commande explicite
  Agrandir pour lire / Voir la page entière. Sélecteur de page, téléchargement
  et canvas unique restent présents ; aucune modification du PDF final.
- <960 pixels : bascule Réglages / Aperçu, nommée et utilisable au clavier,
  pour éviter deux panneaux illisibles ou un bandeau A4 très aplati. Aucun ajout
  de préférence persistée ni changement du design sauvegardé.
- Observer et événements de taille/défilement libérés à la sortie du Studio.

Tests adaptés à la demande réelle, pas à l’hypothèse d’un Studio empilé :
formulaire étroit à gauche, aperçu haut à droite, formulaire en une colonne,
défilement indépendant et focus, A4 entier, zoom, pages, bascule mobile et
absence d’overflow. Une option de la suite existante isole ce contrôle rapide :
`npm run test:browser -- --studio-workspace`. Même harnais Chromium/CDP et
nettoyage de processus, pas de copie d’un nouveau harnais ni de dépendance.
Formats : 1365×768, 1280×720, 1024×768, 768×1024, 360×740, 320×640.

Première recette ciblée : 78 contrôles réussis. Captures Chromebook et mobile
inspectées réellement. La capture montre l’A4 entier à droite et le formulaire
à gauche, et non une bande d’aperçu au-dessus. Résultats des contrôles finaux :

| Commande | Résultat |
| --- | --- |
| npm test | 340 tests Node réussis |
| npm run check | 85 fichiers JavaScript, syntaxe valide |
| npm run test:browser -- --studio-workspace | 78 contrôles ciblés réussis |
| npm run test:browser | 2 826 contrôles Chromium réussis, dont cette recette ciblée |
| npm run build | 1 227 291 octets, HTML autonome |
| npm run build:production | 1 227 539 octets, profil gratuit sans images distantes |
| git diff --check | Aucune erreur |

Build production régénéré en dernier, SHA-256 :
`5b9c6f6c8f05b3e8f69f3a2ee38031f7461cb3c4c84be5ad0caf3911353401f7`.
Les suites HTTP et Poppler ne sont pas relancées pour cette disposition :
aucun code relais, plan ou renderer PDF modifié. La suite Chromium complète
conserve les générations, images, couleurs, thèmes, clavier, offline et /voti/.
La perception de lisibilité reste à faire valider
par Lu’uma : aucune approbation visuelle de ce nouveau Studio revendiquée.

Fichiers concernés : web/poster-studio.js, web/styles.css ; scripts/browser-studio.mjs,
scripts/browser-test.mjs ; ce rapport, POSTER_STUDIO_POLISH_V0.md, UX_FLOWS_V0.md ;
index.html à régénérer. Aucun fichier créé ni dépendance ajoutée. Aucun changement
de partage, backend, modèle, stockage, agrégats, protocole ou configuration sans R2.
Pas de commit/push, publication ou ZIP pour cette seconde correction à ce stade.

### Autorisation de publier la disposition clarifiée

Lu’uma demande explicitement : « je ne peux pas voir sur le site pour l’instant,
donc commit et publie. » Accord pour publier les huit fichiers de cette seconde
correction, sans inclure les autres modifications documentaires locales ni ZIP.
Le build attendu est celui de 1 227 539 octets et du SHA-256 indiqué ci-dessus.
Vérification binaire de GitHub Pages après push, puis jugement humain du Studio.
Cet accord de publication ne vaut pas validation visuelle du rendu.
Aucune modification Cloudflare ou du profil sans R2 n’est autorisée ni nécessaire.
