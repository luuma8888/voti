# Validation humaine post-déploiement — Carte et ergonomie

## État et audit

HEAD initial et origin/main : `3e484f4c6e4e61fc9ea4e91ea4ab30376ca3d483`.
Huit rapports historiques déjà modifiés, captures personnelles et archives hors lot
préservés. Index initial vide. Production D1 contrôlée en lecture seule : migrations
0001–0005, une application chacune ; quick_check ok. Aucune mutation distante.

Skill PDF lu ; vues `member-card-view.js`, `member-cards.js`, modèle commun,
space-management, SpacesUI, app/render et tests cartes/Espaces inspectés avant édition.

Avant : données communes mais CSS responsive réorganisant les blocs, illustration
écran 110×180 et PDF 220×330, coordonnées séparées, QR PDF maximum 400 logique.
Dirty state membre limité au bouton de fin ; groupe sans état partagé ; navigation
SPA sans garde. Listes compactes uniques.

## Solution locale retenue

- Repère commun `card-layout.js`, 1120×760, huit cartes A4 inchangées. DOM et canvas
  utilisent les mêmes zones, tailles de texte et retours à la ligne mesurés.
- Zone QR 456 ; modules entiers, quiet zone incluse, fond opaque ; URL courante :
  371 → 424 pixels logiques, 31,4 → 35,9 mm à 300 dpi (+14,3 %).
- Illustration : zone 430×448 (320×448 avec groupes), contain ; humain entier ~65 % de la hauteur sous
  header, créature jusqu’à 350×350 ; groupes secondaires, icon 56 → 62 logiques
  (~35 px dans un aperçu de 640 px). Sans illustration, aucun cadre vide.
- Liste icon / Vignettes medium lazy/async ; préférences séparées membres/groupes
  dans `voti.space.views.v1`, uniquement deux choix UX, aucun nom/ID/credential.
- Contrôleur de fiche en mémoire : comparaison aux valeurs persistées (nom, groupes,
  illustration), barre sticky desktop haut/mobile bas, sauvegarde/erreur/annulation.
  Garde avant démontage du shell, confirmation de départ et beforeunload natif.
  API et CAS existants conservés ; état dirty conservé en cas d’échec.

## Vérifications et captures

Toutes les suites demandées sont PASS. Aucun test supprimé ou affaibli : les anciennes
assertions en pixels écran sont remplacées par des ratios écran/PDF et des tailles
physiques vérifiées, puisque la carte garde désormais sa composition sur téléphone.

| Commande | Résultat |
| --- | --- |
| npm test | 410 tests PASS |
| npm run check | 141 fichiers, PASS |
| npm run test:browser | 2 966 contrôles |
| npm run test:space-ui | 2 850 contrôles UI + 2 pilote, 46 captures annexes |
| npm run test:spaces-ux | 368 contrôles UI + 2 pilote |
| npm run test:spaces | 368 UI + 188 HTTP/D1 |
| npm run test:visual-identities | 1 372 UI + 215 pilote, dont 212 dédiés API |
| npm run test:visual-pdf | 94 contrôles, 15 QR / 4 PDF |
| npm run test:member-cards | 30 contrôles, 9 QR / 2 pages A4 |
| npm run test:card-polish | 66 contrôles, 10 QR / 6 PDF |
| npm run test:card-ux | 279 contrôles + 2 pilote, 21 captures écran |
| npm run test:card-ux-pdf | 10 contrôles, 2 QR sur PDF identiques aux aperçus |
| npm run build:production | PASS |
| git diff --check | PASS |

36/36 décodages QR réussis à 300 dpi (34 dans les suites historiques/illustrées,
2 pour les comparaisons exactes écran/PDF). Enfants/adultes verticaux, plusieurs
créatures, absence d’illustration, zéro/un/trois groupes, surplus résumé, noms longs,
accents/emoji et cinq thèmes couverts. Aucun crop ni déformation : contain à l’écran,
ratio natif respecté lors de tous les drawImage PDF.

La suite dédiée compare largeur/hauteur/position des zones DOM avec le repère PDF
(tolérance normalisée 0,006, soit 0,6 point de pourcentage) : QR, personnage, nom,
Espace, groupes et pied. Contrôles de confidentialité minimale conservés par les
suites métier ; aucun code métier changé.

