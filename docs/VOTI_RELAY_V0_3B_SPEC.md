# Voti — v0.3B — Premier relais réel Cloudflare + parcours multi-appareils

**Statut :** spécification de développement  
**Objectif :** implémenter le premier relais HTTP réel de Voti, testable localement de bout en bout, tout en conservant l’abstraction `RelayAdapter` et en ajoutant quatre micro-corrections graphiques déjà validées.

---

# 0. Autorités et principe

Le contrat de référence est celui de v0.3A :

- `docs/RELAY_CONTRACT_V0.md`
- `docs/VOTI_RELAY_V0_3A_SPEC.md`
- `docs/CODEX_RELAY_V0_3A_REPORT.md`

Le backend Cloudflare est une **implémentation** du contrat. Il ne doit pas contaminer le modèle de domaine avec des objets Cloudflare.

Le mode local v0.2B.2 reste fonctionnel.

---

# 1. Architecture retenue

```text
GitHub Pages / HTML autonome Voti
              │
              │ HTTPS + JSON
              ▼
       HttpRelayAdapter
              │
              ▼
      Cloudflare Worker
        │            │
        ▼            ▼
       D1            R2
 état / votes     images
```

## Choix

- **Worker** : transport HTTP, validation, CORS, orchestration.
- **D1** : sondages, préparations de publication, révisions, capacités dérivées, liens d’assets et bulletins anonymes minimaux.
- **R2** : octets des images utilisateur distantes.
- **Rate Limiting binding** : protection grossière sans créer une table applicative d’IP.
- **Aucun compte** dans ce lot.
- **Aucun cookie / session**.
- **Aucun secret d’infrastructure dans le client**.

Le D1 et le R2 de production devront être créés en juridiction UE si cette option est disponible lors du déploiement.

---

# 2. Frontière fournisseur

Les fichiers partagés (`shared/`) ne doivent pas importer d’API Cloudflare.

Créer une implémentation HTTP cliente distincte, par exemple :

```text
web/http-relay.js
```

Créer le backend dans un espace clairement isolé, par exemple :

```text
relay/cloudflare/
```

Le reste du projet doit pouvoir, plus tard, recevoir une autre implémentation HTTP/backend sans réécrire le moteur.

---

# 3. HTTP API v1

Préfixe recommandé :

```text
/api/v1
```

Routes conceptuelles :

```text
POST   /api/v1/publications
GET    /api/v1/publications/:pollId/missing-assets
PUT    /api/v1/publications/:pollId/assets/:assetId
POST   /api/v1/publications/:pollId/commit
DELETE /api/v1/publications/:pollId

GET    /api/v1/polls/:pollId
PATCH  /api/v1/polls/:pollId/definition
PATCH  /api/v1/polls/:pollId/style
POST   /api/v1/polls/:pollId/close

POST   /api/v1/polls/:pollId/votes
GET    /api/v1/polls/:pollId/results
GET    /api/v1/polls/:pollId/assets/:assetId
```

Les noms exacts peuvent être ajustés si nécessaire pour correspondre à `RelayAdapter`, mais l’API doit rester :
- versionnée ;
- explicite ;
- sans méthode raw-ballots.

---

# 4. Capacité administrateur

Utiliser la capacité 256 bits de v0.3A.

Pour HTTP :

```text
Authorization: Bearer <adminCapability>
```

La capacité :
- n’est jamais dans l’URL ;
- n’est jamais renvoyée par une route publique ;
- n’est jamais loggée volontairement ;
- n’est jamais stockée en clair dans D1.

D1 conserve uniquement le dérivé prévu par le contrat v0.3A.

Ne pas inventer de mot de passe ou de compte.

---

# 5. CORS

Production autorisée :

```text
https://luuma8888.github.io
```

Développement :
- origines localhost nécessaires aux tests/dev.

Règles :
- comparaison exacte des origines ;
- `Vary: Origin`;
- OPTIONS/preflight correctement traité ;
- méthodes et headers minimaux ;
- autoriser `Authorization` pour l’administration ;
- aucun `Access-Control-Allow-Credentials`;
- aucun cookie.

