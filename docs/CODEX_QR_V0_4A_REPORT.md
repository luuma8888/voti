# Voti v0.4A — QR, partage et premières affiches PDF

Date : 12 octobre 2026. Base : main `44db068`, confirmations v0.3E publiées
précédemment sur accord explicite. Le développement et ses tests sont restés
locaux. Après validation de l'audit ChatGPT, Lu’uma a explicitement autorisé
le commit/push v0.4A et la publication GitHub Pages ; suivi ci-dessous.
Aucun appel mutant de production ni deploy Worker dans ce lot.
La production reste le pilote textuel gratuit validé, sans R2.

## Architecture réalisée

`shared/qr-links.js` construit les destinations canoniques publiques et encode/
valide le format secret existant. Il dépend uniquement des validateurs communs,
pas du DOM, fetch ou Cloudflare. Le moteur, schéma, empreintes, stockage métier,
contrat RelayAdapter, révisions et protocole admin/vote sont inchangés.

`web/qr.js` isole la matrice, SVG, Canvas, PNG et téléchargement. qrcode-generator
encode au niveau M ; le wrapper ajoute quatre modules blancs de quiet zone.
SVG uniquement coordonnées calculées, Canvas noir/blanc, pixels entiers et
lissage désactivé ; aucun logo dans le QR. TextEncoder assure les octets UTF-8.
Taille de payload bornée à 1800 octets ; les URLs actuelles sont très inférieures.
Le décodage indépendant jsQR est uniquement dans les tests.

`web/sharing.js` construit une vue dédiée `#share/<pollId>` : sections repliables
vote, choix, résultats, affiches, transfert SECRET. Destinations textuelles et
cliquables, Copier, PNG/SVG individuels. La gestion garde ses actions existantes
et ajoute un lien Partager. Pas de QR/affiche pour le local ou les préparations.
Le rattachement existant et une lecture réelle du relais sont nécessaires.

La base publique n'est jamais déduite de la page courante ni du backend :
`https://luuma8888.github.io/voti/`, centralisée dans shared/qr-links.js.
Builders publics testés pour 2/3/6 choix et UUID invalides. Les routes sont :

- `#/p/<pollId>` ;
- `#/p/<pollId>/results` ;
- `#/p/<pollId>/choice/<choiceId>`.

Le routeur refuse les segments publics surnuméraires. Un QR choix ouvre un radio
présélectionné avec une explication claire, modifiable. Continuer n'écrit rien ;
seul « Oui, je confirme » envoie le bulletin distant minimal. Choix invalide :
tous décochés et message court. Fermé : pas de formulaire/bouton de vote ; URLs
inchangées. Supprimé : message explicite introuvable sur les trois routes.

## Transfert d'administration et sécurité

QR caché par défaut dans une section séparée SECRET. Afficher nécessite un clic
explicite, Masquer retire l'image ; refermer la section la masque aussi.
Pas de bouton de téléchargement secret, lien secret affiché, QR admin dans une affiche
ou backup automatique. CSS d'impression masque la section SECRET.

Payload identique au fichier admin v1 : version, relayId, pollId, adminCapability.
JSON UTF-8/base64url canonique, borné et validé. C'est un encodage, pas un
chiffrement ni une nouvelle authentification. Route `#/admin/import/<payload>`.
`web/admin-transfer.js` retire synchroniquement même un payload malformé de
location/history avant stockage et requête, au bootstrap et lors des hashchange.
replaceState utilise un état null et la route sans secret `#admin-transfer`.
Le secret ne reste qu'en mémoire ; quitter/annuler/rafraîchir l'oublie.

Écran « Clé d’administration détectée », avertissement modifier/supprimer,
Annuler et Importer l'administration. Pas de vérification ou import automatique.
La confirmation appelle verifyAdmin avant stockage. Fichier et QR réutilisent
le même helper UI, le dialogue v0.3E et les règles CAS existantes de conflit.
Identique accepté, différente jamais écrasée silencieusement. La navigation
pendant la vérification refuse l'écriture avant retour de verifyAdmin.
Une clé supprimée/inconnue n'est jamais une commande de republication.

