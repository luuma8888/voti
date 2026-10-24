# Cartes Voti — fonds illustrés et gestion par lot

## État initial et diagnostic avant modification de l’architecture

HEAD réel et origin/main : `91bb4aadecaaae0d1f62092721bfea0af7889c3b`.
Neuf rapports historiques déjà modifiés, médias personnels et archives hors lot
préservés ; index vide. Mission locale, aucun accès/mutation production nécessaire.

L’état existant est **`SpacesUI.issued`**, tableau de l’instance unique `spacesUI`
créée par `web/app.js`. Le contrôleur survit aux rendus SPA. `showCard` filtre par
memberId puis ajoute la carte brute ; les changements de thème modifient cet objet.
`memberCardsPdf(this.issued, ...)` assemble le lot avec le renderer commun. La vue
est remplacée par `handleRoute`/renderSpaceManagement, mais le tableau ne se vide
pas lors de Membres → Groupes → Aperçu → Membres du même Espace. Le bouton PDF,
construit seulement dans `showCard`, disparaît donc alors que les données restent.
Une nouvelle génération reconstruit ce bouton et révèle à nouveau le lot ancien.

Des frontières supplémentaires effacent le tableau : leaveRoute (hors zone Espaces),
branche #spaces, parcours #member/#invite/cardPrompt et pagehide. Un vrai reload
recrée le contrôleur vide. Ces frontières expliquent les différences entre sorties
SPA ; il ne s’agit ni d’une persistance navigateur ni d’un coffre serveur.

Backend inspecté : `rotateMemberCard` utilise un digest et un batch D1 atomique
avec la même révision globale de l’Espace ; fonctionne aussi sans carte active.
getMemberHome permet de vérifier une nouvelle carte, sans ouvrir de session UI.
Aucune récupération du secret existant. Pas d’endpoint multi-membres actuel.

## Décisions avant implémentation

- Réutiliser **issued**, une entrée par Espace/membre ; aucune collection de
  credentials parallèle. Les résultats du dernier batch ne gardent que des clés.
- Lot d’impression administrateur en mémoire du document, conservé en SPA, effacé
  explicitement ou au vrai départ/reload. Affichage uniquement après lecture admin
  autorisée de cet Espace, jamais dans le parcours participant.
- La carte personnelle issue d’invitation reste dans sa vue temporaire, sans rejoindre
  le lot d’impression admin : pas d’extension de la session participante.
- Batch séquentiel utilisant rotateMemberCard et sa CAS, arrêt au premier échec,
  compteurs exacts. Pas d’atomicité globale revendiquée. Réponse réseau ambiguë :
  candidat conservé en mémoire comme non confirmé, exclu des PDF jusqu’à vérification.
- Aucun backend, contrat, migration ou catalogue modifié. Limite PDF alignée sur
  les 200 membres maximum d’un Espace ; export toujours cloisonné par Espace.
- Fond raster décoratif peint par une fonction canvas partagée DOM/PDF : mêmes
  images et ordre, mosaïque fondue, couleurs de thème, gradients et zones protégées.
  Liste de groupes et géométrie de premier plan validées conservées.

## A. Registre mémoire et correction UX

`card-session.js` agit directement sur `SpacesUI.issued`. Une clé Espace/membre
remplace les anciennes versions, dont la chaîne credential est vidée. Les résultats
du dernier batch ne contiennent que des clés/versions, jamais un second lot secret.
Un candidat à réponse incertaine peut conserver, dans la même entrée, sa précédente
version comme secours ; aucune des deux n’est exportée avant résolution. Si le
candidat est refusé, l’ancienne carte est elle-même vérifiée avant de la rétablir.

Membres expose le nombre de cartes prêtes, le thème du lot, l’option de fond,
le PDF complet, un aperçu à sélection et l’effacement explicite. Aperçu offre un
raccourci vers Membres quand le registre contient des cartes de cet Espace.
Une navigation Membres/Groupes/Aperçu, vers Mes Espaces ou vers l’accueil ne détruit
plus le registre. Le retour dans un Espace nécessite toujours l’accès admin valide.
Un vrai reload/pagehide, l’effacement explicite ou l’oubli de l’accès local l’effacent.
Une révocation de carte/membre effectuée dans cette interface retire son entrée ;
l’archivage efface le lot de l’Espace. Aucun de ces nettoyages mémoire ne modifie
le serveur. La commande de révocation reste, elle, la commande serveur habituelle.

