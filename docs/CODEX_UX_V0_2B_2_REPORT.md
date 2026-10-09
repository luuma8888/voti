# Voti v0.2B.2 — Branding, images et assets locaux

## Livraison et architecture

Ce lot intègre les trois WebP de marque fournis, les images facultatives des sondages et des choix, le stockage binaire IndexedDB, la migration du schéma et une sauvegarde unique contenant les assets. Les règles de vote, de publication des résultats et les bulletins anonymes minimaux sont conservés. Aucun compte, upload distant, relais, QR, PDF, Android ou synchronisation distribuée.

Les quatorze documents demandés ont été lus intégralement avant modification. Le plan a été établi après inspection du modèle, de la validation, du repository, du build et du parcours existant. `VOTI_UX_V0_2B_2_SPEC.md` fait autorité. Au démarrage, seuls `assets/` et cette spécification étaient non suivis ; ils ont été préservés.

```text
Fichier JPEG/PNG/WebP
  → contrôle du format et des dimensions
  → décodage navigateur + orientation + canvas + réencodage
  → asset temporaire en mémoire
  → Repository sous Web Lock
      → validation du snapshot et de toutes ses références
      → écriture atomique du lot d'assets dans IndexedDB
      → publication du snapshot localStorage
      → nettoyage des assets devenus orphelins

shared/ : modèle, migration, contrat d'assets, validation et backup, sans DOM
web/    : IndexedDB, traitement d'image, URLs objet, interface et repository
build   : modules et trois WebP de marque → index.html autonome
```

## AssetAdapter et identités

`shared/assets.js` définit `AssetAdapter` : `put`, `get`, `has`, `delete`, `putMany`, `deleteMany`, `listMetadata`, `collectOrphans`. Les opérations par lot sont atomiques. `get` retourne un enregistrement binaire ou `null` ; le listage ne retourne que les métadonnées. Import/export utilisent ces primitives, sans dépendre d'IndexedDB. `MemoryAssetAdapter` fournit une implémentation de contrat pour les tests, avec quota injectable.

Un enregistrement contient exactement :

```text
id: "sha256-" + SHA-256 hexadécimal des octets normalisés
formatVersion: 1
mimeType: image/webp | image/png
width, height, byteLength
blob: Blob
```

L'identifiant est lié au contenu, plutôt qu'à un emplacement remplaçable. Un remplacement d'image produit une nouvelle référence. L'empreinte sémantique du sondage lie ainsi les règles verrouillées aux octets de l'image. Les écritures valident format, dimensions, taille et hash avant toute transaction. Une écriture idempotente peut restaurer les mêmes octets vérifiés ; elle ne peut pas substituer un contenu différent sous un même ID. Une image identique partagée n'est stockée et exportée qu'une fois.

SHA-256 utilise Web Crypto, sans cryptographie maison. Les UUID des sondages, choix et bulletins ne changent pas. Ce mécanisme n'est pas une signature ni une protection contre un propriétaire capable de réécrire l'ensemble du stockage et des empreintes.

## IndexedDB et séparation du stockage

`web/asset-storage.js` implémente le contrat avec IndexedDB natif, sans dépendance. Base version 1, store `assets`, clé `id`. Les opérations de lecture utilisent des transactions readonly ; les lots d'écriture et suppression utilisent des transactions readwrite. Une promesse d'écriture ne réussit qu'à `transaction.oncomplete`, pas au premier succès d'une requête. Un abort rejette le lot.

Sur HTTP/HTTPS, le nom de base est `voti.assets.v1`. En `file://`, il est suffixé par `:file:` et le chemin encodé du HTML. Cette isolation évite qu'une autre copie du HTML, dont le localStorage peut être distinct, nettoie les images du premier fichier si IndexedDB partage son origine. Déplacer le HTML nécessite toujours une sauvegarde/restauration ; le chemin fait partie de l'espace de stockage local.

Les sondages restent dans la clé historique **`voti.local.v1`**, sans blob, URL objet ou base64. Garder cette clé permet de retrouver et migrer les données existantes ; son suffixe historique ne désigne plus la version du snapshot. Les assets de marque ne sont jamais placés dans IndexedDB.

Les erreurs de quota indiquent explicitement que l'espace pour les images est insuffisant. Les accès indisponibles ou transactions avortées sont signalés. Les navigateurs doivent fournir IndexedDB et Web Locks pour enregistrer des sondages illustrés. Un navigateur sans ces fonctions peut encore utiliser les sondages sans image ; il ne reçoit pas une fausse garantie de transaction inter-onglets pour les images.

