# Voti v0.6.2 — Recomposition ergonomique des Espaces

Les sections 1–20 décrivent la première revue locale. Le dernier correctif demandé
après inspection humaine est documenté en section 21. La section 22 fixe les
derniers défauts Express et le build destiné au commit local ; elle supplante les
valeurs précédentes sur ce point. L’architecture des six sections reste acquise.

## 1. État initial et périmètre

23 octobre 2026. Branche main, HEAD `d0e7422fff22387e1f9231d10842302c9c3070eb`.
Index vide. Six rapports déjà modifiés (v0.4A, v0.4B, v0.3E, livraison/déploiement
v0.6 et v0.6.1) sont préservés. Cinq captures personnelles et VOTI_UX_V0_3E_SPEC
restent non suivis. Ils ne font pas partie des changements v0.6.2.

Mission strictement locale : aucune production consultée ou mutée, aucun staging,
commit/push/déploiement, migration, nouveau credential, changement shared/relay ou
de configuration Cloudflare. Aucune nouvelle dépendance prévue.

Autorités relues intégralement : AGENTS, CODEX_V0_6_1_UX_REPORT,
CODEX_PRODUCTION_DEPLOYMENT_V0_6_REPORT, CODEX_SPACES_GROUPS_V0_6_REPORT,
VOTI_SPACES_GROUPS_V0_6_SPEC, SPACES_GROUPS_V0, MEMBER_CARDS_V0, UX_FLOWS_V0,
GROUP_VOTING_PRIVACY_V0, DATA_MODEL_V0, PARTICIPATION_V0,
COMMENTS_AND_IDENTITY_V0, PRIVACY_AND_ABUSE_V0, README. MVP_SCOPE et matrice des
modes relus ; les autorités fondatrices déjà lues restent inchangées.
Le skill Wrangler est utilisé exclusivement pour les outils/tests locaux.

## 2. Constat ergonomique humain

« C'est juste moins pire qu'avant. » La v0.6.1 a corrigé des comportements mais
conservé une page où presque tout est affiché en même temps. Une carte membre
concentre nom, affiliations, sauvegarde et révocations ; les formulaires d'ajout
restent sous les listes. Ajouter encore des cadres ne résoudrait pas ce modèle.

## 3. Cartographie avant modification

| Vue / fonction existante | Contenu et actions | Cause de surcharge |
| --- | --- | --- |
| `SpacesUI.space` | Renommer/archiver/exporter, groupes, membres, invitations, accès, sondages | Tout dans le même flux vertical |
| Boucle groupes | Nom éditable, renommer, archiver, puis ajout | Édition permanente de chaque ligne |
| Boucle membres | Nom, toutes les cases, Enregistrer, carte, révocations | Une fiche complète par personne |
| Invitations | Gros formulaire, récapitulatif, puis liste/fermeture | Création prioritaire sur les objets existants |
| Accès | Création et boutons de révocation répétés | Danger dominant, portée peu lisible |
| `newPoll` / `spacePollForm` | Pas à pas et rapide dans un details au bas de page | La tâche de création se perd dans la gestion |
| `managePoll` / share / résultats | Tâches de sondage séparées | Retours encore parfois simples liens |

Les mutations passent déjà par `spaceCommand` avec révision, confirmations et
contrôles serveur. Elles peuvent être conservées ; il faut conditionner le rendu,
pas modifier le métier. Scanner, participation, PDF et moteur commun restent intacts.

## 4. Architecture retenue avant implémentation

Un Espace est un lieu navigable : **Aperçu, Sondages, Membres, Groupes, Invitations,
Accès**, et **Réglages** en secondaire. Une seule section principale rendue à la fois.
Les sections administratives ne sont pas rendues pour un Créateur. Les groupes et
sondages proviennent exclusivement de sa projection autorisée.

Routes locales sous `#space/<id>/…` : racine = aperçu ; polls, members, groups,
invitations, access et settings. Sous-route new pour une tâche de création, ou
identifiant non secret pour une fiche. Les routes de sondage existantes
`poll/<pollId>/…` restent compatibles. Historique et liens natifs, sans reload.

### Grand écran

Navigation latérale claire, pas de console sombre ni de tableau technique. Contenu
large mais champs bornés. Lignes séparées subtilement, nom, badges, état et bouton
Voir/Gérer ; objectif de plusieurs objets visibles simultanément. Fiche membre
en formulaire principal et petite zone carte/actions secondaire.

### Smartphone

Navigation en grille courte, sans tableau horizontal. Lignes devenant petites
cartes sans bordures imbriquées. Tâche dédiée avec retour explicite ; navigation
secondaire effacée sur petit écran pendant une tâche pour préserver l'attention.
Contrôles natifs, focus et cibles tactiles conservés.

### Progressive disclosure et limites de contrat

Les listes ne contiennent plus les champs d'édition ni les actions dangereuses.
Les formulaires n'existent qu'après activation. Révocation/archivage dans les fiches,
avec confirmations existantes. Pas de nouvelle bibliothèque générique de composants.

`getSpace` ne renvoie pas les audiences/résultats détaillés de chaque sondage :
leur enrichissement éventuel doit utiliser des lectures autorisées bornées de
`getSpacePoll`, sans nouveau contrat ni promesse inventée. Un Créateur ne reçoit
pas la liste des membres : pas de faux compteur « zéro ».

Le serveur ne renvoie pas les secrets des autres accès. L'export reste celui de
l'accès personnel conservé, explicitement nommé ; jamais une fausse récupération
d'un fichier secret depuis un digest. Les cartes issues d'invitations gardent leur
limite de récupération documentée en v0.6.1.

## 5. Plan de vérification défini avant modification

Maintien des parcours v0.6.1, tests structurels/densité/rôles/clavier, viewports
360×800, 390×844, 1200×800 et 1440×900. Au moins dix-huit captures des neuf vues
demandées, sur fixtures locales fictives, puis inspection réelle avant conclusion.
Toutes les suites demandées seront relancées séquentiellement, production build
local en dernier. Résultats, fichiers, captures, confidentialité et bundle à
compléter après leur exécution réelle ; aucune validation humaine revendiquée.
## 6. Architecture livrée et navigation

`web/space-management.js` compose le lieu Espace : en-tête, navigation, aperçu et
listes. `SpacesUI` garde les tâches et leurs commandes existantes ; `spaceDetails`
ne construit que la fiche demandée. Pas de bibliothèque de composants ajoutée.
Les nouvelles routes utilisent des identifiants d’objets non secrets. Les chemins
historiques de gestion/partage/Studio/résultats d’un sondage restent valides.

Les liens natifs, stylisés selon leur importance, conservent l’historique du
navigateur. Un titre focalisé annonce la navigation. Un seul élément
`data-space-section` est rendu. Les sections administratives sont absentes pour
un Créateur, et leur ouverture directe est refusée par la présentation ; les
contrôles du serveur restent autoritaires et inchangés.

## 7. Aperçu

Nom et rôle, trois compteurs issus de la projection autorisée, une action principale
Nouveau sondage, puis Ajouter un membre / Créer une invitation pour l’administration.
Invitations encore utilisables et trois sondages récents complètent l’aperçu.
Aucun formulaire complet n’y est rendu. Pour un Créateur, le compteur de membres
est remplacé par le nombre de sondages accessibles : aucune donnée inventée.

## 8. Sondages et création

Liste compacte : question, état, audience et disponibilité des résultats, puis
Gérer. Les métadonnées sont chargées via `getSpacePoll`, deux lectures simultanées
et vingt sondages maximum. Les réponses devenues obsolètes sont ignorées par le
contrôle d’époque existant ; un échec propose d’ouvrir Gérer. Au-delà des vingt
premiers, les détails restent accessibles dans la gestion.

Nouveau sondage est une tâche dédiée. Pas à pas utilise cinq écrans significatifs :
question, réponses, participants, résultats, vérification/création. Les options
participation/commentaires et confidentialité restent accessibles dans des détails
secondaires. Création rapide rend les mêmes sections et les mêmes champs ; le
constructeur `makeSpacePollDraft`, les valeurs par défaut et validations restent
identiques. Changer d’étape ou de mode conserve les valeurs. Aucune sauvegarde
intermédiaire nouvelle n’est introduite. Retour aux sondages est visible en haut
de la gestion ; résultats et Studio proposent un retour explicite à Gérer.

## 9. Membres

Une ligne montre uniquement pseudo, groupes, état de la carte et Voir. Les cinq
membres de la fixture tiennent simultanément dans le viewport desktop. La fiche
expose ensuite nom/groupes, indication des modifications non enregistrées,
Enregistrer, état de carte et régénération. Révoquer carte / membre sont repliés
dans Actions à utiliser avec précaution et gardent leurs confirmations.
Après émission d’une carte, Retour à l’Espace mène à la liste des membres, pas à
un formulaire vide. La file d’impression reste uniquement en mémoire.

## 10. Groupes

Nom, nombre de membres (administration seulement), état éventuel et Gérer sur une
ligne. Nouveau groupe ouvre le formulaire uniquement à la demande. Renommer et
archiver restent dans la fiche, avec l’archivage en zone de précaution. Un Créateur
ne peut ouvrir que les groupes de sa projection et n’a aucun formulaire de création
ou de modification. L’archivage reste soumis aux contraintes existantes.

## 11. Invitations et accès

