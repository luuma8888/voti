# Voti v0.6.1 — UX après recette v0.6

## État initial et périmètre

Mission strictement locale, début le 22 octobre 2026. HEAD : `3f1189f69965561571ae828d81cfd3b6f95fec94`, branche `main`, index vide.
Modifications préexistantes conservées : rapports CODEX_POSTER_V0_4B, CODEX_PRODUCTION_DEPLOYMENT_V0_6, CODEX_QR_V0_4A, CODEX_SPACES_GROUPS_V0_6 et CODEX_UX_V0_3E. Cinq captures personnelles et VOTI_UX_V0_3E_SPEC non suivis restent hors du lot.

Aucun accès à la production, aucune migration, aucun changement Worker/contrat/modèle métier/configuration Cloudflare. Aucun staging, commit ou push. La récupération serveur d'une carte est étudiée, pas implémentée.

## Documents lus intégralement

AGENTS.md ; CODEX_PRODUCTION_DEPLOYMENT_V0_6_REPORT (section 14, autorité des réserves) ; CODEX_SPACES_GROUPS_V0_6_REPORT ; VOTI_SPACES_GROUPS_V0_6_SPEC ; SPACES_GROUPS_V0 ; MEMBER_CARDS_V0 ; GROUP_VOTING_PRIVACY_V0 ; UX_FLOWS_V0 ; DATA_MODEL_V0 ; PARTICIPATION_V0 ; COMMENTS_AND_IDENTITY_V0 ; RESULTS_PDF_V0 ; QR_AND_POSTER_V0 ; PRIVACY_AND_ABUSE_V0 ; RELAY_CONTRACT_V0 ; CLOUDFLARE_RELAY_V0 ; CLOUDFLARE_DEPLOYMENT_V0 ; README.
Autorités fondatrices supplémentaires : application_sondages_qr_reference_v0, application_sondages_qr_plan_action_v0, MVP_SCOPE, VOTE_MODES_MATRIX. Skills PDF (vérification visuelle Poppler) et Wrangler (outils locaux exclusivement).

## Audit ciblé avant modification — quinze réserves

| Réserve constatée | Cause dans l'existant | Fichiers / solution retenue | Risque / tests nécessaires |
| --- | --- | --- | --- |
| 1. Groupes empilés et confondus | Création et éléments dans le même flux | spaces-ui, styles : grille et création séparée | Bas ; 320/360/1200, cinq thèmes |
| 2. Membres / affiliation peu clairs | Checkbox largeur globale, pas d'état sale | spaces-ui, styles : labels proches, modifications signalées, enregistrement contextualisé | Bas ; changement sans sauvegarde, aucune affiliation inventée |
| 3. Création uniquement rapide | Formulaire long unique | space-poll-form : guidé/rapide, même DOM et construction du modèle | Moyen ; équivalence, retour, conservation des saisies |
| 4. Actions gestion collées / rôle Créateur peu découvrable | Liens inline sans groupe, fichier de gestion peu expliqué | spaces-ui, styles : diffusion/résultats distincts, explication du rôle/fichier | Bas ; clavier/mobile et texte d'aide |
| 5. Cartes PDF / export / noms | Rendu brut, bouton lot sans périmètre, nom fixe | member-cards, spaces-ui, space-ux : carte imprimable, individuel/lot nommé et listé | QR ; Poppler 300 dpi, décodage, inspection réelle |
| 6. Carte d'invitation non récupérable pour impression | Serveur conserve seulement un digest | Étude seulement : trois architectures comparées plus bas, aucune implémentation structurelle | Hors périmètre explicite ; aucun coffre ni credential en clair serveur |
| 7. Scanner moins tolérant | Réduction 800 px plein cadre, pas de guidage | member-scanner : analyse bornée plein cadre/centre, guidage, arrêt caméra | Moyen ; image/caméra simulée locales, aucune requête externe |
| 8. Carte reconnue sans pseudo | Profil mémoire non montré avant vote | spaces-ui : confirmation visuelle du pseudo en mémoire seulement | Confidentialité ; succès/navigation/expiration/stockages/bulletin anonyme |
| 9. « Tout le monde OU clôture » elliptique | Libellé abrégé | space-ux : « Quand tous ont participé, ou dès la fermeture » | Bas ; même valeur all_eligible_or_closed et minimum conservé |
| 10. Motifs résultats / état absent de gestion | showResults générique même pour admins_only, état dans une autre vue | space-ux, spaces-ui : causes distinctes, audience prioritaire, état en gestion, autorisation serveur inchangée | Confidentialité ; modes et minimum 2/snapshot 1 |
| 11. Révocation sans retour clair | Action toujours proposée après refresh | spaces-ui : état carte, confirmation, révocation indisponible si révoquée | Bas ; vrai Worker local + UI |
| 12. Invitation groupes/usages/durée/QR et retour inactif | Pas de récapitulatif, DOM remplacé sans changer le hash | spaces-ui : confirmation, QR téléchargeable, avertissement mémoire, navigation SPA réentrante | Moyen ; récapitulatif et retour sans reload |
| 13. Accès Admin/Créateur : noms identiques | Nom fixe UUID seulement | space-ux : Espace, rôle et périmètre, métadonnées nettoyées | Confidentialité ; noms distincts et aucun credential |
| 14. Visibilité en Vote simple | Select toujours actif | spaces-ui/form, app : désactivation synchronisée sans mutation de valeur | Bas ; création et édition, libre et Espace |
| 15. « À voter » ambigu | Libellé trop proche de « a voté » | spaces-ui : « À toi de participer » / « Déjà participé » | Bas ; vues participant |

