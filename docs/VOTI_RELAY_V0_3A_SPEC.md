# Voti — v0.3A — Contrat de relais Internet et état distant

**Statut :** spécification d’architecture, avant premier backend réel  
**Objectif :** préparer le passage de Voti d’un prototype local mono-navigateur à un sondage réellement partageable entre appareils, sans encore implémenter Cloudflare, QR, comptes ou synchronisation Android.

---

## 0. Notes visuelles différées

Ces deux retours humains sont enregistrés mais volontairement hors du prochain travail fonctionnel :

1. le fond Voti Pop devra ultérieurement couvrir le viewport indépendamment de la hauteur du contenu / scroll ;
2. la mascotte devra être réutilisée plus visiblement à quelques endroits choisis ; actuellement elle n’apparaît que dans la bibliothèque vide.

Ne pas corriger ces points dans v0.3A.

---

# 1. But du lot

v0.3A doit définir et tester les contrats nécessaires au futur relais Internet :

```text
Voti Web / futur Android
          ↓
     RelayAdapter
          ↓
 implémentation distante
```

Le lot ne crée pas encore de backend réel.

À la fin de v0.3A :

- le moteur local existant reste fonctionnel ;
- une abstraction RelayAdapter existe ;
- les états local / distant sont clairement séparés ;
- les invariants d’anonymat sont documentés ;
- le protocole de vote distant est spécifié ;
- la gestion des capacités créateur est spécifiée ;
- un adaptateur mémoire permet de tester les scénarios multi-clients ;
- aucun secret de backend n’est introduit dans le client ;
- la future implémentation Cloudflare peut être développée sans redessiner le domaine.

---

# 2. Principe central : le relais devient autorité pour un sondage distant

Un sondage local et un sondage publié sur un relais ne doivent pas être traités comme deux bases égales pouvant diverger silencieusement.

Pour un sondage distant :

- le relais est autorité sur :
  - statut distant ;
  - verrouillage après premier bulletin distant ;
  - révision ;
  - bulletins distants ;
  - disponibilité des résultats ;
- le client conserve :
  - une copie/cache utilisable par l’interface ;
  - les assets locaux du créateur ;
  - la capacité d’administration si ce navigateur est créateur.

Toute mutation distante doit être validée atomiquement côté relais.

---

# 3. Publication initiale

Pour le premier relais MVP :

**un sondage ne peut être publié en ligne que s’il ne contient encore aucun bulletin local.**

Raison :
- importer ou fusionner des bulletins locaux dans un nouveau relais introduirait immédiatement des problèmes d’unicité, de provenance et de synchronisation ;
- ce besoin pourra faire l’objet d’un lot distinct.

Un sondage illustré peut être publié : ses assets référencés font partie de la publication.

---

# 4. RemoteRef

Prévoir une structure locale non sémantique décrivant le rattachement distant.

Exemple conceptuel :

```text
RemoteRef
  relayId
  pollId
  revision
```

`pollId` peut conserver l’UUID du sondage existant si cela simplifie le domaine.

Le rattachement au relais :
- ne participe pas à `definitionHash`;
- ne doit pas être placé dans PollDefinition ;
- ne doit pas affecter le sens du vote.

Ne pas stocker l’URL complète du backend partout dans le modèle métier.

---

# 5. Capacité créateur

En l’absence de comptes, l’administration distante repose sur une capacité secrète par sondage.

Principes :

- générer côté client avec une primitive cryptographique système ;
- entropie minimale recommandée : 256 bits ;
- jamais dans l’URL publique de vote ;
- jamais dans le HTML statique ;
- jamais dans PollDefinition ;
- jamais envoyée à un votant ;
- le relais ne conserve qu’un dérivé/hash adapté à la vérification ;
- toute requête d’administration doit fournir la capacité ;
- si elle est perdue, aucune récupération par compte n’existe dans cette première version.

Le stockage local de cette capacité doit être isolé des données publiques du sondage.

La question de son inclusion dans le futur `.sondagebox` sera traitée séparément. v0.3A peut définir le format local mais ne doit pas l’ajouter silencieusement aux exports existants.

---

# 6. Identifiant public

Le sondage distant doit être accessible par un identifiant public non séquentiel et difficile à deviner.

Un UUID v4 existant convient pour le MVP si le contrat le garantit.

L’identifiant public n’est pas une authentification.

---

# 7. RelayAdapter

Définir une interface indépendante de `fetch`, Cloudflare, D1, R2 et du DOM.

Fonctions minimales conceptuelles :

```text
publishPoll(...)
getPoll(...)
updateDefinition(...)
updateStyle(...)
closePoll(...)
castVote(...)
getResults(...)
putAssets(...)
getAsset(...)
```

