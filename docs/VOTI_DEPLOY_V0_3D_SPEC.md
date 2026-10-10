# Voti — v0.3D — Provisionnement et premier déploiement réel Cloudflare

## Statut

Lot de déploiement réel contrôlé.

Ce lot part de v0.3C validé et doit conduire au premier parcours Internet réel :

```text
Chromebook créateur
→ GitHub Pages
→ Worker Cloudflare
→ D1 + R2
→ téléphone
→ vote
→ résultats
```

Le lot ne doit PAS introduire de nouvelles fonctionnalités métier.

---

# 1. Objectif

Provisionner et configurer proprement le premier environnement de production/pilote Voti :

- Worker Cloudflare réel ;
- D1 réel en juridiction UE ;
- R2 réel en juridiction UE ;
- Turnstile réel ;
- secrets Worker ;
- migrations distantes ;
- configuration CORS production ;
- build GitHub Pages connecté au relais ;
- recette Internet réelle ;
- vérification coûts/quotas/cron/suppression.

Le lot reste un **pilote contrôlé**, pas une ouverture publique large.

---

# 2. Modèle de déploiement retenu

Pour le premier pilote :

```text
Frontend :
https://luuma8888.github.io/voti/

Relay :
https://<worker-name>.<workers-subdomain>.workers.dev

D1 :
voti-production

R2 :
voti-production-assets

relayId :
voti-production

Turnstile widget :
Voti publication
```

Utiliser `workers.dev` pour le premier pilote.

Ne pas introduire de domaine personnalisé dans ce lot.

---

# 3. Noms proposés

Sauf collision réelle dans le compte Cloudflare :

```text
Worker             voti-relay
D1                 voti-production
R2                 voti-production-assets
relayId            voti-production
Turnstile widget   Voti publication
```

Si un nom est déjà pris dans le compte :
- ne pas supprimer/remplacer la ressource existante ;
- présenter l’état à Lu’uma ;
- proposer un nom alternatif minimal.

---

# 4. Règle de sécurité opérationnelle

Ce lot contient des opérations distantes réelles.

Codex doit fonctionner par **gates de confirmation** dans la même session.

Il ne faut PAS découper le lot en conversations distinctes.

## Gate A — avant le premier changement Cloudflare

Faire d’abord uniquement des contrôles read-only.

Afficher :
- identité/compte Cloudflare détecté ;
- plan si disponible ;
- ressources existantes pertinentes ;
- noms qui seront créés ;
- juridictions ;
- opérations exactes prévues ;
- éventuel risque de coût.

Puis demander explicitement à Lu’uma :

```text
Autorises-tu la création des ressources Cloudflare de production/pilote listées ci-dessus ?
```

Ne lancer aucune création distante avant son accord.

## Gate B — avant migration/deploy

Après création/configuration :
- montrer les IDs/noms sans afficher de secret ;
- montrer le fichier de production ;
- montrer les migrations qui vont être appliquées ;
- vérifier qu’aucun secret n’est dans Git.

Puis demander confirmation avant :
- migration distante ;
- déploiement Worker.

## Gate C — avant Git push / Pages

Après validation du Worker réel :
- construire le frontend avec URL Worker + sitekey Turnstile ;
- montrer le diff ;
- vérifier qu’aucun secret n’est inclus.

Demander confirmation avant :
- commit ;
- push GitHub ;
- modification effective du site Pages.

---

# 5. Préflight Cloudflare read-only

Avant toute mutation :

```text
wrangler whoami
wrangler d1 list
wrangler r2 bucket list
```

Lister également les Workers existants si la CLI/version actuelle le permet proprement.

Ne jamais imprimer :
- API token ;
- global key ;
- Turnstile secret ;
- contenu de secret Wrangler.

Si Wrangler n’est pas authentifié :
- guider Lu’uma vers l’authentification officielle ;
- ne pas demander de copier un token secret dans le chat Codex.

---

# 6. Plan/coûts

Avant provisioning, vérifier le plan Cloudflare réel du compte si accessible.

Ne jamais supposer qu’une ressource restera gratuite uniquement parce qu’elle possède un free tier.

Pour le pilote :
- ne pas activer volontairement un service payant non nécessaire ;
- ne pas upgrader le compte ;
- ne pas activer de produit Enterprise ;
- ne pas ajouter Cloudflare Images ;
- ne pas ajouter Workers Paid sans accord explicite.

Si le compte est Workers Free :
- conserver ce plan pour le pilote si toutes les ressources nécessaires sont disponibles ;
- rappeler que les limites journalières peuvent interrompre le service.

