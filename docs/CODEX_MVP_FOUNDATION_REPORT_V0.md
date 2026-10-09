# Rapport de livraison — Fondation MVP Web local Voti

Date : 9 octobre 2026. Statut : fondation implémentée et vérifiée automatiquement.
Les validations humaines et les essais sur appareils réels restent à réaliser.

## 1. Périmètre livré

Parcours réel : créer un brouillon de 2 à 6 choix → publier dans le navigateur →
sélectionner → confirmer → enregistrer le bulletin et verrouiller le fond →
consulter les résultats selon le seuil et, si choisi, la fermeture.

Le fond d'un sondage publié reste éditable avant son premier bulletin accepté.
Après verrouillage, seule l'apparence est éditable ; le sondage peut être fermé.
La fermeture est définitive dans cette interface. Aucun nom n'est demandé.
Le vote ne fonctionne que dans le navigateur possédant les données.

Les décisions humaines ont été consignées en premier dans `LOCAL_MVP_DECISIONS.md`.
Les deux grands documents historiques et `AGENTS.md` n'ont pas été modifiés.
Aucun commit ni push. Tous les fichiers du projet et profils Chromium ont été créés
dans Voti. Une exception à la contrainte de périmètre a été constatée : npm a créé
trois journaux techniques hors dépôt pendant les tests autorisés hors sandbox ; voir
la section « Écart de périmètre » ci-dessous.

## 2. Fichiers créés

| Fichier | Rôle |
|---|---|
| `.gitignore` | Exclure caches npm, profils de tests navigateur, dépendances et journaux |
| `.npmrc` | Garder désormais le cache et les journaux npm dans le dépôt |
| `package.json` | Scripts et version minimale Node, sans dépendance |
| `package-lock.json` | Métadonnées npm, aucune dépendance externe |
| `docs/LOCAL_MVP_DECISIONS.md` | Onze arbitrages validés et exclusions |
| `docs/CODEX_MVP_FOUNDATION_REPORT_V0.md` | Présent rapport |
| `shared/model.js` | Valeurs par défaut, sérialisation canonique, SHA-256 et recomptage |
| `shared/validation.js` | Validation exhaustive de structure, références et invariants |
| `shared/poll-engine.js` | Création, modification, publication, fermeture et vote |
| `shared/result-rules.js` | Projection autorisée des résultats sans distribution sous seuil |
| `shared/serialization.js` | JSON versionné, validation, export et import dans espace vide |
| `web/storage.js` | StorageAdapter, localStorage, transactions et gestion des erreurs |
| `web/app.js` | Parcours créateur, vote, confirmation, résultats, thèmes et sauvegardes |
| `web/index.template.html` | Gabarit sémantique de l'application française |
| `web/styles.css` | Interface pastel, responsive, jour/nuit et CSS d'impression |
| `scripts/build.mjs` | Emballage autonome des modules natifs dans le HTML |
| `scripts/dev.mjs` | Serveur statique de développement sur localhost uniquement |
| `scripts/check.mjs` | Vérification de syntaxe des sources, outils et tests |
| `scripts/browser-test.mjs` | Tests Chromium via protocole de débogage, sans bibliothèque |
| `tests/fixtures.js` | Petits jeux de données fictifs sans identité |
| `tests/poll-engine.test.js` | 13 tests du moteur |
| `tests/result-rules.test.js` | 11 tests de publication |
| `tests/serialization.test.js` | 19 tests JSON, intégrité et incohérences |
| `tests/storage.test.js` | 8 tests de stockage et transactions |
| `tests/build.test.js` | 3 tests de livraison autonome et rendu sûr |

## 3. Fichiers modifiés

- `README.md` : utilisation, commandes, architecture, sauvegarde et limites.
- `index.html` : page d'attente remplacée par la livraison autonome générée.
- `docs/MVP_SCOPE.md` : nominatif supprimé de l'interface, QR/affiches/PDF reportés,
  seuil obligatoire après fermeture, règles verrouillées et acceptation locale.
- `docs/DATA_MODEL_V0.md` : bulletins minimaux sans horodatage, empreinte étendue,
  paramètres actifs, format exécuté et contraintes techniques documentées.
- `docs/VOTE_MODES_MATRIX.md` : portée locale, absence de nominatif/QR, garanties limitées.
- `docs/UX_FLOWS_V0.md` : suppression du choix nominatif, édition avant premier vote,
  QR reportés et compteur masqué par défaut.