Les invitations montrent d’abord groupes, usages et échéance. Terminées/fermées
sont typographiquement secondaires, avec un libellé explicite. Nouvelle invitation
conserve récapitulatif et confirmation v0.6.1 ; le QR à usage de partage immédiat,
son téléchargement et le retour SPA fonctionnent toujours après remplacement du
DOM. Aucun groupe n’est sélectionné ou attribué silencieusement.

Les accès montrent rôle, périmètre et état avant toute action. Leur détail permet
la révocation confirmée. Créer un accès reste une tâche dédiée avec export du
fichier SECRET correctement nommé. Exporter mon accès personnel conduit aux
Réglages : seules les capacités réellement conservées sont exportables. Aucun
secret d’un autre accès n’est récupéré ou promis à partir de son digest.

## 12. Responsive et accessibilité

1440 : navigation latérale légère, lignes de liste avec colonnes souples ; champs
de tâche bornés à 760 px. 390 : navigation trois colonnes, listes sur deux lignes,
bouton Voir/Gérer séparé à droite. Pendant une tâche sur mobile, la navigation
secondaire disparaît au profit d’un retour explicite. 360×800 et 1200×800 sont
également vérifiés par les assertions de structure/débordement.

Les liens Voir/Gérer possèdent un nom accessible contextualisé. Titres ordonnés,
labels/cases imbriqués, focus visible et contrôles de navigation d’au moins 44 px.
Les fiches sont des pages SPA dédiées, sans nouveau panneau modal ni piège de
focus/Escape. Les dialogues existants conservent Escape, annulation et restauration
du focus. Les tests envoient une vraie touche Entrée via CDP pour ouvrir une fiche.
Le CSS d’impression masque navigation/actions et remet le contenu en flux simple ;
le nouveau quadrillage de gestion ne s’impose pas aux pages imprimées.

## 13. Fichiers du lot

- `web/space-management.js` : composition des sections et listes.
- `web/spaces-ui.js` : routage, tâches conditionnelles, présentation guidée et retours.
- `web/space-poll-form.js` : Continuer identifié comme action principale.
- `web/styles.css` : navigation, densité, responsive et danger secondaire.
- `scripts/browser-space-layout.mjs` : fixtures, structure, tâches et rôles locaux.
- `scripts/browser-test.mjs`, `scripts/free-pilot-integration.mjs`, `package.json` :
  branche/suite dédiée `test:space-ui`, capture réelle et raccordement local.
- `scripts/browser-spaces.mjs`, `scripts/browser-spaces-ux.mjs` : parcours existants
  adaptés aux sections, sans retirer les assertions fonctionnelles v0.6.1.
- `scripts/audit-bundle.mjs`, `tests/audit-bundle.test.js` : nom du nouveau bundle.
- `index.html` : build autonome régénéré localement.
- `README.md` : accès à la revue locale et à sa suite de captures.
- `docs/SPACES_GROUPS_V0.md`, `docs/UX_FLOWS_V0.md`, présent rapport : présentation.

`shared/`, `relay/`, migrations, configurations Cloudflare, dépendances et lockfile
ne sont pas modifiés. Les six rapports préexistants et cinq captures personnelles
restent hors du lot ; aucun nettoyage opportuniste.

## 14. Tests et incidents de mise au point

La suite dédiée passe avec **519 contrôles structure/densité/rôles/tâches**,
plus deux contrôles du lanceur local. Elle utilise un vrai Worker/D1 local, deux
groupes, cinq membres, trois sondages, deux invitations et trois accès fictifs.
Elle vérifie aussi ajout/renommage/archivage d’un groupe, fermeture d’invitation,
révocation d’un accès, séparation des réglages et ouverture de fiche au clavier.
Les parcours v0.6.1 conservent **368 contrôles Chromium**, y compris invitations,
révocation effective, PDF individuel/lot, résultats privés, appareil partagé et
absence de persistance participante.

Échecs intermédiaires diagnostiqués : adaptation d’un test attendant encore quatre
étapes au lieu de cinq (corrigé sans retirer d’assertion) ; archivage de l’Espace
encore visible hors du détail Danger (détecté par la nouvelle suite et corrigé).
Le premier `npm test` en sandbox restreinte échouait à lancer le runtime local du
test Siteverify ; le test isolé puis la suite complète avec processus locaux
autorisés passent. Aucun challenge production ni appel Turnstile réel simulé.

Un autre sélecteur de test attendait le refus d’une section Créateur dans le
bandeau global ; le routeur affiche une page d’erreur dédiée. L’attente a été
corrigée pour vérifier cette page et le motif exact, sans changer la protection.
Les résultats finaux figurent en section 19.

Le profil relais historique des tests simule aussi R2 **localement** pour vérifier
ses anciennes interfaces ; aucune ressource R2 n’est activée. Les suites
`test:free-pilot` et `test:spaces` utilisent le profil gratuit sans binding R2.

## 15. Inspection visuelle réelle

Vingt PNG proviennent de Chromium rendu, jamais de maquettes. Chaque paire a
été ouverte et inspectée visuellement. Desktop : cinq membres visibles, lignes
alignées d’environ 80 px, deux groupes sur deux lignes compactes avec leurs colonnes
de contenu, aucun formulaire dans les listes, danger absent des
lignes. Les listes courtes gardent un espace calme plutôt que des formulaires
pour remplir artificiellement l’écran. Aucun texte coupé ni chevauchement observé.

Smartphone : trois membres complets visibles en 390 px avec leurs badges et Voir,
pas de tableau horizontal ; les trois actions d’aperçu restent reconnaissables.
La fiche est plus longue qu’une ligne, volontairement, mais seule la personne
ouverte expose ses réglages. Le formulaire guidé tient son action Continuer dans
le premier écran. Le mode rapide défile normalement ; il n’est plus dans la page
d’aperçu. Les anneaux visibles après changement de mode sont le focus accessible.

Une première capture de Sondages avait encore le texte de chargement : la suite
attend désormais que les lectures autorisées se terminent avant de capturer.
Les deux captures longues complètent les dix-huit vues de viewport. La vue longue
mobile est rendue avec un viewport plus haut pour placer sa barre fixe en bas de
la page entière, sans recouvrir le milieu d’un assemblage. Les neuf captures
mobile principales restent exactement en 390×844 ; aucune image n’est retouchée.
La validation esthétique humaine et la compréhension effective par un enfant
restent **NON VALIDÉES**. Ces observations Codex ne remplacent pas le jugement de Lu’uma.

## 16. Liste exacte des captures

Répertoire ignoré : `.browser-tests/v062-review/`. `index.html` fournit une planche
HTML locale sans dépendance. Les PNG ne sont ni dans Git ni dans le bundle.

| Vue | Desktop 1440×900 | Smartphone 390×844 |
| --- | --- | --- |
| Aperçu | overview-1440.png | overview-390.png |
| Sondages | polls-1440.png | polls-390.png |
| Membres | members-1440.png | members-390.png |
| Fiche membre | member-detail-1440.png | member-detail-390.png |
| Groupes | groups-1440.png | groups-390.png |
| Invitations | invitations-1440.png | invitations-390.png |
| Accès | access-1440.png | access-390.png |
| Pas à pas | guided-1440.png | guided-390.png |
| Rapide | quick-1440.png | quick-390.png |
| Rapide, page entière | quick-full-1440.png | quick-full-390.png |

Les dix-huit captures principales ont exactement les résolutions des en-têtes.
Les deux vues longues auxiliaires mesurent respectivement **1425×1936** et
**390×2109** ; elles complètent la revue des champs situés plus bas dans la page.

## 17. Confidentialité et limites

Les ajouts ne stockent rien dans localStorage, sessionStorage ou IndexedDB. Ils
utilisent seulement l’accès de gestion déjà conservé et les projections autorisées.
Les credentials restent dans les en-têtes/commandes existants, jamais dans les
nouvelles routes ou noms de fichier. Le texte est construit par textContent et
les attributs DOM ; pas de HTML interprété. Aucun token, pseudo participant ou
carte ajouté à un bulletin, au BroadcastChannel ou à un log.

Aucune dépendance, police distante, CDN, cookie, tracking, image distante ni R2.
Les invariants anonymat/snapshot/unicité/audience/minimumResponses sont inchangés,
et les tests locaux structurels existants restent exécutés. Le scanner et les PDF
ne sont pas modifiés par ce lot ; leurs suites sont relancées en non-régression.
La production, dont l’Espace test conservé, n’est ni consultée ni modifiée.

Limites conservées : pas de récupération serveur des anciennes cartes ni des
credentials des autres accès ; les tâches non créées ne sont pas sauvegardées en
quittant leur route ; seules les vingt premières lignes de sondage sont enrichies
automatiquement. Les grandes listes peuvent encore nécessiter du défilement,
mais n’exposent plus un formulaire complet par objet.

## 18. Validation humaine recommandée avant publication

Commencer par la planche locale : juger Aperçu, Membres et les deux créations sur
desktop/téléphone. Vérifier si les sections se comprennent sans explication, si le
retour depuis une fiche est évident, et si le danger est accessible sans dominer.
Après un éventuel déploiement autorisé seulement, reprendre quelques manipulations
physiques avec les fixtures existantes, sans considérer cette revue Chromium comme
une validation caméra/papier/téléphone collectif.

## 19. Résultats finaux exacts

Toutes les commandes ci-dessous ont terminé avec **code 0**, sans test supprimé
ni désactivé. Journaux ignorés : `.browser-tests/v062-*.log`, tableau machine
`v062-results.json` et dernières vérifications `v062-final-results.json`.

