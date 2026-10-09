# Rapport Voti v0.3B — premier relais HTTP et corrections graphiques

Date : 9 octobre 2026. Autorité : `VOTI_RELAY_V0_3B_SPEC.md`.
Reprise après interruption de quota ; fichiers existants conservés.
**Aucun commit, push, provisioning, migration distante ou déploiement Cloudflare.**

## Résumé

Le backend HTTP réel fonctionne localement avec Worker, D1 et R2 via Wrangler.
Un navigateur créateur publie un sondage illustré ; un second contexte isolé
charge le lien public, vote avec confirmation, atteint le seuil ; le créateur
constate le verrouillage puis ferme. Aucun bulletin distant n'est copié dans
le snapshot local. Le mode sans relais reste utilisable hors ligne en `file://`.

Les documents demandés et les autorités images/assets ont été relus avant les
modifications. Le plan a séparé SQL/Worker, transport HTTP, UI et corrections
visuelles. Les anciennes exclusions Cloudflare/D1 sont dépassées uniquement
pour ce lot explicitement autorisé ; elles ne justifient aucun déploiement distant.

## Architecture, D1 et R2

- `RelayAdapter` reste indépendant du fournisseur ; aucun import Cloudflare dans shared.
- `HttpRelayAdapter` utilise fetch réel, JSON borné, Bearer, AbortController,
  validation stricte des réponses et du contenu des assets, sans DOM.
- Worker : routage `/api/v1`, CORS exact, rate limiting, validation et orchestration.
- D1 : polls, publications privées, ballots minimaux, relations d'assets,
  garbage et gardes transactionnelles.
- R2 : objets privés contextualisés par sondage et tentative d'upload.
- Local : connexions/capacités séparées, aucun changement de schéma métier 2
  ni du format de sauvegarde existant.

Le détail des tables, routes, arguments et procédures est dans
`CLOUDFLARE_RELAY_V0.md`. Migration versionnée unique :
`relay/cloudflare/migrations/0001_initial.sql`, appliquée réellement dans les
espaces D1 locaux des tests. Aucun ID de base de production dans la configuration.

### Atomicité réelle

Le vote utilise un INSERT conditionnel SQL et une clé primaire `(poll_id, action_id)`.
Un trigger contrôle le statut et le choix ; un autre verrouille et augmente la
révision dans la transaction de l'INSERT. Le hash sémantique est celui calculé
au commit de la définition validée. Le trigger de verrouillage sémantique interdit
les changements de fond après vote. Les bulletins ont seulement trois colonnes :
poll_id, action_id, choice_id ; aucun horodatage de bulletin ou métadonnée réseau.

L'administration utilise un batch D1 avec garde CHECK comparant révision, capacité
dérivée et expiration au moment de l'écriture. Un SELECT antérieur ne suffit
jamais à autoriser une mutation. Conflit : rollback complet, erreur structurée,
relecture UI, aucune réapplication silencieuse. Les tests exercent une course
réelle et le scénario déterministe lecture → vote → modification refusée.

Les révisions croissent par pas non consécutifs ; pas de total exact dérivable
par une simple soustraction. Retry même action/choix = pas de nouvelle révision ;
autre choix avec la même action = refus ; nouvelle action = nouveau bulletin.

### Publication, assets et reprise

Préparation privée → assets absents → lot d'upload → commit. Aucune visibilité
publique avant vérification des références, octets, hashes, formats, dimensions
et tailles. Une image n'est servie que dans le contexte du sondage qui la référence.
Les JPEG choisis dans l'interface sont déjà normalisés localement en WebP/PNG.

R2 utilise `polls/<pollId>/<assetId>/<uploadUUID>` : le suffixe évite qu'un rollback
concurrent supprime l'objet d'une autre tentative. Enregistrement de garbage avant
PUT, puis liaison D1/effacement de cette réservation dans le batch réussi.
Les erreurs laissent une reprise durable plutôt qu'un état public partiel.