Les tests inspectent les URLs HTTP et location avant fetch sans enregistrer
headers/Authorization/corps/capacités. Les diagnostics du harnais masquent aussi
le fragment secret. Pas de console applicative ajoutée. Les fragments ne sont
pas des queries HTTP, mais un scanner, une extension ou le terminal utilisateur
peut les observer : aucune garantie d'effacement chez ces tiers. Ce QR doit
rester aussi protégé que le fichier admin. Aucune donnée réelle de mineur.

## PDF et présentation

`web/poster.js` sépare plan public, mise en page mesurée et génération PNG/PDF.
Deux modes A4 portrait : accès unique avec grand QR centré dominant ; grille
de choix avec une consigne explicite de présélection/confirmation. QR résultats
séparé dans les deux modes. Branding discret, aucun secret ou image distante.

Canvas 2480×3508, environ 300 dpi, PNG sans perte dans une page de
595,2756×841,8898 points. Une seule surface RGBA d'environ 35 Mo à la fois,
libérée en finally, avec mémoire temporaire du codec PNG/PDF en sus. Textes
locaux system-ui, accents français, retours mesurés et mots longs sans perte.
Pas de police distante ; le PDF reste raster et non balisé/non sélectionnable.

Palette papier claire avec accent du sondage ; cinq thèmes testés via rendu.
Nuit est adapté au papier en conservant la famille Menthe/Lavande/Pêche.
QR noir/blanc, au moins cinq pixels source par module ; environ 43–47 mm
pour un QR choix, >=34 mm pour résultats. Pas de lissage des modules Canvas.
Des liens écrits complètent également tous les QR de l'affiche, sans secret.
Une page pour les fixtures ordinaires 2/3/6 choix ; textes très longs paginés
plutôt que QR réduits, maximum quatre pages. Le PDF comporte une indication
d'impression à 100 % et le nombre de pages.

Le skill PDF a guidé la recette Poppler et l'inspection visuelle des vrais
exports. Les QR extraits des pages rasterisées sont décodés indépendamment,
pas seulement comparés à une intention de rendu. Cette vérification ne remplace
pas le scan physique avec caméra/imprimante de Lu’uma.

## Dépendances et build

Versions directes exactes :

| Paquet | Usage | Licence | Source minifiée embarquée |
| --- | --- | --- | ---: |
| qrcode-generator 2.0.4 | Encodage QR mature plutôt qu'artisanal | MIT | 20 909 octets |
| pdf-lib 1.17.1 | Conteneur PDF A4 et PNG local | MIT | 431 630 octets, transitives incluses |
| esbuild 0.28.2 | Bundling des deux bibliothèques, développement uniquement | MIT | Non embarqué |
| jsqr 1.4.0 | Décodeur de recette indépendant, développement uniquement | Apache-2.0 | Non embarqué |

pdf-lib est plus volumineux que le QR, mais évite un générateur de conteneur PDF
maison et toute dépendance serveur. Ses transitives sont @pdf-lib/standard-fonts,
@pdf-lib/upng, pako (MIT) et tslib (Zero-Clause BSD), verrouillées. Notices dans
THIRD_PARTY_LICENSES.md et dans le HTML en texte non exécuté. Aucun CDN/scanner
runtime/framework. esbuild et jsQR ne figurent pas dans l'import map du runtime.

Le build conserve le mécanisme ESM/import map existant ; seuls vendor/qr.js et
vendor/pdf.js sont bundlés en ESM puis inlinés. Les sources Voti ne sont pas
refactorées en framework. 33 modules embarqués ; branding WebP préservé,
PNG source exclus ; profils local et production sans R2 conservés. Le HTML
plus lourd contient tout pour produire QR/PDF hors connexion.

