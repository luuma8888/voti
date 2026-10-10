# Voti v0.3D — rapport de préparation du pilote

## État réel : Gate B autorisé, migrations et Worker déployés

Le provisionnement approuvé au Gate A est terminé. Lu’uma a explicitement
autorisé le Gate B. Le 10 octobre 2026, les deux migrations ont été appliquées
sur D1 UE et le Worker a été déployé sur workers.dev. **Ce rapport reste
intermédiaire : le pilote de bout en bout n'est pas encore validé.** Lu’uma a
installé le secret Turnstile dans le tableau de bord. Un bug du fetch Worker,
et non une erreur de clé démontrée, empêchait Siteverify d'être appelé. Il a été
corrigé et redéployé : les jetons factices sont désormais refusés avec
`403 HUMAN_VERIFICATION_FAILED`. Aucun secret récupéré ou affiché ; aucune
vérification humaine réussie revendiquée. Le HTML connecté est construit mais
pas publié : le challenge humain réel sera testé sur Pages après le Gate C.
Gate C explicitement autorisé par Lu’uma : commit des changements v0.3D,
push sur main et mise à jour Pages. Publication en cours ; aucune recette
Chromebook/téléphone validée et aucun ZIP final encore produit.

## Arbitrage gratuit validé

Lu’uma impose gratuit uniquement et interruption lorsque les quotas gratuits
sont dépassés. Il a confirmé Workers Free dans le tableau de bord, avec
« Number of Workers: 100 ». Les API d'abonnement ne sont pas accessibles avec
la connexion actuelle ; le champ usage model n'a pas été assimilé à un forfait.

R2 n'offre pas ici de plafond financier natif zéro vérifié. Les alertes de budget
ne sont pas des blocages. Lu’uma a donc explicitement approuvé le pilote
**Workers Free + D1 UE + Turnstile Free, sans images utilisateur distantes**.
Ce changement remplace le périmètre R2/images distantes de la spécification
v0.3D pour ce pilote seulement ; la spécification originale n'est pas réécrite.
Aucun stockage de remplacement ni transfert d'image vers D1/localStorage.

## Opérations distantes effectivement réalisées

Compte `1c74451e938197bbcd316939932fc778`, via API officielle Cloudflare connectée :

1. Création D1 `voti-production`, UUID `bb3329c1-7de3-4147-8d07-af8679b6cd12`,
   `jurisdiction=eu`, réplication désactivée. Vérification ultérieure : `eu`,
   région d'exécution `EEUR`, **0 table**, fichier de base vide 12 288 octets.
2. Enregistrement du sous-domaine `voti-luuma8888.workers.dev`.
3. Création Turnstile `Voti publication`, mode Managed, `no_clearance`, domaine
   autorisé uniquement `luuma8888.github.io`. Site key publique
   `0x4AAAAAAFSr8Ez4dZ22j76S`. Aucun secret affiché ou écrit dans le dépôt.
4. Lecture de contrôle : liste des Workers toujours vide.

Après accord Gate B, via Wrangler 4.149.0 authentifié, logs disque et métriques
désactivés, sans auto-provisionnement :

5. Migrations `0001_initial.sql` et `0002_cleanup_indexes.sql` appliquées sur
   cette même base. Vérification API : 7 tables métier, 6 triggers, 2 index
   explicites ; historique des deux migrations présent ; 0 sondage et 0 bulletin.
6. Worker `voti-relay` déployé, version
   `70e6600c-1011-4f41-9355-ba2653eee158`, upload 51,20 KiB / gzip 14,27 KiB,
   démarrage observé 1 ms (pas une mesure CPU du parcours métier).
   URL active : `https://voti-relay.voti-luuma8888.workers.dev`.
7. Vérification API des bindings réels : DB sur l'UUID approuvé, 3 rate limiters,
   CORS GitHub exact, `REMOTE_ASSETS_ENABLED=false`, Siteverify/hostname stricts,
   aucun R2 ; cron réel `17 * * * *`. Liste des secrets vide.
