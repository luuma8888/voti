# Voti

## v0.6 — Espaces & groupes

v0.6 publiée et validée humainement ; historique dans le rapport de déploiement.
Le lot **v0.6.1 UX** reste strictement local, non publié : création guidée/rapide,
clarification des résultats, groupes/membres, cartes/invitations et scanner.
Voir [le rapport v0.6.1](docs/CODEX_V0_6_1_UX_REPORT.md).

Mode libre v0.5.1 préservé ; zone distincte Espaces, groupes, rôles, cartes membre
temporaires, snapshots et une participation par membre. Pas de comptes enfant
classiques ni de garantie d’identité civile ; séparation applicative anonyme, pas E2E.
Documentation : `docs/SPACES_GROUPS_V0.md`, `docs/MEMBER_CARDS_V0.md`,
`docs/GROUP_VOTING_PRIVACY_V0.md`, rapport `docs/CODEX_SPACES_GROUPS_V0_6_REPORT.md`.

Commandes supplémentaires : `npm run test:spaces` (vrais Worker/D1 locaux + Chromium)
et `npm run test:member-cards` (après test:spaces, Poppler 300 dpi et QR redécodés).
jsQR 1.4.0 déjà utilisé en tests devient une dépendance runtime Apache-2.0 : lecture
de cartes locale sans scanner/CDN/service externe ; licence intégrée au HTML.
La migration additive 0004 préserve les colonnes historiques. Elle est déjà appliquée
avec v0.6 ; v0.6.1 ne modifie ni migration ni Worker et n'est pas déployée.
Le backup JSON général reste limité au mode libre, sans cartes/accès Espaces/designs.

v0.5 participation/commentaires : **pilote publié et validé humainement par Lu’uma**.
Nouveaux sondages anonymes avec commentaire facultatif privé par défaut ; identité
déclarée optionnelle, jamais vérifiée. Pas de compte ni d'unicité par personne.
Guides : [participation](docs/PARTICIPATION_V0.md),
[commentaires et identité](docs/COMMENTS_AND_IDENTITY_V0.md).
Migration D1 0003 puis Worker compatible déployés avant Pages ; profil Free
sans R2 conservé. Recette et trois réserves UX pour le prochain lot :
[rapport v0.5](docs/CODEX_PARTICIPATION_V0_5_REPORT.md).
Les indications d'état des anciens lots ci-dessous décrivent leur historique.

Studio v0.4C : couleurs palette/personnalisé synchronisées, typographies
titre/corps prévisualisées, densité/QR, surfaces et cadrage focal local.
Guide : `docs/POSTER_STUDIO_POLISH_V0.md`. Après `npm run test:browser`,
`npm run test:poster-polish` vérifie les nouveaux PDF avec Poppler et jsQR.

Le **pilote textuel v0.3D est validé par la recette Chromebook ↔ téléphone de
Lu’uma** : publication Turnstile réelle, vote, seuil, verrouillage, style,
fermeture, transfert de clé et suppression. Le site est publié sur
[GitHub Pages](https://luuma8888.github.io/voti/) ; Worker et D1 UE sont déployés.
Les trois gates et les deux micro-corrections de recette ont été explicitement
autorisés. Arbitrage validé :
Workers **Free seulement**, pas de R2 ni d'images utilisateur distantes ; les
images locales restent disponibles. État précis et gates :
[guide du pilote gratuit](docs/PRODUCTION_DEPLOYMENT_V0.md) et
[rapport final, limites et observations](docs/PRODUCTION_PILOT_REPORT_V0.md).
Ce pilote contrôlé n'est pas une validation de charge/sécurité pour une ouverture large.
Le lot v0.4A ajoute le partage QR et les affiches A4, sans modifier le relais.
Son audit est validé ; la recette physique reste à confirmer étape par étape
après publication. Voir [QR et affiches](docs/QR_AND_POSTER_V0.md).
Les indications v0.3C suivantes décrivent le socle local historique.

v0.4B est préparé **localement, non publié** : QR par choix vers confirmation
directe sans vote automatique, Studio d’affiches et PDF des résultats autorisés.
Voir [Studio](docs/POSTER_STUDIO_V0.md) et [résultats PDF](docs/RESULTS_PDF_V0.md).
Les médias d’affiche restent sur l’appareil et hors backup général ; pas de R2.

Prototype de sondages locaux pour choisir ensemble. Création guidée, 2 à 6 choix,
vote confirmé, verrouillage au premier bulletin accepté et résultats conditionnels.

v0.3C durcit le relais HTTP optionnel Worker/D1/R2, testé **uniquement en local** :
Turnstile à la création, quota indépendant des capacités, cache/quota par image,
suppression distante, nettoyage cron et transfert explicite des clés secrètes.
À cette étape historique, aucun service distant n'était déployé et le HTML
restait sans relais configuré. L'état actuel v0.3D est indiqué en tête de page.
Voir [le guide local](docs/CLOUDFLARE_RELAY_V0.md),
[les instructions de déploiement non exécutées](docs/CLOUDFLARE_DEPLOYMENT_V0.md)
et [le rapport v0.3C](docs/CODEX_RELAY_V0_3C_REPORT.md).

L'accueil v0.2A présente une liste compacte avec recherche (question, description,
choix), filtres de statut/résultats et tri. Les résultats sont accessibles directement
depuis cette liste. Navigation : Accueil, Nouveau sondage et Sauvegarde, avec barre
inférieure sur mobile. Les filtres restent en mémoire pendant la navigation locale.