| Commande | Résultat |
| --- | --- |
| `npm test` | PASS — 399 tests unitaires ; relancé en contrôle final |
| `npm run check` | PASS — 116 fichiers JavaScript ; relancé après les derniers changements de tests |
| `npm run build` | PASS — HTML autonome ; relancé en contrôle final |
| `npm run test:browser` | PASS — 2 966 contrôles Chromium |
| `npm run test:participation` | PASS — 294 contrôles, 3 PDF |
| `npm run test:comments` | PASS — 37 contrôles Poppler, 3 PDF A4, 7 QR décodés |
| `npm run test:relay` | PASS — 118 contrôles HTTP locaux |
| `npm run test:integration` | PASS — 3 136 contrôles Chromium, 119 contrôles HTTP |
| `npm run test:free-pilot` | PASS — 3 138 contrôles Chromium, 67 contrôles HTTP/D1 sans R2 |
| `npm run test:spaces` | PASS — 188 contrôles HTTP/D1, 368 contrôles Chromium |
| `npm run test:spaces-ux` | PASS — 368 contrôles Chromium, 2 contrôles du lanceur |
| `npm run test:member-scanner` | PASS — 11 contrôles caméra artificielle locale |
| `npm run test:spaces-migration` | PASS — 8 contrôles ; anciennes lignes/hashes compatibles |
| `npm run test:member-cards` | PASS — 12 contrôles Poppler, 2 pages A4, 9 QR fictifs décodés à 300 dpi |
| `npm run test:poster` | PASS — 97 contrôles, 8 PDF A4, 30 QR décodés |
| `npm run test:poster-studio` | PASS — 188 contrôles, 13 PDF A4, 51 QR décodés |
| `npm run test:poster-polish` | PASS — 117 contrôles, 7 PDF A4, 36 QR décodés |
| `npm run test:space-ui` | PASS — 519 contrôles, 20 PNG réels, 2 contrôles du lanceur |
| `npm run build:production` | PASS — exécuté après les tests en dernière construction |
| `git diff --check` | PASS |

Les contrôles dédiés incluent navigation native au clavier, historique retour/avant,
focus de titre, impression sans navigation de gestion, cinq thèmes sans débordement,
fiche de groupe Créateur en lecture seule, refus de la route Membres et absence du
sondage du groupe interdit. Le dernier membre reste accessible au-dessus de la barre
mobile après défilement. Aucune exception JavaScript ni requête HTTP externe dans
la suite dédiée. Les tests critiques v0.6 restent réalisés sur D1 local réel.

## 20. Build, état final et audit

Référence v0.6.1 vérifiée depuis le blob Git de HEAD : **1 603 237 octets**,
`cafe2545f6aed3203a74269438f892ac1eb971f077bf0eb5336aef3958ea2096`.

Build de production local v0.6.2 : **1 624 432 octets**, SHA-256 :

`38d8ba524bd8c1f362f5c1e2755c09357e104add80dc5d417637c4db784ecd6d`

Variation : **+21 195 octets**, environ **+1,32 %**. Elle vient des compositions
DOM/navigation et du CSS responsive supplémentaires, embarqués dans le HTML et
l’import map. Aucune nouvelle bibliothèque, police ou image. Les 55 modules sont
embarqués en data URLs, scanner compris. Configuration publique identique à
`web/relay-production.json`, `remoteAssetsEnabled=false`, Turnstile siteverify.
Aucun déploiement n’est déclenché par cette construction.

Les empreintes des **38 fichiers protégés** (shared/relay/lockfile et six rapports
préexistants) sont comparées à l’état initial. Aucun changement dans ces fichiers.
Les modules scanner, cartes, stockage, relais HTTP et les configurations publiques
restent également sans diff. Aucun ajout de migration 0005.

État attendu pour livraison : **LOCAL PASS technique**, validation visuelle humaine
**EN ATTENTE**. Desktop 1440 et smartphone 390 : inspection Codex PASS ; pas de
validation enfant, caméra physique, papier ou production revendiquée. HEAD reste
`d0e7422fff22387e1f9231d10842302c9c3070eb`, branche main, index vide. Aucun staging,
commit, push, déploiement ou accès à la production. L’Espace test n’a pas été utilisé.

Bundle local : `VOTI_AUDIT_V0_6_2.zip`, après ce rapport, hors Git. **197 entrées** :
CRC et intégrité ZIP vérifiés indépendamment avec Python ; manifeste exact et
octets comparés aux 197 fichiers admissibles. Aucun ZIP récursif, capture, export
secret, PDF, sauvegarde/base, profil/cache, node_modules ou fichier env. Aucun
credential littéral détecté, y compris après décodage des 55 modules du build.
Les cartes/credentials fictifs des essais restent dans les répertoires de tests
ignorés et ne sont pas inclus. Le module source `shared/backup.js` reste inclus :
ce code n’est pas un fichier de sauvegarde. Le ZIP est recréé après cette conclusion
documentaire puis revérifié ; sa taille finale est fournie dans le retour terminal.

## 21. Dernier polissage après revue humaine

### Observations et périmètre retenu

La recomposition Espace est validée dans son principe. Il ne s’agit pas d’une
nouvelle architecture : Aperçu/Sondages/Membres/Groupes/Invitations/Accès, lignes
compactes, fiches à la demande et tâches séparées sont conservés. La revue a relevé
la concurrence entre navigation générale et Espace, un breadcrumb redondant,
l’étirement horizontal des listes, un titre membre trop administratif, et surtout
l’assimilation erronée de « rapide » à un long formulaire complet.

### Navigation contextuelle, identité et listes

Dans `#space/…`, y compris les tâches de sondage, la navigation globale est masquée.
Un seul retour explicite **Accueil Voti** reste disponible, en plus du retour
**Espaces**. La barre fixe mobile générale disparaît : pas de concurrence entre
création libre et création Espace, ni de boutons Continuer/Créer masqués. Le mode
libre retrouve sa navigation habituelle quand on quitte ce contexte. Aucun état
participant n’est conservé pour cela : c’est uniquement un attribut DOM de contexte.

Le petit breadcrumb dupliquant le titre est masqué. Sur une fiche, le nom du membre
devient le H1 ; le nom de l’Espace reste un contexte bref et distinct. Informations
et Carte Voti structurent le détail, sans remettre les actions dangereuses en avant.
Les listes restent compactes et leur largeur est bornée à 1000 px. Les invitations
parlent de « personnes sur N » plutôt que d’utilisations. Aucun concept métier ne
change. Les anciennes captures et le ZIP de revue visuelle restent inchangés.

### Icônes

`space-icons.js` fournit une petite famille SVG locale, sans bibliothèque ni CDN,
proche du langage de traits déjà employé dans Voti. Navigation, ajout, retour,
modification et réponses utilisent icône + texte. Aucun contrôle nouveau n’utilise
une icône seule ; pas de dépendance au hover, au long press ou à une couleur pour
comprendre une action. Les SVG sont décoratifs (`aria-hidden`, non focalisables).

### Création : un formulaire, trois présentations

L’entrée affiche **Création guidée**, **Création express**, puis **Réglages avancés**
en secondaire. Aucun mur de paramètres avant ce choix.

Guidée a six étapes : question ; réponses ; qui participe ; comment participer ;
quand montrer les résultats ; vérifier. Les réponses sont des lignes individuelles
(2 à 6) avec ajout/retrait et réorganisation secondaire. Les groupes sont choisis
explicitement ; un Créateur limité reste limité à sa projection autorisée. Les
commentaires et l’identité sont séparés de l’audience. Vote simple désactive toujours
la visibilité. Le minimum et les quatre conditions de résultats restent ceux du
modèle existant. Le résumé est structuré en cinq rubriques avec Modifier vers chaque
étape. Retour/avance et changement de présentation conservent les champs en mémoire.

Express affiche seulement question, réponses et audience. Ses valeurs recommandées
sont **anonymous / optional / private / threshold / minimumResponses=5 /
poll_audience**, exactement les défauts déjà utilisés par Voti. Il ne baisse pas
le minimum selon le nombre de membres. Ces valeurs sont appliquées explicitement
par `spaceCreationValues` à la soumission Express ; les réglages secondaires saisis
dans Guidée/Avancé ne sont pas écrasés et réapparaissent si l’on revient à ces modes.
Le contexte Espace et les défauts Express sont écrits dans la tâche. Le brouillon
reste modifiable dans Gérer avant publication.

Avancé expose tous les champs sur une page, volontairement choisie. Les trois
présentations utilisent les mêmes nœuds de saisie, le même `makeSpacePollDraft`,
les mêmes validations et la même API `prepareSpacePublication`. Aucun nouveau schéma,
hash, credential, stockage ou protocole. `space-poll-editor.js` sépare la composition
des champs de leur présentation (`space-poll-form.js`) sans créer trois moteurs.
Les erreurs de saisie sont proches de l’étape concernée ; le focus suit l’étape.

### Anticipation des images — aucune implémentation média

Une future zone image de question pourrait être placée dans `.space-question-content`.
Chaque `[data-answer-row]` possède un bloc texte distinct pouvant accueillir une
image facultative, sans transformer toute la page en une seule pile de paramètres.
Mobile garderait des lignes/cartes de réponse, desktop une largeur de lecture bornée.
Aucun bouton image factice ni nouveau média n’est ajouté. Un futur lot devrait
définir disponibilité locale/distante, validation, stockage, sérialisation/hash,
cycle de vie et support du relais ; rien de cela n’est anticipé dans les données.

