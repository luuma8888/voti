# Studio & UX polish — Voti v0.4C

## Couleurs déterministes

La palette reste la référence nommée. Tant que les couleurs ne sont pas modifiées,
Principale/Secondaire/Fond reflètent ses vraies valeurs et changent avec elle.
Une modification passe automatiquement en **Personnalisé**. Changer de palette
dans ce mode change la référence de retour, pas les couleurs personnalisées.
**Revenir à la palette** rétablit explicitement ses trois couleurs.

Principale : en-tête et repère de la question ; Secondaire : repères des choix
dans les quatre layouts ; Fond : fond général. Les couleurs choisies ne sont
pas remplacées pour résoudre un contraste : seuls les textes et les graphiques
essentiels sont corrigés lorsque nécessaire. QR toujours noir/blanc.

## Contrôles et typographies

La clarification de Lu’uma concerne la colonne du FORMULAIRE, pas l’ensemble
de l’espace de travail. Sur écran >=960 pixels : panneau de réglages à gauche
(300 pixels, champs et cartes typographiques en une colonne), aperçu à droite.
Le Studio utilise une largeur maximale de 1480 pixels, sans changer les autres
vues. Sa hauteur suit la place réelle sous les titres/avis ; le formulaire défile
dans son propre panneau et ne pousse pas l’aperçu hors écran.

L’A4 entier est montré par défaut dans un aperçu haut. « Agrandir pour lire » /
« Voir la page entière » alterne lecture et vision globale. Une page à la fois,
un seul canvas de 900 pixels, sélecteur si nécessaire. Le téléchargement reste
dans le bandeau de l’aperçu. Les événements/observer de taille sont libérés à
la fermeture. Sur écran plus petit, boutons Réglages / Aperçu pour utiliser
la place disponible sans deux panneaux minuscules. Le mode lecture mobile
utilise 600 pixels avec défilement interne ; aucun overflow horizontal de la page.
Le PDF haute résolution est inchangé.

Six accordéons natifs à titre, repère et explication : Composer l’affiche,
Choisir les couleurs, Choisir les écritures, Choisir des images, Cadrer les images,
Surfaces et lisibilité. Seule la composition est ouverte initialement. Une
catégorie ouverte à la fois dans les navigateurs gérant le groupe natif de
details ; ailleurs, plusieurs restent ouvrables sans perte de fonction. Les
options typographiques gardent leurs cartes radios visuelles ; aucun réglage
ou design sauvegardé n’est supprimé. Pas de nouveau format de stockage.

Six styles de titre : Moderne, Douce, Éditoriale, Affiche, Manuscrite douce,
Fantaisie sobre. Quatre styles de corps : Moderne, Douce, Éditoriale, Compacte.
Cartes avec radios, noms et échantillons dans leur propre pile locale ; titre
et corps indépendants dans le plan commun aperçu/PDF. Pas de fichier de police,
CDN ou téléchargement. Le rendu précis dépend des polices installées ; les
replis génériques préservent le fonctionnement, pas une identité typographique
universelle sur tous les appareils.

## Mise en page et sécurité QR

En-tête Normal/Discret/Masqué, ce dernier retirant le branding du haut du document.
Les informations fonctionnelles A4, confirmation et résultats restent présentes.
Choix par ligne Auto/1/2/3 ; les quatre compositions conservent des défauts distincts.
La densité Compact/Équilibré/Aéré ajuste titre, espaces et zones d’images.
Trois choix illustrés peuvent tenir sur une page, en trois colonnes ou 2+1,
avec des réglages sûrs. Les textes longs restent paginés, au plus huit pages.

QR Petit/Moyen/Grand : tailles cibles selon accès ou choix, quantifiées en modules
entiers. Minimum imposé : 400 pixels environ 34 mm à 300 dpi et 5 pixels/module,
quiet zone de quatre modules. Une largeur insuffisante réduit les colonnes ou
refuse le plan avec explication ; une cible trop grande dans une colonne est
adaptée avec avertissement, sans descendre sous le minimum sûr.

Surface QR Large/Compacte/Minimal : du panneau structuré à la marge locale autour
du QR. Le QR et sa marge sont toujours blancs opaques. Les blocs de texte ont
une opacité Opaque/Doux/Transparent renforcé. Le renderer impose un minimum de
voile pour obtenir au moins 4,5:1 même sur les cas pessimistes noir/blanc d’une
photo ; le renforcement est signalé dans l’aperçu. Accent textuel ajusté à l’encre
lisible sur une surface translucide. Les barres de résultats restent contrastées.

## Images et cadrage local

Ratios principale/choix : Original, 1:1, 16:9, 9:16, 3:4, 4:3. Original utilise
les dimensions locales réelles lorsque disponibles. Chaque frame respecte le
ratio dans une zone bornée ; aucune image étirée. Remplir rogne en conservant
les proportions ; Ajuster montre toute l’image, centrée.