---

# 7. Création D1

Après Gate A :

Créer :

```text
voti-production
```

avec juridiction :

```text
eu
```

Utiliser la syntaxe Wrangler actuelle supportée.

Capturer le véritable `database_id`.

Créer ensuite le binding production dans un fichier distinct, par exemple :

```text
relay/cloudflare/wrangler.production.jsonc
```

Ne modifier le fichier local/test que si nécessaire.

Le fichier production doit contenir :
- vrai database_id ;
- binding attendu par le Worker ;
- database_name ;
- juridiction UE lorsque la syntaxe le prévoit.

Ne jamais placer de token dans ce fichier.

---

# 8. Création R2

Créer :

```text
voti-production-assets
```

avec juridiction :

```text
eu
```

Le bucket doit rester privé.

Ne pas :
- activer r2.dev ;
- ajouter de custom domain R2 ;
- rendre le bucket public.

Configurer le binding Worker avec :
- bucket_name ;
- jurisdiction `eu` si exigée par Wrangler/config.

Vérifier après création que l’accès public n’a pas été activé.

---

# 9. Rate Limit bindings

Configurer les trois bindings prévus par v0.3C :

```text
LIMITER
CREATION_LIMITER
ASSET_LIMITER
```

avec namespaces/configurations distincts.

Conserver les politiques v0.3C :
- création : 30 / 60 s / relayId:creation ;
- public/admin : 120 / 60 s selon catégorie ;
- assets : 600 / 60 s par pollId + assetId.

Ne pas changer ces valeurs pendant ce lot sauf incompatibilité Cloudflare concrète.

Si le plan du compte ne permet pas cette configuration telle quelle :
- stopper avant deploy ;
- documenter précisément ;
- proposer la solution minimale ;
- ne pas remplacer silencieusement par un mécanisme moins sûr.

---

# 10. Cron

Configurer le scheduled trigger existant :

```text
minute 17 de chaque heure
```

Vérifier que :
- le cron apparaît dans la configuration production ;
- il n’existe qu’un déclencheur utile ;
- aucun cleanup opportuniste HTTP n’est réintroduit.

---

# 11. Turnstile réel

Créer un widget réel :

```text
Nom : Voti publication
Mode : managed
Hostname : luuma8888.github.io
Action attendue : voti-publication
```

Ne pas activer de fonctionnalité Enterprise inutile.

Le widget peut être créé :
- via dashboard ;
- via API officielle ;
- via Wrangler/outil officiel si la version installée le supporte proprement.

Préférer la méthode la plus sûre dans l’environnement courant.

## Secrets

La sitekey est publique.

Le secret est SECRET.

Le secret :
- ne doit pas être écrit dans un fichier suivi ;
- ne doit pas être inclus dans un rapport ;
- ne doit pas apparaître dans un diff ;
- ne doit pas être collé dans Git ;
- doit être placé via secret Worker.

Utiliser l’équivalent actuel de :

```text
wrangler secret put TURNSTILE_SECRET
```

avec la config production.

La saisie doit rester interactive lorsque possible.

Ne jamais recopier la valeur secrète dans le terminal résumé ou le rapport.

---

# 12. Configuration Worker production

Créer une configuration séparée de production.

Elle doit au minimum définir :

```text
name = voti-relay
workers_dev = true
relayId = voti-production
Turnstile mode = siteverify
Turnstile hostname = luuma8888.github.io
Turnstile action = voti-publication
CORS production = https://luuma8888.github.io
D1 binding réel
R2 binding réel
rate limit bindings
cron
```

Ne pas conserver les origines localhost dans la configuration production sauf nécessité technique justifiée.

Observability/logging sensible :
- garder la politique v0.3C ;
- ne pas activer de logging de corps ou secrets.

Le Worker doit rester fail-closed lorsque le secret Turnstile est absent/invalide.

---

# 13. Migrations distantes

Après Gate B :

Appliquer dans l’ordre :

```text
0001_initial.sql
0002_cleanup_indexes.sql
```

à la D1 réelle.

Vérifier :
- statut de migration ;
- tables attendues ;
- indexes/triggers attendus ;
- base vide avant la recette.

Ne jamais importer les bases locales de tests.

---

# 14. Premier deploy Worker

Déployer :

```text
voti-relay
```

sur `workers.dev`.

Capturer l’URL HTTPS exacte produite.

Ne pas modifier le frontend immédiatement.

D’abord tester le Worker indépendamment.

---

# 15. Smoke tests Worker réel

Avant GitHub Pages, tester depuis le poste :