## Corrections et architecture retenue

### Navigation, états et gestion

`SpacesUI.navigate` traite aussi une destination identique à la route courante par
un rendu SPA, sans rechargement ni faux changement d'URL. Le lien de retour conserve
son href utilisable au clavier/avec les conventions du navigateur.

« À toi de participer » se distingue de « Déjà participé ». Le pseudo reconnu est
affiché avant le choix et sur la confirmation, jamais sur le succès. La révocation
affiche une confirmation, un statut persistant fourni par le serveur et un bouton
désactivé ; régénération disponible, aucune nouvelle règle serveur.

Groupes/membres existants sont séparés de leur formulaire d'ajout. Une grille de
cartes exploite le desktop et devient une colonne sur téléphone. Checkbox et libellé
partagent un label cliquable ; une modification non enregistrée est indiquée par
texte et bordure, pas seulement la couleur. Le bouton de sauvegarde porte aussi le
nom du membre dans son libellé accessible.

Les actions de diffusion et consultation sont des boutons espacés dans un groupe
titré. Les dialogues accessibles existants sont réutilisés ; aucun confirm natif.
Le helper des boutons d'Espace réactive le déclencheur avant de restaurer le focus
si celui-ci est revenu au body après une attente/modale. Un test part d'un bouton
focalisé comme lors d'une activation clavier/pointeur, annule l'invitation, puis
vérifie focus restauré et révision serveur inchangée. Pas de double mutation.

### Création guidée et rapide

Quatre étapes : question/réponses, participants, résultats, récapitulatif. Les étapes
répondent à des décisions compréhensibles, pas à un découpage arbitraire de champs.
Retour et changement de présentation conservent les mêmes nœuds/champs en mémoire.
La création rapide rend ces mêmes sections visibles simultanément. Aucun deuxième
moteur ni second format de brouillon : `makeSpacePollDraft` appelle `createPoll`,
`validateRules(..., true)` et `validatePollAudience` existants. La préparation v0.6
côté relais continue seule à convertir le brouillon vers le schéma Espace.

Le brouillon distant n'existe qu'après l'action explicite de création. Pas de
sauvegarde implicite des saisies avant cette action. Les saisies non créées ne sont
pas promises après fermeture/rechargement de la page. Le mode libre conserve son
parcours guidé historique ; seule la désactivation de visibilité en Vote simple est
ajoutée également dans son éditeur. La valeur mémorisée n'est pas effacée quand le
contrôle devient non pertinent.

### Résultats et messages

`resultsState` est une présentation, jamais un moteur d'autorisation. `available`
reste la décision du relais. `admins_only` est prioritaire dans le parcours membre :
aucun faux message de seuil, aucun agrégat ou appel aux compteurs administratifs.
La gestion exploite uniquement X/Y déjà autorisés de `getPollAttendance` pour
expliquer le minimum non atteint ou le minimum atteint avec une condition restante.

Les messages distinguent minimum, participation de tous, fermeture, participation
de tous ou fermeture, réservation à l'administration. Sans compteur autorisé, le
participant reçoit les conditions combinées, sans prétendre savoir si le minimum
est atteint : cette limitation est nécessaire pour préserver la projection privée.
Si le sondage est déjà fermé et que la règle autorise cette fermeture, le message
ne demande pas de le fermer à nouveau : `available=false` indique alors que le
minimum reste bloquant, sans révéler de compteur supplémentaire.
Un snapshot de 1 et un minimum de 2 restent bloqués, même après fermeture ou
participation de tous. Aucun seuil, snapshot ou calcul d'agrégats n'est modifié.

