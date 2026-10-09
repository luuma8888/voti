# Consolidation du harnais navigateur — Fondation MVP Voti

Date : 9 octobre 2026. Statut : correction vérifiée, sans modification fonctionnelle.

## Cause exacte

Le harnais attendait la réponse de `Page.navigate`, puis exécutait `browserScenario`.
Cette réponse confirme la navigation demandée, mais ne garantit pas que le document
cible a terminé son chargement. Le contexte d'exécution pouvait encore correspondre
au document précédent, ou au nouveau document dont le DOM était incomplet.

Le premier prédicat appelait directement
`document.getElementById('app').textContent`. Si `#app` était absent, il levait le
TypeError signalé par l'audit indépendant au lieu de continuer à attendre.
L'ouverture offline avait aussi une attente de DOM lancée trop tôt : même avec un
accès optionnel à `#app`, elle pouvait être exécutée dans un contexte ensuite détruit
par la navigation. Une attente arbitraire ne garantissait pas le bon document.

La lecture du code établit cette course. L'ancien échec n'a pas été reproduit avant
modification dans cet environnement ; il est rapporté par l'audit indépendant.
Les tests ajoutés reproduisent les ordonnancements CDP dangereux et les DOM incomplets.

## Correction réalisée

Un helper partagé `scripts/browser-navigation.mjs` assure deux barrières distinctes :

1. **Chargement du document attendu.** `Page.setLifecycleEventsEnabled` active les
   événements CDP. L'écoute de `Page.lifecycleEvent` est installée avant l'envoi de
   `Page.navigate`. Les événements `load` sont conservés, y compris lorsqu'ils arrivent
   avant la réponse de navigation. Seul le `load` de la session, du frame et du loader
   renvoyés par la commande débloque le test. Un ancien document ou une autre session
   ne peut pas satisfaire cette attente. `Page.getFrameTree` vérifie ensuite l'URL,
   le frame et le loader réellement actifs.
2. **Initialisation de Voti.** Une évaluation dans ce document vérifie l'URL et
   `document.readyState === 'complete'`. Un `MutationObserver` attend `#app`, puis les
   contrôles de l'accueil initialisé : création et import. Une erreur applicative
   d'ouverture du stockage est signalée avec son message.

Les attentes sont bornées à 15 secondes par étape. Les timers constituent des délais
d'échec, pas des pauses avant d'exécuter le scénario. Le scénario démarre dès que les
conditions réelles sont satisfaites. Les abonnements et timers sont nettoyés.

Les erreurs distinguent : navigation impossible, document non chargé, document
inattendu, `#app` absent, initialisation Voti inachevée et initialisation en erreur.
Le lecteur de texte du scénario utilise aussi un accès optionnel pour éviter le
TypeError accidentel.

Le délai fixe de 100 ms après injection de fixtures a été supprimé. L'attente porte
désormais sur le rendu attendu après l'événement de stockage et la navigation locale.
Les sondages et le stockage de l'application n'ont pas été modifiés.

## Fichier offline et smoke test HTTP

Le parcours complet demeure exécuté sur `file://`, avec les 27 contrôles existants.
Le même mécanisme de navigation vérifie ensuite une nouvelle ouverture du HTML après
coupure réseau via CDP. Aucune requête HTTP de la page n'est autorisée durant ces essais.

Le harnais démarre ensuite le véritable `scripts/dev.mjs`, attend son signal de serveur
en écoute et ouvre `http://127.0.0.1:4173/voti/` dans Chromium. Une latence réseau CDP
de 250 ms est appliquée pour exercer un chargement plus lent ; elle ne sert pas à
synchroniser le test.

Quatre contrôles HTTP sont ajoutés :

- le bon document Voti est chargé à l'URL `/voti/` et l'accueil est initialisé ;
- aucun état métier n'est écrit lors du chargement ;
- le clic « Créer un sondage » rend le formulaire à `/voti/#new`, sans sortir du sous-chemin ;
- cette navigation ne crée pas de bulletin ni de sauvegarde métier.

Seules les requêtes HTTP vers l'origine locale `http://127.0.0.1:4173` sont permises.
Aucune exception JavaScript navigateur n'est acceptée.
Le serveur et Chromium sont arrêtés et leur sortie est attendue dans `finally`, ce
qui permet les relances successives sans conserver le port occupé.

## Fichiers de ce lot

| Fichier | Changement |
|---|---|
| `scripts/browser-test.mjs` | Synchronisation CDP/DOM, messages, smoke HTTP, arrêt des processus, suppression du délai de fixtures |
| `scripts/browser-navigation.mjs` | Nouveau helper indépendant et testable de navigation/initialisation |
| `tests/browser-navigation.test.js` | Dix nouveaux tests ciblant les courses et diagnostics |
| `docs/CODEX_MVP_FOUNDATION_FIX_REPORT_V0.md` | Présent rapport |