### Vérifications et captures

Les tests existants sont adaptés au choix initial et aux six étapes sans retirer
leurs assertions métier. Les nouveaux scénarios créent réellement des brouillons
locaux, comparent Guidée/Avancé et les défauts Express, vérifient modification avant
publication et nettoyage de ces brouillons. L’extension de revue a atteint une limite
de requêtes lors d’une première exécution trop rapide : le test espace ses navigations
et évite une double lecture inutile. Aucun quota, binding ou code serveur n’a changé.

Les nouvelles captures sont produites dans `.browser-tests/v062-final-review/`.
Les résultats finaux et l’inspection réelle sont consignés ci-dessous. Aucun accès
production ni staging/commit/push.

### Résultats finaux du dernier polissage — 23 octobre 2026

Le parcours Guidée vérifie chaque étape, préserve les saisies au retour et au
changement de présentation, et ramène aussi à l’étape concernée si un champ devenu
masqué est invalide lors de la création finale. Les erreurs restent près du champ.
Le test couvre ce cas après modification de la question depuis Avancé. L’étape
Résultats utilise quatre choix radio : leurs formulations restent entièrement
lisibles, même sur smartphone, sans les tronquer dans un select.

Tous les contrôles ci-dessous ont terminé avec un code de sortie 0. Les suites sont
exécutées séquentiellement, sur des fixtures locales uniquement. Un lanceur long a
été interrompu avec le code 143 après `test:poster`, avant résultat de Studio ; les
deux suites PDF restantes ont été reprises et terminées avec succès. Aucun test ni
assertion n’a été supprimé pour contourner un échec. Le dernier passage UI inclut
la correction finale de validation et régénère toutes les nouvelles captures.

| Commande | Résultat exact |
| --- | --- |
| `npm test` | PASS — 400 tests |
| `npm run check` | PASS — 118 fichiers JavaScript, revérifiés à la fin |
| `npm run build` | PASS — HTML autonome de développement |
| `npm run test:browser` | PASS — 2 966 contrôles Chromium |
| `npm run test:participation` | PASS — 294 contrôles, 3 PDF détaillés |
| `npm run test:comments` | PASS — 37 contrôles Poppler, 3 PDF, 7 QR |
| `npm run test:relay` | PASS — 118 contrôles HTTP locaux |
| `npm run test:integration` | PASS — 3 136 contrôles Chromium + 119 HTTP locaux |
| `npm run test:free-pilot` | PASS — 3 138 contrôles Chromium + 67 HTTP/D1 sans R2 |
| `npm run test:spaces` | PASS — 368 contrôles Chromium + 188 HTTP/D1 sans R2 |
| `npm run test:spaces-ux` | PASS — 368 contrôles Chromium + 2 contrôles de lancement local |
| `npm run test:space-ui` | PASS final — 2 125 contrôles UI + 2 contrôles de lancement local ; 24 captures |
| `npm run test:member-scanner` | PASS — 11 contrôles Chromium locaux |
| `npm run test:spaces-migration` | PASS — 8 contrôles de 0004 locale, anciennes lignes/hashes et INSERT v0.5 compatibles |
| `npm run test:member-cards` | PASS — 12 contrôles, 2 pages A4, 9 QR fictifs à 300 dpi |
| `npm run test:poster` | PASS — 97 contrôles, 8 PDF, 30 QR |
| `npm run test:poster-studio` | PASS — 188 contrôles, 13 PDF, 51 QR |
| `npm run test:poster-polish` | PASS — 117 contrôles, 7 PDF, 36 QR |
| `npm run build:production` | PASS — exécuté après toutes les suites ci-dessus |
| `git diff --check` | PASS |

Les mentions R2 des suites historiques `test:relay` / `test:integration` concernent
leur émulateur local existant. Aucun service distant, binding ou R2 de production
n’a été utilisé. Les suites Espaces et pilote gratuit fonctionnent sans R2.
Journaux et résultats détaillés : `.browser-tests/v062-polish-*.log`,
`v062-polish-results.json` et `v062-polish-final-results.json` (ignorés, hors bundle).

Les nouvelles assertions couvrent la validation des six étapes, les 2–6 réponses,
le retrait et le réordonnancement, l’audience explicite, Vote simple, les quatre
conditions de résultats et leur minimum, le résumé modifiable, l’équivalence des
brouillons Guidée/Avancé, les défauts Express exacts et leur modification avant
publication. Elles vérifient également le périmètre du Créateur en Express, le
retour à la navigation libre, les SVG décoratifs avec texte visible et le maintien
des contrôles de densité, clavier, droits et confidentialité existants.

### Captures finales et inspection visuelle

Répertoire ignoré : `.browser-tests/v062-final-review/` ; planche locale :
`index.html` dans ce répertoire. **24 PNG originaux Chromium** : aucun recadrage,
redimensionnement ou annotation après capture. Fixtures fictives locales de
La Cabane Voti, Groupes Lune/Soleil, cinq membres et sondages de test. Aucune donnée
de production, vraie carte, QR secret ou fichier d’accès dans ces vues.

| Vue | Desktop | Smartphone |
| --- | --- | --- |
| Aperçu | `overview-1440.png` | `overview-390.png` |
| Membres | `members-1440.png` | `members-390.png` |
| Fiche membre | `member-detail-1440.png` | `member-detail-390.png` |
| Choix du parcours | `creation-choice-1440.png` | `creation-choice-390.png` |
| Guidée : question | `guided-question-1440.png` | `guided-question-390.png` |
| Guidée : participants | `guided-participants-1440.png` | `guided-participants-390.png` |
| Guidée : participation | `guided-participation-1440.png` | `guided-participation-390.png` |
| Guidée : résultats | `guided-results-1440.png` | `guided-results-390.png` |
| Guidée : vérification | `guided-review-1440.png` | `guided-review-390.png` |
| Express | `express-1440.png` | `express-390.png` |
| Avancé | `advanced-1440.png` | `advanced-390.png` |
| Avancé, vue longue | `advanced-full-1440.png` | `advanced-full-390.png` |

Les 22 captures standard mesurent respectivement **1440 × 900** et **390 × 844**.
Les vues longues mesurent **1440 × 3397** et **390 × 3402** : elles sont capturées
par Chromium dans un viewport de hauteur augmentée, sans traitement des PNG.
Les quatre formats **360 × 800, 390 × 844, 1200 × 800 et 1440 × 900** sont testés.
Les anciennes 20 captures de `.browser-tests/v062-review/`, leur planche et leur
archive visuelle sont préservées octet pour octet pour comparaison.

Inspection Codex effective des 24 PNG, après leur dernière génération :

- Aperçu : le contexte Espace reste explicite ; Accueil Voti remplace les actions
  générales concurrentes. Les six sections restent icône + texte, y compris sur
  mobile. Pas de bouton de création libre concurrent.
- Membres : cinq lignes desktop visibles simultanément ; les cartes mobile restent
  compactes, sans formulaires d’édition permanents ni actions rouges dominantes.
  La largeur bornée rapproche métadonnées et action sans enfermer la liste.
- Fiche : Lune A est le titre principal ; Informations et Carte Voti structurent
  les actions. Le contexte Espace n’est plus un doublon du titre individuel.
- Choix : Guidée est la proposition première, Express est distincte, Avancé est une
  action secondaire avec son explication. Aucun mur de paramètres au départ.
- Guidée : question, audience et participation sont des écrans courts, avec étapes,
  Retour/Continuer et focus visibles. Sur mobile, l’en-tête est allégé tout en
  conservant le nom de l’Espace et un retour explicite aux sondages.
- Résultats : les quatre conditions ne sont pas tronquées. Un léger défilement
  reste nécessaire pour les actions selon la hauteur disponible ; aucun élément
  fixe ne les recouvre. Le résumé complet défile aussi, en rubriques lisibles.
- Express : question, deux réponses et audience, note des défauts puis Créer tiennent
  dans le viewport de tâche mobile de référence. Ajouter des réponses/groupes
  allonge naturellement la page ; aucun réglage avancé n’y apparaît.
- Avancé : long par choix explicite, avec les mêmes champs et le résumé. Il n’est
  plus présenté comme le mode rapide. Les vues longues montrent toute la page.
- Les champs desktop restent autour d’une largeur de lecture de 700–760 px ; aucun
  champ de 1200 px, texte coupé ou overflow observé. Les contours de focus visibles
  sur certains titres/champs sont volontaires, liés à la navigation clavier.

Conclusion technique/visuelle Codex : desktop 1440 et smartphone 390 présentables
pour revue. **Ce constat ne remplace pas la validation visuelle humaine de Lu’uma**,
ni une recette physique caméra/papier/appareil partagé.

### Fichiers du polissage final

- Nouveaux : `web/space-icons.js`, `web/space-poll-editor.js`.
- Présentation : `web/space-poll-form.js`, `web/space-management.js`,
  `web/spaces-ui.js`, `web/space-ux.js`, `web/styles.css`, `index.html` reconstruit.
- Tests : `scripts/browser-space-layout.mjs`, `scripts/browser-test.mjs`,
  `scripts/browser-spaces.mjs`, `scripts/browser-spaces-ux.mjs`,
  `tests/space-ux.test.js`.
