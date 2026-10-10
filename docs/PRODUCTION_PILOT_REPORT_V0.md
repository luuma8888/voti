# Voti v0.3D — rapport final du pilote gratuit

## État final : pilote textuel Chromebook ↔ téléphone validé

Le provisionnement approuvé au Gate A est terminé. Lu’uma a explicitement
autorisé le Gate B. Le 10 octobre 2026, les deux migrations ont été appliquées
sur D1 UE et le Worker a été déployé sur workers.dev. **La recette physique du
pilote textuel est maintenant confirmée par Lu’uma, jusqu'à la suppression.** Lu’uma a
installé le secret Turnstile dans le tableau de bord. Un bug du fetch Worker,
et non une erreur de clé démontrée, empêchait Siteverify d'être appelé. Il a été
corrigé et redéployé : les jetons factices sont désormais refusés avec
`403 HUMAN_VERIFICATION_FAILED`. Aucun secret récupéré ou affiché ; aucune
vérification humaine réussie n'avait été revendiquée au stade du smoke négatif.
Lu’uma a depuis confirmé la publication protégée sur le site Pages réel.
Gate C explicitement autorisé par Lu’uma et exécuté : commit `3d25213`,
push sur main et mise à jour Pages. Après micro-correction graphique autorisée
par Lu’uma, le commit graphique `e2b7a54` a été vérifié : l'URL canonique servait exactement le
HTML production corrigé de 478 669 octets. Contrôles automatiques Pages réussis ; Lu’uma
confirme l'affichage Chromebook, la publication protégée et l'ouverture du
sondage sur téléphone, les votes, le seuil, la fermeture et le transfert de clé.
Lu’uma confirme aussi la suppression ; le relais renvoie NOT_FOUND pour le
sondage et les résultats. Lu’uma confirme enfin que les deux liens actualisés
sur téléphone indiquent le sondage introuvable. Le contrôle D1 final confirme
la suppression métier et les files vides ; trois exécutions cron réelles ont
été observées en succès. Frontend actif : `8204e95`, HTML 478 957 octets.
Le ZIP d'audit est produit après les derniers tests et la présente documentation.
Cette validation est celle d'un **pilote contrôlé sans R2**, pas d'une ouverture
publique large ni d'un audit exhaustif de sécurité/charge.

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
un challenge humain réussi ni un replay réel à ce stade. La publication humaine
a ensuite été confirmée sur Pages ; le replay réel n'a pas été testé.

## Arbitrage complémentaire explicitement autorisé par Lu’uma

Pendant la recette humaine, Lu’uma a constaté que le réglage Menthe/Lavande/
Pêche ne changeait que la bordure supérieure du cadre : le bloc question et
le bouton Continuer conservaient les couleurs du thème global.

**Cette micro-correction graphique dans le lot v0.3D est autorisée par Lu’uma,
et non décidée unilatéralement par l'agent.** Ses instructions sont :

> Tu peux modifier dans ce lot : je te l'autoriserai, car ce n'est pas grand chose et grandement utile

Puis confirmation explicite de la traçabilité pour l'audit :

> Indique dans le rapport que c'est bien moi qui l'ai autorisé afin qu'il n'y pas de confusion lors de l'audit GPT.

Cet arbitrage plus récent autorise une exception ciblée au périmètre graphique
initial v0.3D : appliquer l'accent existant du sondage au bloc question,
aux boutons principaux et à la sélection des réponses, en préservant les cinq
thèmes, les contrastes et le focus. Fichiers concernés : CSS, tests, build HTML
et rapport. Aucun nouveau thème, mode de vote, champ de données, migration ou
changement du relais. Lu’uma autorise également explicitement sa publication :

> quand c'est fait, tu peux commiter et pusher

Il précise l'objectif :

> (cela me permettra de verifier le bon rendu lors de la suite des tests restants)

La correction locale et ses tests sont terminés ; commit/push du diff
complémentaire exécutés après succès des contrôles. Le commit production
initial est `3d25213` ; le commit complémentaire publié est
`e2b7a54343e477deecf5349cc1ed4d4742568a12`.

### Cause et correction de l'apparence du sondage