`index.html` a été régénéré par les commandes de build depuis les sources applicatives
existantes. Aucun changement de logique métier, d'interface, de modèle, de règle ou
de dépendance. `scripts/dev.mjs`, les documents d'autorité et le rapport de fondation
précédent n'ont pas été modifiés par ce lot. Les changements de la fondation déjà
présents au début ont été conservés.

## Tests du helper

Les dix nouveaux tests `node:test` couvrent :

1. `load` reçu avant la réponse à `Page.navigate` ;
2. événement d'ancien loader ou d'autre session ignoré ;
3. absence de chargement, diagnostic et nettoyage après timeout ;
4. erreur explicite renvoyée par la navigation ;
5. URL du document différente malgré un événement de chargement ;
6. absence de `#app`, sans lecture de `textContent` sur null ;
7. présence de `#app` mais initialisation inachevée ;
8. erreur d'initialisation Voti avec conservation du message ;
9. accueil déjà prêt, sans pause artificielle ;
10. mauvais document ou `readyState` incomplet refusé avant scénario.

Les événements sont simulés pour les tests de protocole ; les attentes DOM sont
exercées dans un contexte VM contrôlé. Les exécutions Chromium complètent ces tests
avec les vrais événements et le véritable DOM.

## Commandes exécutées et résultats exacts

| Commande | Résultat |
|---|---|
| `npm test` | Succès : 54 tests de fondation conservés + 10 nouveaux = 64 tests, aucun échec |
| `node tests/browser-navigation.test.js` | 10 tests réussis, 0 échec, 0 ignoré, 0 TODO |
| `npm run check` | Succès : syntaxe de 19 fichiers JavaScript |
| `npm run build` | Succès : HTML autonome de 57 506 octets, aucune dépendance |
| `npm run test:browser` | Succès : 31 contrôles, dont file offline et HTTP `/voti/` |
| Cinq relances consécutives de `npm run test:browser` | 5/5 réussies, 31 contrôles à chaque passage |
| `git diff --check` | Succès : aucune erreur d'espacement |

Dans cet environnement, le reporter agrégé de `npm test` représente les six fichiers
de tests. Les 54 tests préexistants avaient été confirmés par l'audit indépendant ;
le nouveau fichier a aussi été exécuté directement pour vérifier son décompte de 10.

**Nombre d'exécutions navigateur achevées dans ce lot : 6, toutes réussies.**
La première exécution a été suivie d'une série de cinq exécutions séquentielles,
chacune avec un nouveau profil Chromium et son propre serveur local.
La série a été lancée par Node avec `execFileSync('npm', ['run', 'test:browser'])`,
en imposant le cache npm dans `.npm-cache/` du dépôt.

Une première demande d'exécution hors sandbox a expiré au niveau de la revue automatique
d'autorisation, avant lancement de la commande. La nouvelle tentative autorisée a
abouti. Cette expiration n'est pas un échec du test navigateur et n'est pas comptée
comme exécution achevée.

## Périmètre et dépendances

Aucune dépendance ajoutée. Les tests emploient Node, ses modules natifs et Chromium
déjà installé. Le cache npm est fixé par `.npmrc` dans Voti. Profils Chromium, caches
et chemins XDG sont confinés à `.browser-tests/` dans le dépôt et ignorés par Git.
Aucun nettoyage ou modification des journaux externes du lot précédent.

Aucun commit, push ou déploiement GitHub Pages. Aucun Cloudflare, D1, relais, QR, PDF,
Android, Capacitor, compte, authentification ou synchronisation distribuée.

## Limites restantes

- La série de six réussites établit la stabilité dans l'environnement disponible,
  pas dans toutes les configurations. Le second environnement de l'audit reste à retester.
- Chromium doit être disponible ; `VOTI_CHROMIUM` permet d'indiquer son exécutable.
- Le port localhost 4173 doit être libre. Le harnais démarre son propre serveur et
  refuse un échec de lancement ; il ne réutilise ni n'arrête un serveur appartenant à autrui.
- Le sandbox doit permettre le lancement de Chromium et l'écoute localhost, ou fournir
  une autorisation adaptée. Leur refus entraîne un diagnostic d'exécution, pas une
  modification de l'application pour contourner ses règles.
- Les 15 secondes par étape sont une borne explicite : une machine encore plus lente
  peut échouer avec un message de délai dépassé.
- Le signal d'initialisation est constitué de contrôles DOM de l'accueil existant ;
  si ce parcours change, le prédicat du harnais devra être adapté.
- Le smoke HTTP couvre chargement, initialisation et navigation sous `/voti/`.
  Le parcours métier complet reste couvert par les tests file et Node.
- Pas d'essai Firefox/Safari, téléphone physique, lecteur d'écran ou GitHub Pages réel.

## Points nécessitant une validation humaine

Aucun arbitrage métier nouveau ni blocage de développement.
Relancer `npm run test:browser` dans l'environnement où l'audit avait observé l'échec
constitue la vérification humaine utile avant commit. L'autorisation de commit reste
une instruction distincte de Lu’uma ; aucun commit n'a été réalisé.