- Bundle : `scripts/audit-bundle.mjs`, `tests/audit-bundle.test.js` excluent désormais
  toute archive ZIP, y compris l’archive visuelle non suivie, pour éviter sa copie
  récursive dans le bundle source.
- Documentation : ce rapport, `docs/SPACES_GROUPS_V0.md`, `docs/UX_FLOWS_V0.md`,
  `README.md`. Aucune dépendance ajoutée.

### Build production final et confidentialité

Build final : **1 644 597 octets**.

SHA-256 : `96f616106a7aafa0ee03724e638d768be02da7b74c43be4677eea7743d6a26d2`.

Variation : **+20 165 octets** par rapport à la v0.6.2 avant dernier polissage
(1 624 432) ; **+41 360 octets** par rapport à la v0.6.1 publiée (1 603 237).
L’augmentation vient des parcours, lignes de réponses, résumé, validations UI et
petits SVG embarqués dans le HTML autonome, sans nouvelle bibliothèque ou média.

Contrôle des empreintes initiales : les **64 fichiers protégés** (shared, relay,
vendor, lockfile, anciens rapports déjà modifiés, anciennes captures/planche/ZIP)
restent identiques. Aucun changement de migration, hash métier, règle de résultat,
snapshot, unicité ou credential. Aucun appel production n’a été effectué.
Les nouveaux modules de présentation ne font ni stockage, ni requête réseau, ni
journalisation d’identité. Le scanner, le cycle de session participant et les
projections protégées restent ceux de v0.6.1, couverts par les suites existantes.
Les noms de membres et réponses utilisent des nœuds texte DOM ; aucun HTML injecté.

Configuration publique de build conservée : relais production configuré, clé
Turnstile **publique** de site, `siteverify`, médias distants désactivés. Cette
configuration n’est pas utilisée par les fixtures locales de test. Aucun credential
réel, secret Turnstile, cookie, tracking, CDN, persistance participant ou nouvelle
ressource distante n’a été introduit. Le scan du HTML et de ses modules décodés est
complété lors de la vérification du bundle ci-dessous.

### Limites et prochaine validation

La création reste en mémoire jusqu’à Créer le brouillon ; il n’y a pas de nouvel
autosauvegardage. Les changements de présentation et retours entre étapes gardent
les saisies dans cette même tâche. Les images question/réponses restent un futur
lot métier, sans bouton factice. Les quatre règles de résultats et le minimum ne
changent pas : Express peut donc préparer un minimum de 5 pour un petit groupe,
valeur visible puis modifiable dans Gérer avant publication.

À valider par Lu’uma sur les nouvelles captures : compréhension du choix initial,
simplicité des étapes, longueur d’Express, vocabulaire des résultats, navigation
contextuelle et lisibilité de la fiche membre. Aucun nouveau succès humain n’est
revendiqué. HEAD reste `d0e7422fff22387e1f9231d10842302c9c3070eb` ; aucune commande
de staging, commit, push ou déploiement n’a été exécutée.

### Bundle final du polissage et arrêt local

`VOTI_AUDIT_V0_6_2.zip` est recréé avec le mécanisme existant. **199 fichiers source
admissibles**, manifeste comparé à `auditPaths()` et contenu de chaque entrée
comparé octet pour octet aux fichiers locaux. CRC de toutes les entrées et contrôle
indépendant `python3 -m zipfile -t` : PASS. Aucune archive récursive, capture,
carte/QR exporté, PDF de test, sauvegarde D1, base, environnement secret, cache,
profil, journal ou node_modules. L’ancienne archive visuelle est explicitement
exclue et reste inchangée.

Scan des credentials littéraux dans les entrées et les **57 modules décodés** du
HTML : aucun détecté. Configuration publique vérifiée dans le module réellement
embarqué : relais attendu, `siteverify`, médias distants désactivés, aucun localhost
dans cette configuration ; jsQR est embarqué localement. Les nouveaux modules
icônes/formulaire/éditeur/gestion n’introduisent ni fetch, ni stockage navigateur,
ni cookie, ni BroadcastChannel, ni console. Le scan ne prétend pas remplacer une
preuve cryptographique ; il complète les contrôles de code et suites de régression.

Le ZIP et les captures sont hors Git ; aucun fichier staged. Les six rapports
historiques déjà modifiés avant ce polissage restent dans leur état initial.
Production strictement inchangée : aucun accès ni mutation pendant cette mission.
La version finale locale attend la revue visuelle humaine ; aucun déploiement
v0.6.2 n’a été effectué.

## 22. Ajustement final des défauts Express

Cette section fait autorité pour les défauts Express finaux et remplace sur ce
point les valeurs historiques de la section 21. Lu’uma a explicitement confirmé
la validation visuelle de la refonte v0.6.2, à l’exception de ce micro-ajustement
demandé. Aucun nouveau parcours, champ ou changement de mise en page n’est ajouté.

### Ancien et nouveau défaut

- Ancien : `anonymous / optional / private / threshold / 5 / poll_audience`.
- Final : `anonymous / disabled (vote simple) / threshold / 2 / poll_audience`.
  Le champ existant `commentVisibility` reste `private` dans la définition, sans
  effet lorsque `commentMode=disabled` : aucun commentaire n’est demandé/accepté
  au titre de ce mode. Aucun nouvel enum ni contrat.
- Note visible : « Réglages recommandés : anonyme · vote simple · résultats après
  au moins 2 réponses, pour les membres concernés. » Aucun jargon interne.

Express crée ainsi un premier brouillon simple sans activer une capacité commentaire
non demandée. Le minimum de confidentialité choisi est explicitement **2** : aucune
adaptation au nombre d’éligibles, en particulier aucune réduction à 1. Avec un
snapshot de 1, un vote ne libère donc pas les résultats, même après fermeture.
Avec 2 membres ou davantage, `threshold` autorise les résultats à partir de deux
participations selon les contrôles d’audience existants. Le brouillon peut toujours
être affiné dans Gérer avant publication. Aucune règle serveur ne change.

### Conservation des réglages entre présentations

`spaceCreationValues` renvoie une copie des valeurs, en appliquant les défauts
Express uniquement pour ce mode ; il ne réécrit pas les champs partagés du DOM.
Visiter Express puis revenir à Guidée/Avancé conserve donc identité, commentaires,
visibilité, condition, minimum et audience personnalisés. La soumission explicite
Express utilise en revanche **ses** défauts, même si ces champs cachés contiennent
encore d’autres valeurs. Les champs essentiels question/réponses/groupes restent
ceux saisis. Ce comportement prévu est vérifié sur le brouillon réellement stocké
par le relais local, pas seulement par le texte de la note.

Les tests utilisent notamment une configuration identifiée, commentaires facultatifs
publics approuvés, fermeture, minimum 7, administration seule : elle est préservée
après une visite Express ; Guidée et Avancé produisent le même brouillon. Express
soumet alors anonyme/sans commentaire/seuil 2/membres concernés. Une nouvelle tâche
Guidée retrouve ses défauts historiques (commentaire facultatif privé, minimum 5),
sans contamination. Le minimum du brouillon Express est ensuite modifié de 2 à 3
dans Gérer pour vérifier qu’il reste modifiable avant publication.

### Tests ciblés et recherche des anciennes valeurs

Le test du vrai constructeur et de `groupResultsAvailable` couvre les snapshots
**1, 2 et 8**, chaque nombre de participations possible, ouvert et fermé : minimum
fixe 2, absence de résultats avec une seule réponse, disponibilité à partir de 2.
Les tests historiques de minimum 2/snapshot 1 pour les quatre conditions restent
présents. Aucun test ni assertion de protection n’est retiré.

Recherche ciblée des références Express dans les modules, tests et docs : anciennes
valeurs retirées du défaut Express exécutable, de sa note et des docs fonctionnelles
actuelles. Les minimums 5 et commentaires facultatifs d’autres parcours/scénarios
ne sont pas remplacés. Les sections historiques de ce rapport sont conservées.
Le helper de défauts est utilisé seulement par la création Espace ; aucun appel
du Mode libre ne l’utilise. Les suites Mode libre/PDF complètes de la section 21
restent la référence récente de non-régression du lot, sans répétition inutile
pour cette seule constante et cette note.

### Captures Express finales

`npm run test:space-ui` régénère sa série réelle de 24 captures locales. Comparaison
SHA-256 avec la série précédente : **seules** `express-1440.png` et
`express-390.png` changent ; les **22 autres PNG sont identiques**. Les anciennes
20 captures et leur archive de comparaison sont également préservées.

Inspection effective des deux nouveaux PNG dans `.browser-tests/v062-final-review/` :

- `express-1440.png` : 1440 × 900, 84 829 octets ; note conforme, largeur inchangée,
  action Créer visible et aucun réglage supplémentaire.
- `express-390.png` : 390 × 844, 50 227 octets ; texte entier sur quelques lignes,
  aucun débordement et présentation toujours compacte.

Aucune retouche, annotation ou modification d’image après Chromium. Fixtures
fictives locales uniquement. Aucun nouveau jugement humain n’est inventé sur ces
deux PNG ; l’inspection Codex confirme la cohérence du changement demandé.

### Résultats de livraison après l’ajustement Express

Toutes les commandes suivantes terminent avec un code de sortie 0 :

