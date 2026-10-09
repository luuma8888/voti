# Voti

Prototype de sondages locaux pour choisir ensemble. Création guidée, 2 à 6 choix,
vote confirmé, verrouillage au premier bulletin accepté et résultats conditionnels.

v0.3B ajoute un relais HTTP optionnel Worker/D1/R2, testé **uniquement en local**.
Aucun service distant n'est déployé. Le HTML livré reste sans relais configuré.
Voir [le guide local](docs/CLOUDFLARE_RELAY_V0.md),
[les instructions de déploiement non exécutées](docs/CLOUDFLARE_DEPLOYMENT_V0.md)
et [le rapport v0.3B](docs/CODEX_RELAY_V0_3B_REPORT.md).

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
npm run dev          # build puis http://127.0.0.1:4173
npm test             # node:test : métier, import/export, stockage et build
npm run check        # vérification de syntaxe
npm run test:browser # parcours Chromium via un profil isolé dans le dépôt
npm run worker:migrate # migrations D1 locales seulement
npm run worker:local   # Worker + D1/R2 locaux sur 127.0.0.1:8787
npm run test:relay     # tests HTTP/D1/R2 locaux, avec redémarrage
npm run test:integration # même suite + deux contextes navigateur
```

Relancer `npm run dev` après modification des sources. Le serveur de développement
écoute uniquement sur localhost ; à lui seul, il ne fournit aucune collecte réseau partagée.
Pour l'associer au Worker local, voir le guide. Exécuter tests et builds séquentiellement :
ils régénèrent le même HTML. Terminer par `npm run build` sans variables pour revenir au mode local.
Les tests navigateur demandent un exécutable Chromium (`/usr/bin/chromium` par défaut,
configurable par `VOTI_CHROMIUM`). Dans un sandbox, le lancement de Chromium ou l’écoute
locale peuvent nécessiter une autorisation d’exécution adaptée.

## Sources

- `shared/` : modèle, validation, moteur, publication et sérialisation sans DOM.
- `web/` : interface, styles et adaptateur de stockage.
- `relay/cloudflare/` : Worker, service D1/R2 et migrations locales versionnées.
- `scripts/` : construction native sans dépendance, outils et tests navigateur.
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
Le stockage local n’est pas une sauvegarde durable. L’import valide entièrement le
fichier avant écriture et accepte uniquement un espace vide ; aucune fusion ni
remplacement. Utiliser un autre profil vide pour tester une restauration, après export.

Le snapshot métier est en schéma 2. Les anciennes données et sauvegardes v1 sont
validées puis migrées de façon déterministe. La sauvegarde unique utilise le conteneur
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