Le parcours personnel d’invitation ne rejoint pas le registre admin. Le profil
participant, ses cinq minutes, l’effacement après vote/Terminer et le canal de
neutralisation restent inchangés. Le registre d’impression est une capacité privée
de l’émetteur : ne pas prêter ce profil comme téléphone collectif participant.

## B. Mode administrateur « Gérer les cartes »

Une action icône + texte active les cases nommées, individuelles ou toutes/aucune,
un compteur et une confirmation de remplacement. Liste/Vignettes partagent le même
Set de sélection mémoire. Le mode peut être annulé sans écriture. Les membres révoqués
ne sont pas sélectionnables. Le panneau du lot existant devient repliable pendant
la sélection, afin de laisser visibles les membres, notamment sur téléphone.

L’orchestrateur relit l’Espace et le membre avant chaque `rotateMemberCard`.
La révision fraîche est transmise à la CAS existante ; un autre remplacement de
carte peut provoquer un conflit, qui arrête le lot sans écraser sa carte concurrente.
Les anciennes cartes sélectionnées sont invalidées ; les autres membres ne sont
pas modifiés. La même commande crée une carte si aucune carte active n’existe.

**Atomicité par membre, pas par lot entier.** Le premier refus arrête les opérations
suivantes. L’interface affiche séparément réussites, échecs, réponses à vérifier et
membres non traités. Une limite de débit reconnue est un refus sans mutation ; une
rupture réseau après l’envoi est une incertitude. Le candidat de celle-ci reste en
mémoire et hors PDF. « Vérifier les cartes » appelle `getMemberHome` directement,
sans ouvrir de session participante, puis résout l’état sans nouvelle rotation.
Une interruption réelle de l’onglet peut encore faire perdre une réponse/son secret :
une régénération sera alors nécessaire. Les limites de débit existantes sont préservées.

Après action, « PDF de ces N cartes » correspond aux versions réussies encore dans
le registre. « PDF des M cartes » correspond à tout le lot courant de cet Espace.
Les nouvelles versions remplacent les anciennes sans doublon. Un changement de
version/effacement pendant la préparation d’un PDF bloque son téléchargement obsolète.
La navigation SPA est bloquée durant l’émission ; le shell reste monté. Le navigateur
signale aussi une tentative de fermeture/rechargement en cours.

Le focus entre dans les commandes de sélection, revient sur les actions après
Tout sélectionner/Tout désélectionner/Annuler et se place sur le résultat après
émission/vérification. Cases avec noms accessibles et cibles de 44 px, compteurs
status et résultats aria-live ; dialogue de confirmation accessible existant réutilisé.

## C. Fond illustré partagé écran/PDF

`memberCardModel` résout les groupes puis `groupBackdrop` fixe les images, leur ordre,
le layout et les paramètres. Aucun ID, asset ou manifeste n’est modifié. Zéro
illustration donne un fond uni équilibré. Un groupe illustré remplit en cover la
surface ; plusieurs groupes sont limités aux quatre premiers visuels distincts :
deux/trois bandes fondues ou quatre zones 2×2 dans la région décorative. Les groupes
sans illustration sont ignorés pour le fond, conservés dans la liste informative.
Au-delà de quatre, les textes/miniatures au premier plan et leur résumé restent intacts.

Une seule peinture canvas produit le décor DOM et PDF : cover proportionnel,
chevauchements, alpha de bord progressif, teinte du thème, fondu vertical et masques
doux neutralisant les zones de texte (hauteur des groupes adaptée à leurs lignes
effectivement affichées, pour ne pas blanchir inutilement toute la zone libre). Intensité maximale / teinte : Pop 12 % /15 %,
Nature 10 % /20 %, Douceur 9 % /22 %, Nuit 9 % /40 %, Minimal 5,5 % /30 %.
Le fondu réduit encore la visibilité locale. La réserve QR commune est blanche
opaque sur toute sa zone de 456×456 avant le dessin du QR et sa quiet zone.
Les images ne sont jamais derrière les modules. Nom, illustration membre, miniatures
de groupes, dimensions physiques et premier plan validés ne changent pas.