Expiration des préparations : 24 heures. Nettoyage opportuniste, cron horaire
et commande locale explicite. Traitement borné à 25 préparations/100 objets par
passage. Le test force l'expiration d'une préparation fictive réellement illustrée,
vérifie le refus de commit, lance le scheduled local puis constate son absence.
D1/R2 n'offrent pas de transaction commune ; ce protocole est documenté comme
publication ordonnée et nettoyage rejouable, pas comme transaction distribuée ACID.

## HTTP, capacité, confidentialité

Douze opérations exposées, aucune route listBallots/rawBallots. Le lot d'assets
est un PUT JSON/base64 ; l'interrogation des absents est un POST. Ces adaptations
aux routes conceptuelles sont explicites dans la documentation.

La capacité 256 bits de v0.3A est envoyée seulement dans Authorization, jamais
dans URL/JSON public. D1 ne conserve que son dérivé contextualisé SHA-256.
Workers utilise sa comparaison native timingSafeEqual. Aucun compte de récupération.
Les sauvegardes locales excluent capacités et bulletins distants, avec avertissement UI.

CORS : origines exactes configurables, production GitHub Pages autorisée, localhost
de développement, OPTIONS, Vary: Origin, Authorization/Content-Type, aucun cookie.
Les origines suffixées malicieusement sont refusées. CORS n'est pas une authentification.

Rate limiting réel par binding, 120 appels/60 secondes : poll/catégorie côté public,
dérivé de capacité côté admin ; aucune table d'IP. Le test obtient réellement
429/RATE_LIMITED. Protection collective grossière, pas unicité ni anti-DoS absolu.

Le Worker ne contient aucun logging volontaire de corps de vote, image, Authorization,
IP ou User-Agent. Observability est désactivé dans la configuration fournie.
L'hébergeur peut traiter/journaliser le réseau ; pas d'anonymat réseau garanti,
pas de chiffrement E2E, pas de garantie une-personne-un-vote.

## Configuration et parcours UI

Source unique `web/relay-config.js`, null par défaut. Variables de build publiques :
`VOTI_RELAY_ID`, `VOTI_RELAY_URL`. Aucune URL Worker dispersée dans le domaine.
Le HTML final est livré **sans configuration de relais** ; l'activation de production
attend une URL et une instruction de déploiement validées.

Pour un sondage local publié sans bulletin, Publier en ligne devient disponible
dans un build configuré. Avec des votes locaux : refus expliqué. La capacité est
conservée avant publication, sous coordination avec le verrou local ; dès rattachement,
aucun bulletin local supplémentaire n'est autorisé, y compris depuis un autre onglet.
Préparation interrompue : reprise ou abandon explicite ; expiration nettoyée :
abandon local possible sans prétendre supprimer un sondage public.

Gestion en ligne : lien public/copie, résultats, gestion/édition, apparence et fermeture.
Le formulaire d'édition réutilise le traitement local d'images mais envoie les
mutations au relais. Une édition conserve sa révision initiale avant uploads :
une lecture d'assets ne donne pas le droit d'écraser une nouvelle définition.

Routes `#/p/<pollId>` et `#/p/<pollId>/results`. Sélection → continuer → confirmer →
vote HTTP → succès. Même action conservée lors d'une tentative répétée ; double
clic testé. Relais indisponible : erreur claire, aucun faux succès et aucun vote
offline différé. Le pied de page distingue désormais explicitement local/en ligne.

## Corrections graphiques

1. Fond Pop : couche fixe, inset 0, derrière l'interface, opacité discrète,
   pointer-events none. Contrôle du viewport après scroll à 360 et 1200 px.
2. Mascotte : deux emplacements seulement, bibliothèque vide et succès de vote ;
   112 × 101 px, décorative, identifiable sans occuper tout l'écran.
3. Question : titre, description et image réunis dans une surface harmonisée.
   Portrait/paysage en contain, aucune déformation ni recadrage sémantique.
