# Audit ChatGPT — Voti v0.3B

Date : 9 octobre 2026  
Base auditée : `VOTI_AUDIT_V0_3B.zip` + rapport Codex v0.3B

## Verdict

Le lot v0.3B est **validé pour commit**, mais **pas encore pour exposition Internet publique**.

La réalisation est techniquement solide :
- séparation nette domaine / transport / fournisseur ;
- Worker Cloudflare isolé ;
- D1 et R2 utilisés via bindings ;
- `HttpRelayAdapter` indépendant du DOM ;
- capacité administrateur hors URL et hors modèle métier ;
- vote distant idempotent ;
- verrouillage atomique appuyé par SQL/triggers ;
- aucune route de bulletins bruts ;
- CORS exact ;
- mode local conservé ;
- branding et présentation des images améliorés.

Le bundle d’audit léger fonctionne très bien : environ 6 Mo extraits, sans `node_modules`, cache Wrangler, profils Chromium ou bases locales.

---

## Vérifications indépendantes réalisées

Dans le bundle fourni :

```text
npm test       -> succès
npm run check  -> succès
npm run build  -> succès
```

Exécution directe des onze fichiers de tests :

```text
150 tests
150 succès
0 échec
0 ignoré
```

Le build autonome produit un `index.html` de 458 960 octets.

Le test Chromium complet ne peut pas être rejoué dans l’environnement ChatGPT car Chromium y bloque les ouvertures `file://` avec :

```text
net::ERR_BLOCKED_BY_ADMINISTRATOR
```

Il s’agit de la même restriction d’environnement déjà observée dans les audits précédents, pas d’un échec Voti démontré.

---

## Points particulièrement solides

### Atomicité du premier vote

Le schéma D1 combine :
- clé primaire `(poll_id, action_id)` ;
- validation du choix/statut ;
- trigger de verrouillage ;
- incrément de révision ;

dans la transaction de l’insertion.

Cela évite la fenêtre classique :

```text
SELECT état
→ un autre client vote
→ UPDATE définition
```

Les mutations administratives réutilisent également une garde transactionnelle sur la révision et la capacité.

### Idempotence

Même `actionId` + même choix :
- retry accepté ;
- pas de nouveau bulletin ;
- pas de nouvelle révision.

Même `actionId` + autre choix :
- conflit.

Nouvel `actionId` :
- nouveau bulletin.

### Confidentialité applicative

La table `ballots` ne contient que :
- poll_id ;
- action_id ;
- choice_id.

Pas d’IP, User-Agent, identité, session ou horodatage individuel du vote.

### Assets

Les objets R2 ne sont pas directement publics.

Une image est lue dans le contexte d’un sondage qui la référence.

Les clés de tentative comportent un UUID pour éviter qu’un rollback concurrent supprime l’objet d’un autre upload.

### Client

Le client :
- n’envoie pas la capacité dans l’URL ;
- n’utilise pas de cookie ;
- refuse les redirections ;
- borne les réponses ;
- valide les projections reçues ;
- ne crée aucun vote local en cas d’échec réseau.

---

# Points à corriger AVANT exposition Internet publique

## 1. BLOQUANT — création de sondages / uploads insuffisamment protégée contre l’abus

Actuellement, n’importe quel client Internet peut :

1. générer lui-même une nouvelle capacité administrateur ;
2. appeler `POST /api/v1/publications` ;
3. préparer un nouveau sondage ;
4. envoyer des assets ;
5. publier.

Le rate limiting administratif utilise un dérivé de la capacité comme clé.

Or la capacité est générée par le client.

Un attaquant peut donc générer continuellement de nouvelles capacités et obtenir continuellement de nouveaux buckets de rate limiting.

Il n’existe actuellement :
- aucun compte ;
- aucun droit de création ;
- aucun quota global de création ;
- aucune limite durable du nombre de sondages publiés ;
- aucune barrière humaine type Turnstile ;
- aucun contrôle de création indépendant de la capacité auto-générée.

Conséquence :
un Worker exposé publiquement peut être utilisé pour créer de très nombreux sondages et objets R2, donc générer stockage, opérations et coûts.

### Recommandation

Avant le premier déploiement public utilisable, ajouter une protection de **création/publication** indépendante de la capacité.

La solution pourra être décidée dans le prochain lot, par exemple :
- rate limiting edge basé sur une caractéristique réseau sans persistance applicative ;
- Turnstile ;
- invitation / droit de publication temporaire ;
- combinaison de plusieurs mécanismes ;
- quotas globaux de sécurité.

La capacité de sondage doit continuer à servir à administrer CE sondage, mais ne doit pas être le seul frein à la création de nouveaux sondages.

---

## 2. IMPORTANT — rate limit des images trop collectif

Le rate limiter public utilise une clé de type :

```text
pollId + catégorie de route
```

Pour `getAsset`, plusieurs images du même sondage partagent donc le même quota de 120 appels / 60 s.

Un sondage avec :
- 1 image de question ;
- 6 images de choix ;

peut produire environ 7 téléchargements d’assets par votant.

