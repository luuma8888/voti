# Cohérence du shell et du premier rendu

Référence de départ : `06d6098acd242a0a5cc4dc1bfccb3ab16121eb39`, branche `main`.
Lot du 29 octobre 2026, publication autorisée par Lu’uma.

## Diagnostic ciblé

`main,footer` étaient bornés à 1080 px. Un second système CSS définissait
`--content-width:1080px`, puis le portait à 1760 px uniquement lorsque `body:has(...)`
détectait une bibliothèque, un `.space-workspace` ou une Carte rendue.
Le HTML initial « Chargement de Voti… » ne comportait aucun de ces éléments.
Les nettoyages du DOM pendant une navigation asynchrone rétablissaient aussi
la largeur étroite. La gestion utilisait en plus un plafond de 1120 px.
Les anciennes surcharges `main:has(...)` à 1480 px ajoutaient une deuxième couche.

## Correction

Le shell est large dès le CSS initial, indépendamment du hash, des permissions,
du contenu et du démarrage JavaScript : plafond commun de 1760 px, padding
existant conservé, même règle pour le pied de page et l’alignement du header.
Aucun masquage de l’application et aucun changement du routeur.

Trois intentions : shell 1760 px, contenu standard 1080 px, lecture/formulaire
800 px. Les limites internes n’influencent plus la largeur extérieure.
La réservation du gutter desktop évite le décalage supplémentaire lié à
l’apparition d’une barre de défilement classique entre page courte et page longue.
Le Studio conserve sa limite interne de 1480 px ; les Cartes restent inchangées.

La gestion regroupe uniquement ses blocs existants dans `.poll-overview` :
état et actions à gauche, disponibilité des résultats à droite à partir de
1000 px ; ordre vertical existant conservé sur mobile. Édition et résumé restent
séparés, champs de saisie bornés en largeur de lecture.
La présentation de Carte utilise deux zones desktop, mascotte et explication/actions,
puis redevient verticale/compacte sur mobile. Le questionnaire participant conserve
un axe de lecture centré, dans le shell large. Résultats et confirmations utilisent
le même cadre extérieur ; les textes ne sont pas étirés sur toute sa largeur.

## Contrôles

- `npm test` : PASS, 431 tests ; première tentative sandbox bloquée par les sockets
  HTTP locales, exécution autorisée ensuite réussie.
- `npm run check` : PASS, 159 fichiers JavaScript.
- `npm run test:layout-consistency` : 60 états sur 390/768/1200/1440/1920 px ;
  accueil, Espace, gestion, édition ouverte, résultats indisponibles/disponibles,
  attente de Carte, liste participant, vote, confirmation, succès et retour Espace.
  Géométrie observée à chaque frame pendant les navigations ; pas de variation
  de largeur du shell ni de débordement horizontal.
- Contrôle du HTML initial avec JavaScript suspendu sur quatre routes : loader
  visible dans le même shell. Ces images structurelles ne sont pas un filmstrip
  chronométré et affichent aussi le fallback `noscript` du navigateur de test.
- `npm run test:space-ui` : PASS final, 2965 contrôles dont douze refreshs supplémentaires : accueil, Espace,
  gestion et Carte, trois fois chacun, contre le Worker/D1 local réel.
  Les assertions SPA préexistantes sont conservées ; les refreshs volontaires
  sont exécutés après elles pour ne pas changer leurs préconditions.

- `npm run test:browser` : PASS, 2966 contrôles (dont formulaires, participation,
  QR/PDF, dialogues, thèmes, responsive et ouverture locale).
- `npm run test:mascot` : PASS, trois tests et 443 contrôles Chromium,
  dont le scanner, les actions et la confirmation réelle de vote sur fixtures.

Les premières itérations du nouveau harnais ont corrigé des préconditions de test
(relay fictif configuré, renouvellement de document, carrousel de filtres volontaire,
mesure du viewport utile et séparation refresh/SPA). Aucun test existant supprimé
ou affaibli. Des tentatives de la suite Espace longue ont aussi expiré sur des
attentes de section ; leur origine n’a pas été attribuée à une règle métier.
La relance finale est PASS avec les mêmes assertions et délais ; le diagnostic
d’erreur du test affiche désormais le début du texte de l’écran fictif en cas
d’attente échouée. Les suites navigateur sont exécutées séquentiellement : elles partagent
le serveur local 4173 et le build `index.html`.

## Captures privées de revue

Dossier ignoré `.browser-tests/layout-consistency/` :

- `space-1440.png`
- `management-1440.png`
- `card-1440.png`
- `vote-1440.png`
- `management-390.png`
- `card-390.png`
- quatre `initial-*-1440.png` : géométrie du HTML initial, JS suspendu.

Captures inspectées visuellement. Fixtures fictives exclusivement ; aucun accès
réel ni QR exploitable dans ces dix images. Les résultats JSON restent privés.

## Périmètre

Aucune modification du moteur, des permissions, des votes, de l’anonymat,
des seuils, des résultats métier, des Cartes/PDF, du backend, des assets ou de la PWA.
Le tag `pilot-2026-10-25` reste inchangé. Les rapports historiques déjà modifiés,
archives et fichiers personnels ne font pas partie du lot.

## Build prêt à publier

`npm run build:production` et `git diff --check` : PASS.
HTML : 1 723 421 octets.
SHA-256 : `4cac395366e508a094856d3d297473930b5b8ef7fb38dc76da5e44d0519ed10b`.
Push normal sur `origin/main` demandé ; publication frontend par GitHub Pages.
Aucun déploiement Worker, aucune migration ni modification des données réelles.