### Invitations, cartes, accès et PDF

Le récapitulatif d'invitation montre groupes (ou absence explicite), usages et
durée, puis le dialogue demande confirmation avant la mutation. Les valeurs
confirmées sont capturées avant l'attente du dialogue. Après succès : confirmation,
lien SECRET copiable, QR SVG téléchargeable, avertissement de non-récupération
après sortie, retour SPA fonctionnel. Aucune affiliation n'est choisie à la place
de l'administrateur et aucune invitation permanente n'est ajoutée.

L'écran de carte distingue PDF individuel et lot de cartes actuellement en mémoire,
en énumérant le périmètre du lot. Pas de fausse récupération de toutes les cartes
du serveur. Les noms de fichiers incluent Espace, membre ou lot, et rôle/périmètre
pour les accès de gestion. Nettoyage des séparateurs et des formats de credentials
connus, aucune capacité dans le nom. `.gitignore` et le filtre d'audit protègent
les nouveaux noms d'exports.

PDF : même pdf-lib/Canvas, A4 et huit cartes par page. Hiérarchie nom/Espace/QR,
fond calme, coins arrondis et consigne distincte. Le QR noir/blanc garde sa surface
opaque, ses modules entiers et sa quiet zone ; positions/taille sûre inchangées.
Les libellés d'Espace longs sont adaptés par retour à la ligne/taille bornée.
Aucun asset externe ni police distante, aucune dépendance ajoutée.

### Scanner et session participante

Analyse alternée plein cadre/centre, maximum 1 280 px par dimension et une tentative
au plus toutes les 180 ms (hors temps de calcul), inversion jsQR standard. Le cadre
visuel et les consignes aident à agrandir/rapprocher/stabiliser. Une indication de
recherche prolongée explique que la caméra fonctionne sans encore reconnaître le QR.
Les erreurs de frame ne tuent plus la boucle. Pistes, pixels, listeners et dialogue
sont libérés au succès, à l'annulation, au changement de route et au départ de page ;
une permission reçue après annulation est également arrêtée.

Le pseudo provient seulement de `profile` déjà chargé dans la session mémoire
participante existante. Aucun nouveau stockage ni attribut du bulletin anonyme.
La soumission reste pollId/actionId/choiceId/comment/hash ; pas de nom ajouté.
Le BroadcastChannel conserve seulement `{type:'clear'}`. Durée de cinq minutes et
effacement après vote/Terminer/sortie/expiration inchangés.

## Fichiers du lot

- Interface : `web/spaces-ui.js`, `web/app.js`, `web/styles.css`.
- Petites abstractions : `web/space-ux.js`, `web/space-poll-form.js`.
- Scanner et cartes : `web/member-scanner.js`, `web/member-cards.js`.
- Tests : `tests/space-ux.test.js`, `scripts/browser-spaces-ux.mjs`,
  `scripts/browser-spaces.mjs`, `scripts/browser-participation.mjs`, `scripts/browser-test.mjs`.
  `scripts/spaces-checks.mjs` ajoute le cas exact snapshot 1 / minimum 2 sur D1 local.
- Audit : `scripts/audit-bundle.mjs`, `tests/audit-bundle.test.js`, `.gitignore`.
- Commandes : `package.json` (scripts seulement ; lockfile/dépendances inchangés).
- Build autonome : `index.html`.
- Documentation : présent rapport, MEMBER_CARDS_V0, SPACES_GROUPS_V0, UX_FLOWS_V0,
  README. Les cinq rapports historiques pré-modifiés ne sont pas réécrits.

## Tests ajoutés

Cinq tests unitaires regroupent les motifs de résultats, le plancher de confidentialité,
les noms de fichiers sans credentials, la construction/validation commune des deux
présentations et les régions de scan bornées. Le nouveau parcours Chromium, face au
Worker/D1 locaux, couvre retour invitation à hash inchangé, affiliation explicite,
révocation effective et état du bouton, récapitulatif d'invitation et confirmation,
conservation des saisies guidé/rapide, vote simple, état de résultats en gestion,
admins_only réel, statuts, export individuel/lot et absence de persistance participante.