Cause CSS démontrée : les trois règles `.card[data-accent=...]` définissaient
seulement `border-top`. `.question-block` utilisait `--soft` et `.primary`
utilisait `--accent`, tous deux hérités du thème global. Lu’uma a correctement
distingué cette limite visuelle du fonctionnement distant : après son changement,
GET public confirme `themeId=lavender`, verrouillage conservé, question/choix/
règles et empreinte exactement identiques à la lecture avant changement.

Micro-correction : chaque thème définit trois paires de tokens couleur/surface
`--poll-mint`, `--poll-lavender`, `--poll-peach` et leurs variantes `-soft`.
Le cadre du sondage redéfinit localement `--accent`, `--soft` et `--app-focus`.
Les composants existants héritent alors de l'accent pour le bloc question,
les boutons principaux, radios, sélection, confirmation, liens et barres de
résultat. Ni le thème global ni les états danger/statuts ne sont réécrits.
Les palettes Nuit utilisent des accents clairs sur surfaces sombres ; les
quatre palettes claires gardent un bouton suffisamment foncé. Impression
neutre explicitement préservée. Aucune modification de JavaScript applicatif,
de modèle, de persistance ou de Worker ; aucun vote de test envoyé en production.

Fichiers complémentaires : `web/styles.css`, `tests/themes.test.js`,
`scripts/browser-test.mjs`, `scripts/browser-relay.mjs`, `index.html` régénéré,
et ce rapport. Aucune dépendance ajoutée. Six tests Node supplémentaires
couvrent les quinze palettes et le périmètre/impression ; les tests Chromium
comparent effectivement fond question, bouton, radio, sélection et focus,
vérifient trois apparences distinctes par thème, absence de mutation métier,
images mixtes et responsive. Contraste minimal calculé : **4,845:1** pour les
paires de texte testées et pour le focus sur surface/cadre question.
Une capture locale 360 px a également été inspectée ; elle reste dans le
répertoire de tests ignoré et n'est ni commitée ni incluse dans l'audit.

Contrôles après micro-correction :

| Commande | Résultat |
| --- | --- |
| `npm test` | Réussi ; décompte explicite : 193 tests passés, 0 échec/sauté/annulé |
| `npm run check` | Réussi, 60 fichiers JS |
| `npm run build` | Réussi, HTML local autonome 478 421 octets |
| `npm run test:browser` | Réussi, 910 contrôles |
| `npm run test:relay` | Réussi, 72 contrôles HTTP/D1/R2 locaux |
| `npm run test:integration` | Réussi, 73 contrôles HTTP et 954 contrôles Chromium |
| `npm run test:free-pilot` | Réussi, 21 contrôles HTTP/D1 sans R2 et 956 contrôles Chromium |
| `npm run build:production` | Réussi en dernier, HTML connecté 478 669 octets ; configuration publique inchangée |
| `git diff --check` | Réussi, aucune erreur de whitespace |

Publication complémentaire autorisée et exécutée : commit/push `e2b7a54`
sur main. URL canonique Pages HTTP 200, identique octet pour octet au build
478 669 octets, SHA-256
`3a363556f3738bab5653d316121fb9aed71bef489b78c9f133343de7f497ddfe`.
Chromium sur le vrai sondage public, à 360 et 1200 px : trois couleurs de
bouton et trois fonds de question distincts, thème global inchangé, cibles
tactiles >=44 px, pas de débordement ni exception runtime, aucun Turnstile
au vote. Les changements de dataset pour ces contrôles sont uniquement
des aperçus DOM dans le profil isolé ; **aucun changement distant ni vote**
effectué par l'agent. Lu’uma confirme le nouveau rendu sur Chromebook/téléphone :
« Le rendu est bon, c'est parfait ». La recette des seuils peut reprendre ;
la validation complète du pilote était alors conditionnée aux autres étapes,
depuis confirmées dans le journal final.

## Architecture et différences minimales

Architecture de production réalisée : GitHub Pages → HttpRelayAdapter → Worker
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
a construit initialement `index.html` connecté : **477 490 octets**, publié au
Gate C. Après les deux corrections complémentaires autorisées, le build actif
est de **478 957 octets**, vérifié identique sur Pages.
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
  configuration publique seulement ; publié sur GitHub Pages après Gate C.
