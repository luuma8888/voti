# Voti

Prototype de sondages locaux pour choisir ensemble. Création guidée, 2 à 6 choix,
vote confirmé, verrouillage au premier bulletin accepté et résultats conditionnels.

## Utilisation

Ouvrir `index.html` dans un navigateur moderne. Le fichier est autonome et utilisable
hors connexion : HTML, CSS et modules JavaScript sont intégrés, sans CDN ni framework.
Les navigateurs doivent prendre en charge les modules ESM, les import maps, Web Crypto
et localStorage. Chromium a été vérifié sur fichier local. La persistance sous `file://`
dépend du navigateur et du chemin du fichier ; ne pas déplacer ce fichier sans exporter.

Les votes sont collectés dans ce navigateur uniquement. Aucun QR partagé, compte ou
vote nominatif. Le propriétaire de l’appareil peut inspecter les bulletins ; aucune
garantie d’anonymat fort ou d’unicité par personne. Le compteur est masqué par défaut
avant publication des résultats. En mode fermeture, le seuil reste obligatoire.

## Développement

Node.js 20 ou supérieur. Aucune dépendance npm à installer.

```sh
npm run build        # régénère index.html à partir des sources
npm run dev          # build puis http://127.0.0.1:4173
npm test             # node:test : métier, import/export, stockage et build
npm run check        # vérification de syntaxe
npm run test:browser # parcours Chromium via un profil isolé dans le dépôt
```

Relancer `npm run dev` après modification des sources. Le serveur de développement
écoute uniquement sur localhost ; il ne fournit aucune collecte réseau partagée.
Les tests navigateur demandent un exécutable Chromium (`/usr/bin/chromium` par défaut,
configurable par `VOTI_CHROMIUM`). Dans un sandbox, le lancement de Chromium ou l’écoute
locale peuvent nécessiter une autorisation d’exécution adaptée.

## Sources

- `shared/` : modèle, validation, moteur, publication et sérialisation sans DOM.
- `web/` : interface, styles et adaptateur de stockage.
- `scripts/` : construction native sans dépendance, outils et tests navigateur.
- `tests/` : jeux fictifs et tests avec `node:test`.
- `docs/LOCAL_MVP_DECISIONS.md` : arbitrages validés pour cette phase.
- `docs/CODEX_MVP_FOUNDATION_REPORT_V0.md` : livraison et vérifications.

L’empreinte SHA-256 couvre définition, accès et résultats, sans le style. Les bulletins
ne contiennent que trois identifiants et aucun horodatage. Les caches statistiques
sont recalculés. Le build emballe les modules dans une import map de data URLs :
le navigateur exécute les modules natifs sans requête externe.

## Sauvegarde

Exporter le JSON depuis l’accueil et conserver une copie hors du navigateur.
L’export inclut les bulletins ; ce fichier doit être protégé comme vos données.
Le stockage local n’est pas une sauvegarde durable. L’import valide entièrement le
fichier avant écriture et accepte uniquement un espace vide ; aucune fusion ni
remplacement. Utiliser un autre profil vide pour tester une restauration, après export.

Le format version 1 reste un format JSON de prototype, distinct de `.sondagebox`.
Version inconnue, références incohérentes, identifiants dupliqués, métadonnées de
bulletins supplémentaires et empreintes incompatibles sont refusés.