Des artefacts de vérification ont été produits uniquement dans `.npm-cache/` et
`.browser-tests/`, tous ignorés par Git. Les profils Chromium sont isolés des profils
réels et conservés pour inspection ; ils contiennent exclusivement les données fictives
des tests. Les chemins XDG, cache et profil du navigateur de test restent dans le dépôt.

## 4. Architecture réalisée

```text
Interface DOM (web/app.js)
          ↓
Repository + StorageAdapter (web/storage.js)
          ↓
Fonctions métier pures / validation / publication / sérialisation (shared/)
          ↓
Snapshot JSON validé → un setItem localStorage

Sources web + shared → build Node natif → index.html autonome
```

Le moteur ne dépend ni du DOM, ni du stockage, ni d'un relais. Chaque opération
prépare une copie de l'état d'entrée. Les fonctions renvoient explicitement un nouvel
état ou une erreur. L'horloge et les UUID de création sont injectables dans les tests.

Le repository sérialise les actions, relit le stockage avant mutation, valide entièrement
l'état candidat, puis écrit un seul snapshot. Une erreur ne remplace pas l'état validé
en mémoire et ne déclenche pas de confirmation de réussite. Une corruption à l'ouverture
affiche une erreur et une récupération du JSON brut, sans réinitialisation silencieuse.

Les Web Locks sont utilisés lorsqu'ils existent pour coordonner plusieurs onglets du
même navigateur. Un contrôle de snapshot détecte également les changements avant écriture.
Sans Web Locks, la sérialisation est garantie dans l'onglet ; le contrôle lecture/écriture
localStorage ne constitue pas une transaction garantie entre plusieurs processus.
Privilégier un seul onglet actif, notamment sur les navigateurs dont le comportement
sur `file://` diffère. Cela n'est pas une synchronisation distribuée.

Le verrouillage et le bulletin sont préparés ensemble, puis persistés ensemble.
L'empreinte SHA-256 utilise Web Crypto et couvre `{ definition, accessRules, resultRules }`.
Elle exclut le style, les statistiques et le statut de cycle de vie.
La représentation JSON canonique trie les clés, sans implémenter de cryptographie maison.
Une altération des propriétés verrouillées est refusée à la lecture/import.

Un bulletin contient uniquement `id`, `pollId`, `choiceId`. Aucun nom, session, IP,
fingerprint, source ou horodatage. La confirmation conserve un identifiant d'action
pour dédupliquer un double envoi ; un identifiant distinct reste un bulletin distinct.
La sélection, la navigation et le chargement ne soumettent aucun bulletin.

Les résultats sont recalculés depuis les bulletins. Sous les conditions de publication,
la projection ne contient ni distribution ni compteur par défaut. Le navigateur héberge
néanmoins les données brutes : ce masquage ne résiste pas à l'inspection du stockage,
et un export contient les bulletins même si les résultats ne sont pas publiables.

L'interface emploie exclusivement `textContent`, `value` et la création de nœuds DOM
pour les textes saisis/importés. Aucun sink HTML, eval, URL utilisateur exécutable ou
CSS arbitraire. Les liens de navigation sont des fragments construits avec des UUID.

## 5. Dépendances et build

Aucune dépendance npm ajoutée, ni en production ni en développement. Aucun framework,
CDN, police distante, analytics ou ressource réseau requise à l'exécution.

Node.js v20.19.2 et npm 9.2.0 étaient accessibles au démarrage de cette phase.
Chromium installé dans l'environnement sert uniquement aux tests navigateur.

Une vérification initiale d'esbuild via npm a échoué sur la résolution DNS du registre
(`EAI_AGAIN`). Aucun paquet n'a été installé. La livraison n'en dépend pas :
le build lit les modules locaux, réécrit leurs imports statiques vers des identifiants
stables et les emballe dans une import map de data URLs intégrée au HTML.
Le navigateur conserve son exécution native des modules ESM ; aucun chargement externe.

Ce build volontairement limité n'est pas un compilateur général : imports statiques
relatifs nommés, sans import dynamique, paquet tiers ou transpilation. Un élargissement
futur du langage de build devra être spécifié ou confié à esbuild. Les navigateurs
doivent prendre en charge les import maps, ESM, Web Crypto et structuredClone.

## 6. Commandes disponibles

| Commande | Comportement |
|---|---|
| `npm run build` | Régénère `index.html`, déterministe et autonome |
| `npm run dev` | Construit puis sert sur `http://127.0.0.1:4173` |
| `npm test` | Lance les cinq fichiers de tests avec `node:test` |
| `npm run check` | Contrôle la syntaxe des 17 fichiers JavaScript |
| `npm run test:browser` | Construit puis vérifie le fichier dans Chromium isolé |