## Schéma 1 → schéma 2

Le snapshot actif est `{ schemaVersion: 2, polls, ballots }`, avec chaque sondage en version 2.

- `PollDefinition.pollImageAssetId` est ajouté : référence d'asset ou `null`.
- `Choice.imageRef`, déjà réservé en v1, accepte désormais une référence d'asset ou `null`.
- Les références appartiennent à la définition, jamais au style.
- Le premier bulletin accepté verrouille ces références avec les autres propriétés sémantiques.
- Les images sont modifiables sur brouillon et sondage publié sans bulletin ; l'édition sémantique d'un sondage fermé reste refusée, comme auparavant.
- Les thèmes et accents restent modifiables après verrouillage.

Migration déterministe dans `shared/migration.js` :

1. Valider complètement le v1, ses champs autorisés, références, chronologie et anciennes empreintes.
2. Copier l'état, passer les versions du snapshot et des sondages à 2.
3. Ajouter `definition.pollImageAssetId = null`. Les anciens `Choice.imageRef` restent `null` ; un ancien v1 comportant une image est refusé.
4. Recalculer l'empreinte des sondages déjà verrouillés, après vérification de l'ancienne empreinte. Elle change parce que la définition comporte un champ sémantique supplémentaire.
5. Valider le v2 ; conserver UUID, bulletins, dates, statuts, règles et styles. Les caches statistiques restent recalculés depuis les bulletins.

La source n'est pas mutée. La lecture migre en mémoire sans écriture automatique du snapshot ; le prochain enregistrement persiste le v2. Les exports contiennent le v2. Les anciennes sauvegardes restent importables. Versions inconnues, structures mixtes ambiguës ou anciennes empreintes altérées sont refusées. L'ancienne application v1 ne sait pas lire le nouveau v2 : la compatibilité est ascendante, pas rétroactive.

## Traitement local des images

`shared/image-format.js` reconnaît les signatures et les dimensions des JPEG, PNG et WebP avant décodage. Le type déclaré doit correspondre au contenu lorsqu'il est fourni. SVG, tous les GIF, formats inconnus, PNG animés/APNG et WebP animés sont refusés.

Entrée bornée à **20 000 000 octets**, **24 millions de pixels** et **16 384 px par côté**. Ces bornes évitent de décoder une image manifestement disproportionnée ; elles ne garantissent pas qu'un appareil très contraint pourra traiter tout fichier situé sous la limite.

`web/image-processing.js` décode réellement avec `createImageBitmap` et `imageOrientation: 'from-image'`, puis dessine les pixels orientés dans un canvas. Le réencodage retire notamment EXIF, XMP et noms de fichier d'origine. Le profil colorimétrique standard éventuellement ajouté par l'encodeur reste accepté : ce n'est pas une recopie des métadonnées EXIF de l'utilisateur.

| Usage | Côté long maximum | Fichier final maximum |
| --- | ---: | ---: |
| Sondage | 1600 px | 1 000 000 octets |
| Choix | 1000 px | 600 000 octets |

La sortie demandée est WebP, qualité initiale 0,86. Si elle dépasse la limite, la taille est réduite par étapes de 0,75 et la qualité diminue, avec au plus sept essais. Le PNG est le repli natif de `canvas.toBlob` lorsque WebP n'est pas encodable. Un fichier restant trop grand est refusé. Aucune image n'est agrandie. Les bitmaps sont fermés et le canvas libéré après traitement.

La bibliothèque est bornée à **200 assets distincts référencés** et **24 Mo binaires**, vérifiés avant enregistrement afin de conserver la possibilité d'une sauvegarde unique. Une image partagée par sondage et choix respecte la limite du choix, plus stricte.

## UX et accessibilité

L'étape Question propose l'image du sondage ; l'étape Réponses propose une image par choix. Chaque contrôle comporte Ajouter une image, aperçu, Changer l'image, Retirer l'image, état de traitement et message d'erreur. L'image reste facultative et les textes restent obligatoires. Continuer est refusé pendant un traitement en cours, avec explication.

Les images préparées restent dans la session d'édition en mémoire jusqu'à l'enregistrement final. Annuler ou quitter cette session n'écrit aucun blob. Remplacer ou retirer une image dans le formulaire prend effet à l'enregistrement, comme les autres propriétés du sondage ; les références existantes restent utilisables si l'enregistrement échoue.