8. Dix contrôles HTTP réels réussis : GET sondage/résultats/asset/ballots
   inexistant → `NOT_FOUND`, CORS accepté/refusé et OPTIONS, aucun cookie,
   publication sans token → `HUMAN_VERIFICATION_REQUIRED`, token factice sans
   secret → `RELAY_UNAVAILABLE`, vote sur sondage inexistant → `NOT_FOUND`
   sans challenge, payload excessif → `PAYLOAD_TOO_LARGE`. Aucun sondage créé.

Pas d'activation R2, bucket, souscription payante, upgrade, récupération/écriture
de secret Worker **par l'agent** ou modification GitHub. Aucun succès de publication réelle
ni vote sur un sondage de production n'est revendiqué à ce stade.

### Contrôle après installation manuelle du secret

Lu’uma a signalé « secret installé ». Contrôles en lecture seule de l'agent :

- Binding `TURNSTILE_SECRET` présent, type `secret_text`, jamais de lecture de valeur.
- Version `35e21b53-a046-4229-80fe-529bf389e72a` déployée à 100 %, déploiement
  `e75477da-89dd-4cd1-9f96-082a8eae443d`, créé le 10 octobre 2026 à 15:37:51 UTC.
- À ce stade, ETag du script identique à la version initiale ; handlers
  fetch/scheduled et bindings publics/D1 conservés.
- GET d'un sondage inconnu → `404 NOT_FOUND` ; token absent →
  `403 HUMAN_VERIFICATION_REQUIRED` ; token dépassant 2 048 caractères →
  `403 HUMAN_VERIFICATION_FAILED`.
- Token factice `XXXX.DUMMY.TOKEN.XXXX` et autre token aléatoire borné →
  `503 RELAY_UNAVAILABLE`, au lieu du refus `403` attendu. Le smoke test a donc
  **échoué** sur cette assertion ; diagnostic poursuivi avant le Gate C.
- Siteverify direct fonctionne avec les clés **publiques de test officielles** :
  HTTP 200 ; une valeur de secret volontairement fictive produit HTTP 400 et
  `invalid-input-secret`. Ces sondes n'utilisent pas le secret réel et ne prouvent
  pas sa validité. Elles confirment seulement le comportement du service depuis
  le poste, pas celui de la requête exacte depuis le Worker.

### Cause démontrée et correction du fetch Siteverify

Lu’uma a confirmé que la bonne Secret key était déjà installée et l'a recopiée.
La demande de recopie était inutile : le diagnostic dans le runtime réel a
identifié un bug indépendant de la clé. Aucun secret réel n'a été lu pour ce diagnostic.

`verifyHuman` utilisait `fetch(..., { redirect: 'error' })`. **workerd refuse ce
mode avant toute requête réseau**, avec une TypeError indiquant que seuls
`follow` et `manual` sont implémentés à l'edge. Le catch renvoyait alors
`RELAY_UNAVAILABLE`. Les mocks fetch Node acceptaient l'option et masquaient le bug.
Le défaut a été reproduit avec le workerd installé et la même compatibility date,
sans utiliser le secret réel.

Correction minimale : `redirect: 'manual'`. Le contrôle existant `response.ok`
refuse toute réponse 3xx ; aucune redirection suivie et aucun secret retransmis
à une autre destination. Un test Node couvre le refus 302 et un nouveau test
Miniflare/workerd charge le code réel, simule uniquement le service sortant et
vérifie succès, token invalide, 302, 503 et hostname incorrect. Pas de nouvelle
dépendance : runtime transitif du Wrangler déjà verrouillé.

Redéploiement Gate B sur le même Worker, sans modifier le secret :

- Version `7d353d36-d74a-4764-ab5c-c90f4129126e`, déploiement
  `68b0456d-e4ed-4993-acc7-ed66851c83eb`, actif à 100 %.
- Upload 51,20 KiB / gzip 14,27 KiB, startup 1 ms ; bindings, cron et profil
  sans R2 conservés. Binding secret_text confirmé, valeur jamais lue.