- endpoint inexistant → réponse contrôlée ;
- CORS origine attendue ;
- CORS origine suffixée/malveillante refusée ;
- aucune route ballots ;
- nouvelle publication sans Turnstile → refus ;
- aucun secret dans réponse ;
- D1/R2 bindings accessibles ;
- Worker HTTPS ;
- cron/config déployés.

Ne pas créer de données personnelles.

---

# 16. Recette Turnstile réelle

Construire temporairement le frontend avec :

```text
VOTI_RELAY_ID=voti-production
VOTI_RELAY_URL=<URL-WORKER>
VOTI_TURNSTILE_SITE_KEY=<SITEKEY>
```

et `siteverify`.

Servir cette version dans un contexte où le hostname autorisé est cohérent.

IMPORTANT :
Turnstile doit être réellement testé depuis :

```text
https://luuma8888.github.io
```

car le hostname de production est strict.

Donc le test final Turnstile arrive après le déploiement Pages.

Avant cela, seuls les tests backend/absence de token sont possibles.

---

# 17. Build production frontend

Après validation Worker :

Créer le build production avec :

```text
relayId = voti-production
relayUrl = URL HTTPS réelle du Worker
Turnstile site key = vraie sitekey publique
Turnstile mode = siteverify
```

Le frontend final peut contenir :
- relayId ;
- Worker URL ;
- sitekey Turnstile.

Il ne doit contenir AUCUN secret.

Vérifier avec recherches explicites :
- absence du Turnstile secret ;
- absence de token Cloudflare ;
- absence de `.dev.vars` ;
- absence de credential ;
- absence de capacité admin fixe.

L’HTML autonome doit continuer à fonctionner localement pour les fonctions purement locales même si le relais n’est pas accessible.

---

# 18. Gate C puis Git

Avant commit/push :

Exécuter :

```text
npm test
npm run check
npm run build avec configuration production
git diff --check
```

Puis montrer :
- fichiers modifiés ;
- taille build ;
- URL relay publique ;
- sitekey publique ;
- absence de secret.

Demander autorisation à Lu’uma.

Après accord :

```text
git add ...
git commit ...
git push
```

Ne jamais ajouter :
- `.dev.vars`;
- secret ;
- fichiers de credentials ;
- bundle audit ;
- caches ;
- runtime Node.

---

# 19. Vérification GitHub Pages

Attendre que Pages serve le nouveau commit.

Vérifier :

```text
https://luuma8888.github.io/voti/
```

Contrôler :
- chargement normal ;
- création locale intacte ;
- bouton Publier en ligne ;
- Turnstile chargé uniquement au clic ;
- aucune erreur console bloquante ;
- CORS correct ;
- aucun secret exposé.

---

# 20. Recette réelle Chromebook ↔ téléphone

Créer un sondage FICTIF de test.

Exemple :

```text
Question : Quel fruit pour le goûter test ?
Choix :
- Pomme
- Banane
- Poire
```

Une ou plusieurs images neutres peuvent être ajoutées pour tester R2.

Ne pas utiliser de données réelles de jeunes.

## Créateur Chromebook

1. créer le sondage ;
2. publier localement ;
3. Publier en ligne ;
4. résoudre Turnstile ;
5. confirmer publication distante ;
6. copier lien public.

## Téléphone

1. ouvrir le lien sur réseau mobile ou Wi-Fi ;
2. vérifier images ;
3. sélectionner ;
4. confirmer ;
5. voter ;
6. vérifier succès ;
7. aucune authentification/Turnstile au vote.

## Deuxième vote / seuil

Utiliser quelques contextes de test pour atteindre le seuil sans prétendre à une voix/personne.

Vérifier :
- résultats cachés avant seuil ;
- disponibles au seuil ;
- Chromebook voit l’état autoritaire.

## Verrouillage

Après premier vote :
- essayer d’éditer la question ;
- vérifier refus.

## Style

Après premier vote :
- modifier apparence ;
- vérifier que c’est permis.

## Fermeture

- fermer ;
- nouveau vote refusé ;
- résultats selon règles.

## Clé admin

- exporter clé ;
- ouvrir autre profil navigateur ;
- importer clé ;
- vérifier administration retrouvée.

## Suppression

- supprimer le sondage ;
- confirmer ;
- lien téléphone → NOT_FOUND ;
- résultats → NOT_FOUND ;
- assets réseau → NOT_FOUND après cache frais éventuel.

---

# 21. Cron / garbage réel

Après suppression :

Inspecter D1/R2 avec commandes read-only adaptées.