Pas de `npm install` nécessaire pour travailler. Le lockfile a été généré avec
`npm install --package-lock-only --ignore-scripts --offline --cache .npm-cache --no-audit --no-fund`.
Le serveur de développement doit être relancé après modification des sources.
Ouvrir directement `index.html` permet l'usage hors connexion.

## 7. Tests exécutés et résultats

Résultat final : **54 tests Node, 27 contrôles Chromium et 4 contrôles du serveur local réussis**.
Aucun échec final, test ignoré ou test marqué TODO.

`npm test` passe pour les cinq fichiers. Dans cet environnement sandboxé, le reporter
agrégé représente les cinq fichiers ; les exécutions directes `node tests/<nom>.test.js`
ont aussi confirmé les décomptes individuels indiqués dans l'inventaire (54 au total).

Couverture métier et stockage :

- création avec 2 et 6 choix ; refus de 1, 7 et textes vides ;
- refus de voter en brouillon ou après fermeture ;
- publication invalidée par une définition incorrecte ; transitions répétées refusées ;
- premier vote accepté : état d'entrée intact, verrouillage/empreinte/bulletin cohérents ;
- vote invalide : aucun verrouillage ni bulletin ; identifiant inexistant et choix étranger refusés ;
- modification après publication avant premier vote ; fond et règles refusés après verrouillage ;
- style modifiable après verrouillage et fermeture, empreinte inchangée ;
- empreinte sensible à définition, mode, privacy, règles d'accès et résultats ;
- résultats masqués à 0 et 4, visibles à 5 et 6 ; cache statistique sans influence ;
- `closed` bloqué avant fermeture et sous seuil, y compris à 3 réponses après fermeture ;
- idempotence d'un même envoi, refus de réutiliser son identifiant avec un autre choix ;
- aller-retour JSON ; validation des versions, références, UUID, chronologie, métadonnées et hash ;
- import refusé sur espace occupé et en cas de données incohérentes ; caches recalculés ;
- aucune écriture lors d'une lecture ou d'une transaction invalide ;
- échec/quota du stockage sans fausse sauvegarde ; corruption sans réinitialisation ;
- actions concurrentes locales sérialisées, modification externe détectée,
  coordination de deux repositories avec un gestionnaire de verrous simulé ;
- build autonome, déterministe, styles responsive/nuit/impression et absence de sinks HTML.

Contrôles navigateur via DOM réel dans Chromium : création guidée sans double création,
publication, édition publiée avant vote, sélection sans vote, confirmation par double clic
avec un seul bulletin, refus d'édition verrouillée, changement de thème, résultats aux seuils,
fermeture sous seuil, textes saisis/importés ressemblant à du HTML sans exécution,
jour/nuit, import invalide sans écriture, collision sans remplacement et restauration valide.
Contrôles complémentaires : largeur 360 px sans débordement, CSS d'impression appliquée,
ouverture `file://` réseau coupé et absence de requête HTTP externe de la page.
Aucune exception JavaScript navigateur lors du scénario final.

Le serveur de développement a été démarré puis arrêté pour vérifier : `/` et `/voti/`
répondent 200 ; un document hors des routes autorisées répond 404 ; POST répond 405.
L'environnement interdit certaines opérations de processus et l'écoute localhost en sandbox :
les essais Chromium et serveur ont été exécutés avec une autorisation adaptée, sans changer
leurs fichiers ou leurs fonctionnalités. Les profils sont restés dans le dépôt.

`npm run check` : succès sur 17 fichiers. `git diff --check` : aucun problème d'espacement.

Les premiers essais ont identifié un message d'erreur d'import persistant après succès ;
il a été corrigé et le scénario de restauration a été rejoué avec succès. Une attente
de navigation du harnais a également été corrigée. Les résultats ci-dessus concernent
le code final après corrections.

## 8. Limites connues et tests non exécutés

- Pas de collecte entre appareils, QR, PDF, relais, comptes, groupes ou authentification.
- Pas d'unicité par personne, d'anonymat fort, de cryptographie avancée ou de synchronisation.
- localStorage peut disparaître ; export obligatoire pour une sauvegarde indépendante.
- Aucun secret fourni par l'application ; les exports contiennent néanmoins tous les bulletins.
- Import dans un espace vide uniquement ; aucune suppression, fusion, remplacement ou migration.
- Les résultats masqués sont inspectables par le propriétaire de l'appareil dans le JSON brut.
- Un hash peut être recalculé par une personne qui modifie le stockage : pas de signature.
- L'ordre du tableau des bulletins reste un ordre d'enregistrement ; ce prototype ne prétend
  pas empêcher les déductions par observation de la séance.