L’option est activée par défaut, temporaire et indépendante des miniatures de groupes.
Le PDF individuel utilise l’option de sa carte ; les PDF nouveau lot/session utilisent
une seule option et un seul thème pour toutes leurs cartes. Le bouton de lot depuis
l’émission individuelle applique également le thème/fond affichés à tout le lot.
Huit cartes A4/page, 200 cartes maximum (limite d’un Espace). Cache borné à seize
images publiques, aucun credential dans le cache. Une erreur de chargement du décor
retire ce décor de l’aperçu et fait échouer l’export : la carte mémoire reste disponible
pour réessayer, sans régénération nécessaire.

## D. Confidentialité et périmètre

Aucun changement shared/relay/schema/migration/configuration Cloudflare/lockfile,
aucune nouvelle dépendance, CDN, R2, cookie, télémétrie ou upload. Les seules images
proviennent du catalogue intégré existant. Aucun accès production effectué.
Les credentials bruts sont générés par la fonction existante puis transmis à la
commande autorisée ; le serveur conserve toujours uniquement le digest. Aucun
ajout de localStorage/sessionStorage/IndexedDB pour les cartes, ni log de credential.
Les préférences Liste/Vignettes préexistantes ne contiennent que le mode d’affichage.
Les PDF téléchargés restent des fichiers secrets sous la responsabilité de l’émetteur.
Un émetteur peut utiliser une carte qu’il imprime : cette limite existante est conservée.

## E. Tests, captures, build et commit

Résultats définitifs consignés ci-dessous après fin des suites locales.


### Couverture ajoutée et adaptations des tests existants

- `tests/card-background-session.test.js` : mosaïques/absence de visuel/OFF/thèmes,
  clé par Espace/membre, remplacement/effacement, arrêt séquentiel, CAS, quota,
  réponse ambiguë, vérification de l’ancienne carte avant rétablissement.
- `test:card-background-batch` : vrai Worker/D1 local, génération A puis B,
  navigation/retour, régénération dédupliquée, aperçu, deux PDF distincts, sélection
  Liste/Vignettes, toutes/aucune, confirmation, clavier Space, focus et zoom 360,
  succès partiel et réponse perdue réellement affichés, vérification sans réémission,
  effacement et reload sans révocation. Inspection localStorage, sessionStorage et
  de tous les object stores IndexedDB du contexte : aucun credential membre.
- Cas D1 additionnels : refus avant écriture, création après révocation de carte,
  membre révoqué entre sélection/action, remplacement concurrent de la même carte
  provoquant une vraie CAS refusée, rôles Créateur/Admin inchangés.
- `test:card-background-pdf` : PDF de décors, nouveau lot et session. QR attendus
  figés au téléchargement (pas après les remplacements suivants du test), Poppler
  300 dpi et redécodage de chaque carte, vérification des coins blancs de quiet zone.
- Parité : comparaison byte-for-byte des canvas décoratifs de l’aperçu et des
  textures effectivement dessinées sur la page PDF, pas seulement des attributs.
  Les éléments de premier plan gardent les tests de ratios et contain existants.

Aucun test supprimé ni invariant réduit. Les attentes de chargement des tests cartes
attendent désormais `backdropReady`. Le contrôle des images distingue le cover
proportionnel du décor du contain sans crop des personnages. Un ancien sélecteur
« Enregistrer le groupe » se basait sur le texte visible, devenu « Enregistrer »
au lot précédent : il utilise aussi le nom accessible exact conservé, et continue
à vérifier la modification réelle du groupe.

