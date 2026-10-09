# Voti — v0.3C — Durcissement pré-déploiement, anti-abus et cycle de vie

## Objectif

Sécuriser le relais v0.3B avant toute exposition Internet publique.

Ce lot doit traiter :
1. abus de création/publication ;
2. rate limiting trop collectif des assets ;
3. suppression distante d’un sondage ;
4. politique de rétention ;
5. nettoyage D1/R2 moins coûteux ;
6. durcissement de la validation d’images ;
7. préparation du déploiement réel ;
8. bundle d’audit léger automatique.

Aucun déploiement Cloudflare distant n’est autorisé dans ce lot.

---

# 1. Protection de création/publication

La capacité admin auto-générée ne doit plus suffire à ouvrir un nombre illimité de publications.

Ajouter une protection distincte :

## Turnstile

Le démarrage d’une nouvelle publication distante exige un jeton Turnstile valide.

Le vote public NE requiert PAS Turnstile.

Contraintes :
- vérification côté Worker ;
- secret Turnstile uniquement en secret Worker ;
- site key publique configurable côté client ;
- token à usage court ;
- aucune validation purement client ;
- erreurs structurées ;
- aucune conservation du token dans D1.

En environnement local/test :
- fournir une stratégie de test officielle/configurable ;
- ne pas mettre un secret réel dans Git.

## Rate limit global de création

Ajouter en plus un rate limit de sécurité indépendant de `adminCapability`.

Il doit viser uniquement :
- création/préparation d’une nouvelle publication.

Il ne doit pas utiliser la capacité client comme seule clé.

Ne pas persister d’IP en D1.

L’implémentation peut utiliser les primitives edge/rate limiting de Cloudflare ; documenter précisément le compromis confidentialité/anti-abus.

Objectif :
empêcher qu’un attaquant génère en boucle de nouvelles capacités pour contourner la limite.

---

# 2. Rate limiting par type d’opération

Revoir les clés et seuils.

## Votes
Conserver une protection collective raisonnable sans prétendre assurer une voix/personne.

## Assets publics
Ne plus partager un seul bucket trop faible pour toutes les images d’un sondage.

Utiliser au minimum une clé contextualisée par :

`pollId + assetId`

ou une stratégie équivalente évitant qu’un sondage illustré normal sature son quota.

Le quota asset doit supporter sans difficulté un groupe jeunesse ouvrant simultanément un sondage avec 6 images.

## Administration
Continuer à utiliser une clé dérivée de la capacité pour les opérations d’administration d’un sondage existant.

## Création
Clé/limite indépendante de la capacité auto-générée.

Documenter tous les seuils.

---

# 3. Cache des assets

Les assets sont immuables et adressés par contenu.

Ajouter des headers cache publics adaptés sur les réponses d’assets, si cela reste compatible avec leur contrôle d’accès contextualisé.

Exemple de direction :
- cache navigateur long ;
- immutable lorsque pertinent ;
- ETag ou identifiant de contenu si utile.

Ne rendre aucun bucket R2 public.

Ne permettre l’accès que si le sondage référence bien l’asset.

---

# 4. Suppression distante

Ajouter une vraie opération administrateur `deletePoll`.

Elle exige :
- capacité valide ;
- revision/contrôle de concurrence approprié ;
- confirmation UI explicite.

Effets :
- sondage public inaccessible ;
- résultats inaccessibles ;
- vote refusé ;
- suppression ou mise en file de suppression des assets R2 ;
- suppression des relations ;
- suppression des bulletins ;
- suppression des données D1 associées ;
- suppression de la connexion distante locale côté créateur après succès.

Ne jamais confondre fermer et supprimer.

Après suppression :
- GET poll -> NOT_FOUND ;
- vote -> NOT_FOUND ;
- résultat -> NOT_FOUND ;
- asset -> NOT_FOUND.

Prévoir un mécanisme sûr si D1 est supprimé avant que R2 ne puisse être nettoyé :
- tombstone/garbage durable ;
- nettoyage rejouable.

---

# 5. Politique de rétention

Documenter et implémenter une première politique simple.