| Commande | Résultat |
| --- | --- |
| `npm test` | PASS — 401 tests |
| `npm run check` | PASS — 118 fichiers JavaScript |
| `npm run test:space-ui` | PASS — 2 126 contrôles UI + 2 de lancement local ; 24 captures |
| `npm run test:spaces-ux` | PASS — 368 contrôles Chromium + 2 de lancement local |
| `npm run test:spaces` | PASS — 368 contrôles Chromium + 188 HTTP/D1 locaux sans R2 |
| `npm run test:spaces-migration` | PASS — 8 contrôles 0004 locale ; anciennes lignes/hashes intacts |
| `npm run build:production` | PASS — exécuté en dernier après les suites |
| `git diff --check` | PASS |

Journaux de cette passe : `.browser-tests/v062-express-*.log` et
`v062-express-results.json`, ignorés et exclus du commit/bundle. Aucune grosse
suite historique n’a été retirée ou affaiblie. Le nouveau test de minimum s’ajoute
aux tests existants ; le test navigateur vérifie davantage de champs restaurés.

Build production final après Express : **1 644 573 octets**.

SHA-256 : `35dad48e10007fe74b4d8df84062d0ba7fce0a525d751c91269c62e258f3fae1`.

Soit **−24 octets** par rapport au build juste avant cet ajustement (1 644 597),
et **+41 336 octets** par rapport à la v0.6.1 publiée. La note Express et ses
constantes embarquées changent ; aucune bibliothèque ou ressource n’est ajoutée.

### Manifeste du commit local v0.6.2 complet

Lu’uma autorise désormais un seul commit local complet, **sans push**. Le manifeste
explicite comprend 21 fichiers, couvrant toute la refonte locale validée et le
dernier correctif Express :

```text
README.md
docs/CODEX_V0_6_2_SPACE_UI_REPORT.md
docs/SPACES_GROUPS_V0.md
docs/UX_FLOWS_V0.md
index.html
package.json
scripts/audit-bundle.mjs
scripts/browser-space-layout.mjs
scripts/browser-spaces-ux.mjs
scripts/browser-spaces.mjs
scripts/browser-test.mjs
scripts/free-pilot-integration.mjs
tests/audit-bundle.test.js
tests/space-ux.test.js
web/space-icons.js
web/space-management.js
web/space-poll-editor.js
web/space-poll-form.js
web/space-ux.js
web/spaces-ui.js
web/styles.css
```

État au contrôle pré-commit : branche `main`, HEAD et référence locale `origin/main`
à `d0e7422fff22387e1f9231d10842302c9c3070eb`. Index initial vide ; staging prévu
exclusivement pour ce manifeste après les audits. Message autorisé :
`feat: refondre l’ergonomie des Espaces Voti v0.6.2`.
Le SHA du commit créé à l’issue de ces contrôles est relevé dans la sortie finale ;
il n’est pas auto-inscrit dans son propre contenu, pour conserver un seul commit.

Les six rapports historiques pré-modifiés hors lot, la spécification historique
v0.3E non suivie, les captures personnelles et les archives de revue restent hors
commit. `browser-test.zip`, présent au début de cette passe, reste aussi hors lot.
Les empreintes de **71 fichiers protégés/hors périmètre** sont préservées, dont
shared/relay/vendor/lockfile et les anciennes captures. Aucune migration/0005,
configuration Cloudflare, donnée locale, carte, QR, fichier d’accès, log, cache,
capture ou archive n’appartient au manifeste.

Le changement exécutable de cette dernière passe se limite à la constante Express
dans `web/space-ux.js` et à sa note dans `web/space-poll-form.js`. Les adaptations
de tests et docs sont associées ; Guidée/Avancé et les garanties métier restent
fonctionnellement inchangés. Aucun accès production, push ou déploiement.

### Audit final Express

Bundle `VOTI_AUDIT_V0_6_2.zip` reconstruit : **199 fichiers**, manifeste exact
`auditPaths()`, octets de chaque entrée identiques aux sources locales, CRC de
toutes les entrées et vérification indépendante Python ZIP : PASS. Aucun ZIP
récursif (notamment ni archive de revue ni `browser-test.zip`), capture, PDF privé,
carte/QR/export d’accès, sauvegarde/base/env/cache/profil/node_modules.
Scan des credentials littéraux dans les sources et les **57 modules décodés** du
HTML : aucun détecté. Les références historiques inchangées de règles et les
fixtures fictives de tests restent distinctes des défauts Express finaux.
Le ZIP reste hors Git ; les vérifications de manifeste et CRC sont répétées sur
l’archive contenant ce rapport final avant la livraison du commit local.

## 23. Publication frontend autorisée et vérifiée

Le 23 octobre 2026, après le commit local final, Lu’uma autorise explicitement :
« tu peux deployer et push ». Cette autorisation concerne le frontend v0.6.2 déjà
validé ; aucun déploiement Worker ni migration n’est réalisé.

- Commit publié : `67328a2014e52d8427a46e869b7275a09ba2a3bf`,
  `feat: refondre l’ergonomie des Espaces Voti v0.6.2`, 21 fichiers.
- Avant push : branche main, index vide, build local identique à `HEAD:index.html`,
  aucun diff shared/relay/lockfile dans le commit. La lecture distante de main
  confirme encore `d0e7422fff22387e1f9231d10842302c9c3070eb`.
- Push normal `git push origin main` : succès, sans force. Une nouvelle lecture
  distante confirme main exactement à `67328a2014e52d8427a46e869b7275a09ba2a3bf`.
- Le mécanisme Pages existant publie sans changement de workflow/configuration.
  Les premières lectures servent encore la v0.6.1 ; aucune réussite n’est annoncée
  avant propagation effective.
- À **13:29:19 UTC**, l’URL canonique `https://luuma8888.github.io/voti/` répond
  **HTTP 200**, **1 644 573 octets**, SHA-256
  `35dad48e10007fe74b4d8df84062d0ba7fce0a525d751c91269c62e258f3fae1`.
  Comparaison binaire au build local : **identité exacte**.

Smoke Chromium sur cette URL publique, profil neuf et isolé, sans import de
credential ni fixture : accueil, Espaces & groupes et première étape de création
libre, à **360 × 800** et **1200 × 800**. Les six vues s’ouvrent ; aucun débordement
horizontal, exception JS, requête externe inattendue, cookie ou credential
participant persistant détecté. Les captures ont été produites sans retouche dans
`.browser-tests/v062-published-smoke/` et les vues accueil/entrée Espaces ont été
inspectées. Aucune soumission de formulaire, aucun accès à l’Espace test conservé.
Le harnais interdit les requêtes HTTP mutantes ; aucune tentative bloquée et
**zéro requête au backend** pendant le smoke final. Aucun challenge Turnstile.

Deux limites du contrôle sont consignées : l’API publique de statut Pages répond
404 sans authentification, donc la preuve de publication retenue est le contenu
effectivement servi, et non cette API. Le premier passage du petit harnais smoke
cherchait un input au lieu du textarea existant de question libre ; seul ce
sélecteur dans `/tmp` a été corrigé, puis les six vues ont été revérifiées avec
succès. Aucun correctif applicatif après publication.

Worker/D1/Turnstile/bindings/R2 : **aucune commande ni modification**. Leur état
interne n’a pas été relu pour cette publication exclusivement frontend ; aucune
nouvelle migration ni fixture. Les écrans privés Membres/Groupes/Guidée/Express
n’ont pas été parcourus en production sans accès : ils restent couverts par les
tests locaux et la revue visuelle humaine déjà déclarée. Aucun nouveau scan
physique ou vote humain n’est revendiqué.

HEAD et origin/main sont synchronisés au commit publié. Les fichiers historiques
hors lot sont conservés. Cette section post-publication reste **locale non commitée**,
sans second commit documentaire automatique. Le bundle d’audit prépublication est
conservé tel quel ; aucun ZIP final de recette n’est régénéré.

## 24. Polissage post-commit après usage réel

### État initial et audit avant modification

HEAD relevé : `67328a2014e52d8427a46e869b7275a09ba2a3bf`, identique au commit
v0.6.2 précédent. `origin/main` local pointe déjà dessus : contrairement au
préambule de la nouvelle demande, ce commit a été poussé et Pages vérifié lors
de l’autorisation précédente (section 23). Aucun nouvel accès production n’est
nécessaire pour ce lot. Le rapport contient déjà une section post-publication
locale non commitée ; les six autres rapports historiques modifiés, captures et
archives hors lot sont préservés. Index initial vide.

| Retour humain | Cause observée dans le code | Correction locale retenue | Vérifications |
| --- | --- | --- | --- |
| Liste d’Espaces ambiguë | `listSpaces` juxtapose lien et action de retrait dans une card | Mes Espaces, nom/rôle dominants, Ouvrir explicite, retrait secondaire | clavier/mobile/liste multi-Espaces |
| Flash entre sections | `app.render` et `SpacesUI.handleRoute` vident `#app`, puis le renderer reconstruit la coque après fetch | conserver shell/header/nav et remplacer le contenu central, sans cache d’autorisation | MutationObserver + RAF + historique |
| Carte écran brute | `showCard` affiche texte/QR séparés ; PDF dispose de son propre modèle minimal | modèle commun, vrai aperçu, thèmes et hiérarchie du nom | écran/PDF/QR Poppler |
| Visuels membres/groupes | aucun catalogue local | manifestes intégrés vides, résolution stricte, galerie réutilisable non montée sans assets | fixtures raster locales, aucun upload |
| Largeurs incohérentes | main historique 1080 px, Espace 1480 px | largeur fluide partagée avec formulaires bornés | 360/390/1200/1440/1920 |
| Input fichier natif visible | import Espace et photo scanner affichent l’input brut | pattern commun input réel masqué visuellement + label stylisé + nom | clavier/labels/focus/reset |
| Footer trop étroit | `main,footer` figés puis override de main seul | même variable de largeur et marges que main | pages libres/Espaces/1920/mobile |

