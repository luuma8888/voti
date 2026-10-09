# Rapport Voti v0.3A — contrat de relais Internet et état distant

Date : 9 octobre 2026. Lot repris après interruptions, sans reprendre les lots UX.
Autorité : `VOTI_RELAY_V0_3A_SPEC.md`. Aucun commit, push, dépendance ajoutée,
backend réel ou changement d’interface.

## Résultat

Le scénario de sortie fonctionne dans les tests avec deux instances de RelayClient,
deux stockages de connexions indépendants et un InMemoryRelayAdapter partagé :
publication → consultation → premier vote/verrouillage → refus de modification →
résultats masqués sous 5 → disponibles à 5 et 6 → fermeture.

Le mode local demeure celui de v0.2B.2. Aucun accès réseau ni fonctionnalité de
publication en ligne n’a été ajouté à l’application utilisable.

## Fichiers créés

- `shared/relay.js` : interface, erreurs structurées, RemoteRef, identifiants et capacité.
- `shared/relay-client.js` : orchestration cliente indépendante du DOM/transport.
- `shared/remote-state.js` : contrat de connexions, validation et stockage mémoire.
- `web/remote-storage.js` : stockage optionnel distinct dans localStorage, sous Web Locks.
- `tests/in-memory-relay.js` : simulation complète de relais partagé à état privé.
- `tests/relay.test.js` : 29 nouveaux tests.
- `docs/RELAY_CONTRACT_V0.md` : API exacte, protocole et note de confidentialité.
- `docs/CODEX_RELAY_V0_3A_REPORT.md` : présent rapport.

## Fichiers modifiés

- `tests/build.test.js` : 20 modules embarqués au lieu de 16 ; présence du contrat
  et du client, absence de la simulation mémoire dans le build.
- `index.html` : régénéré par le build existant, 431 209 octets.

Les trois fichiers de contrat commencés avant interruption ont été conservés et
complétés. Aucun changement de moteur, modèle, stockage métier, sauvegarde,
traitement des images, styles ou harnais navigateur. Aucun document historique modifié.

## Architecture réalisée

Le contrat partage les validations, calculs d’empreinte et règles de publication
existants. La simulation est dans `tests/`, hors livraison. Ses Maps et snapshots
sont privés ; elle ne fournit aucune méthode d’inspection ou de bulletins bruts.
Une file sérialise lectures et écritures, avec validation sur copies avant commit.

Le client conserve une connexion séparée du snapshot métier. Le stockage mémoire
permet les clients indépendants ; le stockage Web optionnel utilise la clé
`voti.remote.v1`, un format versionné et Web Locks, sans activation dans l’UI.
Les 4 nouveaux modules livrés sont inertes tant qu’ils ne sont pas instanciés.
Le build ne contient ni relais mémoire ni capacité concrète précréée.

### API RelayAdapter

Méthodes : `preparePublication`, `getMissingAssets`, `putAssets`, `publishPoll`,
`discardPublication`, `getPoll`, `updateDefinition`, `updateStyle`, `closePoll`,
`castVote`, `getResults`, `getAsset`. Arguments et réponses exhaustifs dans
`RELAY_CONTRACT_V0.md`, section « API exacte RelayAdapter ».

La préparation privée est nécessaire pour authentifier les uploads avant
publication. Elle est invisible au public ; la publication vérifie toutes les
images. Une préparation abandonnée peut être supprimée explicitement.

### RemoteRef, capacité et état local

RemoteRef : `{ relayId, pollId, revision }`, jamais dans la définition ni son hash.
`pollId` est un UUID v4 ; `relayId` est une clé, pas une URL. Les helpers produisent
les fragments futurs `#/p/<pollId>` et `#/p/<pollId>/results`, sans développer leurs vues.