Une vingtaine de votants arrivant presque en même temps peut donc suffire à atteindre le quota des assets, alors que l’usage est parfaitement légitime.

### Recommandation

Avant usage réel en groupe :
- clé `pollId + assetId` pour la lecture des assets, ou
- quota asset distinct nettement supérieur, et/ou
- cache contrôlé pour les assets immuables adressés par contenu.

Ce problème ne concerne pas les règles de vote mais peut casser l’affichage normal d’un sondage illustré.

---

## 3. IMPORTANT — aucune suppression / politique de rétention des sondages publiés

Une préparation expire après 24 h, mais un sondage réellement publié n’a pas de cycle de suppression.

Le créateur peut fermer un sondage, pas le supprimer.

Cela signifie que :
- poll ;
- définition ;
- images R2 ;
- bulletins ;

peuvent rester indéfiniment.

### Recommandation

Avant usage réel durable :
- opération administrateur `deletePoll` ;
- nettoyage des objets R2 associés ;
- politique de rétention documentée ;
- éventuellement archivage / durée configurable ultérieurement.

---

## 4. IMPORTANT POUR LA DURABILITÉ — capacité créateur non récupérable

La capacité créateur est stockée séparément dans le navigateur mais n’est pas incluse dans la sauvegarde.

Si le stockage navigateur disparaît :
- le sondage distant continue d’exister ;
- l’administration est perdue.

Le code et l’UI le signalent correctement.

Ce point n’empêche pas un premier test contrôlé, mais doit être résolu avant de confier Voti à des utilisateurs ordinaires.

Direction future :
- export sécurisé de la capacité ;
- futur `.sondagebox` ;
- ou comptes/gestion de récupération.

---

## 5. DURCISSEMENT — validation serveur des images

Le Worker valide :
- type ;
- structure ;
- hash ;
- dimensions déclarées ;
- taille.

Il ne décode pas réellement les pixels.

Le navigateur normal de Voti réencode les images avant upload, donc l’usage honnête est propre.

Mais l’API est appelable sans passer par le navigateur Voti.

Un client malveillant pourrait envoyer un fichier structurellement plausible mais problématique pour un décodeur consommateur.

À traiter avant une ouverture publique large.

Ce point devient particulièrement important tant que la création de publications est ouverte à tous.

---

## 6. OPTIMISATION — nettoyage opportuniste sur toutes les requêtes réussies

Le Worker appelle actuellement :

```text
ctx.waitUntil(cleanup(...))
```

après chaque opération HTTP réussie.

Cela inclut les lectures publiques et les assets.

Or un cron horaire existe déjà.

Pour une application fréquentée, cela peut créer des lectures/écritures D1 inutiles.

Recommandation :
- cron comme mécanisme principal ;
- nettoyage opportuniste uniquement sur certaines mutations ou de façon probabiliste/bornée.

Ce n’est pas un problème de correction fonctionnelle, mais de coût et de charge.

---

# Observations non bloquantes

## État de l’accueil pour les sondages distants

La bibliothèque utilise encore beaucoup l’état local/cache.

Gestion, vote et résultats relisent bien l’autorité distante.

L’accueil peut donc ponctuellement afficher un statut/résultat moins frais que la page distante elle-même.

Acceptable à ce stade, surtout puisque la priorité actuelle n’est plus l’UX.

## Node/Wrangler et taille du dépôt local

Les ~500 Mo du dossier de travail ne correspondent pas au code source Voti.

Le lot ajoute Wrangler, workerd, Node local et leurs dépendances de développement.

Ils sont ignorés par Git.

Le bundle d’audit créé via :

```text
git ls-files -co --exclude-standard
```

est la bonne méthode pour les prochains échanges.

---

# Décision

## Commit

**OUI.**

Le code v0.3B peut être commité et poussé.

Les problèmes identifiés concernent le passage de « backend fonctionnel local » à « service Internet exposé publiquement ».

## Déploiement public

**PAS ENCORE.**

Avant `wrangler deploy`, corriger au minimum le point 1 sur l’abus de création/publication.

Je recommande de traiter en même temps :
- protection de création ;
- rate limit assets ;
- suppression/rétention ;
- réduction du cleanup opportuniste.

La récupération de capacité et le décodage serveur peuvent être distingués entre :
- nécessaire pour premier pilote contrôlé ;
- nécessaire avant ouverture plus large.

---

# Prochain lot recommandé

`v0.3C — Pré-déploiement, anti-abus et cycle de vie`

Objectifs :

1. protection de création/publication indépendante de la capacité ;
2. rate limiting adapté aux assets et votes ;
3. suppression distante administrateur ;
4. politique de rétention ;
5. nettoyage moins coûteux ;
6. configuration de production Cloudflare ;
7. ensuite seulement provisioning D1/R2 + premier déploiement réel.

Après ce durcissement, recette réelle :

```text
Chromebook créateur
→ GitHub Pages
→ Worker Cloudflare
→ D1/R2
→ téléphone
→ vote
→ seuil
→ résultats
→ fermeture
```