Périmètre : présentation web, PDF des cartes et outillage/tests locaux. Aucun
changement shared/relay, migration, credential, anonymat, snapshot, unicité ou
règle de résultats. Packs membres/groupes : illustrations prédéfinies intégrées
uniquement, sans image personnelle, URL utilisateur, stockage binaire, R2 ou CDN.
Les vrais assets seront créés séparément ; aucune illustration SVG de substitution.

### Présentation livrée et navigation sans flash

La page d’entrée distingue **Mes Espaces**, une liste compacte avec nom/rôle et
**Ouvrir**, puis création à la demande et import d’un accès existant. Le retrait
est dans un details natif « Plus d’actions », replié, avec sa confirmation intacte.
Le serveur fournit toujours le rôle ; il n’est pas inféré du fichier local.

`app.render` demande désormais si un shell du même Espace peut être conservé,
avant de vider le contenu. `SpacesUI.handleRoute` conserve alors la coque et son
emplacement central, remplace seulement celui-ci par un statut de chargement, puis
relit les données/droits. `renderSpaceManagement` actualise titre, rôle, section et
état actif sans détacher le header ni la navigation. Un changement de périmètre
réconcilie les liens autorisés, sans conserver des liens admin pour un Créateur.
Les réponses asynchrones périmées restent refusées par l’epoch existant.

Aucun cache d’autorisation, délai de rendu, opacity, fade ou animation pour masquer
le défaut. Sortir de l’Espace, passer à un autre Espace ou au parcours participant
ne réutilise pas ce shell. Les erreurs de droit restent refusées. Sur mobile,
la navigation reste visible dans les fiches ; la création de sondage conserve
sa présentation de tâche validée.

Le test navigateur suit Aperçu → Membres → fiche → Membres → Groupes → Réglages →
Aperçu, puis retour/avant. MutationObserver et une boucle requestAnimationFrame
vérifient l’identité et la présence des nœuds shell/header/navigation pendant
les lectures asynchrones, ainsi que l’état actif et le slot central. Il s’exécute
en 360 et 1440 px ; pas de simple attente arbitraire utilisée comme preuve.
Le pacing des captures existant pour ne pas déclencher les quotas locaux est
uniquement dans le harnais, pas dans l’application.

### Coque, footer et fichiers

Les pages bibliothèque libre, entrée Espaces, gestion Espace et carte partagent
une largeur fluide maximale de 1760 px, avec marges responsive. Les formulaires
restent bornés, les listes compactes ne redeviennent pas de grandes cartes.
Le footer suit la même variable que main ; Studio garde sa largeur propre de
1480 px et vote/résultats leur largeur de lecture. Les overrides de largeur sont
limités à l’écran pour préserver l’impression.

`file-picker.js` garde le vrai input file et son FileList. Il est masqué visuellement,
reste dans l’ordre clavier et associé aux labels ; le label stylisé affiche le
focus de l’input. Nom sélectionné annoncé par role=status, reset explicite après
import/analyse. Ce pattern s’applique à l’import Espace et à la photo du scanner.
Audit des autres inputs : sauvegarde, clé admin et images de sondage disposaient
déjà d’inputs cachés avec boutons explicites ; ils ne sont pas refondus.

### Carte écran/PDF et thèmes

`memberCardModel` normalise nom, Espace, groupes, credential et choix de thème/visuels.
Il est consommé par `memberCardPreview` et `drawMemberCard`/`memberCardsPdf` : aucune
divergence de données entre écran, individuel et lot. Les groupes sont fournis
depuis les affiliations déjà autorisées lors de création/régénération, ou le
profil propre de l’invité ; aucune nouvelle requête ou projection serveur.

Le texte est exactement **Ma carte individuelle**. Le nom est dominant ; Espace
et groupes secondaires. La page d’émission distingue aperçu, thème et outils
d’export. Le thème courant initialise seulement cette carte ; choisir Voti Pop,
Nature, Douceur, Nuit ou Minimal met immédiatement à jour l’aperçu et le modèle
de cette entrée dans le lot. Aucun enregistrement du thème ou de la carte dans
localStorage/sessionStorage/IndexedDB ou sur le serveur.

PDF : huit cartes par A4 conservées, nom agrandi (jusqu’à 64 px dans le raster de
carte), adaptation des noms longs, Espace secondaire. Le QR garde sa grille entière,
son budget de 400 px, blanc opaque et quiet zone. Aucune illustration ne chevauche
le QR. Sans illustration ni groupe, il est centré ; sinon il est séparé à droite.
Le DOM mobile peut empiler les zones tout en gardant la même sémantique.

### Packs prédéfinis : architecture prête, pas de faux pack

Deux manifestes JSON vides dans `web/assets/member-visuals/` et `group-visuals/`.
Le build valide ID stable, type, label, fichier PNG/WebP local et dimensions/poids,
puis embarque les futurs assets du dépôt dans le HTML offline. Aucun chemin/URL
utilisateur, SVG d’illustration de substitution, upload ou stockage d’image.

`visual-presets.js` résout les seuls IDs connus ; `visual-gallery.js` fournit radios
natifs, « Aucune illustration », noms, focus et options indépendantes membre/groupes.
Ces éléments sont masqués avec le catalogue vide. Les listes savent consommer des
IDs de présentation avec vignettes de 40 px. La carte prévoit membre 80–90 px et
groupes 28 px à l’écran (180/56 dans le raster PDF), trois groupes plus résumé du
surplus. Aucune grande image de lieu concurrente du membre ou du QR.

Les seuls graphismes d’essai sont des carrés raster géométriques explicitement
fictifs, générés en mémoire des tests et jamais ajoutés aux manifestes. Ils testent
les dimensions et la résolution d’IDs, pas l’identité artistique des futurs packs.
La sélection durable d’IDs membres/groupes n’est **pas** implémentée sans vrai pack.

`docs/MEMBER_VISUALS_V0.md` propose pour un futur lot deux champs nullable
`space_members.member_visual_id` et `groups.group_visual_id`, validation serveur
et projections limitées aux IDs via commandes/CAS existants. Backup versionné pour
les IDs uniquement, sans toucher aux bulletins/commentaires anonymes. Aucune
migration 0005, colonne, API, nouveau credential ou stockage binaire dans ce lot.

### Incidents de mise au point consignés

- Collision de variable locale `settings` dans le renderer, détectée à l’initialisation
  navigateur puis corrigée en `settingsLink` ; aucun contournement de test.
- Le bouton d’un details fermé restait mesurable via l’API de géométrie de Chromium :
  CSS explicite display:none pour l’action de retrait fermée, sans retirer l’assertion.
- Un premier lancement npm test sous sandbox a échoué dans workerd ; le test local
  concerné passe avec les permissions de processus/loopback, puis la suite complète
  est relancée avec ces permissions. Aucun appel Siteverify réel.
- Le pixel de bord d’un QR rasterisé peut être interpolé par Poppler. Le test de
  blanc opaque porte maintenant sur les **quatre coins intérieurs de la quiet zone**,
  tous strictement blancs, en plus du redécodage ; ce contrôle est plus représentatif
  et ne réduit pas l’exigence de contraste.

- Le repère « Administrateur » existe maintenant aussi dans la bibliothèque des
  Espaces : une attente de test devenue ambiguë a été remplacée par l’attente de
  la vraie section Aperçu. Les assertions métier et de navigation sont conservées.
- L’inspection à 1920 px a révélé une recherche trop étirée sur l’accueil. Sa zone
  de filtres est bornée à 1180 px, sans réduire la bibliothèque ni le footer.
  Les quatre formats d’accueil sont régénérés et contrôlés après cette correction.

### Résultats exacts des vérifications locales

Toutes les commandes ci-dessous terminent avec le code 0. Les tests qui utilisent
Chromium/workerd sont exécutés avec les permissions de processus et de loopback
local ; aucune commande distante, donnée production ou vérification Turnstile
humaine n’est utilisée.

| Commande | Résultat |
| --- | --- |
| `npm test` | 404 tests ; dernière relance après l’assertion de refus d’un credential staff dans le modèle de carte |
| `npm run check` | Syntaxe de 127 fichiers JavaScript valide |
| `npm run test:browser` | 2966 contrôles |
| `npm run test:space-ui` | Dernière relance : 2845 contrôles UI + 2 contrôles du pilote local ; 46 captures |
| `npm run test:spaces-ux` | 368 contrôles navigateur + 2 contrôles du pilote local |
| `npm run test:spaces` | 368 contrôles navigateur + 188 contrôles HTTP/D1 local |
| `npm run test:member-cards` | 30 contrôles ; 2 pages A4 ; 9 QR fictifs décodés à 300 dpi |
| `npm run test:card-polish` | 66 contrôles ; 6 PDF (5 individuels et un lot) ; 10 QR fictifs décodés à 300 dpi |
| `npm run test:participation` | 294 contrôles ; 3 PDF détaillés |
| `npm run test:free-pilot` | 3138 contrôles navigateur + 67 contrôles HTTP/D1 local |
| `npm run test:spaces-migration` | 8 contrôles ; migration 0004 locale, lignes/hashes historiques et INSERT v0.5 compatibles |
| `npm run test:member-scanner` | 11 contrôles |
| `npm run test:poster` | 97 contrôles ; 8 PDF ; 30 QR décodés |
| `npm run test:poster-studio` | 188 contrôles ; 13 PDF ; 51 QR décodés |
| `npm run test:poster-polish` | 117 contrôles ; 7 PDF ; 36 QR décodés |
| `npm run build:production` | Réussi, exécuté en dernier après les suites navigateur/PDF |
| `git diff --check` | PASS ; contrôle staged à nouveau exigé immédiatement avant le commit local |