Tests caméra artificielle : QR incliné local, guidage, décodage, pistes arrêtées après
succès/annulation/navigation et permission tardive. Ce n'est pas une recette téléphone.
Les parcours v0.6 restent exécutés à 320/360/1200 px et cinq thèmes : QR sans vote
avant confirmation, vrais COUNT D1, deux membres successifs, succès durable,
expiration, carte invalide, consentement renouvelé après modification de confidentialité,
suppression locale sans appel au relais. Les autres invariants structurels restent
vérifiés par les suites D1 v0.6 existantes.

## Exécution et inspection visuelle

**PASS local, terminé le 23 octobre 2026 (Europe/Paris).** Node 22.23.3,
Wrangler 4.149.0 verrouillés ; aucune installation ou mise à jour de dépendance.
Les logs locaux ignorés se trouvent dans `.browser-tests/v061/` ; aucune donnée
de production n'y est utilisée. Codes de sortie de toutes les commandes : 0.

| Commande réellement exécutée | Résultat exact |
| --- | --- |
| `npm test` | 399 tests, zéro échec ; relancé en fin de lot |
| `npm run check` | 114 fichiers JavaScript, syntaxe OK ; relancé en fin de lot |
| `npm run build` | HTML autonome hors relais : 1 602 989 octets au dernier passage |
| `npm run test:browser` | 2 964 contrôles Chromium, offline/local, thèmes, QR/PDF, clavier, responsive |
| `npm run test:participation` | 294 contrôles Chromium, trois PDF détaillés générés |
| `npm run test:comments` | 37 contrôles Poppler, trois PDF A4 et sept QR redécodés |
| `npm run test:relay` | 118 contrôles HTTP/D1 et R2 **émulé localement** |
| `npm run test:integration` | 119 contrôles HTTP/D1 + 3 136 contrôles Chromium multi-contextes |
| `npm run test:free-pilot` | 67 contrôles HTTP/D1 sans R2 + 3 138 contrôles Chromium |
| `npm run test:spaces` | 188 contrôles HTTP/D1 sans R2 + 356 contrôles Chromium |
| `npm run test:spaces-migration` | Huit contrôles D1 locaux ; lignes/hashes historiques et INSERT v0.5 compatibles |
| `npm run test:member-cards` | 12 contrôles Poppler, deux pages A4, neuf QR fictifs décodés à 300 dpi |
| `npm run test:spaces-ux` | Dernier passage : 368 contrôles Chromium + deux contrôles du lanceur local ; 320/360/1200 px |
| `npm run test:member-scanner` | 11 contrôles Chromium, caméra artificielle locale et libération des pistes |
| `npm run test:poster` | 97 contrôles Poppler, huit PDF A4, 30 QR redécodés |
| `npm run test:poster-studio` | 188 contrôles Poppler, 13 PDF A4, 51 QR redécodés |
| `npm run test:poster-polish` | 117 contrôles Poppler, sept PDF A4, 36 QR redécodés |
| `npm run build:production` | PASS ; exécuté **en dernier** après les derniers tests applicatifs, valeurs ci-dessous |
| `git diff --check` | PASS, aucune erreur de whitespace |

Les derniers passages unitaires/UX incluent le cas d'un sondage déjà fermé sous
minimum : le message ne demande plus de fermer un sondage déjà fermé. Le scénario
D1 ajouté couvre exactement snapshot 1 / minimum 2 dans all_eligible, closed et
all_eligible_or_closed, avant/après fermeture, avec COUNT = un bulletin, une
consommation, zéro Participation identifiée. Aucune règle serveur n'a changé.

Les compteurs Chromium diffèrent selon le profil et les assertions ciblées exécutées ;
la dernière recette UX inclut les assertions supplémentaires de fermeture sous minimum.
R2 dans la suite historique est uniquement une émulation locale : aucun service R2
Cloudflare n'est activé, et le profil gratuit sans R2 est testé séparément.

Premiers contrôles : 12 contrôles Poppler réussis, deux pages A4 et neuf QR de cartes
fictives redécodés à 300 dpi. Inspection réelle des PNG de cartes et des pages de
gestion à 360/1200 : groupes/ajout distincts, membres en grille desktop et colonne
mobile, cases proches des noms, statut révoqué visible ; cartes sans chevauchement,
QR contrastés et consigne lisible. Les captures restent ignorées et hors ZIP.
La seconde page avec nom/pseudonyme long, accents, emoji et nom d'Espace long a
également été inspectée en crop Poppler 300 dpi : aucun chevauchement avec le QR
ou la consigne. Pas de validation papier ou de caméra physique revendiquée.