- `web/styles.css`, `tests/themes.test.js` : correction des accents existants
  autorisée pendant la recette, sans nouvelle fonction métier.
- `docs/PRODUCTION_DEPLOYMENT_V0.md`, `docs/PRIVACY_AND_ABUSE_V0.md`, `README.md`,
  `docs/CLOUDFLARE_DEPLOYMENT_V0.md` : mise à jour finale de l'état réel du pilote.

`docs/VOTI_DEPLOY_V0_3D_SPEC.md` était déjà non suivi au départ ; fichier de
Lu’uma lu et préservé, non créé ni modifié par ce travail. Aucun ancien ZIP
n'est supprimé ou désindexé.

## Tests et contrôles

Journal du premier build v0.3D, avant la micro-correction graphique : les
nouveaux résultats (193 tests Node, 910/954/956 contrôles Chromium et nouveau
build) sont consignés dans la section de correction autorisée ci-dessus.

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
| Lecture seule de GitHub Pages avant Gate C | HTTP 200, 475 630 octets, relais non configuré |
| Contrôles pré-commit Gate C | npm test réussi, check 60 fichiers, build production 477 490 octets, diff --check réussi ; 29 fichiers indexés sans archive ni motif de secret concret |
| Commit et push autorisés | `3d252138875c530156401b45fbff36ccc6d992ad` sur main et origin/main, sans force-push |
| GitHub Pages après propagation | URL canonique HTTP 200, 477 490 octets, identique octet pour octet au build publié ; SHA-256 `75af30943313e97154a32b47ee6b1618d66af4b1df59c40ad5ea398b88eedfdb` |
| Chromium sur Pages réel, profil isolé | Chargement, création d'un brouillon textuel et publication locale réussis ; bouton Publier en ligne présent ; aucune requête Turnstile avant clic ; GET Worker depuis l'origine réelle 404 NOT_FOUND lisible via CORS ; 360 px sans overflow ; 0 exception runtime |
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
Le smoke Chromium sur Pages utilise un profil de test isolé et ne crée qu'un
sondage dans ce profil local. Aucune nouvelle préparation distante, aucun vote
réel ni résolution de challenge humain n'a été effectué par ce smoke.

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
2. Gate C explicitement accordé puis exécuté : commit/push et HTML Pages
   vérifiés. Il ne constitue pas une validation de la recette physique.
3. Recette physique complète du pilote textuel confirmée par Lu’uma. Replay
   Turnstile réel **non testé** ; CPU agrégé observé mais aucune preuve exhaustive
   par route/charge. HTTP/CORS et fail-closed vérifiés comme détaillé plus haut.
   Aucun quota de production forcé jusqu'à
   épuisement, ce serait une interruption inutile du pilote.
4. Le forfait doit rester Free ; aucun garde-fou du code ne garantit zéro coût
   si un administrateur le transforme ensuite en abonnement Paid.
5. Absence de récupération de capacité par compte et d'unicité par personne,
   aucun anonymat réseau garanti, logs Cloudflare possibles, pas de vote différé.
6. Images utilisateur distantes volontairement indisponibles. Aucune solution
   financière de stockage média gratuite dure n'est inventée dans ce lot.
7. ZIP `VOTI_AUDIT_V0_3D.zip` : produit **à la toute fin** via le mécanisme du
   dépôt ; les archives VOTI, même suivies accidentellement, sont exclues.
   Aucun ZIP d'audit commité/poussé. Voir les contrôles finaux ci-dessous.