CORS n’est pas considéré comme une authentification.

L’origine de production doit être configurable, pas dispersée en chaînes littérales dans le code.

---

# 6. D1 — modèle minimal

Créer des migrations versionnées.

Tables minimales conceptuelles :

## `polls`

Contient :
- poll_id ;
- schema_version ;
- status ;
- revision ;
- definition JSON canonique/validé ;
- style JSON ;
- accessRules JSON ;
- resultRules JSON ;
- definitionHash ;
- adminCapabilityHash ;
- état de verrouillage ;
- dates de cycle de vie nécessaires hors bulletins.

Ne jamais stocker la capacité brute.

## `ballots`

Contient seulement ce qui est nécessaire au domaine :

```text
poll_id
action_id
choice_id
```

Contrainte d’unicité :

```text
UNIQUE(poll_id, action_id)
```

Pas de :
- userId ;
- IP ;
- User-Agent ;
- fingerprint ;
- session ;
- origine ;
- timestamp précis de bulletin.

## `publications` / `staging`

Préparation privée avant publication :
- poll_id ;
- capacité dérivée ;
- définition préparée ;
- révision de préparation ;
- expiration.

Une préparation abandonnée doit avoir une durée de vie bornée.

Valeur MVP recommandée :
- 24 heures.

## relations d’assets

Conserver explicitement quels assets sont référencés par quel sondage afin que la lecture publique d’un objet R2 soit contextualisée par le sondage.

---

# 7. R2 — clés des objets

Éviter une URL R2 publique.

Les objets sont servis uniquement à travers le Worker.

Clé recommandée :

```text
polls/<pollId>/<assetId>
```

Même si deux sondages utilisent les mêmes octets, cette première implémentation peut conserver deux objets distincts pour simplifier :
- isolation ;
- suppression ;
- autorisation ;
- raisonnement confidentialité.

La déduplication inter-sondages n’est pas un objectif v0.3B.

---

# 8. Publication avec images

Flux :

```text
prepare
→ missing assets
→ upload assets nécessaires
→ commit
```

Au commit :

- toutes les références doivent exister ;
- métadonnées cohérentes ;
- hash cohérent ;
- définition valide ;
- aucune publication partielle publique.

Une préparation expirée/refusée ne devient jamais visible publiquement.

Prévoir le nettoyage des objets d’une préparation abandonnée/expirée.

Un nettoyage opportuniste + commande/test explicite est acceptable pour ce lot ; documenter exactement ce qui est garanti.

---

# 9. Atomicité du vote

Le point critique de v0.3B est le premier vote.

Le backend réel doit garantir :

```text
validation sondage
+ validation choix
+ unicité actionId
+ création bulletin
+ verrouillage si premier bulletin
+ changement de révision
```

sans fenêtre où une définition pourrait être modifiée après le premier bulletin.

Utiliser les mécanismes transactionnels/contraintes de D1 correctement.

Ne pas reproduire naïvement une séquence :

```text
SELECT
puis INSERT
puis UPDATE
```

sans protection contre la concurrence.

Créer des contraintes / triggers / batch transactionnel ou autre stratégie D1 démontrée par les tests.

Documenter l’approche exacte.

---

# 10. Révisions

Respecter le contrat v0.3A :

- révision attendue pour mutations admin ;
- `REVISION_CONFLICT` si obsolète ;
- aucune fusion silencieuse ;
- retry idempotent ne change pas la révision ;
- vote effectif change la révision.

Ne pas transformer la révision en compteur public exact de bulletins.

---

# 11. Résultats

Le Worker calcule/projette uniquement les résultats autorisés.

Sous le seuil :
- aucune distribution ;
- aucun compteur si masqué.

Aucune route publique ne retourne la table des bulletins.

Le client distant ne télécharge jamais les bulletins pour calculer lui-même les résultats.

---

# 12. Rate limiting sans table d’IP