Vérifier :
- sondage métier supprimé ;
- garbage éventuellement présent avant cron ;
- nettoyage après scheduled/attente raisonnable ou déclenchement contrôlé si possible ;
- R2 vidé pour les assets de test.

Ne jamais exposer de bucket publiquement pour vérifier.

---

# 22. Coûts / usage

Après la recette, examiner dans le dashboard ou outils disponibles :

- requêtes Worker ;
- D1 reads/writes ;
- taille D1 ;
- R2 operations/storage ;
- rate limiting ;
- Turnstile analytics ;
- cron/errors.

Documenter les valeurs observables.

Ne pas extrapoler un coût mensuel précis à partir d’un test minuscule.

Créer si possible une alerte/budget uniquement si :
- disponible sur le plan ;
- non payant ;
- clairement compris.

Sinon documenter comment le faire plus tard.

Ne jamais upgrader le plan automatiquement.

---

# 23. Rollback

Préparer avant déploiement une procédure de rollback.

Minimum :

Frontend :
- revert du commit GitHub Pages vers build sans relais ou précédent build stable.

Worker :
- possibilité de redéployer la version précédente.

D1/R2 :
- ne jamais supprimer automatiquement les ressources de production lors d’un rollback frontend.

Turnstile :
- conserver le widget tant que des publications pourraient l’utiliser.

Documenter le rollback, ne le déclencher qu’en cas de problème réel.

---

# 24. Documentation de production

Créer / mettre à jour :

```text
docs/PRODUCTION_DEPLOYMENT_V0.md
docs/PRODUCTION_PILOT_REPORT_V0.md
docs/CLOUDFLARE_DEPLOYMENT_V0.md
README.md
```

Le rapport final doit contenir SANS SECRET :

- compte/plan seulement si non sensible ;
- noms des ressources ;
- IDs publics/non secrets nécessaires ;
- juridictions ;
- Worker URL ;
- relayId ;
- sitekey Turnstile ;
- commit déployé ;
- migrations ;
- tests ;
- recette téléphone ;
- résultats cron/cleanup ;
- observations quotas/coûts ;
- incidents ;
- limites restantes.

Ne jamais inclure :
- Turnstile secret ;
- API token ;
- auth cookie ;
- clé admin d’un sondage test ;
- données personnelles.

---

# 25. Bundle audit v0.3D

À la fin :

```text
VOTI_AUDIT_V0_3D.zip
```

Utiliser le mécanisme `npm run audit:bundle`.

Le script doit explicitement exclure toute archive :

```text
VOTI_AUDIT_*.zip
```

même si une archive était accidentellement suivie par Git.

Le bundle doit exclure :
- node_modules ;
- runtime Node local ;
- `.wrangler` ;
- `.relay-local` ;
- `.dev.vars` ;
- credentials ;
- caches ;
- DB locales ;
- R2 local ;
- profils/captures ;
- fichiers secrets.

---

# 26. Hors périmètre

Ne pas développer maintenant :

- QR ;
- PDF ;
- comptes ;
- groupes ;
- Android ;
- Capacitor ;
- commentaires ;
- une-personne-un-vote ;
- synchro offline différée ;
- chiffrement E2E ;
- domaine personnalisé ;
- Cloudflare Images ;
- nouveau design général.

---

# 27. Critère de succès

v0.3D est terminé lorsque :

- D1 EU existe ;
- R2 EU privé existe ;
- Turnstile réel existe ;
- Worker réel est déployé ;
- migrations réelles sont appliquées ;
- GitHub Pages utilise le relais réel ;
- création distante passe par Turnstile réel ;
- téléphone peut voter sans Turnstile ;
- seuil/résultats/verrouillage/fermeture fonctionnent ;
- clé admin export/import fonctionne ;
- suppression fonctionne ;
- garbage/cron est vérifié ;
- aucun secret n’est dans Git ou les rapports ;
- coûts/quotas initiaux sont inspectés ;
- bundle audit v0.3D est produit.

---

# 28. Important : ne jamais inventer un succès

Toute étape réelle doit être vérifiée.

Si une ressource ne peut pas être créée :
- arrêter au point concerné ;
- conserver les étapes déjà réussies ;
- expliquer précisément le blocage.

Ne jamais écrire :
- « déployé » sans URL/réponse réelle ;
- « Turnstile validé » sans challenge réel sur GitHub Pages ;
- « téléphone validé » sans confirmation de Lu’uma ;
- « cron fonctionne » sans observation réelle.

Lu’uma effectue les actions physiques demandées et confirme leurs résultats.