## Gate C — exécuté, Pages vérifié

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
Avant le push, le site servait un HTML de 475 630 octets sans relais. Après
la première propagation, l'URL canonique servait exactement le build connecté de 477 490 octets
du commit `3d252138875c530156401b45fbff36ccc6d992ad`. Aucun ZIP d'audit
n'est actuellement suivi par Git (contrôle `git ls-files '*VOTI_AUDIT_*.zip'`
vide), et ils restent ignorés. La mise à jour de ce rapport après vérification
Pages a été conservée localement jusqu'à finalisation de la recette ; aucun secret n'y est ajouté.
La recette Chromebook ↔ téléphone a ensuite été guidée étape par étape et les
réponses attendues, sans attribuer à l'agent une manipulation physique. Deux
corrections ciblées distinctes ont été explicitement autorisées et publiées :
`e2b7a54` (accents), puis `8204e95` (liens publics de résultats), comme décrit
dans leurs sections. Aucun QR/PDF, compte, Android, synchronisation ou refonte
générale ajouté.

## Recette humaine — journal des confirmations

| Étape | État réel |
| --- | --- |
| 1. Site publié sur le Chromebook de Lu’uma | Contrôles automatiques réussis ; Lu’uma confirme : « l'affichage est correct » |
| 2. Création d'un sondage fictif textuel | Lu’uma confirme : « c'est créé et le bouton apparaît » après les consignes textuelles sans images, seuil 5, publication locale sans vote |
| 3. Challenge Turnstile réel | Lu’uma confirme la réussite du parcours protégé sur Pages ; la publication exige Siteverify serveur. Sondage publié également confirmé par lecture HTTP réelle ; replay réel non testé |
| 4. Publication distante réelle | Lu’uma confirme : « publication réussirt » ; GET public via HttpRelayAdapter réel valide question, trois choix, statut published, seuil 5 et mode threshold |
| 5. Ouverture du lien sur téléphone | Lu’uma confirme : « Je confirme pour le telephone » et fournit le lien public ; aucune action téléphone effectuée par l'agent |
| 6. Vote du téléphone, sans compte ni Turnstile | Lu’uma confirme le message « Ton vote a bien été enregistré. » après les consignes de sélection/confirmation de Pomme ; contrôle public après vote réussi |
| 7. Seuil et résultats | Sous seuil : RESULTS_LOCKED, distribution/compteur absents ; COUNT administratif confirme 4 bulletins lors de l'incident. Après un vote Pomme supplémentaire, Lu’uma voit les résultats ; GET public confirme exactement 5 réponses : Pomme 3/60 %, Banane 1/20 %, Poire 1/20 %. L'écart avec la séquence initialement annoncée est consigné ci-dessous |
| 8. Verrouillage après premier vote | GET public : locked=true, empreinte présente, statut published. Lu’uma confirme également le message de verrouillage, l'absence de modification du fond, l'apparence toujours disponible et le refus de la route d'édition directe : « Je confirme que c'est bon » |
| 9. Style après verrouillage | Enregistrement distant et empreinte/question/choix/règles inchangés vérifiés. Après correction CSS autorisée et publication e2b7a54, Lu’uma confirme le rendu complet : « Le rendu est bon, c'est parfait » |
| 10. Fermeture et refus de nouveau vote | Lu’uma confirme : « Sondage bien fermé ». GET public confirme closed, locked=true ; résultats toujours disponibles, 5 réponses, répartition 3/1/1. Après correction autorisée publiée en 8204e95, Lu’uma répond « Je confirme » à la vérification téléphone : message fermé, sans possibilité de voter, bouton Résultats ouvrant 5 réponses Pomme 3 / Banane 1 / Poire 1 |
| 11. Export/import secret de la clé admin | Lu’uma confirme « oui, fichier téléchargé » après export dans le navigateur créateur, puis « Je confirme, ça fonctionne » après les consignes d'import dans une fenêtre privée distincte, avec récupération de la gestion du sondage fermé et des actions Apparence / Supprimer en ligne. Validation distante prévue par le code d'import ; aucune clé ni fichier secret transmis à l'agent |
| 12. Suppression et NOT_FOUND | Lu’uma confirme « Je confirme la suppression », puis « oui » pour les deux liens actualisés sur téléphone signalant le sondage introuvable. Lectures HTTP via HttpRelayAdapter réel : getPoll et getResults renvoient NOT_FOUND. Contrôle D1 final : toutes les lignes liées au sondage fictif sont absentes, garbage/préparations vides ; aucun secret ni bulletin brut lu |