Utiliser si disponible le binding Cloudflare Rate Limiting.

Objectif :
- protection grossière anti-abus ;
- pas garantie comptable ;
- pas unicité par personne.

Ne pas persister d’IP dans D1.

Pour le MVP, préférer des clés non personnelles telles que :
- `pollId + catégorie de route`;
- dérivé de capacité pour opérations admin.

Documenter que ce mécanisme peut limiter collectivement un sondage et n’est pas une protection absolue contre le déni de service.

Retourner `RATE_LIMITED` / HTTP 429.

---

# 13. Logs et confidentialité

Le code applicatif ne doit jamais logger volontairement :
- `Authorization`;
- capacité ;
- corps d’un vote ;
- IP ;
- User-Agent ;
- contenu binaire d’image.

Les erreurs peuvent contenir :
- code structuré ;
- route générique ;
- identifiant public du sondage si nécessaire au diagnostic ;

sans données secrètes.

Documenter :
- Voti ne persiste pas les métadonnées réseau dans les bulletins ;
- Cloudflare peut traiter/journaliser des métadonnées d’infrastructure ;
- cela n’est pas un anonymat réseau.

---

# 14. HttpRelayAdapter

Créer une implémentation réelle de `RelayAdapter` utilisant `fetch`.

Responsabilités :
- sérialisation JSON ;
- auth admin ;
- timeout/AbortController ;
- mapping HTTP → codes `RelayError`;
- contrôle de taille ;
- validation de la forme des réponses ;
- upload et lecture d’assets ;
- aucun accès au DOM.

Ne pas dupliquer les règles métier côté client au lieu de faire confiance au relais autoritaire.

---

# 15. Configuration du relais

Prévoir un mécanisme clair de configuration de :

```text
relayId
baseUrl
```

Exemple :
- configuration de build ;
- fichier source unique ;
- constante générée.

Ne pas coder l’URL du futur Worker dans 10 fichiers.

Comportement :
- relais non configuré → mode local fonctionne normalement ;
- relais configuré → publication distante disponible.

Le build autonome local ne doit pas être cassé si aucun relais n’est configuré.

---

# 16. Parcours UI réel

Ajouter une interface minimale, claire, sans nouvelle refonte globale.

## Créateur

Pour un sondage publié localement sans bulletin :

```text
[ Publier en ligne ]
```

Après publication distante :

```text
En ligne
[ Ouvrir le lien public ]
[ Copier le lien ]
[ Résultats ]
[ Gérer ]
```

Si le sondage possède déjà un bulletin local :

```text
Publication en ligne impossible pour ce sondage :
il contient déjà des votes locaux.
```

Ne pas fusionner.

## Votant

Nouvelle route :

```text
#/p/<pollId>
```

Elle charge le sondage depuis le relais.

Le votant :
- choisit ;
- continue ;
- confirme ;
- vote via le relais ;
- reçoit succès / retry idempotent ;
- ne crée pas de ballot local.

## Résultats publics

```text
#/p/<pollId>/results
```

Charge la projection distante.

Sous seuil : message de verrouillage.

---

# 17. Un sondage distant ne vote plus localement

Dès qu’un sondage est rattaché à un relais :

- l’action `Voter` du créateur doit ouvrir/utiliser le parcours distant ;
- ne pas créer en parallèle de bulletins dans le snapshot local ;
- résultats distants = autorité ;
- fermeture distante = autorité.

Éviter absolument deux historiques de votes indépendants pour le même sondage.

---

# 18. Administration distante

Pour le créateur possédant la capacité :

Avant premier vote distant :
- modification de définition permise via le relais ;
- modification des images permise ;
- révision contrôlée.

Après premier vote :
- définition/images sémantiques refusées ;
- style reste modifiable ;
- fermeture reste possible.

Si le relais retourne `REVISION_CONFLICT` :
- recharger ;
- informer clairement l’utilisateur ;
- ne pas écraser silencieusement.

---

# 19. État déconnecté / indisponible

Ce lot n’implémente pas la synchronisation offline distribuée.