Les images sont présentées dans le récapitulatif de création, la gestion, le vote et sa confirmation. La bibliothèque utilise une vignette bornée à 56 × 56 px. Les choix conservent leur bouton radio et leur texte ; la sélection conserve bordure et indicateur natif. Les images utilisent `object-fit: contain`, sans recadrage supprimant une partie du sens.

Les illustrations redondantes avec leur texte ont un alt vide ; l'illustration du sondage est nommée dans les vues de gestion/vote. Une image non chargée affiche « Image indisponible » sans désactiver le choix textuel. Les aperçus ne créent aucun vote. Les URLs `blob:` sont locales, propres aux vues et révoquées lorsque les vues sont retirées ou lorsqu'une image échoue. Elles ne sont jamais enregistrées comme références.

Les cinq thèmes, focus clavier, contrôles de 44 px, recherche/tri mobile et liste compacte sont conservés. L'édition des images est absente après verrouillage et le moteur refuse aussi une tentative directe.

## Sauvegarde unique et validation

Format :

```json
{
  "format": "voti-backup",
  "backupVersion": 1,
  "state": { "schemaVersion": 2, "polls": [], "ballots": [] },
  "assets": []
}
```

Dans chaque asset exporté, `blob` est remplacé par `base64`. Seules les images référencées sont exportées, une fois par ID. Limite de fichier : **40 000 000 octets** ; le snapshot métier garde sa limite existante de 2 millions de caractères. Il ne s'agit pas encore du futur `.sondagebox`.

L'export prend le même verrou que les écritures et relit l'état courant. Il vérifie les assets référencés avant de proposer le fichier. Une image manquante ou corrompue n'est pas ignorée en silence. Le JSON complet reste uniquement derrière Options avancées.

Avant import : parser, vérifier la version et la structure entière, migrer si nécessaire, vérifier toutes les références, l'unicité des assets, base64 canonique, tailles, signatures, dimensions déclarées, hash binaire et décodage réel de chaque image. Les assets absents, dupliqués, inutilisés ou corrompus sont refusés. Un snapshot v1 ou v2 sans images reste accepté sans conteneur. Le nouvel état n'est publié qu'après cette préparation complète et la réussite des écritures.

L'espace métier doit être vide ; aucune fusion ou substitution silencieuse. La condition est revérifiée sous le verrou au moment d'écrire. Le fichier exporté contient bulletins et images : il doit être conservé comme les données de l'utilisateur.

## Stratégie transactionnelle et orphelins

`Repository.transact` partage le Web Lock existant avec les autres écritures de sondages. Sous ce verrou : relecture, opération métier, validation/sérialisation complète, vérification des assets, écriture atomique du lot binaire, puis unique `setItem` du snapshot avec contrôle de concurrence. L'état mémoire n'est publié qu'après réussite du snapshot.

| Incident | Comportement |
| --- | --- |
| Validation ou décodage refusé | Aucune écriture d'asset ni de snapshot. |
| Quota/abort IndexedDB | Transaction binaire annulée, aucun nouveau snapshot publié. |
| Échec localStorage après écriture binaire | Relecture du snapshot courant et suppression des blobs non référencés, puis erreur ; les assets encore référencés restent conservés. |
| Nettoyage lui-même impossible | Erreur explicite « nettoyage en attente », sans faux succès ; reprise au prochain démarrage. |
| Nettoyage impossible après snapshot publié | L'enregistrement reste un succès ; un avertissement signale le nettoyage restant. |
| Arrêt entre écriture des blobs et publication du snapshot | Au prochain démarrage, nettoyage des blobs non référencés par le snapshot validé. |
| Arrêt après publication du snapshot | Les blobs référencés sont conservés ; seuls les anciens orphelins sont supprimés. |
| Snapshot corrompu | Aucun nettoyage destructif n'est tenté à partir d'un état non validé. |

Les images temporaires d'autres onglets restent en mémoire tant qu'elles ne sont pas enregistrées. Le nettoyage coordonné par le repository relit toutes les références, sous le même verrou que les écritures. Une image partagée n'est retirée qu'après disparition de sa dernière référence. Les primitives brutes `delete` et `collectOrphans` de l'adaptateur restent internes : l'interface ne les appelle pas sans coordination.

**Limite explicite :** IndexedDB et localStorage ne proposent pas de transaction ACID commune. Il s'agit d'un protocole de publication ordonnée avec rollback et reprise, pas d'une garantie absolue contre toute perte électrique ou corruption indépendante des deux stockages. Si une API reste inaccessible, le nettoyage doit attendre son retour. Aucun stockage navigateur n'est considéré comme sauvegarde durable.