Le nom exact et les arguments doivent être affinés après inspection du code.

Le contrat doit exprimer :

- révision attendue pour éviter les écrasements ;
- capacité créateur sur les opérations d’administration ;
- idempotence du vote ;
- erreurs structurées ;
- résultats publics filtrés ;
- assets référencés.

Ne pas exposer de méthode publique “listBallots”.

---

# 8. Révisions et concurrence

Chaque état distant possède une révision monotone.

Toute mutation d’administration reçoit la révision attendue.

Si deux clients tentent des changements concurrents :
- aucune fusion implicite ;
- le relais rejette l’écriture obsolète ;
- le client recharge l’état autoritaire.

Le premier bulletin et le verrouillage doivent être atomiques côté relais.

Cas critique :

1. créateur lit “aucun vote” ;
2. un votant envoie le premier bulletin ;
3. le créateur tente de modifier la définition.

Résultat attendu :
- le relais refuse la modification ;
- la définition déjà votée reste inchangée.

---

# 9. Vote distant anonyme MVP

Le bulletin distant reste minimal.

Aucune donnée applicative persistée de type :
- userId ;
- IP ;
- User-Agent ;
- fingerprint ;
- identifiant de session ;
- horodatage précis du bulletin ;
- origine du votant.

Le fournisseur d’infrastructure peut avoir ses propres journaux techniques : Voti ne doit pas prétendre garantir leur inexistence.

Le relais applicatif ne doit pas recopier ces métadonnées dans sa base de bulletins.

---

# 10. Idempotence, pas “une personne = un vote”

Le client génère un `actionId` aléatoire pour une tentative de vote.

Le relais garantit :

```text
(pollId, actionId)
```

unique.

Même `actionId` + même choix :
- réponse idempotente.

Même `actionId` + choix différent :
- refus.

Nouvel `actionId` :
- nouveau bulletin.

Cette mécanique évite le double clic / retry réseau.

Elle ne prétend PAS garantir une seule voix par personne.

Aucune promesse “une personne = un vote” ne doit apparaître dans cette version.

---

# 11. Réponse de vote

Après un vote accepté, le relais peut retourner :

- accepté / déjà accepté ;
- statut du sondage ;
- révision ;
- état de disponibilité des résultats.

Il ne retourne les comptes détaillés que si les règles de publication les autorisent.

Sous le seuil :
- pas de distribution ;
- pas de total si `showResponseCountBeforeRelease = false`.

---

# 12. Résultats

Le serveur applique lui-même :

- `minimumResponses`;
- mode `threshold`;
- mode `closed`;
- fermeture ;
- règle de masquage du compteur.

Le client ne doit pas recevoir des bulletins bruts pour recalculer les résultats.

Endpoint / méthode de résultat :
- renvoie uniquement une projection publique autorisée ;
- jamais la liste des bulletins.

---

# 13. Définition et style

Avant le premier bulletin distant :

- la définition sémantique peut être modifiée ;
- les assets sémantiques peuvent être remplacés ;
- le relais recalcule / vérifie l’empreinte.

Après le premier bulletin distant :

- définition, règles et références d’images sémantiques sont verrouillées ;
- style reste modifiable ;
- fermeture reste possible.

Le serveur, et non le navigateur, décide si le verrouillage s’applique.

---

# 14. Assets distants

Les assets restent adressés par leur identifiant de contenu `sha256-...`.

Publication :

1. vérifier les assets référencés ;
2. envoyer ceux absents du relais ;
3. valider côté relais :
   - hash ;
   - type ;
   - dimensions ;
   - taille ;
4. publier la définition uniquement lorsque toutes ses références existent.

Lecture publique :

- un asset ne doit pas être publiquement découvrable seulement par son hash global ;
- la lecture doit être contextualisée par le sondage ou un mécanisme équivalent ;
- le relais vérifie que l’asset est effectivement référencé par ce sondage.

La déduplication physique éventuelle est un détail d’implémentation du relais.

---

# 15. URLs Voti

Le site reste statique sur GitHub Pages.

Utiliser des routes hash afin qu’un hébergement statique n’ait pas besoin de réécriture serveur.

Direction recommandée :

```text
#/p/<pollId>
#/p/<pollId>/results
```

Le relais utilisé par le build/configuration reste séparé de l’identifiant du sondage.

Les futurs QR encoderont ces URLs Voti, jamais directement l’endpoint technique du backend.

---

# 16. Erreurs structurées

Le contrat doit distinguer au minimum :

```text
NOT_FOUND
POLL_CLOSED
POLL_LOCKED
REVISION_CONFLICT
INVALID_CHOICE
INVALID_DEFINITION
RESULTS_LOCKED
INVALID_CAPABILITY
ASSET_MISSING
ASSET_INVALID
PAYLOAD_TOO_LARGE
RATE_LIMITED
RELAY_UNAVAILABLE
```