- **9 contrôles HTTP réels réussis** : token absent → 403
  `HUMAN_VERIFICATION_REQUIRED`, token factice → 403
  `HUMAN_VERIFICATION_FAILED`, quatre GET inconnus (sondage, résultats,
  ballots, asset) → 404, origines suffixe malveillant et localhost rejetées,
  OPTIONS de l'origine GitHub autorisée → 204.
- D1 après contrôle : 0 sondage, 0 bulletin, 0 préparation.

Cela valide la correction du runtime et le chemin négatif Siteverify, **pas**
un challenge humain réussi ni un replay réel. Ceux-ci restent à tester sur Pages.

## Architecture et différences minimales

Architecture de production préparée : GitHub Pages → HttpRelayAdapter → Worker
→ D1. La configuration locale Worker/D1/R2 et InMemoryRelayAdapter sont conservés.
Le moteur, modèle, schéma des données, ballot minimal, empreinte sémantique,
concurrence D1, idempotence et règles de résultats ne sont pas modifiés. Seule
la syntaxe du `CASE` dans `ballot_validate` a été parenthésée pour le parser
D1 distant ; condition et erreur conservées, aucune table réinitialisée.

Politique serveur `REMOTE_ASSETS_ENABLED=false` :

- Images de sondage et de choix refusées avant toute écriture de préparation.
- Commit et modification de définition vérifient aussi l'absence de références.
- Upload non vide refusé avec `REMOTE_ASSETS_DISABLED` (HTTP 422), sans changer
  les refus prioritaires existants de fermeture/verrouillage.
- Recherche/lots d'assets vides compatibles avec RelayClient : no-op, sans
  R2 ni nouvelle révision. Aucun lot silencieusement ignoré s'il contient une image.
- Lecture publique d'asset → `NOT_FOUND`, sans accès R2.
- Limite de corps HTTP 65 536 octets sur ce profil, y compris les routes upload.

Le client montre une explication à la place de « Publier en ligne » pour un
sondage illustré et vérifie la politique avant Turnstile et avant l'envoi.
La définition n'est jamais dépouillée d'images. Le formulaire d'un sondage
distant n'offre pas d'ajout d'image ; les sondages locaux gardent cette option.
Les trois images de marque intégrées, thèmes, backups et images locales sont
toujours utilisables. Aucun refactoring graphique ou nouvelle fonction métier.

Configuration production distincte : compte/UUID explicites, CORS uniquement
`https://luuma8888.github.io`, Siteverify réel/hostname strict, cron horaire,
préparations 24 h, namespaces rate limit `34001`/`34002`/`34003`. Aucun binding R2.
Pas de logs/traces applicatifs, conformément à la politique de confidentialité
qui prime sur la recommandation générique d'observabilité du guide Workers.
Les guides Wrangler/Workers ont servi à vérifier le schéma et le dry-run ; le
guide Turnstile encadre le traitement du secret. Il interdit sa récupération
via un exécutable du projet et exige une destination confirmée. Aucun Wrangler
canonique hors dépôt approuvé n'a été trouvé. La voie retenue pour cette étape
est donc le gestionnaire de secrets du tableau de bord Cloudflare, manipulé
par Lu’uma : pas de récupération automatique, pas de secret dans le chat.

Configuration publique centralisée dans `web/relay-production.json`, sans
capacité ou secret. Après correction et contrôles HTTP, `npm run build:production`
a construit `index.html` connecté : **477 490 octets**. Il n'est pas encore publié.
`npm run build` reste le build local autonome sans relais ; les tests réécrivent
le HTML, donc le build production est exécuté en dernier avant revue Gate C.

## Fichiers créés

- `relay/cloudflare/wrangler.production.jsonc`
- `relay/cloudflare/wrangler.free-test.jsonc` (local, sans R2 ni credentials)
- `web/relay-production.json` (configuration publique)
- `scripts/build-production.mjs`
- `scripts/free-pilot-integration.mjs`
- `tests/free-pilot.test.js`
- `tests/turnstile-runtime.test.js` (runtime Worker réel, service sortant simulé)
- `docs/PRODUCTION_DEPLOYMENT_V0.md`
- `docs/PRODUCTION_PILOT_REPORT_V0.md`

## Fichiers modifiés