Dirty : nom, illustration, retour à la valeur originale, Annuler complet, échec HTTP
503 conservant les saisies et message local, succès puis clean, garde/refus/abandon
de navigation et shell identique. Groupe également testé. Barres sticky réellement
dans le viewport, cibles >=44px, focus clavier visible sur Enregistrer, 360/390/1200/
1440 px ; police racine agrandie sur téléphone et émulation zoom navigateur 150 %
960×600 CSS / DPR 1,5 (surface physique 1440×900). Préférence retrouvée après vrai
rechargement ; fichiers icon/medium corrects, lazy/async, pas de large dans les listes.

Les premiers échecs ont été diagnostiqués : attente du rechargement de fiche dans
le test, injection du 503 au transport effectivement capturé par l’adaptateur, et
garde limitée aux seules fiches dirty pour préserver le chemin synchrone du Mode
libre. Aucun scénario de test supprimé pour masquer un échec.

### Inspection visuelle

23 vues de revue (21 captures Chromium + 2 crops des PDF 300 dpi), plus les deux
pages A4 intermédiaires. Dossier ignoré : `.browser-tests/voti-card-ux-polish/`.
`manifest.json` décrit les dimensions, tailles et empreintes ; `index.html` est
la planche locale. Images inspectées : noms dominants, corps entiers, QR prioritaire
et blanc en Nuit, groupes secondaires lisibles, listes compactes et humains entiers
en Vignettes, barre toujours visible au défilement/zoom, focus et dialogue clairs.
Les cartes capturées utilisent le renderer réel sur fixtures locales ; les suites
Espaces complémentaires couvrent l’écran d’émission et les thèmes.

Deux PDF de comparaison utilisent exactement les mêmes noms, thèmes, groupes,
illustrations et QR que leurs aperçus. L’inspection confirme la composition commune,
avec des différences mineures de rasterisation/baseline de police admises.

Captures exactes :

- `members-list-1440.png`
- `members-tiles-1440.png`
- `groups-list-1440.png`
- `groups-tiles-1440.png`
- `members-tiles-390.png`
- `groups-tiles-390.png`
- `detail-clean.png`
- `dirty-name.png`
- `dirty-visual.png`
- `sticky-desktop.png`
- `confirm-discard.png`
- `sticky-mobile.png`
- `sticky-360.png`
- `sticky-zoom-360.png`
- `sticky-1200.png`
- `sticky-browser-zoom-150.png`
- `card-child-1440.png`
- `card-creature-1440.png`
- `card-child-390.png`
- `card-groups-1440.png`
- `card-adult-night-1440.png`
- `pdf-human-300dpi.png`
- `pdf-creature-300dpi.png`

### Build et audit

Build production : **1 804 288 octets**, SHA-256
`417c2794d3d5adaf2aec3d5b1a0ef685aa433d2f1496a5936df8ee8e1104a8ca`. +13 274 octets face à la version publiée,
provenant des helpers de géométrie/édition, des contrôles de vue et du CSS. Aucun
asset ni manifeste changé. Le build production est exécuté après les tests.
Aucun secret/credential réel, CDN, tracking, cookie, image personnelle ni nouvel
appel distant. Préférence locale limitée aux deux modes de vue ; données de fiche
en mémoire seulement. Aucun shared/relay, schéma visual_id, règle de vote, anonymat,
snapshot, résultat, binding ou lockfile modifié.

## Livraison Git locale

Commit séparé autorisé : `fix: améliorer les cartes et fiches Voti`, parent attendu
`3e484f4c6e4e61fc9ea4e91ea4ab30376ca3d483`. Staging explicite du lot uniquement ;
les huit rapports historiques déjà modifiés et les fichiers personnels restent hors
commit. Aucun amend/rebase/squash, push, Pages, Worker ou migration distante.
L’ancien bundle d’audit reste inchangé ; aucun bundle supplémentaire demandé ici.

Aucun asset ni manifeste changé ; aucune migration, aucun changement backend prévu.

## Limites

Les cartes utilisent la même composition sur mobile : elles se réduisent comme un
objet imprimé, sans réorganiser les zones. Le zoom navigateur reste possible.
Le navigateur contrôle le message natif lors de fermeture/rechargement. Aucun secret
participant n’est conservé pour reconstruire une carte après fermeture.

Recette humaine à prévoir sur la version locale ou après publication autorisée :
comparer aperçu et impression réelle, scanner une carte imprimée, alterner les deux
vues, modifier nom/illustration/affiliation, enregistrer ou annuler, puis essayer un
départ avec des modifications. Les scripts ne remplacent pas cette validation.