Incidents de validation locale corrigés : test de densité initialement en échec
à cause d’une ligne d’action supplémentaire ; action déplacée dans la barre
Liste/Vignettes, sans changer le nombre de membres exigé dans le viewport. Les
premiers contrôles PDF de ce lot comparaient à tort les tokens après une rotation
ultérieure ou observaient les canvas de travail intermédiaires : références figées
à l’export et observation limitée à la composition A4 finale. Les comparaisons
restent strictes. Le premier npm test sous bac à sable restreint ne pouvait pas
exécuter workerd ; relance avec runtime local autorisé, sans contourner le test.

### Limites et recette ultérieure

Pas de transaction globale ni de reprise automatique aveugle après réponse ambiguë.
Un membre déplacé/renommé ou une carte révoquée par un autre appareil après émission
peut rendre les métadonnées/la carte mémoire obsolètes ; la copie temporaire n’est
pas une synchronisation de cartes et ne récupère pas de secret depuis D1. Une vraie
fermeture/recharge perd les secrets non téléchargés, volontairement. Effacer ne
supprime pas les PDF déjà téléchargés. Une chaîne JavaScript vidée/retrait de
référence n’est pas une garantie d’effacement physique de toute mémoire du navigateur.

Après une éventuelle publication autorisée séparément : revue du fond à taille
physique sur papier, scan téléphone réel des cinq thèmes, lisibilité du lot sur
petit écran et compréhension des deux actions PDF. Ces validations humaines ne
sont pas revendiquées ici. Aucun push, déploiement ou accès production pour ce lot.

### Résultats définitifs — 24 octobre 2026

| Commande exacte | Résultat | Durée |
|---|---|---|
| `npm run test:browser` | PASS | 228.9 s |
| `npm run test:space-ui` | PASS | 141.6 s |
| `npm run test:spaces-ux` | PASS | 78.9 s |
| `npm run test:spaces` | PASS | 168.3 s |
| `npm run test:visual-identities` | PASS | 60.1 s |
| `npm run test:visual-pdf` | PASS | 15.0 s |
| `npm run test:member-cards` | PASS | 5.1 s |
| `npm run test:card-polish` | PASS | 10.4 s |
| `npm run test:card-ux` | PASS | 30.8 s |
| `npm run test:card-ux-pdf` | PASS | 3.9 s |
| `npm run test:participation` | PASS | 20.5 s |
| `npm run test:comments` | PASS | 13.7 s |
| `npm run test:free-pilot` | PASS | 129.9 s |
| `npm run test:spaces-migration` | PASS | 56.3 s |
| `npm run test:card-background-batch` | PASS | 25.9 s |
| `npm run test:card-background-pdf` | PASS | 10.5 s |
| `npm test` | PASS | 13.1 s |
| `npm run check` | PASS | 7.3 s |
| `npm run build:production` | PASS | 0.8 s |
| `git diff --check` | PASS | — |

417 tests unitaires ; syntaxe de 147 fichiers. Chromium historique : 2966
contrôles. UI Espaces : 2855 contrôles, cinq largeurs 360/390/1200/1440/1920 ;
Espaces/appareil partagé : 368 contrôles +188 HTTP/D1. Identités visuelles :
1372 contrôles Chromium et 212 D1 (215 avec le pilote). Mode libre connecté :
3138 contrôles navigateur et 67 HTTP/D1. Participation 294, commentaires/PDF 37.
La migration locale de compatibilité vérifie 16 invariants historiques ; aucune
nouvelle migration créée.

Nouveau parcours fond/lot : **175 contrôles Chromium**, 30 captures ; les sept
scénarios unitaires couvrent aussi l’effacement pendant une opération en cours,
sans repeuplement ultérieur, et la limite PDF. **16/16 QR** du PDF de décors
(11 cartes), nouveau lot (2) et session (3), redécodés à 300 dpi, 60 contrôles.
Les suites PDF préexistantes passent également : 15 QR illustrés, 9 cartes membre,
10 cartes harmonisées et 2 comparaisons écran/PDF ; les 7 QR commentaires passent.
Aucune suite demandée non exécutée. Logs/résultats privés dans `.browser-tests/`.

### Inspection visuelle finale et liste exacte des vues