Après la réserve humaine sur les vignettes trop petites, chaque image principale
et chaque image de choix dispose de **Hauteur de la zone : Auto / Petite /
Moyenne / Grande** et **Alignement du cadre : Gauche / Centre / Droite**.
La hauteur est un maximum, limité par le ratio, la largeur disponible et la page.
Une principale paysage en Grande peut occuper toute la largeur utile ; une
photo portrait garde ses proportions, sans étirement pour remplir la largeur.
Les zones Auto sont plus généreuses en Équilibré/Aéré ; Compact privilégie
toujours la densité. Agrandir peut ajouter des pages sans réduire les QR.
Une limitation par la hauteur de page est signalée dans les avertissements.
En accès, l’image du choix est désormais au-dessus de son texte, également
en une colonne, au lieu d’une petite vignette latérale.

Point focal par contexte d’image : miniature, souris/tactile, positions horizontale
et verticale, boutons directionnels et Réinitialiser au centre. Les bandes de
letterboxing de la miniature sont exclues du calcul du point. Le drag met à jour
l’aperçu au rythme requestAnimationFrame ; enregistrement à la fin du geste,
pas de PDF haute résolution pendant le déplacement. Le point agit en Remplir ;
en Ajuster l’image est entière, le point reste conservé pour un retour à Remplir.
En Original, ou lorsque le ratio choisi correspond à la photo, il n’y a pas
de recadrage : les commandes focales sont désactivées avec une explication.
En Ajuster elles sont également désactivées. La hauteur règle la taille ;
l’alignement déplace le cadre lorsqu’il est plus étroit que la zone disponible ;
le point focal choisit uniquement la partie visible en Remplir avec rognage.
Le fond garde Remplir/Ajuster, voile, intensité et cadrage focal, sans ratio artificiel.

Les images affiche-only restent dans IndexedDB dédié, sans upload ni activation
R2. Les images métier disponibles sont uniquement lues. Suivi des références,
sweep dédié, protection des images partagées et limites de taille inchangés.
Le backup général n’inclut toujours pas les designs ou médias affiche-only.

## Persistance rétrocompatible

Clé et version conservées : voti.poster.v1 et formatVersion:1. Champs optionnels
ajoutés : titleTypography, bodyTypography, headerMode, qrSurfaceMode,
textSurfaceOpacity, densityPreset, choicesPerRow, qrSize, imageSettings.
Ce dernier associe main/background/choiceId à ratio, fit, focalX, focalY.
Les nouvelles propriétés facultatives height/align sont normalisées en Auto /
Centre lorsqu’elles manquent dans un design existant. Le fond conserve ses
réglages propres et n’utilise pas ces tailles de zones. Toujours formatVersion:1.
Absence = valeurs par défaut ; les anciennes typographies initialisent titre et
corps. Les anciennes couleurs personnalisées activées sont conservées ; celles
inactives sont resynchronisées avec leur palette, puisqu’elles n’étaient pas rendues.
Lecture normalisée en mémoire sans écriture automatique ; prochain save conserve
les réglages étendus. CAS compare les designs normalisés, pas leur ancienne forme.
Champs inattendus/versions inconnues/cadrages invalides refusés, sans effacement.
Compatibilité de lecture par la nouvelle version, pas promesse que l’ancien v0.4B
saura lire les champs v0.4C. Aucun changement de schéma métier/empreinte.

## Partage, contexte et secret

Le Lien et QR de vote est affiché en permanence, au-dessus des trois entrées
visuelles validées : Un QR pour chaque choix, QR des résultats, Créer une
affiche PDF. Les deux premières affichent un panneau autonome exclusif, avec
titre focalisé et bouton marqué ouvert ; pas d’accordéon public. La troisième
ouvre directement le Studio. Les destinations textuelles et PNG/SVG restent
disponibles ; seul le transfert SECRET conserve sa section repliable distincte.

État métier Brouillon/Ouvert/Fermé et contexte Local/En ligne sont séparés.
Après suppression par cette interface, un repère UX dans voti.ui.context.v1
indique Copie locale · ancien lien supprimé. Il ne contient que des identifiants
publics, aucune capacité, bulletin ou URL ; hors backup métier, borné à 200 repères.
Un rattachement en préparation affiche Publication en attente. La bibliothèque
utilise le dernier état distant connu, sans nouvelle requête au relais par ligne.
Une suppression effectuée ailleurs n’est pas déduite d’une simple absence de
connexion : pas de fausse certitude sur l’histoire d’un sondage importé.

QR SECRET : icône vectorielle décorative, texte danger contrasté et fond teinté.
« Ce QR donne accès à l’administration du sondage. Toute personne qui le possède
peut gérer ou supprimer ce sondage. Ne le partage pas publiquement. »
Masqué par défaut, affichage volontaire et protocole admin inchangés.

## Validation

Suites Node, Chromium, PDF/Poppler et intégrations locales ; aucune validation
humaine v0.4C ni impression papier revendiquée avant audit/publication autorisée.
test:poster-polish isole la rasterisation et le décodage des nouvelles affiches.
Voir CODEX_STUDIO_V0_4C_REPORT.md pour les résultats exacts et limites.
`npm run test:browser -- --studio-workspace` vérifie rapidement cette disposition
sur six formats d’écran, le clavier et les pages, sans refaire les 28 PDF.