- Fichier local : stockage lié au navigateur et au chemin ; déplacer le HTML peut changer
  l'espace de stockage. Certaines politiques de navigateur peuvent bloquer la persistance.
- Préférences jour/nuit stockées séparément ; leur échec n'empêche pas le vote.
- Thèmes simples uniquement ; description/emoji du modèle n'ont pas d'éditeur dédié.
- Firefox, Safari, appareils mobiles physiques, lecteur d'écran, impression papier,
  essais enfants et restauration humaine sur un autre profil n'ont pas été exécutés.
- Le contrôle mobile est une émulation Chromium à 360 px, pas un test sur téléphone réel.
- Pas de service worker ni promesse d'ouverture hors ligne d'une URL GitHub Pages jamais chargée.
  Le fichier HTML téléchargé est autonome ; aucun déploiement GitHub Pages n'a été effectué.

## 9. Écarts par rapport aux documents

### Écart de périmètre — journaux npm

Les trois appels à `npm run test:browser` autorisés hors sandbox ont écrit des journaux
automatiques dans le cache npm utilisateur, malgré la consigne de ne rien modifier
hors du dépôt. Ces fichiers ont été identifiés par leur titre `npm run test:browser` :

- `/home/luuma/.npm/_logs/2026-10-09T08_17_35_334Z-debug-0.log`
- `/home/luuma/.npm/_logs/2026-10-09T08_18_59_909Z-debug-0.log`
- `/home/luuma/.npm/_logs/2026-10-09T08_21_05_913Z-debug-0.log`

Ils n'ont pas été supprimés : une suppression hors dépôt ne serait pas autorisée
par le périmètre actuel. La configuration `.npmrc` créée dans Voti fixe désormais
`cache=.npm-cache` pour les prochaines commandes. Ce sont des journaux d'outil,
pas des fichiers applicatifs, mais leur création constitue bien un écart à la consigne.

### Adaptations fonctionnelles et techniques

Les écarts fonctionnels historiques (nominatif, QR, horodatages, fermeture et empreinte)
correspondent exclusivement aux arbitrages validés, consignés puis reportés explicitement
dans les quatre documents actifs. Les documents historiques restent inchangés.

JavaScript/JSDoc remplace les types TypeScript envisagés dans le plan historique,
conformément à la stack validée. Pas de JSON Schema séparé dans cette livraison :
les validateurs exécutables et le contrat documenté sont la source de validation.
Pas d'esbuild : bundling natif sans dépendance, autorisé par le choix « si nécessaire ».
Le vocabulaire de l'interface décrit le prototype local sans promettre un vote secret fort.

La stratégie d'import la plus simple a été retenue : tout espace non vide est refusé,
même si les identifiants du fichier sont différents. Cela évite toute fusion implicite.
Les contraintes de taille et de longueur sont documentées dans `DATA_MODEL_V0.md`.

## 10. Validation humaine et blocages

Aucune décision fonctionnelle manquante n'a bloqué cette livraison. Les onze arbitrages
validés ont été appliqués. Aucun nouveau fournisseur ni compte externe à choisir.

À valider par essais réels avant le lot suivant : compréhension du parcours de création
et de confirmation ; formulation des limites du prototype ; compréhension de fermeture
ET seuil ; lisibilité sur petit téléphone et au clavier ; export puis restauration dans
un profil vide. Ces essais valident l'usage et n'annulent pas les règles déjà actées.

## 11. Recommandations pour le lot suivant

1. Tester cette fondation dans Chromium et Firefox, puis sur les appareils cibles.
2. Vérifier humainement le parcours, les refus et une restauration depuis un export.
3. Corriger les retours UX/accessibilité avant d'élargir le périmètre.
4. Préparer ensuite le contrat d'un relais interchangeable, sans l'implémenter sans
   instruction de changement de phase. Le vrai QR de vote partagé doit attendre ce relais.
5. Maintenir les tests d'invariants lors de toute future extension : comptes, stockage
   natif, permissions et anonymat demanderont leurs propres validations.

Ne pas commencer Android, synchronisation distribuée, chiffrement avancé ou studio
d'affiches complexe à partir de cette seule fondation.