## Utilisation

Ouvrir `index.html` dans un navigateur moderne. Le fichier est autonome et utilisable
hors connexion : HTML, CSS et modules JavaScript sont intégrés, sans CDN ni framework.
Les navigateurs doivent prendre en charge les modules ESM, les import maps, Web Crypto
et localStorage. Les images utilisateur nécessitent aussi IndexedDB, Web Locks,
createImageBitmap et canvas. Chromium a été vérifié sur fichier local. La persistance sous `file://`
dépend du navigateur et du chemin du fichier ; ne pas déplacer ce fichier sans exporter.

Sans relais configuré, les votes sont collectés dans ce navigateur uniquement. Aucun QR partagé, compte ou
vote nominatif. Le propriétaire de l’appareil peut inspecter les bulletins ; aucune
garantie d’anonymat fort ou d’unicité par personne. Le compteur est masqué par défaut
avant publication des résultats. En mode fermeture, le seuil reste obligatoire.

## Développement

Node.js 20 ou supérieur pour lancer npm. `npm install` installe les outils de
développement verrouillés, dont Node 22 local au dépôt et Wrangler (qui exige Node ≥22).
Les scripts npm utilisent ce Node local. Aucune dépendance réseau à l'exécution du mode local.

```sh
npm run build        # régénère index.html à partir des sources
npm run build:production # HTML connecté au pilote ; après validation Worker/Gate B
npm run dev          # build puis http://127.0.0.1:4173
npm test             # node:test : métier, import/export, stockage et build
npm run check        # vérification de syntaxe
npm run test:browser # parcours Chromium via un profil isolé dans le dépôt
npm run worker:migrate # migrations D1 locales seulement
npm run worker:local   # Worker + D1/R2 locaux sur 127.0.0.1:8787
npm run test:relay     # tests HTTP/D1/R2 locaux, avec redémarrage
npm run test:integration # même suite + deux contextes navigateur
npm run test:free-pilot # HTTP/D1 SANS R2 + deux contextes Chromium, local seulement
npm run test:poster # après test:browser : Poppler à 300 dpi + décodage des QR PDF
npm run test:poster-studio # vrais PDF Studio/résultats, Poppler et QR redécodés
npm run worker:cleanup # scheduled explicite du Worker local
npm run audit:bundle # ZIP léger, uniquement fichiers Git admissibles, après tests/rapport
```

Relancer `npm run dev` après modification des sources. Le serveur de développement
écoute uniquement sur localhost ; à lui seul, il ne fournit aucune collecte réseau partagée.
Pour l'associer au Worker local, voir le guide. Exécuter tests et builds séquentiellement :
ils régénèrent le même HTML. Terminer par `npm run build` sans variables pour revenir
au mode local, ou par `npm run build:production` pour conserver le HTML du pilote
avant toute publication autorisée. Ne pas pousser un build de tests à la place du pilote.
Les tests navigateur demandent un exécutable Chromium (`/usr/bin/chromium` par défaut,
configurable par `VOTI_CHROMIUM`). Dans un sandbox, le lancement de Chromium ou l’écoute
locale peuvent nécessiter une autorisation d’exécution adaptée.

## Sources

- `shared/` : modèle, validation, moteur, publication et sérialisation sans DOM.
- `web/` : interface, styles et adaptateur de stockage.
- `relay/cloudflare/` : Worker, service D1/R2 et migrations locales versionnées.
- `scripts/` : construction one-file, esbuild seulement pour les bibliothèques QR/PDF, tests navigateur.
- `vendor/` : points d'entrée des bibliothèques npm embarquées (pas de CDN).
- `tests/` : jeux fictifs et tests avec `node:test`.
- `docs/LOCAL_MVP_DECISIONS.md` : arbitrages validés pour cette phase.
- `docs/CODEX_MVP_FOUNDATION_REPORT_V0.md` : livraison et vérifications.

L’empreinte SHA-256 couvre définition, accès et résultats, sans le style. Les bulletins
ne contiennent que trois identifiants et aucun horodatage. Les caches statistiques
sont recalculés. Le build emballe les modules dans une import map de data URLs :
le navigateur exécute les modules natifs sans requête externe.

## Sauvegarde