## Branding et build autonome

Les trois fichiers optimisés fournis sont utilisés sans modification. Le logo mesure 32 px dans le header et accompagne le vrai texte HTML Voti ; alt vide. Le header reste à 68 px desktop et 56 px mobile.

Le fond abstrait est une couche décorative de 420 px de haut, à opacité 0,12, réservée à Voti Pop. Il n'a ni animation ni parallax, ne capte pas les clics et reste derrière des surfaces principales opaques. Il apparaît surtout dans les marges desktop. Les autres thèmes gardent leurs fonds.

La mascotte est limitée à la bibliothèque vide, 88 × 79 px, alt vide, sans action ni répétition par sondage. Une bibliothèque contenant des sondages ne l'affiche pas.

`scripts/build.mjs` lit exclusivement les trois WebP, vérifie leur signature, les encode puis remplace les marqueurs du template/CSS. Aucun base64 volumineux n'est collé dans les sources applicatives. Les PNG de `assets/branding/source/` sont conservés mais jamais embarqués. Le HTML final contient exactement trois data URLs WebP de marque et les seize modules ESM locaux. Aucun CDN, police distante ou paquet npm ajouté. Les images utilisateur restent dans IndexedDB et ne font pas partie du build statique.

## Fichiers créés

- `shared/migration.js` : migration vérifiée v1 → v2.
- `shared/image-format.js` : signatures, dimensions et limites.
- `shared/assets.js` : contrat, identités de contenu, validation, références et adaptateur mémoire.
- `shared/backup.js` : conteneur versionné, validation complète, export et restauration.
- `web/asset-storage.js` : implémentation IndexedDB et isolation file.
- `web/image-processing.js` : décodage, orientation et réencodage local.
- `web/image-ui.js` : sélecteurs d'images et cycle de vie des URLs objet.
- `tests/assets.test.js` : 28 tests Node supplémentaires.
- `scripts/browser-assets.mjs` : 59 contrôles exécutés sur chacune des deux origines de test.
- `docs/CODEX_UX_V0_2B_2_REPORT.md` : présent rapport.

## Fichiers modifiés

- `shared/model.js`, `shared/validation.js`, `shared/poll-engine.js`, `shared/serialization.js` : version et références sémantiques, migration à la lecture.
- `web/storage.js` : coordination des deux stockages, rollback et nettoyage.
- `web/app.js`, `web/index.template.html`, `web/styles.css` : images, branding, sauvegardes et affichage.
- `scripts/build.mjs`, `scripts/browser-test.mjs` : intégration autonome et exécution des nouveaux scénarios.
- `tests/build.test.js`, `tests/themes.test.js` : branding intégré, seize modules, fond local autorisé.
- `README.md`, `docs/MVP_SCOPE.md`, `docs/DATA_MODEL_V0.md` : contrat actif, exigences navigateur et migration documentés.
- `index.html` : livraison autonome régénérée.

Les six fichiers graphiques fournis et `docs/VOTI_UX_V0_2B_2_SPEC.md` restent inchangés et non ajoutés à l'index Git. Aucun changement aux deux grands documents historiques. Aucun commit ni push.

## Tests et résultats exacts

Les 28 nouveaux tests Node couvrent CRUD/métadonnées/identités, quota et lot invalide sans état partiel, orphelins partagés, formats interdits et dimensions, migration déterministe de brouillon et sondage verrouillé, anciennes sauvegardes, empreintes et verrouillage d'images, style après vote, export/import sans et avec assets, absence/doublon/corruption/version/référence/dimensions, échec de décodage injecté, rollback localStorage, quota, reprise, collision sur espace occupé, échec de nettoyage explicite, snapshot corrompu, absence de Web Locks et isolation de fichiers locaux. Le nouveau test de build compare exactement les trois WebP aux octets embarqués et exclut les PNG source.

Le scénario Chromium images s'exécute en `file://` avec réseau coupé, puis sur `http://127.0.0.1:4173/voti/`. Il exerce les vrais décodeurs JPEG/PNG/WebP, dimensions et tailles de sortie, EXIF orientation 6, flux compressé corrompu, refus SVG/GIF et entrées excessives, IndexedDB réel et abort réel, quota simulé, ajout/remplacement/retrait par l'interface, affichage du vote, fallback d'image, confirmation, verrouillage, sauvegarde et restauration par fichier. Les cinq thèmes, logo, mascotte, surfaces opaques et fond discret sont vérifiés. Un rechargement supplémentaire confirme la persistance de l'image IndexedDB hors ligne.