Sources consultées : [encodeur](https://github.com/kazuhikoarase/qrcode-generator/blob/master/js/README.md),
[PDFDocument](https://pdf-lib.js.org/docs/api/classes/pdfdocument),
[esbuild API](https://esbuild.github.io/api/).

## Fichiers du lot

Créés : shared/qr-links.js ; web/admin-transfer.js, qr.js, poster.js, sharing.js ;
vendor/qr.js, pdf.js ; scripts/browser-qr.mjs, browser-admin-qr.mjs,
test-posters.mjs ; tests/qr.test.js, poster.test.js ; docs/QR_AND_POSTER_V0.md,
THIRD_PARTY_LICENSES.md et ce rapport.

Modifiés : web/app.js, styles.css ; scripts/build.mjs, check.mjs,
browser-test.mjs, browser-navigation.mjs, browser-hardening.mjs,
relay-integration.mjs, free-pilot-integration.mjs, audit-bundle.mjs ;
tests/build.test.js, audit-bundle.test.js ; package.json/lock, .gitignore,
README.md, docs/UX_FLOWS_V0.md ; index.html régénéré.

Correction documentaire pré-publication demandée après audit :
docs/DATA_MODEL_V0.md précise que `allowDirectChoiceQr` reste forcé à false
pour compatibilité, réservé et sans politique d'autorisation opérationnelle.
La présélection v0.4A exige une confirmation et ne vote jamais automatiquement.
Sa future sémantique configurable reste à décider. Aucun changement de valeur,
schéma, validateur, empreinte ou migration. Les repères historiques ont été
explicités dans MVP_SCOPE.md, LOCAL_MVP_DECISIONS.md et VOTE_MODES_MATRIX.md ;
QR_AND_POSTER_V0.md est aligné. UX_FLOWS_V0.md décrit déjà le parcours actuel.

Préexistants préservés : modification du rapport v0.3E et spécifications v0.3E/
v0.4A non suivies de Lu’uma. Ils ne sont pas attribués à ce lot. Les deux grands
documents historiques, production v0.3D, moteur et modèle exécutables, StorageAdapter,
AssetAdapter, modules de thèmes, RelayAdapter, Worker/D1/migrations/configuration
Turnstile/R2 et protocoles distants restent inchangés. Cache npm, profils et
runtime de test confinés aux répertoires ignorés du dépôt.

## Tests exacts et incidents

Tests Node : builders, IDs invalides, secret v1/canonique/version/relais,
quiet zone/déterminisme/M, décodage public/secret/UTF-8 par jsQR indépendant,
SVG sûr, pixels entiers, retrait de fragment avant stockage, plans A4 2/3/6
choix courts/longs, immutabilité et exclusion des exports privés dans l'audit.

Chromium : PNG réel et téléchargement PNG/SVG, cinq thèmes, 320/360/1200 px,
affichage/masquage secret, liens textuels, huit vrais PDF. Reprise des régressions
v0.3E clavier/focus/inertie/annulation/double clic et des parcours locaux/images.
Relais local multi-clients : chargement/refresh/choix invalide/Continuer avec
COUNT indépendant D1 inchangé à 0 ; confirmation double clic = exactement
un POST/un bulletin ; seuil 4/5, fermé sans vote, suppression des trois routes.
QR admin : bootstrap réel nettoyé avant fetch, absence d'import automatique,
annulation, payload/version/relais/structure invalides, mauvaises capacité/poll,
identique, conflit annulé/confirmé, suppression puis refus. verifyAdmin réel
et mêmes règles de stockage, aucune capacité dans path/query HTTP.

Résultats consolidés après corrections :

| Commande | Résultat |
| --- | --- |
| npm test | Succès, 225 tests Node ; décompte explicite : 225 passés, 0 échec/sauté/annulé |
| npm run check | Succès, 75 fichiers JavaScript |
| npm run build | Succès, HTML local final 1 126 703 octets |
| npm run build:production | Succès, HTML final connecté 1 126 951 octets ; 33 modules, profil gratuit sans R2 |
| npm run test:browser | Succès, 2 377 contrôles Chromium, dont QR/partage et PDF hors connexion |
| npm run test:poster | Succès, 67 contrôles ; huit PDF A4, trente QR décodés depuis les pages Poppler à 300 dpi |
| npm run test:relay | Succès, 72 contrôles HTTP/Worker/D1/R2 locaux |
| npm run test:integration | Succès, 73 contrôles HTTP + 2 511 contrôles Chromium multi-clients |
| npm run test:free-pilot | Succès, 21 contrôles HTTP/D1 sans R2 + 2 513 contrôles Chromium |
| git diff --check | Succès |

Fixtures PDF finales : six affiches ordinaires (2/3/6 choix × deux modes),
chacune sur une page ; deux affiches à question/description/libellés longs,
chacune sur deux pages. Dix pages au total, sans chevauchement ni troncature
observés. Les derniers rendus accès, six choix et les pages longues ont été
inspectés visuellement. Liens écrits auxiliaires, QR noirs/blancs lisibles,
consigne de confirmation et accents français présents.

La génération de huit PDF n'est pas répétée inutilement dans les deux suites
réseau : elle appartient à test:browser et test:poster, dont les artefacts
sont conservés pour recette. Les suites réseau gardent les contrôles de
partage/QR/thèmes et toutes les mutations/parcours réels. Leurs décomptes
diffèrent donc des premiers essais monolithiques, sans assertions métier
retirées. La dernière finition CSS (liens tactiles >=44 px, également vérifiés)
a été suivie d'une relance navigateur/Poppler/check/build. Aucun backend ni
logique applicative JS modifié après les dernières suites réseau.

Le build de production a été exécuté en dernier avant publication. Runtime
de recette : Node 22.23.3 du dépôt, Chromium local moderne ; npm install sous
le CLI système Node 20 avait émis des avertissements d'engine Wrangler, mais
les scripts utilisent bien le runtime Node 22 verrouillé.

Incidents rencontrés, corrigés sans assouplissement métier :

1. Le détecteur d'import dynamique du build confondait un groupe de regex après
   le mot import avec import(...). Regex de capture reformulée, même comportement.
2. Une assertion de plan attendait deux pages pour six choix courts alors que
   les six QR tenaient lisiblement sur une page : attente corrigée à une page.
3. Le test d'import devait attendre la fin de réactivation après l'erreur. Le
   helper partagé ajoutait aussi un await avant le finally : focus rendu après
   réactivation effective, sans changer importAdminKey ni ses protections CAS.
4. Évaluation CDP monolithique de huit PDF dépassait son timeout. La recette
   est découpée en une génération par appel, sans délai arbitraire de navigation.
5. Le décodeur PNG transitif Node exporte default sous CommonJS : interop corrigée
   dans le test Poppler, sans changement du renderer applicatif.
6. Un test de quota historique a encore échoué après 40 préparations acceptées,
   malgré le succès de tous les parcours Chromium. La cause exacte de cette
   exécution n'est pas démontrée ; un chevauchement de fenêtres et le caractère
   approximatif du binding sont des limites connues. La séquence est désormais
   bornée à 90 tentatives (au lieu de 40), en exigeant toujours un vrai refus
   CREATION_RATE_LIMITED et plusieurs capacités distinctes. Quota serveur,
   backend et assertion inchangés ; test:relay et test:integration complets
   relancés avec succès après ce renforcement. Les échecs ne sont pas masqués.

Wrangler : version installée et aide locale vérifiées avec le skill Wrangler.
Toutes les lectures/migrations/écritures de recette utilisent --local, bindings
remote:false et persistance distincte .relay-local. Aucun test contre la base
de production, aucune commande distante, aucun secret récupéré.

## Compatibilité, écarts et limites

La spécification v0.4A prévaut sur les exclusions QR/PDF historiques du MVP.
Pas de mise à jour silencieuse du modèle : allowDirectChoiceQr reste false,
marqueur réservé forcé par les anciens validateurs. Il n'était pas consulté
comme interdiction de sélectionner un choix par l'UI/relais. La présélection
v0.4A, expressément demandée, ne donne aucun droit ni bulletin supplémentaire.
Ce point est signalé à Lu’uma et détaillé dans QR_AND_POSTER_V0.md. Clarifier le
champ avant une future politique d'autorisation ; aucune migration/hash modifié.
posterVariant reste none : la variante PDF est un choix d'export, pas un style
métier persisté. Les limites longueur/données métier sont conservées.

Pas de PDF vectoriel/balisé, scanner, aperçu d'éditeur d'affiche, R2 ou autre
fonction hors périmètre. Papier A4 portrait et pagination plutôt qu'ajout d'un
studio complet. PDF pouvant utiliser des glyphes différents selon system-ui
installé ; pas de reproductibilité binaire universelle (métadonnées de date).
Le rendu principal/scannabilité a été contrôlé automatiquement, mais Firefox,
Safari/iOS, lecteur vocal et caméra réelle ne sont pas revendiqués.

Audit ChatGPT validé par Lu’uma. Recette humaine à effectuer après publication : lisibilité/vocabulaire
du partage et du secret, scan réel sur téléphone des QR vote/choix/résultats,
confirmation sans vote préalable, PDF ouvert/imprimé à 100 % et scan physique.
Pas de nouvelle décision métier requise pour développer le périmètre demandé.
L'évolution du champ réservé est un point d'audit/futur lot, pas une activation
unilatérale d'un droit d'accès ou un changement de définition verrouillée.

## Audit livrable

Archive de livraison à la toute fin après contrôles : VOTI_AUDIT_V0_4A.zip, via
npm run audit:bundle. Sources limitées aux fichiers Git admissibles,
exclusion de toutes les archives VOTI, exports voti-admin-*.json et PDF,
node_modules, runtimes/caches/profils, .wrangler/.relay-local/.browser-tests.
Les anciens ZIP sont conservés, pas de récursion. Préflight : 132 fichiers
admissibles, aucun PDF/export privé ni archive VOTI dans cette liste. Les
trois littéraux factices historiques des tests Siteverify sont identifiés
explicitement, pas par exclusion globale des fichiers de tests. Sources et
modules HTML décodés contrôlés ; aucune clé réelle récupérée. Aucun secret
ne peut donc être comparé par sa valeur réelle : contrôle de provenance et
motifs, pas garantie magique de détection de tous les secrets possibles.
L'intégrité CRC, le répertoire ZIP et la conformité aux octets sources sont
contrôlés après génération ; chemin et taille exacte fournis dans la sortie
finale. Aucun commit ni push du ZIP. L'archive sera recréée après la recette
humaine et sa documentation finale ; celle issue de l'audit précédent ne
représente pas encore les confirmations physiques à venir.

## Suivi pré-publication et recette humaine

Correction documentaire autorisée par Lu’uma après validation de l'audit.
Relance après correction documentaire : npm test réussi (225 tests Node),
npm run check réussi (75 fichiers), npm run build réussi (1 126 703 octets),
npm run build:production réussi (1 126 951 octets), git diff --check réussi.
La première tentative sous sandbox s'est arrêtée sur le test workerd local
sans diagnostic détaillé ; la suite complète relancée hors restrictions
du sandbox a réussi. Aucun code ni test modifié pour contourner cet arrêt.
Le build connecté est conservé pour GitHub Pages, sans R2.
Commit/push explicitement autorisés par Lu’uma. La propagation sera contrôlée
par comparaison SHA-256 et des octets du HTML servi avec index.html local.
Le résultat de cette vérification sera consigné dans la documentation finale.
Recette physique A à H : aucune manipulation humaine encore confirmée pour
v0.4A. Ne pas confondre les contrôles automatisés avec des scans réels.