Capacité : 32 octets générés côté client par Web Crypto, soit 256 bits d’entropie.
Le client la conserve avant toute préparation ; le relais ne conserve qu’un SHA-256
lié au contexte du sondage. Les projections publiques ne contiennent ni secret
ni dérivé. Aucun ajout aux sauvegardes actuelles. Perte = pas de récupération par
compte. Le stockage navigateur reste accessible au propriétaire/XSS et non durable.

Le record local contient version 1, relayId, pollId, remoteRevision, adminCapability
(null côté votant) et un éventuel état connu minimal. Régression de cache,
remplacement silencieux de capacité, corruption et versions inconnues sont refusés.
Une lecture authentifiée des assets permet de retrouver la révision d’une
préparation si une réponse d’upload a été perdue. Pas de fusion automatique.

### Révisions et concurrence

Les mutations administratives exigent la révision exacte. Elle augmente à chaque
mutation effective/nouveau vote, pas lors d’un retry idempotent. Elle n’est pas
consécutive : les pas aléatoires évitent qu’une simple soustraction révèle le total
masqué. L’activité observable par interrogation répétée n’est pas rendue secrète.

La course critique est couverte dans les deux ordres. Premier vote gagnant :
ancienne modification → `REVISION_CONFLICT`, puis après relecture → `POLL_LOCKED`.
Modification gagnante : le vote verrouille la nouvelle définition. Vingt votes
concurrents sont également testés sans perte. Aucune décision locale d’autoriser
la modification ne remplace l’arbitrage distant.

### Protocole de vote, résultats et anonymat

Le bulletin reste `{ id: actionId, pollId, choiceId }`. L’unicité porte sur le
couple sondage/action. Même action/choix : retry ; autre choix : refus ; nouvelle
action : nouveau bulletin. Un retry accepté reste valable après fermeture.

Les résultats sont calculés côté relais, jamais par exposition de bulletins.
Le plancher est obligatoire en threshold et closed. Sous le seuil, aucune
distribution ; compteur absent sauf activation explicite de sa visibilité.
Les erreurs `RESULTS_LOCKED` suivent les mêmes règles que les vues/reçus.

Pas de userId, IP, User-Agent, fingerprint, session, origine ou horodatage précis
dans les bulletins. Les métadonnées personnelles supplémentaires sont refusées
par le contrat de vote strict. Cela ne garantit ni anonymat réseau, ni absence
de journaux d’infrastructure, ni une voix par personne. Le futur hébergeur peut
journaliser IP et horaires ; il faudra définir rétention et minimisation.
Pas de chiffrement avancé ni de protection cryptographique contre l’opérateur.

### Assets

Identité sha256 conservée ; vérifications binaires hash/type/dimensions/taille
réutilisées ; limites d’usage sondage/choix respectées. Upload par lot atomique,
références manquantes bloquantes, absence de découverte globale par hash.
Lecture uniquement dans le contexte d’un sondage publié qui référence l’image.
Les remplacements restent sémantiques et impossibles après le premier vote.
Les assets non référencés sont nettoyés après commit métier/vote ou abandon privé.

Limites de simulation : enveloppe JSON 65 536 caractères, au plus 14 assets
par sondage/staging, blob au plus 1 Mo. Aucun changement des limites du mode local.
Le validateur Node inspecte format/en-têtes/hash, pas les pixels décodés : le vrai
backend devra compléter ce contrôle par décodage borné et validation serveur.

## Commandes exécutées et résultats exacts

| Commande | Résultat final |
| --- | --- |
| `npm test` | Succès, code 0 ; 10 fichiers de tests exécutés par le runner |
| Chargement direct des fichiers `tests/*.test.js` avec Node | **142 tests, 142 succès, 0 échec, 0 annulé, 0 ignoré** |
| `node tests/relay.test.js` pendant développement | 27/27 succès avant les 2 derniers tests, inclus ensuite dans le total 142 |
| `npm run check` | Succès, **38 fichiers JavaScript** |
| `npm run build` | Succès, HTML autonome **431 209 octets**, 20 modules, aucune dépendance |
| `npm run test:browser` | Succès, **343 contrôles Chromium** |
| `git diff --check` | Succès, aucune erreur |