Incidents de développement, corrigés : première fixture unitaire utilisait une date
numérique au lieu d'ISO ; première exécution sandbox refusait le port loopback de
Miniflare ; tests relancés avec autorisation de ports locaux. La simulation caméra
ne produisait qu'une frame blanche (video.currentTime=0) : source continue simulée
corrigée, QR décodé. Aucun contournement par suppression du test.
L'assertion de focus a été ajustée pour focaliser le déclencheur avant son clic
programmatique, comme le fait une activation réelle : `.click()` seul ne reproduit
pas le focus d'un clic pointeur. Le test reste présent et passe à 320/360/1200 px.
Le contrôle ZIP a utilisé le lecteur/CRC Node natif, en plus de `unzip -tqq`, car
le sandbox refusait `spawnSync unzip` ; aucune modification du conteneur pour cela.

## Audit confidentialité et invariants

**PASS, avec les limites de preuve indiquées ci-dessous.** Aucun changement dans
shared/, relay/, migrations, configuration Cloudflare ou package-lock.json. Les
empreintes initiales des cinq rapports historiques, des quatre migrations et de la
configuration production sont identiques après travail (dix fichiers vérifiés).

- Aucun nouveau stockage participant ; seuls les accès de gestion explicitement
  conservés avant ce lot continuent d'utiliser leur stockage local existant.
- Pas de credential participant en localStorage/sessionStorage/IndexedDB ; profil,
  pseudo reconnu et token restent en mémoire et sont effacés aux sorties prévues.
- Pas de token dans les noms de fichiers, logs techniques ou BroadcastChannel ;
  les noms des PDF/fichiers d'accès utilisent seulement des métadonnées nettoyées.
- COUNT D1 anonyme : aucune Participation ou liaison membre-bulletin ; invariants
  de concurrence, snapshot, rôles et autorisation vérifiés par les suites locales.
- Ni agrégat ni compteur ajouté pour un résultat admins_only ; pas d'appel aux
  compteurs admin depuis le parcours participant. Aucune projection publique modifiée.
- Aucune nouvelle dépendance, CDN, police distante, cookie, télémétrie, image
  distante utilisateur, upload caméra ou ressource réseau supplémentaire.
- Build décodé : configuration publique production attendue, remoteAssetsEnabled
  false, mode siteverify, jsQR embarqué, aucun credential brut ni affectation de
  secret Turnstile détectés dans les modules client. La site key reste publique.
- Manifeste d'audit pré-archive : 194 fichiers admissibles, zéro chemin privé/refusé,
  zéro credential brut détecté. Les QR/PDF de fixtures et profils restent ignorés.
- Scan d'affectations de secrets : seulement trois fixtures de tests explicitement
  fictives déjà présentes ; aucun paramètre d'authentification npm, aucun secret réel
  introduit. Aucun contenu privé de sauvegarde ou de profil n'a été inspecté.

Aucune consultation ni mutation de l'Espace test de production, aucun deploy, aucune
migration distante, aucun challenge Turnstile humain simulé, aucun secret lu.
Les contrôles de stockage sont ceux de Chromium isolé et du code, pas une expertise
forensique d'un téléphone réel. La possession d'un PDF/carte donne toujours les droits
de cette carte ; le secret du QR n'est pas un chiffrement E2E de bulletin.

## Carte issue d'invitation : étude seulement

L'absence de récupération depuis le digest est une propriété de sécurité, pas un
oubli de bouton. Le secret n'est connu que de l'appareil qui l'a généré. Trois pistes :

| Piste future | Avantages | Risques et complexité |
| --- | --- | --- |
| Émission/impression centralisée par l'adulte, puis remise physique | Déjà compatible avec l'émission admin et les lots actuels ; pas de coffre serveur ; simple | Ne récupère pas une carte déjà créée sur un téléphone ; réémission invalide l'ancienne ; organisation de la distribution à prévoir |
| Transfert volontaire local du PDF/QR par son détenteur vers le poste d'impression | Respecte la possession du secret ; aucun stockage serveur ; impression de la carte existante | Le document est secret et confère un pouvoir d'usurpation ; canal sûr et consentement explicites ; future UI de réception/validation, sans conservation implicite ; complexité modérée |
| Enveloppe chiffrée destinée au seul poste d'impression, serveur aveugle au secret | Réimpression asynchrone possible sans credential brut côté serveur | Gestion de clés, récupération, expiration, suppression et analyse de menace à concevoir ; nouveau protocole/stockage, probablement migration ; audit cryptographique standard requis ; hors v0.6.1 |