Les tests précédents restent actifs : 20 sondages, recherche/filtres/tri, résultats conditionnels, double clic, refus d'édition verrouillée, textes HTML inertes, focus clavier, contrastes principaux des cinq thèmes, responsive 360/480/768/1200 px et absence de requête externe. Les nouvelles images sont testées à 360 px sur les cinq thèmes. Les quotas sont simulés ; le disque utilisateur n'est pas volontairement rempli.

| Commande | Résultat final |
| --- | --- |
| `npm test` | Succès, neuf fichiers de tests. |
| `node --test --test-reporter=tap tests/*.test.js` | 113 tests, 113 réussis, 0 échec, 0 ignoré, 0 annulé. |
| `npm run check` | Succès : 32 fichiers JavaScript. |
| `npm run build` | Succès : `index.html`, 412 565 octets, seize modules, trois WebP embarqués. |
| `npm run test:browser` | 343 contrôles réussis : 224 antérieurs, 59 images/branding sur chaque origine, 1 rechargement illustré offline. |
| `git diff --check` | Succès, aucune erreur d'espacement. |

Pendant le développement, les tests ont fait corriger un nettoyage dont la décision dépendait d'un état muté par l'opération, ainsi qu'une attente de récupération IndexedDB qui retardait l'installation de la navigation. Le validateur a été adapté au profil colorimétrique standard ajouté par l'encodeur WebP natif. Un lancement a aussi dépassé les 15 secondes du harnais avant réception de la réponse CDP de navigation ; sa relance a passé les 343 contrôles, sans modifier ce délai ni masquer l'erreur. Le plantage Linux signalé a conduit à vérifier les fichiers conservés et à relancer les contrôles avant clôture.

Captures inspectées : bibliothèque illustrée à 360 px (`.browser-tests/ux-v0-2b-2-images-360.png`) et liste Pop desktop avec logo/fond (`.browser-tests/ux-v0-2b-1-pop-1200.png`). Elles contiennent uniquement des fixtures. Profils, caches et captures restent dans les dossiers ignorés du dépôt. Aucune donnée réelle ni image utilisateur n'a été collectée pour les tests.

## Écarts, limites et validations humaines

Aucune fonctionnalité exclue n'est commencée. Les limites précises d'entrée, de bibliothèque et de sauvegarde sont des choix d'implémentation explicités ci-dessus. Tous les GIF, APNG et WebP animés sont refusés afin de conserver une image fixe sémantiquement stable. Les identifiants d'assets sont adressés par contenu ; les identifiants métier restent des UUID. Les anciennes données sont migrées en mémoire puis persistées lors de l'action suivante, pas réécrites au simple chargement.

Le décodage/réencodage utilise le thread du navigateur et peut prendre du temps sur un ancien téléphone. Le fallback PNG existe mais n'est pas forcé dans Chromium, qui encode WebP. Les tests ne constituent pas une garantie contre toute corruption matérielle ni un audit WCAG exhaustif. Le stockage peut être évincé ou rendu inaccessible par les politiques du navigateur. Un fichier déplacé ou ouvert dans un autre navigateur doit recevoir sa sauvegarde ; l'image ne voyage pas avec le HTML statique.

À valider humainement : rendu du logo et de la mascotte sur les appareils cibles ; confort de l'ajout/remplacement sur téléphone ; photos réelles orientées et transparentes ; qualité après compression ; lisibilité du vote illustré pour jeunes lecteurs ; Firefox/Safari, lecteur d'écran, zoom, Chromebook et faibles ressources ; téléchargement réel d'une sauvegarde et restauration dans un autre profil. Aucune décision métier manquante n'a bloqué la livraison.

## Conséquences pour le relais et Android

Le moteur reste indépendant du DOM et d'IndexedDB. Un futur adaptateur peut conserver les identités de contenu, les métadonnées et les opérations par lot, avec conversion Blob/octets dans un pont natif. Room ou un stockage de fichiers devra implémenter ses propres garanties de durabilité ; le protocole localStorage/IndexedDB ne doit pas être transposé aveuglément.

Un futur relais devra valider tailles, types, références et empreintes côté serveur, cloisonner l'accès aux assets selon les contextes et éviter de transformer les hashes en moyen public de découvrir des images. La déduplication locale ne définit pas une politique de partage entre contextes. Il faudra concevoir la publication coordonnée des sondages et assets et le nettoyage selon les références de tous les participants. Aucun de ces services n'est implémenté dans ce lot.