4. Choix : grille de cartes illustrées avec média dominant et libellé associé,
   radio accessible et sélection bordée ; une colonne confortable sous 480 px.
   Les choix mixtes gardent une hauteur cohérente sans image inventée.
   Gestion/récapitulatif réutilisent cette présentation au lieu de petites puces/vignettes.

La bibliothèque compacte, header, cinq thèmes et contrôles tactiles sont conservés.
Captures générées : `.browser-tests/v03b-images-{0,1,2}-{360,1200}.png` pour 2/3/6
choix, portrait/paysage et mélange image/texte. Les captures portrait 360 et six
choix 1200 ont été inspectées. Les couleurs unies sont des fixtures, pas des données
utilisateur. Les profils/captures restent ignorés par Git.

## Dépendances de développement

- Wrangler **4.149.0**, nécessaire aux vrais bindings locaux Worker/D1/R2 et au futur déploiement.
- Node **22.23.3**, installé uniquement dans le dépôt comme outil de développement :
  Wrangler exige Node ≥22 alors que le système fourni utilise Node 20.
- Dépendances transitives verrouillées dans package-lock ; aucune dépendance UI,
  CDN ou ressource distante requise par le mode local.

`npm install` peut afficher l'avertissement engine de Wrangler depuis le Node
système ; les scripts npm prennent ensuite le Node local du dépôt. Aucun runtime
Node global n'a été remplacé, aucune configuration hors dépôt modifiée.

## Fichiers

Créés :

- `relay/cloudflare/{worker.js,service.js,wrangler.jsonc}` ;
- `relay/cloudflare/migrations/0001_initial.sql` ;
- `shared/relay-wire.js` ;
- `web/{http-relay.js,relay-config.js}` ;
- `scripts/{relay-local.mjs,relay-integration.mjs,browser-relay.mjs}` ;
- `tests/http-relay.test.js` ;
- les trois documents `CLOUDFLARE_RELAY_V0.md`, `CLOUDFLARE_DEPLOYMENT_V0.md` et ce rapport.

Modifiés : `README.md`, `.gitignore`, `package.json`, `package-lock.json`, `shared/relay-client.js`,
`web/app.js`, `web/index.template.html`, `web/styles.css`, `scripts/build.mjs`,
`scripts/check.mjs`, `scripts/browser-test.mjs`, `scripts/browser-assets.mjs`,
`scripts/browser-navigation.mjs`, `tests/browser-navigation.test.js`,
`tests/build.test.js`, `index.html` régénéré.

Le fichier de spécification v0.3B fourni reste inchangé. Aucun changement du moteur,
des validateurs métier, du modèle, de l'import/export ou des anciens documents historiques.

## Tests et résultats

| Commande | Résultat final |
| --- | --- |
| `npm test` | Succès, 11 fichiers de tests |
| Exécution directe des 11 fichiers avec Node local | **150 tests, 150 succès, 0 échec, 0 annulé, 0 ignoré** |
| `npm run check` | **47 fichiers JavaScript** valides, backend inclus |
| `npm run build` | Succès, **458 960 octets**, **23 modules**, HTML local sans relais |
| `npm run test:relay` | **43 contrôles réussis**, dont expiration et nettoyage locaux |
| `npm run test:integration` | **44 contrôles réussis** : 43 HTTP/stockage/expiration + exécution navigateur complète |
| Chromium dans `test:integration` | **527 contrôles réussis**, dont app statique → HTTP → D1/R2 depuis deux contextes indépendants |
| `npm run test:browser` sans relais | **499 contrôles réussis**, file:// offline et /voti/ |
| `git diff --check` | Succès, aucune erreur après rédaction |

Les tests InMemory v0.3A restent actifs. Nouveaux tests unitaires : Bearer hors
URL/corps, validation des réponses, JSON excessif, erreurs structurées, timeout,
coupure réseau, codec assets, configuration HTTP sûre ; deux cas CDP supplémentaires
pour fragments et état asynchrone de vue. Le contrôle de build passe de 20 à 23 modules.