Toutes les confirmations physiques prévues pour le pilote textuel ont été
reçues. Rétention/cron/usage sont contrôlés en lecture seule après les
manipulations ; observations et limites détaillées ci-dessous. Le ZIP est
produit après les tests et la documentation finaux, pas avant la recette.

Sondage fictif de recette : `09f5d0ce-80d7-4765-a2eb-7a5a651d1f79`, lien
public `https://luuma8888.github.io/voti/#/p/09f5d0ce-80d7-4765-a2eb-7a5a651d1f79`.
Avant premier vote, contrôle HTTP en lecture seule : définition non verrouillée,
trois choix Pomme/Banane/Poire, minimum 5, threshold, pas de bulletins bruts ni
capacité administrateur dans la projection publique. Aucun vote envoyé par l'agent.
Après le message de succès du premier vote humain : GET public confirme
locked=true et empreinte sémantique présente ; GET résultats reste RESULTS_LOCKED,
sans distribution ni total. L'agent ne récupère aucun bulletin ni capacité.
Après les trois votes supplémentaires humains : Lu’uma confirme « Les trois
votes sont faits et réussi. Resultats toujours bloqués sans répartition, sans
compteur. » GET public confirme statut published, verrouillage et résultats
indisponibles ; GET résultats confirme RESULTS_LOCKED sans distribution ni total.
À ce stade, le nombre quatre provenait du parcours annoncé par Lu’uma, pas d'un compteur
public caché ou d'une récupération de bulletins. Aucun vote envoyé par l'agent.

### Incident de recette : cinquième vote signalé, résultats toujours verrouillés