Choix MVP :

## Préparations non publiées
Expiration : 24 h, déjà présente.

## Sondages publiés
Pas d’expiration automatique tant que le créateur ne les supprime pas.

## Sondages supprimés
Données métier supprimées immédiatement dans la mesure du possible.
Garbage R2 nettoyé de façon rejouable.

## Logs applicatifs
Voti ne crée pas de journal applicatif contenant :
- IP ;
- User-Agent ;
- Authorization ;
- contenu de vote ;
- contenu d’image.

Documenter que Cloudflare peut conserver ses propres logs/informations de réseau indépendamment de Voti.

Ne pas inventer de durée Cloudflare non vérifiée.

---

# 6. Nettoyage moins coûteux

v0.3B lance actuellement un cleanup opportuniste après de nombreuses requêtes réussies.

Modifier :

- cron/scheduled devient le mécanisme principal ;
- cleanup opportuniste uniquement après certaines mutations pertinentes OU probabiliste très faible ;
- jamais après chaque lecture d’asset ou GET public ;
- conserver une commande locale explicite ;
- bornes de lots conservées.

Ajouter des tests montrant que :
- un GET normal ne déclenche pas systématiquement un nettoyage D1/R2 ;
- le cron nettoie correctement ;
- suppression de sondage crée/nettoie correctement le garbage.

---

# 7. Durcissement serveur des images

Le backend v0.3B valide structure/hash/type/taille sans décodage complet.

Pour v0.3C :

- inspecter les capacités réalistes de l’environnement Worker ;
- si un décodage d’image borné fiable est raisonnablement possible sans architecture disproportionnée, l’ajouter ;
- sinon renforcer au maximum le parseur structurel et documenter explicitement la limite.

Ne pas ajouter une énorme dépendance native ou WASM uniquement pour cocher cette case sans bénéfice clair.

Au minimum :
- refuser structures ambiguës ;
- valider dimensions réelles depuis le conteneur ;
- refuser animation ;
- vérifier cohérence MIME/signature ;
- limites strictes octets/pixels/dimensions ;
- hash obligatoire.

Le navigateur Voti continue de réencoder les images avant upload.

---

# 8. Capacité administrateur : préparation du futur transfert

Ne pas créer encore de système de comptes.

Mais préparer un mécanisme export/import explicite de la capacité distante.

NE PAS l’ajouter automatiquement au backup JSON historique sans action utilisateur claire.

Ajouter dans la gestion d’un sondage distant une fonction du type :

`Exporter la clé d’administration`

Format minimal versionné, contenant :
- relayId ;
- pollId ;
- adminCapability ;
- version.

Le fichier doit afficher clairement :
- qu’il permet d’administrer le sondage ;
- qu’il doit rester secret ;
- qu’une personne qui le possède peut administrer le sondage.

Ajouter :
`Importer une clé d’administration`

Contraintes :
- validation stricte ;
- vérifier le sondage auprès du relais avant d’accepter localement ;
- ne jamais écraser silencieusement une autre capacité ;
- confirmation utilisateur.

Nom de fichier possible :
`voti-admin-<pollId>.json`

Ce n’est PAS encore `.sondagebox`.

---

# 9. UI Turnstile

Le challenge de création doit apparaître uniquement au moment de `Publier en ligne`.

Ne pas afficher Turnstile :
- pour créer localement ;
- pour voter ;
- pour voir les résultats ;
- pour administrer un sondage existant.

Si Turnstile est indisponible :
- expliquer que la publication en ligne ne peut pas être démarrée ;
- mode local reste utilisable.

Le challenge doit être compatible mobile.

---

# 10. Configuration

Ajouter configuration centralisée pour :

- Turnstile site key publique ;
- relay URL ;
- relay ID ;
- politiques/rate limits documentés.

Secrets :
- Turnstile secret uniquement via secret Worker / environnement ;
- jamais dans Git ;
- jamais dans HTML final.

Le build sans relais doit continuer à fonctionner.

---

# 11. Codes d’erreur

Ajouter si nécessaire :