Recommandation : privilégier l'émission/impression adulte quand l'organisation le
permet ; étudier ensuite le transfert volontaire du document local. Ne jamais
« résoudre » la réimpression en gardant des cartes en clair sur le serveur. Aucune
de ces fonctionnalités structurelles n'est ajoutée dans ce lot.

## Limites et décisions humaines

Les réserves suivent exactement la numérotation de la section 14 de l'autorité :
**quatorze corrigées localement, une étudiée seulement** (n°6). Les deux bugs confirmés
juste avant cette liste sont traités dans n°10 (admins_only) et n°12 (retour invitation).
La récupération structurelle de cartes issues d'invitations reste hors périmètre.
Une personnalisation graphique plus avancée des cartes ou un scanner aussi tolérant
que toutes les caméras natives n'est pas promise. Une carte volée peut consommer
un droit anonyme, sans permettre de retrouver son bulletin ; invariant inchangé.
Pas d'anonymat cryptographique/E2E absolu, aucune identité vérifiée.

La validation ergonomique par des enfants, téléphone/caméra réel et papier reste
À VALIDER HUMAINEMENT après audit et éventuel déploiement autorisé. Le lot local
ne clôture pas cette future recette et ne modifie pas l'Espace test conservé.

## Recette humaine recommandée après futur déploiement

1. Groupes/membres sur Chromebook et téléphone : distinction ajout/existant,
   changement d'affiliation signalé puis sauvegardé explicitement.
2. Créer un brouillon pas à pas, revenir, changer en rapide ; vérifier conservation
   et compréhension. Vote simple : visibilité non pertinente désactivée.
3. Invitation avec/sans groupe : récapitulatif évident, usages/durée, téléchargement
   pendant disponibilité puis retour immédiat à l'Espace.
4. Carte : PDF individuel et lot correctement nommés, joli et lisible à 100 %,
   impression si disponible ; ne jamais partager ces documents publiquement.
5. Scan réel : guidage, QR petit/incliné raisonnable, pseudo reconnu avant vote,
   téléphone collectif A puis B, aucun nom/token après succès ou Terminer.
6. Résultats réservés / attente minimum / attente de tous / fermeture : message
   compréhensible et cohérent avec l'état indiqué en gestion, sans fuite d'agrégats.
7. Révoquer une carte fictive : état visible, action désactivée, ancienne carte refusée,
   régénération possible. Ne rien muter en production avant autorisation distincte.

## Build et bundle

Build production final : **1 603 237 octets**.

SHA-256 : `cafe2545f6aed3203a74269438f892ac1eb971f077bf0eb5336aef3958ea2096`.

Référence v0.6 : 1 580 321 octets,
`91c9d6a089ea31f686470f398bc83a8868936bb521697b7b114ace40056e10db`.
Variation : **+22 916 octets, environ +1,45 %**. Deux petits modules d'interface,
guidage scanner, CSS/texte des nouveaux états et contrôles guidés ; aucune nouvelle
bibliothèque ni ressource bitmap/font. Le build autonome hors relais reste validé.

Bundle local : `VOTI_AUDIT_V0_6_1.zip`, via `scripts/audit-bundle.mjs` et
`git ls-files -co --exclude-standard` filtré. Il s'agit de l'état source admissible
complet, y compris les documents préexistants, pas seulement du diff v0.6.1.
Contrôle du conteneur : PASS (CRC, répertoire central, 194 fichiers du manifeste,
octets archivés identiques aux fichiers source). Aucun ZIP récursif, PDF, export
Admin/Créateur/carte/invitation, capture personnelle, média privé, backup D1, base,
env/secret, profil/cache/runtime ou node_modules. Les assets de marque publics sont
conservés. L'archive est régénérée après cette documentation finale, puis les mêmes
contrôles sont répétés sur le fichier final ; taille exacte donnée à la sortie.

État Git : **aucun staging, commit ou push**, HEAD initial conservé. Les 23 fichiers
du lot restent locaux ; rapports historiques pré-modifiés et captures personnelles
préservés. Aucune nouvelle validation humaine n'est revendiquée.

**Aucun déploiement v0.6.1 n'a été effectué.**