Le runner `node --test` de cet environnement affiche les fichiers comme unités.
Pour obtenir un total explicite des cas, commande complémentaire exécutée :

```sh
node --input-type=module -e 'import {readdir} from "node:fs/promises"; for (const file of (await readdir("tests")).filter(file => file.endsWith(".test.js"))) await import("./tests/" + file);'
```

Base existante : 113 cas ; ajout : 29 cas relais ; total : 142.
Une première tentative navigateur sous sandbox a échoué avant scénario :
`read ECONNRESET`, `setsockopt: Operation not permitted`. Relance autorisée hors
sandbox : succès. Ce n’est pas une modification du harnais ou de l’application.
Les 343 contrôles existants couvrent notamment branding, images, IndexedDB,
sauvegardes, cinq thèmes, clavier, contrastes, responsive, `file://` hors ligne
et serveur `/voti/`.

## Couverture des nouveaux tests

Contrat et codes, capacités, routes, publication privée/publique, abandon,
absence de votes locaux, administrateur/votant séparés, capacité invalide,
révisions, courses dans les deux ordres, vingt votes concurrents, retry après
fermeture, portée de l’action par sondage, seuil 0/4/5/6, closed avec 3/5 votes,
compteur visible/masqué, style post-lock, choix invalide, champs privés rejetés,
payload trop grand, entrées/réponses/cache isolés, navigation sans vote,
assets manquants/contextualisés/corrompus/dupliqués, lot atomique,
image sémantique verrouillée et orphelin nettoyé, versions/cache/capacités,
localStorage/quota/corruption et échec avant préparation, récupération après
perte de réponse d’upload.

## Écarts, limites et risques restants

- Aucun écart de périmètre : ni backend, endpoint, QR, PDF, comptes, groupes,
  Android, Capacitor, fournisseur, chiffrement ou synchronisation distribuée.
- La publication est décomposée en préparation/upload/commit pour éviter des
  états publics partiels ; extension documentée du contrat minimal demandé.
- La simulation n’est pas persistante et sérialise globalement. Elle ne démontre
  ni performances réseau, ni transactions d’une vraie base, ni tolérance à crash.
- Pas d’expiration automatique des préparations ; abandons explicites seulement.
- `RATE_LIMITED` est défini, sans politique de trafic simulée ou réelle.
- Comparaison JavaScript des dérivés de capacité : aucun engagement de temps
  constant. Backend réel : comparaison native appropriée, HTTPS et logs expurgés.
- Les capacités ne sont pas sauvegardées/transférables depuis l’UI actuelle.
  Échec de cache après commit distant : erreur signalée, relecture requise.
- Les pas de révision empêchent un compteur exact par soustraction, pas toute
  inférence de participation par surveillance continue.
- L’UUID v4 est imposé pour le relais ; un ancien UUID d’une autre version, valide
  dans le modèle local général, n’est pas publié par ce contrat.
- Les notes visuelles différées de la spécification ne sont pas traitées.

## Validations humaines avant backend réel

Aucune décision manquante ne bloque le contrat de ce lot. Avant le backend :

1. Choisir hébergement, stockage et politique de logs/rétention.
2. Fixer quotas, limites de trafic et durée de vie des préparations/uploads.
3. Valider l’UX de perte, transfert et éventuelle sauvegarde des capacités.
4. Définir la configuration du relais du site et les exigences HTTPS/CORS.

Recommandation : implémenter ensuite un adaptateur réel soumis au même scénario
de contrat, avec transactions atomiques, idempotence durable, décodage serveur
borné des images et tests de coupure. Android pourra réutiliser le contrat en
remplaçant uniquement transport et stockage local des connexions ; aucune
implémentation Android n’est anticipée dans ce lot.