- `.gitignore` : exclusion de `.aws`, emplacement d'authentification potentiel.
  Un fichier vide de ce nom est apparu pendant les outils ; origine non établie,
  **contenu laissé intact**, aucun credential trouvé ni ajouté à Git.
- `README.md`, `docs/CLOUDFLARE_DEPLOYMENT_V0.md` : arbitrage et état réel prioritaires.
- `package.json` : `build:production`, `test:free-pilot`, sans nouvelle dépendance.
- `relay/cloudflare/service.js`, `relay/cloudflare/worker.js` : politique du profil gratuit.
- `relay/cloudflare/abuse.js` : fetch Siteverify compatible workerd, redirection
  manuelle et refus des 3xx ; ni modification de secret ni assouplissement.
- `tests/relay-hardening.test.js` : option fetch attendue et refus d'une redirection.
- `relay/cloudflare/migrations/0001_initial.sql` : parenthèses syntaxiques du CASE
  de validation, sans changement sémantique ni modification du schéma.
- `shared/relay.js` : code d'erreur de politique, aucune règle de domaine changée.
- `web/relay-config.js`, `web/app.js` : configuration et explications/garde-fous UI.
- `scripts/build.mjs` : option publique explicite et validation booléenne stricte ;
  conserver les exports utilitaires lors de l'injection de configuration.
- `scripts/browser-test.mjs`, `scripts/browser-relay.mjs` : variante textuelle
  multi-clients gratuite, tout en conservant les scénarios illustrés existants.
- `tests/build.test.js`, `tests/audit-bundle.test.js` : nouvelles garanties.
- `tests/free-pilot.test.js` : garanties gratuites et régression syntaxique D1.
- `scripts/audit-bundle.mjs` : cible v0.3D, exclusion de **tous** les ZIP
  `VOTI_AUDIT_*.zip`, y compris s'il en était accidentellement suivi ; pas de récursion.
- `index.html` : HTML autonome connecté au pilote, ressources locales intégrées,
  configuration publique seulement ; pas encore envoyé sur GitHub Pages.

`docs/VOTI_DEPLOY_V0_3D_SPEC.md` était déjà non suivi au départ ; fichier de
Lu’uma lu et préservé, non créé ni modifié par ce travail. Aucun ancien ZIP
n'est supprimé ou désindexé.

## Tests et contrôles

| Commande/contrôle | Résultat observé |
| --- | --- |
| `npm test` | Succès après correction du fetch ; suite de 187 tests Node |
| Node `--test --experimental-test-isolation=none --test-reporter=spec tests/*.test.js` | Décompte explicite : 187 passés, 0 échec/sauté/annulé après correction |
| `npm run check` | Relancé après correction : succès, 60 fichiers JS |
| `npm run build` | Relancé après correction : succès, HTML autonome local de 477 242 octets |
| `npm run build:production` | Succès, HTML connecté de 477 490 octets, configuration publique et aucune image distante |
| Test `tests/turnstile-runtime.test.js` isolé | Succès, 1 test / 5 scénarios Siteverify dans workerd, aucune requête Internet |
| `npm run test:relay` | Relancé après correction : succès, 72 contrôles HTTP/D1/R2 locaux |
| `npm run test:integration` | Relancé après correction : succès, 73 contrôles relais + 543 contrôles Chromium multi-clients |
| `npm run test:free-pilot` | Relancé après correction : succès, 21 contrôles HTTP/D1 **sans R2** + 545 contrôles Chromium |
| `npm run test:browser` | Relancé après correction : succès, 499 contrôles Chromium offline/local et `/voti/` |
| Wrangler `deploy --dry-run --no-autoconfig` sur config production | Succès après correction, 51,20 KiB / gzip 14,27 KiB ; aucun upload |
| `git diff --check` | Succès, aucune erreur de whitespace |
| Inspection des fichiers admissibles d'audit | 111 fichiers admissibles ; aucun fichier de credentials ni motif de secret concret détecté ; aucun ZIP récursif dans la liste |
| Inspection HTML de production | 477 490 octets, 25 modules embarqués, 3 WebP de marque inline ; configuration publique exacte ; aucun script/stylesheet externe chargé au démarrage |
| Lecture seule de GitHub Pages existant | HTTP 200, 475 630 octets, relais non configuré ; aucun changement du site |
| Migrations D1 distantes après correction | Succès, deux migrations enregistrées, 7 tables métier / 6 triggers / 2 index |
| Déploiement Worker réel | Succès, URL workers.dev active et bindings/cron vérifiés |
| HTTP/CORS réel sans secret | Succès, 10 contrôles, aucun sondage créé ; protection de publication fermée |
| Intégration gratuite HTTP/D1 locale sans Chromium après correction | Succès, 20 contrôles |
| Binding après installation manuelle | Présent, secret_text, version déployée à 100 %, valeur jamais lue |
| Smoke initial après installation manuelle | **Échec historique**, 503 causé par redirect:error non implémenté dans workerd |
| Smoke après correction et redéploiement | Succès, 9 contrôles HTTP/CORS ; jeton factice → 403 HUMAN_VERIFICATION_FAILED |