Si le sondage est distant et le relais indisponible :
- afficher un message clair ;
- ne pas inventer un vote local à synchroniser plus tard ;
- ne pas prétendre que le vote a réussi.

Le mode local des sondages non distants continue à fonctionner.

---

# 20. Micro-corrections graphiques obligatoires

Ces points ont été validés humainement et doivent être traités dans ce lot, sans rouvrir une refonte générale.

## 20.1 Fond Voti Pop

Actuellement le fond est limité à une bande liée au contenu.

Corriger pour que le décor Voti Pop couvre le **viewport complet**, indépendamment :
- de la hauteur du contenu ;
- du scroll ;
- de la longueur de la page.

Approche souhaitée :
- couche décorative `position: fixed` ou équivalent ;
- `inset: 0`;
- derrière l’application ;
- aucun impact sur clics ;
- opacité discrète ;
- pas de parallax animé.

## 20.2 Mascotte réellement visible

La mascotte ne doit plus être quasiment invisible car limitée au seul état bibliothèque vide.

L’utiliser à **2 ou 3 endroits maximum**, choisis parmi :
- accueil vide ;
- confirmation de création/publication ;
- succès de vote ;
- publication en ligne réussie.

Taille suffisante pour être identifiable, sans prendre le dessus sur la tâche.

Ne pas la mettre sur chaque sondage.

## 20.3 Image de la question

L’image ne doit plus apparaître comme une pièce jointe flottante sans lien avec le titre.

Créer un vrai composant média de question :

```text
Question
+ description éventuelle
+ image associée intégrée dans le même bloc visuel
```

Desktop :
- image et texte peuvent partager une composition cohérente.

Mobile :
- empilement propre.

Pour une image verticale :
- conserver l’image entière (`contain`) ;
- utiliser une surface/fond harmonisé autour ;
- éviter les grandes zones blanches arbitraires.

L’image doit paraître appartenir au sondage.

## 20.4 Images des choix prioritaires

Lorsqu’un sondage comporte des images de choix :

**l’image devient l’information visuelle principale** ;
le texte sert à nommer/confirmer ce qui a été compris.

Ne plus afficher une petite vignette secondaire à droite.

Créer un mode de choix illustré :
- cartes visuelles ;
- image beaucoup plus grande ;
- texte clairement associé ;
- contrôle radio / sélection accessible ;
- état sélectionné évident ;
- clavier ;
- tactile ;
- responsive.

Desktop :
- grille raisonnable (selon largeur/nombre de choix) ou grandes cartes.

Mobile :
- une ou deux colonnes seulement si la largeur réelle reste confortable ;
- sinon une colonne.

Les choix sans image restent utilisables.
Dans un sondage mixte, conserver une hauteur/hiérarchie cohérente sans inventer d’image.

## 20.5 Gestion / récapitulatif

Ne plus présenter les choix illustrés comme :

```text
• texte     [miniature]
```

Réutiliser une présentation visuelle cohérente avec le vote :
- média ;
- libellé ;
- état.

La page de gestion peut être plus compacte que la page de vote, mais l’image ne doit pas devenir une micro-vignette décorative.

---

# 21. Tests graphiques

Ajouter des assertions/captures pour :

- fond couvrant le viewport à 360 et 1200 px ;
- scroll long sans coupure du fond ;
- mascotte visible dans au moins deux états pertinents ;
- image de question intégrée au bloc question ;
- choix illustrés avec image dominante ;
- sondage mixte image/sans image ;
- 2, 3 et 6 choix ;
- portrait et paysage ;
- aucune déformation ;
- texte toujours présent ;
- clavier/focus ;
- cinq thèmes ;
- aucun débordement 360 px.

Ne pas reprendre toute la direction artistique.

---

# 22. Tests backend locaux

Utiliser Wrangler/local bindings pour tester réellement :
- Worker ;
- D1 local ;
- R2 local ;
- CORS ;
- HTTP ;
- assets.

Les tests de contrat existants sur InMemoryRelayAdapter restent actifs.