Répertoire ignoré : `.browser-tests/voti-card-background-batch/`. Trente PNG
Chromium originaux, deux extraits de cartes des PDF réellement rendus, plus quatre
rasterisations A4 intermédiaires (`backgrounds-1.png`, `backgrounds-2.png`,
`new-batch-1.png`, `session-1.png`). Planche de revue locale : `index.html`.
Toutes les données proviennent des fixtures fictives du Worker/D1 local.
Aucun fichier de ces vues/PDF/attendus contenant des cartes ne fait partie du commit.

Toutes les vues ont été inspectées sur planche, puis les deux cartes PDF, la
vue d’échec partiel, le mode mobile et la sélection mobile ont été ouverts en grand.
Le nom et le personnage restent dominants, les pieds/têtes sont entiers, les groupes
restent secondaires. Le fond se voit dans les zones libres sans couvrir les textes ;
Nuit et Minimal restent discrets, réserve QR blanche sans décor. Les mosaïques sont
fondues sans séparations dures. Les contrôles mobiles ont des cibles confortables,
les cases ne masquent pas les noms et aucun débordement n’est observé, y compris à
360 avec texte agrandi. L’échec partiel ouvre automatiquement son résultat et place
le focus dessus ; aucune réussite totale n’est annoncée. En mode normal, plusieurs
membres restent visibles ; le bloc de sélection replie le lot pour dégager la liste.

| Capture | Dimensions | Origine |
|---|---|---|
| `members-normal.png` | 1440×900 | Chromium |
| `session-one.png` | 1440×900 | Chromium |
| `session-two.png` | 1440×900 | Chromium |
| `session-preview.png` | 1440×900 | Chromium |
| `session-return.png` | 1440×900 | Chromium |
| `manage.png` | 1440×900 | Chromium |
| `selected-tiles.png` | 1440×900 | Chromium |
| `selected-list.png` | 1440×900 | Chromium |
| `confirmation.png` | 1440×900 | Chromium |
| `batch-complete.png` | 1440×900 | Chromium |
| `new-and-session.png` | 1440×900 | Chromium |
| `partial-failure.png` | 1440×900 | Chromium |
| `verified-response-loss.png` | 1440×900 | Chromium |
| `mobile-session.png` | 390×844 | Chromium |
| `mobile-manage.png` | 390×844 | Chromium |
| `mobile-selection.png` | 390×844 | Chromium |
| `mobile-360-zoom.png` | 360×844 | Chromium |
| `background-0.png` | 1440×900 | Chromium |
| `background-1.png` | 1440×900 | Chromium |
| `background-2.png` | 1440×900 | Chromium |
| `background-3.png` | 1440×900 | Chromium |
| `background-4.png` | 1440×900 | Chromium |
| `background-5.png` | 1440×900 | Chromium |
| `background-6.png` | 1440×900 | Chromium |
| `background-7.png` | 1440×900 | Chromium |
| `background-8.png` | 1440×900 | Chromium |
| `background-9.png` | 1440×900 | Chromium |
| `background-10.png` | 1440×900 | Chromium |
| `session-pdf-action.png` | 1440×900 | Chromium |
| `cleared.png` | 1440×900 | Chromium |
| `pdf-single-300dpi.png` | 1120×760 | Poppler 300 dpi |
| `pdf-mosaic-300dpi.png` | 1120×760 | Poppler 300 dpi |

### Build et livraison Git locale

Build production : **1 836 914 octets**  SHA-256
`300eb94a85a9b7c4fbf258f1f327bf31efaf6cb74ae76c825ed38a9b4ee334d6`.
Référence HEAD initial : 1 804 288 octets,
`417c2794d3d5adaf2aec3d5b1a0ef685aa433d2f1496a5936df8ee8e1104a8ca`.
Variation : **+32 626 octets (+1,81 %)**, due aux contrôles de lot, au registre
mémoire, aux décors partagés et aux libellés/CSS. Poids des assets inchangé.
Configuration publique de production conservée ; 70 modules de l’import map
décodés et contrôlés, configuration strictement égale à relay-production.json,
aucun scénario/credential de test embarqué. Source shared/relay/assets/vendor/lockfile identique au HEAD initial.