Les tests locaux sont exécutés avec les bindings simulés, profils et caches
isolés dans le dépôt. Les limitations de sandbox ont nécessité une exécution
autorisée pour les ports localhost/Chromium et sous-processus Node ; pas de
tests de publication/vote acceptés contre D1 de production ; seuls les contrôles
HTTP négatifs et lectures de schéma détaillés ci-dessus ont été exécutés.

Incidents consignés :

- Deux tentatives initiales de migration distante ont échoué avec `7500`,
  `incomplete input: SQLITE_ERROR`. Historique de migrations vide et aucune
  table métier après échec, pas de reset/drop. Cause reproduite sans écriture
  avec `EXPLAIN CREATE TRIGGER` : CASE non parenthésé refusé, parenthésé accepté.
  [Incident décrit dans le dépôt officiel Workers SDK](https://github.com/cloudflare/workers-sdk/issues/4727).
  Parenthèses ajoutées dans le trigger, 185 tests Node et 20 contrôles locaux
  réussis, puis deux migrations distantes appliquées et vérifiées.
- Une tentative de reprise a été bloquée avant exécution par le quota du
  mécanisme de revue. Après retour du quota confirmé par Lu’uma, reprise
  normale, sans contournement. Un refus D1 `7403` a ensuite été observé ;
  authentification/scopes vérifiés et SELECT distant réussi avant reprise.
  Cause du refus transitoire non démontrée, aucun credential modifié manuellement.
- Un wrapper de test visait un npm non installé dans `node_modules` ; échec
  de lancement uniquement. Reprise via `/usr/bin/npm`, `npm test` et check réussis.

- Premier essai sous sandbox du relais : migration locale bloquée ; reprise
  dans le mode d'exécution autorisé pour les tests localhost.
- Un essai `test:relay` a échoué au contrôle de rate limit public approximatif
  (125 tentatives), puis la relance complète et `test:integration` ont réussi.
  Cause exacte non démontrée ; aucun quota ni assertion existante assoupli.
  Les limites edge ne sont pas des compteurs financiers exacts.
- Après correction Siteverify, un premier `test:integration` a échoué sur une
  assertion générique falsy ; la capture abrégée n'a pas conservé la stack.
  Cause non démontrée, donc pas attribuée avec certitude au rate limiter.
  Relance complète réussie : 73 contrôles HTTP et 543 contrôles Chromium,
  sans modifier les assertions ou les quotas.
- Les nouveaux tests gratuits ont révélé le lot vide d'assets envoyé par le
  contrat client : traitement no-op explicite ajouté côté profil gratuit.
- Une nouvelle navigation de test uniquement par hash ne déclenchait pas un
  nouveau document ; correction du scénario par URL unique, sans changer le
  harnais CDP ni l'application. Dernière suite gratuite réussie.

## Tests ajoutés et garanties

9 tests Node propres au pilote : images de question/choix rejetées sans écriture,
upload refusé sauf lot vide, modification illustrée refusée, publication sans
asset, asset public non accessible, UI/local images préservées, erreur de
contrat, configuration production sans R2 et sans secret, CASE parenthésé
préservant la validation du choix et du statut. Un test build connecté
valide le booléen et les exports conservés. Un test d'audit exclut les anciennes
archives suivies ou imbriquées.

Deux tests de régression supplémentaires rendent le total Node égal à 187 :
refus de redirection Siteverify en Node, puis cinq scénarios dans workerd réel
avec service sortant simulé. Ce dernier couvre le défaut de compatibilité que
les mocks précédents ne détectaient pas.

Le scénario local sans binding R2 vérifie publication, second client, vote,
retry, course/modification refusée, verrouillage, seuil 0/4/5, style post-lock,
upload/référence rejetés, cron sans R2, fermeture et suppression. Chromium
réutilise la régression offline, images locales, cinq thèmes, 360 px et `/voti/`,
puis valide publication textuelle, votes avec deuxième contexte, résultats,
verrouillage, transfert de clé et suppression.

## Limites et décisions restantes

1. Gate B exécuté : migrations, Worker et correction Siteverify déployés ;
   `TURNSTILE_SECRET` installé manuellement et binding confirmé. Refus d'un
   jeton factice vérifié ; aucune nouvelle saisie de clé demandée.
2. Gate C requis avant commit/push et modification de Pages ; pas d'autorisation
   inférée de la simple approbation de gratuité. Accord Gate C maintenant reçu
   explicitement pour commit/push sur main et mise à jour Pages.
3. Turnstile valide/replay réel, performances CPU du parcours métier Workers
   Free et recette physique **non vérifiés**. HTTP/CORS et fail-closed vérifiés
   comme détaillé plus haut. Aucun quota de production forcé jusqu'à
   épuisement, ce serait une interruption inutile du pilote.
4. Le forfait doit rester Free ; aucun garde-fou du code ne garantit zéro coût
   si un administrateur le transforme ensuite en abonnement Paid.
5. Absence de récupération de capacité par compte et d'unicité par personne,
   aucun anonymat réseau garanti, logs Cloudflare possibles, pas de vote différé.
6. Images utilisateur distantes volontairement indisponibles. Aucune solution
   financière de stockage média gratuite dure n'est inventée dans ce lot.
7. Le ZIP `VOTI_AUDIT_V0_3D.zip` sera produit **à la toute fin**, après mise à jour
   finale du rapport. Le filtre d'exclusion récursive est déjà testé ; pas de ZIP
   provisoire présenté comme audit d'un déploiement terminé.

## Revue Gate C — aucun commit/push effectué

Le diff couvre la configuration production gratuite, les refus d'images
distantes, le build public, les deux corrections de compatibilité D1/workerd,
les tests et la documentation listés ci-dessus. Pas de nouvelle fonctionnalité
métier ni changement des règles de vote. Le diff du build embarqué est :

```diff
- RELAY_CONFIG = null
+ RELAY_CONFIG = {
+   relayId: "voti-production",
+   baseUrl: "https://voti-relay.voti-luuma8888.workers.dev",
+   turnstileSiteKey: "0x4AAAAAAFSr8Ez4dZ22j76S",
+   turnstileMode: "siteverify",
+   remoteAssetsEnabled: false
+ }
```

Ce diff décrit le module **embarqué dans index.html** ; la valeur par défaut
des sources reste null pour le build local. Site key publique, pas Secret key.
Contrôle en lecture seule du site actuel : HTTP 200, HTML 475 630 octets,
relais non configuré. Le build connecté local n'a donc pas encore été publié.
Accord Gate C reçu explicitement ; exécuter le commit et le push, puis vérifier
la correspondance du HTML servi avec le build production. Aucun ZIP d'audit
n'est actuellement suivi par Git (contrôle `git ls-files '*VOTI_AUDIT_*.zip'`
vide), et ils restent ignorés. Puis guider Lu’uma étape par étape pour la recette
Chromebook ↔ téléphone et attendre ses réponses, puis compléter ce rapport,
produire et vérifier le ZIP final. Aucun QR/PDF, compte, Android, synchronisation
ou refonte graphique ne fait partie de ces étapes.