Ouvrir « Sauvegarde » puis « Exporter une sauvegarde » et conserver une copie hors du navigateur.
« Importer une sauvegarde » ouvre le choix de fichier. Les données JSON sont consultables
en lecture seule derrière « Options avancées » ; elles ne sont pas affichées à l'accueil.
L’export inclut les bulletins et les images référencées ; ce fichier doit être protégé comme vos données.
Il n'inclut ni les bulletins distants ni les capacités créateur du relais.
Pour celles-ci, gestion → « Exporter la clé d’administration », gestion/Sauvegarde
→ « Importer une clé d’administration ». Fichier SECRET séparé, vérifié auprès du
relais, sans écrasement silencieux. Toute personne le possédant peut supprimer
le sondage. Perdre toutes ses copies empêche la récupération par compte.
Le stockage local n’est pas une sauvegarde durable. L’import valide entièrement le
fichier avant écriture et accepte uniquement un espace vide ; aucune fusion ni
remplacement. Utiliser un autre profil vide pour tester une restauration, après export.

Le snapshot métier v0.5 est en schéma 3. Les anciennes données et sauvegardes v1/v2 sont
validées puis migrées de façon déterministe, sans réécriture des empreintes v2.
Les commentaires et identités locaux sont inclus : sauvegarde sensible.
La sauvegarde unique utilise le conteneur
`voti-backup`, `backupVersion: 1`, avec le snapshot et les images encodées. Il s'agit
toujours d'un format JSON de prototype, distinct de `.sondagebox`.
Version inconnue, références incohérentes, identifiants dupliqués, métadonnées de
bulletins supplémentaires et empreintes incompatibles sont refusés.

## Images et identité graphique

Le logo, le fond discret Voti Pop et la mascotte de bibliothèque vide sont intégrés
au build depuis `assets/branding/*.webp`. Les PNG source restent hors du HTML.
Les images utilisateur sont préparées localement puis stockées dans IndexedDB,
jamais comme blobs/base64 dans localStorage. JPEG, PNG et WebP fixes sont acceptés
(20 Mo et 24 mégapixels maximum à l'entrée). Les images sont réduites et réencodées :
1600 px / 1 Mo pour un sondage, 1000 px / 600 Ko pour un choix.

Les images restent facultatives et le texte des choix obligatoire. Ajouter, changer
ou retirer une image prend effet lors de l'enregistrement du sondage. Le premier
vote verrouille aussi les références d'images. Les thèmes restent modifiables.
La bibliothèque est bornée à 200 images distinctes et 24 Mo pour rester exportable
dans un fichier de 40 Mo maximum. Exportez régulièrement : IndexedDB peut aussi être effacé.
Voir `docs/CODEX_UX_V0_2B_2_REPORT.md` pour la migration et les garanties transactionnelles.
### Revue locale de l’interface Espaces v0.6.2

La gestion est organisée en Aperçu, Sondages, Membres, Groupes, Invitations et
Accès, avec fiches/formulaires ouverts à la demande. Cette évolution frontend
reste locale, sans déploiement ni modification du relais ou de D1.

`npm run test:space-ui` exécute des fixtures fictives contre D1/Worker locaux et
produit 24 captures de revue finale dans `.browser-tests/v062-final-review/`
(planche `index.html`) : Guidée en six étapes, Express court et Avancé secondaire. Les
20 anciennes captures de `.browser-tests/v062-review/` restent conservées pour
comparaison ; les nouveaux parcours partagent le même constructeur de brouillon.
Le [rapport v0.6.2](docs/CODEX_V0_6_2_SPACE_UI_REPORT.md) distingue tests automatiques,
inspection des captures et validation visuelle humaine encore attendue.

Le polissage post-commit produit sa revue dans `.browser-tests/v062-postcommit-review/`
sans écraser les séries précédentes. Après `npm run test:space-ui`,
`npm run test:card-polish` vérifie les PDF individuels/lot et leurs QR à 300 dpi.
Les [packs visuels membres/groupes](docs/MEMBER_VISUALS_V0.md) sont préparés avec
manifestes vides : aucun upload personnel, asset factice ou migration ajouté.

### Pack d'identités visuelles intégré (local avant audit/déploiement)

132 membres + 36 groupes, WebP originaux optimisés en trois tailles, choix facultatif
avec filtres et aperçu. Uniquement des IDs de catalogue sont persistés via la
migration additive locale 0005 ; aucun upload. Voir [la documentation des visuels](docs/MEMBER_VISUALS_V0.md).
Le dossier `byluuma/` sert aux transferts privés et est ignoré par Git/audit.

**Offline :** conserver `index.html` avec `web/assets/voti-visuals/` ; le HTML seul
ne contient pas les nouvelles images. `npm run dev` sert aussi le pack sous /voti/.
Aucun CDN ou service worker ajouté. `npm run test:visual-identities` teste le Worker/D1
local, les sélecteurs et produit les captures ; `npm run test:visual-pdf` redécode
les PDF illustrés à 300 dpi. Rapport : `docs/CODEX_V0_6_2_VISUAL_IDENTITIES_REPORT.md`.