Ajouter une suite d’intégration du backend réel.

Scénarios obligatoires :

1. prepare → upload → commit ;
2. second client GET poll ;
3. vote ;
4. retry identique ;
5. actionId différent = vote distinct ;
6. même actionId/autre choix refusé ;
7. course vote vs modification ;
8. revision conflict ;
9. résultats 0/4/5 ;
10. closed sous seuil ;
11. closed avec seuil ;
12. style post-lock ;
13. definition post-lock refusée ;
14. capacité invalide ;
15. asset absent ;
16. asset corrompu ;
17. asset inaccessible hors contexte ;
18. CORS origine autorisée ;
19. CORS origine refusée ;
20. payload trop gros ;
21. rate limit testable ou binding simulé proprement ;
22. aucune route ballots ;
23. reload Worker avec persistance D1/R2 locale ;
24. app statique → HttpRelayAdapter → Worker local complet.

---

# 23. Migrations et commandes

Créer :
- configuration Wrangler ;
- migrations D1 ;
- scripts npm nécessaires ;
- documentation de création D1/R2 ;
- documentation de lancement local ;
- documentation de déploiement futur.

Les migrations doivent être versionnées.

Ne pas créer ou modifier de ressource Cloudflare distante sans autorisation explicite de Lu’uma.

---

# 24. Juridiction de production

Pour le futur déploiement réel, documenter comme choix recommandé :

- D1 : juridiction `eu` si disponible ;
- R2 : juridiction UE si disponible.

Ne pas prétendre que cela rend tout le traitement réseau exclusivement européen ; documenter précisément ce que la juridiction couvre.

---

# 25. Déploiement : PAS encore automatique

v0.3B doit produire un backend **déployable** et complètement testé localement.

Ne pas exécuter :
- création de D1 distante ;
- création R2 distante ;
- migration distante ;
- `wrangler deploy`;

sans instruction explicite de Lu’uma.

Le lot suivant très court pourra être :
- provisionnement ;
- déploiement ;
- configuration GitHub Pages ;
- test Chromebook ↔ téléphone réel.

---

# 26. Hors périmètre

Ne pas développer :
- QR ;
- PDF ;
- comptes ;
- groupes ;
- VoteEligibility ;
- une-personne-un-vote ;
- Android ;
- Capacitor ;
- synchronisation offline différée ;
- commentaires ;
- modes de vote supplémentaires ;
- chiffrement E2E des bulletins.

---

# 27. Livrables

Créer au minimum :

```text
relay/cloudflare/...
migrations/...
web/http-relay.js
docs/CLOUDFLARE_RELAY_V0.md
docs/CLOUDFLARE_DEPLOYMENT_V0.md
docs/CODEX_RELAY_V0_3B_REPORT.md
```

Adapter les chemins si l’architecture le nécessite.

Le rapport doit inclure :

- architecture ;
- schéma D1 ;
- clés R2 ;
- stratégie d’atomicité ;
- mapping HTTP/RelayAdapter ;
- CORS ;
- rate limiting ;
- logs/confidentialité ;
- configuration client ;
- UI de publication/vote distant ;
- traitement des quatre micro-corrections graphiques ;
- fichiers créés/modifiés ;
- migrations ;
- tests unitaires ;
- tests intégration Wrangler ;
- tests navigateur ;
- résultats exacts ;
- limites ;
- décisions nécessaires avant déploiement réel.

---

# 28. Critère de sortie

Le lot est terminé si, entièrement en local :

```text
Navigateur créateur
→ Worker local
→ D1/R2 locaux
→ publication distante simulée réelle HTTP

Second contexte navigateur
→ charge #/p/<pollId>
→ récupère question + images
→ vote via Worker

Premier navigateur
→ voit l’état distant
→ ne peut plus modifier la définition
→ résultats restent masqués sous seuil

Votes supplémentaires
→ seuil atteint
→ résultats publics

Créateur
→ ferme le sondage
```

et si le mode local sans relais reste intact.