- HUMAN_VERIFICATION_REQUIRED
- HUMAN_VERIFICATION_FAILED
- CREATION_RATE_LIMITED
- POLL_DELETED

Préférer NOT_FOUND après suppression sur les endpoints publics afin de ne pas exposer inutilement l’historique.

L’UI doit transformer les codes en français simple.

---

# 12. Tests obligatoires

## Turnstile
- token valide ;
- absent ;
- invalide ;
- expiré/rejoué si applicable ;
- secret absent ;
- local/test mode ;
- vote sans Turnstile fonctionne toujours.

## Anti-abus création
- nouvelles capacités successives ne contournent pas la limite globale ;
- limite création renvoie 429/code structuré ;
- admin d’un sondage existant continue normalement.

## Assets
- plusieurs assets d’un même sondage ne partagent plus un bucket trop faible ;
- cache headers corrects ;
- asset hors contexte toujours refusé.

## Suppression
- deletePoll autorisé ;
- capacité invalide refusée ;
- revision conflict ;
- poll inaccessible après suppression ;
- résultats/votes/assets inaccessibles ;
- nettoyage R2 ;
- reprise si suppression R2 échoue.

## Rétention/cleanup
- préparation expirée ;
- cron ;
- GET public ne nettoie pas systématiquement ;
- garbage rejouable.

## Capacité export/import
- export ;
- import valide ;
- format invalide ;
- capacité incorrecte ;
- conflit local ;
- vérification distante ;
- aucun secret dans logs/URL.

## Régression
Conserver :
- tests v0.3A ;
- tests v0.3B ;
- mode local ;
- images ;
- cinq thèmes ;
- file:// ;
- multi-client HTTP local.

---

# 13. Tests locaux réels

Relancer :

- npm test
- npm run check
- npm run build
- npm run test:relay
- npm run test:integration
- npm run test:browser
- git diff --check

Utiliser les bindings Wrangler locaux.

Aucune ressource Cloudflare distante.

---

# 14. Documentation

Mettre à jour/créer :

- docs/CLOUDFLARE_RELAY_V0.md
- docs/CLOUDFLARE_DEPLOYMENT_V0.md
- docs/PRIVACY_AND_ABUSE_V0.md
- docs/CODEX_RELAY_V0_3C_REPORT.md

Documenter :
- Turnstile ;
- rate limits ;
- rétention ;
- suppression ;
- cache assets ;
- cleanup ;
- capacités ;
- limites confidentialité ;
- validations images ;
- décisions restantes avant production.

---

# 15. Bundle audit léger

À la toute fin, créer :

`VOTI_AUDIT_V0_3C.zip`

avec uniquement les fichiers renvoyés par :

`git ls-files -co --exclude-standard`

Le ZIP ne doit jamais contenir :
- node_modules ;
- runtime Node local ;
- cache npm ;
- .wrangler ;
- D1/R2 locaux ;
- profils Chromium ;
- captures ;
- caches ;
- fichiers ignorés par Git.

Créer ce ZIP seulement APRÈS tous les tests et le rapport.

Ne l’ajouter ni à Git ni au commit.

---

# 16. Hors périmètre

Ne pas :
- provisionner Cloudflare distant ;
- wrangler deploy ;
- créer D1/R2 distants ;
- QR ;
- PDF ;
- comptes ;
- groupes ;
- Android ;
- Capacitor ;
- vote unique par personne ;
- synchronisation offline ;
- commentaires ;
- modes de vote supplémentaires.

---

# 17. Critère de sortie

v0.3C est terminé lorsque :

1. un attaquant ne peut plus contourner la protection de création simplement en régénérant une capacité ;
2. un sondage illustré supporte un groupe réel sans saturer immédiatement le quota assets ;
3. un créateur peut supprimer son sondage distant ;
4. le nettoyage R2/D1 est rejouable et moins coûteux ;
5. la capacité d’administration peut être sauvegardée/restaurée explicitement ;
6. tous les tests locaux sont verts ;
7. aucun déploiement distant n’a été effectué ;
8. le bundle `VOTI_AUDIT_V0_3C.zip` est produit.