Manifeste prévu et contrôlé du nouveau commit local, **24 fichiers** :

- `docs/CODEX_CARD_BACKGROUND_BATCH_REPORT.md`
- `docs/MEMBER_CARDS_V0.md`
- `docs/SPACES_GROUPS_V0.md`
- `index.html`
- `package.json`
- `scripts/browser-space-layout.mjs`
- `scripts/browser-space-polish.mjs`
- `scripts/browser-test.mjs`
- `scripts/browser-visual-identities.mjs`
- `scripts/free-pilot-integration.mjs`
- `scripts/run-card-background-batch.mjs`
- `scripts/run-card-ux.mjs`
- `scripts/test-card-background-pdf.mjs`
- `tests/card-background-session.test.js`
- `web/app.js`
- `web/card-backdrop.js`
- `web/card-batch-ui.js`
- `web/card-session.js`
- `web/member-card-model.js`
- `web/member-card-view.js`
- `web/member-cards.js`
- `web/space-management.js`
- `web/spaces-ui.js`
- `web/styles.css`

Message : `feat: enrichir les cartes et leur gestion par lot`. Parent :
`91bb4aadecaaae0d1f62092721bfea0af7889c3b`. Livraison uniquement locale, sans
amend/rebase/squash. Le SHA du commit se lit dans `git log -1` (un rapport ne peut
pas contenir son propre SHA de commit). Les neuf rapports historiques pré-modifiés,
les cinq captures personnelles, les archives et le document historique non suivi
restent exclus et intacts. Aucun staging de captures/PDF/ZIP/export/secret/runtime.
Audit des fichiers livrés : aucun credential réel, clé privée, secret Turnstile,
jeton GitHub/Cloudflare ou fichier interdit. Aucun push, aucune publication Pages,
aucune intervention Worker/D1 distante : production inchangée par cette mission.

## Correction après retour humain — décor continu sous les textes

Le retour en ligne signale que le décor reste découpé par des fonds sous le nom,
l’Espace et les groupes. Cause : les masques canvas ajoutés au décor commun, et non
un fond CSS propre à ces textes. Ces masques (y compris celui du message inférieur)
sont supprimés. Le bandeau Voti et la réserve blanche du QR restent opaques ; les
textes sont directement posés sur le décor continu. Intensités, thèmes, fondu global,
mosaïques et géométrie de premier plan restent identiques. Le renderer commun
applique cette correction simultanément à l’écran et au PDF.

Tests renforcés : transparence des quatre blocs DOM, présence réelle du décor sous
ces mêmes zones dans le canvas, bandeau opaque, réserve QR toujours blanche, texture
PDF strictement égale à celle de l’aperçu. Les cinq commandes suivantes passent :

- `npm test` : PASS.
- `npm run check` : PASS.
- `npm run test:card-background-batch` : PASS.
- `npm run test:card-background-pdf` : PASS.
- `npm run build:production` : PASS.

417 tests unitaires ; syntaxe 147 fichiers ; parcours Chromium 175 contrôles et
30 captures ; PDF 60 contrôles, 16/16 QR redécodés à 300 dpi. Les autres suites de
la livraison précédente ne sont pas relancées pour cette correction graphique.
Rendus humain/créature, un groupe/mosaïque inspectés ; plus de plaques rectangulaires
sous les textes, nom lisible, QR isolé sur blanc. Les fixtures restent locales et
ignorées par Git. Comparaison locale : `.browser-tests/card-backdrop-continuous-review/`.

Build corrigé : 1 836 230 octets ; SHA-256 `4edae3f7d29a45aa13fe798d1927323ef841d99cb86ef1764e3cb85bfd5a7836`.
Cinq fichiers du correctif : `web/card-backdrop.js`,
`scripts/run-card-background-batch.mjs`, `docs/MEMBER_CARDS_V0.md`,
ce rapport et `index.html`. Aucun changement métier, credential, asset, manifeste,
shared/relay, Worker ou D1. Commit séparé et push/publication frontend autorisés
explicitement par Lu’uma après son retour ; aucune réécriture de l’historique.
