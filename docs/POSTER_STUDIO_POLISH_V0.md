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

Type de QR, disposition, palette, densité, choix par ligne, taille QR et en-tête
sont directement accessibles. Sections distinctes : Couleurs personnalisées,
Choisir des images, Cadrage, Surfaces et lisibilité. Deux colonnes quand la largeur
le permet, une sur mobile ; pas de bloc « Options avancées » étroit.

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

Point focal par contexte d’image : miniature, souris/tactile, positions horizontale
et verticale, boutons directionnels et Réinitialiser au centre. Les bandes de
letterboxing de la miniature sont exclues du calcul du point. Le drag met à jour
l’aperçu au rythme requestAnimationFrame ; enregistrement à la fin du geste,
pas de PDF haute résolution pendant le déplacement. Le point agit en Remplir ;
en Ajuster l’image est entière, le point reste conservé pour un retour à Remplir.
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
Absence = valeurs par défaut ; les anciennes typographies initialisent titre et
corps. Les anciennes couleurs personnalisées activées sont conservées ; celles
inactives sont resynchronisées avec leur palette, puisqu’elles n’étaient pas rendues.
Lecture normalisée en mémoire sans écriture automatique ; prochain save conserve
les réglages étendus. CAS compare les designs normalisés, pas leur ancienne forme.
Champs inattendus/versions inconnues/cadrages invalides refusés, sans effacement.
Compatibilité de lecture par la nouvelle version, pas promesse que l’ancien v0.4B
saura lire les champs v0.4C. Aucun changement de schéma métier/empreinte.

## Partage, contexte et secret

Trois entrées visuelles : Un QR pour chaque choix, QR des résultats, Créer une
affiche PDF. Elles ouvrent les sections utiles avec focus ou le Studio. Les QR
de vote, liens, PNG/SVG et transfert admin sont conservés.

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