La dernière retouche partagée se limite à la largeur CSS des filtres de bibliothèque.
Après celle-ci, la suite UI dédiée complète est relancée (2845 + 2), les PDF carte
sont revérifiés (66), puis le build production est refait. Les grosses suites déjà
vertes ne sont pas répétées sans changement les concernant. Aucun test supprimé.

Les tests couvrent les rôles et restrictions par groupe, le shell persistant avec
historique, la navigation clavier, les labels/input file, l’absence de persistance
participante, les cinq thèmes de carte, les noms longs/accents/emoji et les groupes
0/1/plusieurs. Les calculs QR vérifient modules entiers, taille minimale, blanc de
quiet zone et décodage Poppler. Les tests unitaires refusent les IDs inconnus, les
URLs/chemins/manifestes invalides et les données d’image personnelles ignorées.

### Captures originales et inspection visuelle

46 PNG Chromium dans `.browser-tests/v062-postcommit-review/`, hors Git et bundle.
`index.html` est la planche locale ; `MANIFEST.json` contient dimensions, tailles et
SHA-256 des PNG originaux. Aucun recadrage, redimensionnement ou annotation des PNG.
Les séries précédentes `v062-review/` et `v062-final-review/` sont conservées.

Liste exacte :

```text
advanced-1440.png
advanced-390.png
advanced-full-1440.png
advanced-full-390.png
card-1440.png
card-390.png
card-theme-dark-1440.png
card-theme-douceur-1440.png
card-theme-minimal-1440.png
card-theme-nature-1440.png
card-theme-pop-1440.png
creation-choice-1440.png
creation-choice-390.png
express-1440.png
express-390.png
file-input-1440.png
file-input-390.png
footer-space-1920.png
footer-spaces-1920.png
gallery-fixtures-390.png
groups-visual-fixtures-1440.png
guided-participants-1440.png
guided-participants-390.png
guided-participation-1440.png
guided-participation-390.png
guided-question-1440.png
guided-question-390.png
guided-results-1440.png
guided-results-390.png
guided-review-1440.png
guided-review-390.png
home-1200.png
home-1920.png
home-360.png
home-390.png
member-detail-1440.png
member-detail-390.png
members-1440.png
members-390.png
members-visual-fixtures-1440.png
overview-1440.png
overview-1920.png
overview-390.png
spaces-1440.png
spaces-1920.png
spaces-390.png
```

Dimensions : 360×800, 390×844, 1200×800, 1440×900 et 1920×1080 ;
les deux vues complètes Avancé mesurent 1440×3397 et 390×3402.

Inspection réelle des captures et rendus PDF :

- Mes Espaces : nom et rôle identifiables, Ouvrir dominant, retrait caché dans
  Plus d’actions ; création repliée, import séparé et sélection de fichier lisible.
- À 1920 px, main/footer alignés sur 1760 px ; listes et filtres bornés, sans
  transformer les formulaires en champs géants. À 360/390 px, pas d’overflow.
- La fiche membre garde son nom en titre et sa navigation visible. Les listes
  restent compactes ; aucune action dangereuse ajoutée aux lignes ordinaires.
- Carte : nom dominant, Espace/groupes secondaires, QR blanc bien distinct,
  contraste Nuit conservé. Les cinq palettes écran/PDF utilisent le même modèle.
  Les fixtures montrent bien membre plus grand que les miniatures de groupes.
- Guidée, Express et Avancé gardent leur hiérarchie validée ; la vue complète
  reste volontairement longue. Le clavier et le focus visible sont conservés.
- Sans vrai pack, une carte avec peu de groupes conserve de l’espace libre :
  il n’est pas rempli par une fausse illustration. La qualité artistique des packs
  n’est pas évaluée dans ce lot. La validation visuelle finale de Lu’uma reste à faire.

### Build final, confidentialité et périmètre figé

Build production : **1 669 112 octets**, SHA-256
`3c43a1c1d680fb9dc8a1cb685d0a8da6aa65148017ff3a92f5f0d37f42dba88e`.
Variation par rapport au HEAD initial : **+24 539 octets** (1 644 573 → 1 669 112),
due au shell, aux composants carte/fichier, au catalogue préparé et aux styles.
Aucun pack d’illustrations réel ni dépendance ajouté.

Audit local : les 70 fichiers protégés au début sont identiques par SHA-256,
dont shared/, relay/, vendor/, package-lock, rapports historiques exclus et
fichiers personnels préexistants. Aucune migration, colonne distante, modification
Worker/Cloudflare, nouvelle capacité, nouveau credential ou règle métier.

Les sélections de thème/visuels de carte vivent dans les objets en mémoire déjà
temporaires de l’écran d’émission ; aucun token/carte/identité participante ajouté
aux storages, au BroadcastChannel, aux logs ou noms de fichiers. Les données
screen/PDF restent texte brut. Aucune jointure membre/bulletin anonyme ajoutée.
Les tests locaux conservent snapshot, unicité, admins_only et restriction Créateur.
Scanner local et libération caméra restent testés ; aucun upload, CDN, média distant,
cookie ou tracking ajouté. Les catalogues intégrés sont vides ; la galerie et ses
options ne sont donc pas affichées dans le build livré. Les seuls credentials des
PDF/captures sont fictifs, créés par les fixtures locales, exclus du bundle.

Limites : aucune preuve de nouvelle impression papier/caméra réelle ni validation
humaine inventée ; aucun thème persistant côté serveur ; IDs de visuels non encore
persistés ; futurs assets et éventuelle évolution additive des IDs à traiter dans
un lot séparé. **Images personnelles membres/groupes exclues par décision produit.**

### Manifeste du nouveau commit local

Parent attendu : `67328a2014e52d8427a46e869b7275a09ba2a3bf`.
Nouveau message : `fix: harmoniser l’interface et les Cartes Voti`.
Le SHA du nouveau commit est relevé après création dans la réponse finale ; aucun
amend/rebase/squash, push ou accès production. La référence locale origin/main
reste celle relevée au début, sans fetch/push pendant cette mission.

30 fichiers prévus, staging explicite uniquement :

```text
README.md
docs/CODEX_V0_6_2_SPACE_UI_REPORT.md
docs/MEMBER_CARDS_V0.md
docs/MEMBER_VISUALS_V0.md
docs/SPACES_GROUPS_V0.md
docs/UX_FLOWS_V0.md
index.html
package.json
scripts/browser-space-layout.mjs
scripts/browser-space-polish.mjs
scripts/browser-spaces.mjs
scripts/browser-test.mjs
scripts/build.mjs
scripts/test-card-polish.mjs
scripts/test-member-cards.mjs
scripts/visual-assets.mjs
tests/member-presentation.test.js
web/app.js
web/assets/group-visuals/manifest.json
web/assets/member-visuals/manifest.json
web/file-picker.js
web/member-card-model.js
web/member-card-view.js
web/member-cards.js
web/member-scanner.js
web/space-management.js
web/spaces-ui.js
web/styles.css
web/visual-gallery.js
web/visual-presets.js
```

Les six rapports historiques déjà modifiés, cinq captures personnelles, deux
archives personnelles et l’ancienne spec UX hors lot restent exclus et inchangés.
Les captures Chromium, PDF/QR de fixtures, ZIP d’audit, bases, profils et caches
restent ignorés/non suivis. Aucun fichier shared/relay/migration/config/lock ajouté
au manifeste. Le rapport inclut la section 23 préexistante de publication précédente,
puis la présente section 24 ; les autres rapports historiques ne sont pas réécrits.

### Bundle et contrôle de livraison

`VOTI_AUDIT_V0_6_2.zip` reconstruit par `npm run audit:bundle` : **211 fichiers**.
Contrôle CRC de chaque entrée, décompression Python et manifeste exact de
`auditPaths()` réussis ; les octets décompressés sont comparés aux fichiers locaux.
Aucune archive récursive, capture, PDF, base, backup, export de carte/accès, env,
profil, cache ou node_modules. Aucun credential littéral détecté dans le bundle
ni dans les 62 modules décodés du HTML autonome. Les catalogues sont vides.
Le ZIP reste ignoré/non commité. Sa taille et son SHA-256 sont relevés après cette
dernière mise à jour du rapport, dans la réponse de livraison, pour éviter une
empreinte autoréférente dans le bundle.

Le manifeste source de 30 fichiers est contrôlé avant staging explicite, puis
comparé à l’index avec `git diff --cached --check` et scan des blobs staged avant
commit. Les scans ciblent notamment credentials littéraux, clés privées, tokens
GitHub et clés AWS ; ce contrôle raisonnable complète les tests de confidentialité,
sans prétendre constituer une détection universelle de secrets.