Tests réels locaux : publication illustrée, assets absents/corrompus/hors contexte,
second client, vote/retry/autre action/autre choix, conflit/course, fermeture,
seuils 0/4/5, closed sous seuil/au seuil, style après verrouillage, définition refusée,
capacité invalide, CORS/préflight/refus, payload excessif, rate limiting réel,
absence de routes ballots, expiration/nettoyage et redémarrage conservant D1/R2.

Tests navigateur : 2/3/6 choix, images mixtes/portrait/paysage, texte obligatoire,
radio/focus, cinq thèmes, 360/1200 et scroll, mascotte dans deux états, publication
illustrée, vote depuis un autre contexte sans bulletin local, double clic, résultats
verrouillés puis disponibles, autorité distante et fermeture. Le socle existant
file:// offline, IndexedDB, sauvegardes, contrastes et /voti/ reste exécuté.

### Échecs rencontrés et résolus

- Sandbox : sockets localhost interdits pour Wrangler/Chromium ; relances autorisées
  hors sandbox, toujours avec bindings locaux et données sous le dépôt.
- Rendu local devenu asynchrone : correction pour garder le parcours local immédiat.
- Fetch natif appelé comme méthode d'adaptateur : contexte global désormais explicite,
  problème détectable dans Chromium mais pas avec fetch Node.
- Harnais historiquement limité à l'accueil : attente d'aria-busy/rendu pour les
  routes distantes ; fragment CDP fourni séparément pris en compte ; tests ajoutés.
- Build concurrent pendant un scénario connecté : le HTML avait été régénéré sans
  relais. Validation finale séquentielle et consigne documentaire, sans masquer les échecs.
- Des connexions du runtime local ont été interrompues pendant les modifications
  en cours ; la suite complète a été relancée sans édition/build concurrent et a réussi.

## Limites et écarts assumés

- Pas de déploiement ni test physique Chromebook/téléphone sur Internet : seulement
  deux contextes Chromium isolés avec vrai HTTP local et bindings persistants.
- Pas de décodage de pixels serveur ; contrôle structure/hash/format/taille, à
  renforcer avant exposition publique large. Pas d'outil d'upload distant autonome.
- La bibliothèque utilise des informations locales/en cache ; la gestion, le vote
  et les résultats rechargent l'état autoritaire. Pas de rafraîchissement temps réel
  ou réplication de toute la définition distante dans le snapshot exporté.
- Pas de sauvegarde/transfert des capacités ou des votes distants ; avertissement UI.
- La reprise R2 est éventuelle, bornée par lots ; il faut surveiller cron, quotas et
  erreurs persistantes. Pas de promesse d'atomicité D1/R2 face à toute panne.
- Rate limiting partagé par sondage, pas par personne ; pas de quotas globaux
  anti-coût ni de politique de modération dans ce prototype.
- Routes d'assets en lot et missing-assets POST au lieu des exemples conceptuels ;
  transport JSON/base64 borné, sans changer les références sémantiques.
- Aucun QR, PDF, compte, groupe, autre mode de vote, Android/Capacitor, commentaire,
  vote unique par personne, synchro offline ou chiffrement E2E.

## Décisions avant déploiement

Validation humaine requise pour : compte/domaine et noms des ressources, coût/quotas,
juridictions UE, politique de logs/rétention et accès opérateur, durcissement des
uploads, gestion des capacités perdues/transférées et sauvegardes du backend.
Revue visuelle sur téléphone/Chromebook et lecteur d'écran recommandée.

Les instructions sont prêtes dans `CLOUDFLARE_DEPLOYMENT_V0.md`. Elles recommandent
D1/R2 en juridiction UE sans prétendre que tout le traitement réseau devient
exclusivement européen. Leur exécution attend une instruction explicite distincte.