Lu’uma signale « Resultat pas encore disponible. (j'ai pourtant voté le cinquième
vote Pomme. » Diagnostic sans mutation : GET public confirme published,
locked=true, threshold/minimumResponses=5 ; GET résultats renvoie RESULTS_LOCKED
sans distribution ni compteur. Une requête d'administration Cloudflare en
lecture seule, limitée à COUNT(*) pour ce seul sondage fictif, indique **4
bulletins acceptés**, et non 5. Aucun contenu de bulletin/actionId ni dérivé
de capacité récupéré ; aucun compteur ajouté à l'interface publique.

Le verrouillage des résultats était cohérent avec le nombre réel enregistré.
**Correction du diagnostic de l'agent :** COUNT(*)=4 ne permettait pas de
conclure que le vote Pomme nouvellement annoncé n'avait pas été ajouté. Il
indiquait seulement que cinq bulletins distincts n'étaient pas encore acceptés.

Lu’uma confirme ensuite avoir refait un vote Pomme ; résultats accessibles,
Pomme 3, Banane 1, Poire 1. GET public et GET résultats valident désormais
5 réponses, proportions 60/20/20, statut published et verrouillage conservé.
La publication au seuil réel de 5 fonctionne donc. Par rapport à la séquence
de test initialement annoncée, un vote Banane est absent du décompte attendu
et le vote Pomme supplémentaire apparaît. Aucun mécanisme ne permet d'attribuer
avec certitude l'écart à un geste précis à partir de ces seuls agrégats.

Lu’uma précise : « J'ai peut être été trop vite et pas assez bien vérifié pour
un vote banane ». Une confirmation incomplète, une reprise idempotente ou une
autre différence de parcours restent des hypothèses, **pas un bug démontré**
ni une erreur humaine établie. Aucune règle métier changée, aucune insertion
manuelle de bulletin, aucun nouveau logging sensible. Cette répartition a servi
de référence pour les étapes de fermeture et suppression ensuite confirmées.

### Correction ciblée de navigation après fermeture — autorisée par Lu’uma

Lu’uma signale que le lien public de vote fermé ne permet pas de voir les
résultats, puis confirme « oui, c'est l'absence de bouton ». Le relais ne bloque
pas les résultats : GET public et GET résultats confirment un sondage fermé
avec 5 réponses, Pomme 3, Banane 1, Poire 1. La cause est dans `web/app.js` :
la branche de vote non ouvert propose seulement un Retour vers la gestion
locale. Un autre défaut du même parcours est constaté : le lien Résultats après
un vote distant utilise `#results/<id>` au lieu de `#/p/<id>/results`.

**Autorisation explicite de Lu’uma pour cette correction distincte du CSS :**
l'agent demande « M’autorises-tu à ajouter ce bouton et à corriger également
le lien “Résultats” après un vote, puis à tester, commiter et pousser cette
correction ciblée ? » ; Lu’uma répond « oui ».

Correction : un sondage fermé propose un bouton Résultats, y compris sous
seuil (la page explique alors le verrouillage). Les résultats distants utilisent
la route publique après vote et après fermeture. Le Retour d'une page distante
fermée vise l'accueil, pas la gestion réservée au créateur. Le brouillon ne
reçoit pas de bouton supplémentaire. Les routes locales et leur Retour vers
la gestion sont conservés. Aucune règle de résultats/vote, aucun modèle,
bulletin, stockage, secret ou backend modifié. Aucun vote de production envoyé
par l'agent ; aucun redéploiement Worker nécessaire.

Fichiers de cette correction : `web/app.js`, `scripts/browser-relay.mjs`,
`scripts/browser-test.mjs`, `index.html` régénéré et ce rapport. Sans dépendance
supplémentaire. Régressions Chromium : lien après chaque vote distant réellement
cliqué, résultats publics après fermeture réellement ouverts par le second
contexte sans capacité administrateur, retour non privé, clavier/cible 44 px,
360 px sans débordement, absence de Turnstile ou bulletin local ; bouton fermé
local sous seuil laissant distribution/compteur masqués, route locale après
vote et absence de bouton sur brouillon conservées.

Contrôles de cette correction :

| Commande | Résultat |
| --- | --- |
| `npm test` | Réussi ; décompte explicite Node : 193 passés, 0 échec/sauté/annulé |
| `npm run check` | Réussi, 60 fichiers JavaScript |
| `npm run build` | Réussi, HTML autonome local 478 709 octets |
| `npm run test:browser` | Réussi, 915 contrôles offline/local et `/voti/` |
| `npm run test:free-pilot` | Réussi, 21 contrôles HTTP/D1 sans R2 + 977 contrôles Chromium |
| `npm run test:integration` | Réussi, 73 contrôles HTTP/D1/R2 locaux + 975 contrôles Chromium |
| `npm run build:production` | Exécuté en dernier : réussi, HTML connecté 478 957 octets |
| `git diff --check` | Réussi |
| Contrôle ciblé avant commit | Aucun motif de secret concret dans les sources/rapport, aucune archive audit suivie ; configuration publique inchangée |

La vérification suit les scripts Wrangler locaux existants et leurs bindings
`remote:false`, sans mutation Cloudflare de production. Le skill Wrangler a
confirmé cette séparation ; aucune configuration ou dépendance modifiée.
Commit/push expressément autorisés ci-dessus et exécutés : `8204e95`
(`fix: expose public results after voting and closure`), main et origin/main
synchronisés. Après propagation, URL canonique Pages HTTP 200, **478 957 octets
identiques au build**, SHA-256
`a5ca888deadbc85f414043d5bcffd8c66fab99f0e06440d3a3e899dd588a0d81`.
Un premier smoke lancé pendant la propagation recevait encore l'ancienne page
et échouait sur l'absence de bouton ; pas de nouvelle correction du code.
Relance après vérification des octets : **14 contrôles Chromium réussis** sur
Pages réel à 360/1200 px, bouton Résultats fermé réellement cliqué, répartition
disponible de 5 réponses, contexte sans capacité admin, aucune exception,
aucun Turnstile ni requête mutante distante. Aucune manipulation du téléphone
faite par l'agent. Lu’uma confirme ensuite la vérification physique demandée :
« Je confirme » (sondage fermé sans possibilité de voter et bouton ouvrant les
5 réponses avec répartition 3/1/1). Étape de fermeture/navigation validée ;
export/import de clé depuis un autre contexte navigateur ensuite confirmés par
Lu’uma, puis suppression confirmée. L'agent n'a reçu ni lu la clé de recette.
Ces observations post-publication et les dernières confirmations figurent
dans le présent rapport final ; elles restent distinctes des tests automatisés.

### Retour UX à reporter au prochain lot — confirmations stylisées

Après suppression, Lu’uma demande : « éviter les alert javascript et utiliser
plutôt des popups stylisé », car la confirmation native du navigateur est jugée
peu agréable. La suppression utilise actuellement `window.confirm`, pas
`window.alert`. Demande consignée pour le lot suivant : fenêtres de confirmation
stylisées cohérentes avec Voti, accessibles (clavier, focus, annulation explicite).
Aucune nouvelle refonte ou modification de confirmation dans v0.3D ; le
comportement testé de suppression et de transfert de clé reste intact.

## Contrôles finaux de suppression, cron et usage — lecture seule

Observation le 10 octobre 2026 vers 18:35 UTC, sans nouvelle mutation distante.

### Suppression métier et nettoyage

Requête D1 limitée à des agrégats, aucun bulletin brut ni capacité/dérivé lus :

| Contrôle | Valeur |
| --- | ---: |
| Sondage fictif dans polls | 0 |
| Bulletins liés dans ballots | 0 |
| Préparation liée dans publications | 0 |
| Relations liées dans asset_links / asset_refs | 0 / 0 |
| Total sondages / préparations | 0 / 0 |
| Garbage R2 / préparations expirées / gardes de mutation | 0 / 0 / 0 |
| Taille du fichier D1 / tables, migrations incluses | 90 112 octets / 8 |
| Mutation de la requête d'audit D1 | changed_db=false, rows_written=0 |

Juridiction API `eu`, exécution de la lecture `EEUR`. Les lignes métier sont
supprimées ; la taille SQLite ne revient pas nécessairement à celle d'une base
vide nouvellement créée. Aucune promesse d'effacement instantané des copies
opérateur/Time Travel. R2 n'existe pas dans ce pilote : pas de drainage d'objets
réels à vérifier, pas de test R2 distant revendiqué.

API schedules : **un seul** déclencheur `17 * * * *`. Le dataset GraphQL
`workersInvocationsScheduled`, introspecté avant requête, montre trois vraies
exécutions en `success` :

| Date UTC | CPU mesuré |
| --- | ---: |
| 2026-10-10 16:17:56 | 1 685 µs |
| 2026-10-10 17:17:56 | 2 498 µs |
| 2026-10-10 18:17:56 | 1 468 µs |

Le cron est donc observé en fonctionnement, pas seulement configuré. Les files
finales étant vides, ce pilote ne démontre pas une suppression d'objet R2 ni
le drainage réel d'une préparation délibérément laissée expirer 24 h. Expiration,
bornes, reprise et garbage restent couverts par les tests locaux. Aucun cleanup
production forcé, aucun sondage artificiel supplémentaire créé.

### Usage et limites financières observables

Fenêtre GraphQL **2026-10-10 15:00:00 → 18:35:00 UTC**, périmètre voti-relay
et sa D1, pas tout le compte. Agrégats susceptibles d'avoir un délai/échantillonnage :

| Mesure observée | Valeur |
| --- | ---: |
| Invocations Worker / erreurs runtime | 159 / 0 |
| CPU P50 / P99 | 1 603 / 5 608 µs (1,603 / 5,608 ms) |
| Requêtes D1 lecture / écriture | 178 / 52 |
| Lignes D1 lues / écrites | 1 066 / 94 |
| Turnstile challenge_issued | 2 |
| Turnstile challenge_interactive_solved | 1 |
| Turnstile challenge_interactive_siteverify_solved | 1 |
| Turnstile challenge_siteverify_failed_invalid_token | 1 |

Unités CPU confirmées par introspection du schéma : microsecondes. Ces quantiles
agrégés ne garantissent pas que chaque route ou charge future respecte la limite
CPU Free. « 0 erreur runtime » ne signifie pas « aucun refus HTTP » : les refus
contrôlés attendus (403, 404, seuil verrouillé) ne sont pas des exceptions runtime.
Les événements Turnstile sont des catégories pouvant concerner un même parcours,
pas des personnes ni quatre publications. Aucun IP/User-Agent/ASN récupéré.

Le GET des souscriptions est encore refusé (`10000 Authentication error`). Le
forfait Free reste celui confirmé au dashboard par Lu’uma, pas inféré des métriques.
Aucun upgrade, R2, Images, nouveau secret, alerte payante ou budget non bloquant
ajouté. Pas d'estimation de facture mensuelle ni d'essai d'épuisement des quotas.
La gratuité dépend du maintien des offres Free ; un administrateur passant le
compte sur Paid invaliderait ce garde-fou. Surveiller les métriques dans le
dashboard, le cron et le backlog avant toute ouverture plus large.

Sources et méthode : [métriques Workers](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/),
[GraphQL Workers](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/).
Consultation API officielle avec projection des seuls agrégats non sensibles.
Le skill Workers a servi à la revue de configuration/observabilité : la politique
Voti de désactivation des logs sensibles a été conservée, sans activer logs/traces.

## Derniers tests et audit livrable

Suites relancées après la dernière confirmation humaine, sources applicatives
inchangées depuis le commit `8204e95` :

| Commande | Résultat final |
| --- | --- |
| `npm test` | Réussi, suite de 193 tests ; décompte explicite sans isolation : 193 passés, 0 échec/sauté/annulé |
| `npm run check` | Réussi, 60 fichiers JavaScript |
| `npm run build` | Réussi, HTML local 478 709 octets |
| `npm run test:relay` | Réussi, 72 contrôles HTTP/Worker/D1/R2 locaux |
| `npm run test:integration` | Réussi, 73 contrôles HTTP + 975 contrôles Chromium |
| `npm run test:browser` | Réussi, 915 contrôles offline/local et `/voti/` |
| `npm run test:free-pilot` | Réussi, 21 contrôles HTTP/D1 sans R2 + 977 contrôles Chromium |
| `npm run build:production` | Réussi en dernier, HTML 478 957 octets, identique au frontend publié |
| `git diff --check` | Réussi |

Les scénarios navigateur renforcés ont ainsi réussi deux fois : avant publication
de la correction de liens, puis à la finalisation ; aucun comportement aléatoire
observé sur ces relances. La suite `test:relay` supplémentaire passe à la dernière
exécution. Les incidents historiques des premiers essais restent documentés.
Build production remis en dernier pour ne pas livrer le HTML local/test.
Le site publié reste celui du commit frontend `8204e95`, aucune nouvelle fonction
ni mutation Cloudflare nécessaire à cette finalisation documentaire.

Audit : `npm run audit:bundle`, destination `VOTI_AUDIT_V0_3D.zip` à la racine.
Entrées issues uniquement de `git ls-files -co --exclude-standard`, dédupliquées,
avec exclusion explicite de **tous** les `VOTI_AUDIT_*.zip`, même suivis par erreur.
111 fichiers admissibles. Inspection de la liste puis du répertoire ZIP, test intégrité/CRC et comparaison
des octets avec les fichiers sources ; aucun node_modules, cache/runtime Node,
.wrangler, .relay-local, profil/capture Chromium, base locale, fichier secret ou
archive VOTI récursive admis. Aucun secret concret détecté dans les textes ou
modules HTML embarqués. Une première expression trop large signalait les
littéraux factices des tests Siteverify ; trois valeurs de test connues ont été
identifiées explicitement (sans exclure globalement les fichiers de tests).
Le secret Cloudflare et la clé humaine n'ont jamais été
récupérés, donc ne peuvent pas être comparés par leur valeur ; contrôles structurels
et provenance, pas promesse magique d'audit de tous les secrets possibles.
Taille et chemin exacts du ZIP sont fournis dans la sortie finale ; l'archive est
ignorée, jamais ajoutée à Git. Aucune suppression des anciennes archives.

Conclusion : premier pilote Internet textuel gratuit validé avec Lu’uma ;
maintenir le forfait Free et un périmètre contrôlé. Avant élargissement : revue
charge/sécurité et suivi quotas, gestion opérateur des clés perdues/effacement,
replay réel Turnstile si souhaité. Prochain micro-lot demandé : confirmations
stylisées accessibles, sans changement des règles métier. QR/PDF, comptes,
Android, images distantes et services payants restent hors de ce lot.