L’interface transforme ensuite ces codes en français simple.

Ne pas analyser des chaînes de texte pour décider de la logique.

---

# 17. État local de connexion distante

Créer un stockage séparé du snapshot métier pour les informations locales nécessaires au relais.

Il peut contenir conceptuellement :

```text
pollId
relayId
remoteRevision
adminCapability // créateur uniquement
lastKnownRemoteState
```

Ne pas ajouter ces informations à Ballot.

Ne pas modifier `definitionHash` avec ces métadonnées.

Le mécanisme exact peut rester un adapter dédié.

---

# 18. InMemoryRelayAdapter

Créer une implémentation mémoire pour tests.

Elle doit permettre de simuler plusieurs clients indépendants partageant le même relais.

Tester notamment :

- publication ;
- consultation par un second client ;
- premier vote ;
- verrouillage atomique ;
- double envoi idempotent ;
- conflit de révision ;
- fermeture ;
- résultats sous seuil ;
- résultats publiés ;
- style après verrouillage ;
- définition refusée après verrouillage ;
- assets ;
- capacité invalide ;
- aucune liste de bulletins exposée.

Cette implémentation n’est pas utilisée comme backend de production.

---

# 19. Sécurité / confidentialité

v0.3A doit produire une note explicite sur :

- ce que Voti ne stocke pas ;
- ce que le futur fournisseur d’infrastructure peut journaliser ;
- différence anonymat applicatif / anonymat réseau ;
- capacité créateur ;
- absence de comptes ;
- absence de garantie une-personne-un-vote ;
- absence de cryptographie avancée ;
- nécessité de HTTPS pour le futur relais.

Aucune cryptographie artisanale.

---

# 20. Futur backend

Le contrat ne doit dépendre d’aucun fournisseur.

Le premier backend pourra ensuite être :

```text
RelayAdapter
    ↓
CloudflareRelayAdapter
    ↓
Worker + stockage adapté
```

mais une implémentation future PHP/SQLite, Node/Postgres ou auto-hébergée doit rester possible.

Ne pas coder Cloudflare dans v0.3A.

---

# 21. Tests obligatoires

Ajouter des tests Node pour :

- contrat RelayAdapter ;
- InMemoryRelayAdapter ;
- capacité créateur ;
- publication sans bulletin local ;
- refus publication avec bulletins locaux ;
- revision conflict ;
- first-vote locking race ;
- idempotence actionId ;
- nouveau actionId = nouveau bulletin ;
- fermeture ;
- résultats masqués ;
- résultats disponibles ;
- style post-lock ;
- définition post-lock refusée ;
- assets manquants ;
- asset hash incorrect ;
- aucune méthode publique raw-ballots ;
- erreurs structurées ;
- aucune mutation de l’état d’entrée.

Les tests existants doivent rester verts.

---

# 22. Hors périmètre v0.3A

Ne pas implémenter :

- Cloudflare Worker ;
- D1 ;
- R2 ;
- endpoint HTTP réel ;
- QR ;
- PDF ;
- comptes ;
- groupes ;
- authentification utilisateur ;
- VoteEligibility ;
- “une personne = un vote” ;
- commentaires ;
- Android ;
- Capacitor ;
- synchronisation distribuée complète ;
- chiffrement des bulletins ;
- relais chiffré différé.

---

# 23. Livrables

Créer au minimum :

```text
shared/relay.js
tests/relay.test.js
docs/RELAY_CONTRACT_V0.md
docs/CODEX_RELAY_V0_3A_REPORT.md
```

Le nom des fichiers peut être ajusté si l’architecture existante le justifie, mais le découpage contrat / tests / documentation doit rester clair.

Le rapport doit préciser :

- architecture retenue ;
- API RelayAdapter ;
- modèle RemoteRef ;
- capacité créateur ;
- révisions ;
- protocole de vote ;
- garanties et non-garanties d’anonymat ;
- assets ;
- résultats ;
- scénarios de concurrence ;
- fichiers modifiés ;
- tests ;
- résultats exacts ;
- décisions restant à prendre avant backend réel.

---

# 24. Critère de sortie

v0.3A est terminé lorsque deux clients de test indépendants peuvent utiliser le même InMemoryRelayAdapter pour :

```text
créateur publie
→ votant charge
→ votant vote
→ relais verrouille
→ créateur ne peut plus changer la définition
→ résultats restent cachés sous seuil
→ autres votes atteignent le seuil
→ résultats deviennent publics
→ créateur ferme
```

sans backend réel et sans casser le mode local existant.
