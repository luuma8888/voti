# Application de sondages QR — plan d’action concret et détaillé

**Statut :** feuille de route opérationnelle  
**Destinataires :** Lu’uma + ChatGPT + Codex  
**Document compagnon :** `application_sondages_qr_reference_v0.md`  
**Principe directeur :** construire un seul cœur fonctionnel, puis lui ajouter trois modes complémentaires : Web + relais, Android autonome, relais différé/chiffré.

---

# 1. Objectif de ce plan

Ce document indique :

- dans quel ordre construire le projet ;
- ce que Lu’uma doit faire humainement ;
- ce qui peut être préparé dans ChatGPT ;
- ce qui doit être développé dans Codex ;
- ce qui doit être testé physiquement ;
- ce qui doit être configuré sur GitHub / Cloudflare / Android ;
- les critères permettant de décider qu’une étape est terminée ;
- les éléments à ne surtout pas développer trop tôt.

L’objectif est d’éviter deux risques :

1. coder trop de fonctionnalités avant d’avoir stabilisé le modèle de données ;
2. développer trois applications différentes au lieu d’un seul système commun.

---

# 2. Répartition des rôles

## Lu’uma

Responsable des décisions d’usage et des validations réelles.

Actions principales :

- choisir le nom du projet ;
- créer / configurer les comptes et espaces externes nécessaires ;
- décider des options UX non évidentes ;
- tester sur de vrais téléphones ;
- tester avec des enfants / jeunes lorsque le prototype est suffisamment fiable ;
- conserver les secrets, clés et sauvegardes ;
- valider les étapes avant passage à la suivante.

## ChatGPT — conversation d’architecture / produit

À utiliser principalement pour :

- architecture ;
- réflexion UX ;
- modèle de données ;
- rédaction des spécifications ;
- analyse de sécurité ;
- audit de livraisons Codex ;
- détection d’incohérences ;
- création de jeux de tests ;
- préparation des prompts / handoffs pour Codex ;
- analyse de retours humains ;
- arbitrage entre plusieurs solutions techniques.

## Codex

À utiliser principalement pour :

- création du dépôt et du squelette de code une fois l’accès au projet disponible ;
- développement ;
- refactoring ;
- tests automatisés ;
- migrations ;
- intégration GitHub Pages ;
- Worker / D1 ;
- Capacitor ;
- Kotlin / Room ;
- serveur local Android ;
- CI/CD ;
- documentation technique maintenue dans le dépôt.

## Humains testeurs

À utiliser à partir des prototypes fonctionnels pour :

- compréhension des boutons ;
- lisibilité ;
- temps nécessaire pour voter ;
- erreurs réelles ;
- comportements inattendus ;
- test de QR physiques ;
- test réseau ;
- test téléphone collectif.

---

# 3. Stratégie générale de construction

Ordre recommandé :

```text
1. Spécifications et modèle commun
            ↓
2. Prototype Web local
            ↓
3. Création / vote / résultats complets
            ↓
4. QR + affiches + PDF
            ↓
5. Relais Internet
            ↓
6. Comptes / contextes / groupes
            ↓
7. Synchronisation
            ↓
8. Android + Room
            ↓
9. Serveur local Android
            ↓
10. Confidentialité avancée
            ↓
11. Pilote jeunesse
            ↓
12. Stabilisation / publication
```

Ne PAS commencer par :

- signatures aveugles ;
- serveur local Android ;
- hotspot ;
- système complexe de synchronisation ;
- dix types de scrutins ;
- personnalisation graphique exhaustive.

Ces fonctionnalités dépendent du modèle de base.

---

# 4. Jalon 0 — nom, identité et espace du projet

## Objectif

Créer un espace indépendant de Soi-Libre.

## Action Lu’uma

Choisir provisoirement :

- nom du projet ;
- nom du dépôt GitHub ;
- éventuellement un sous-titre.

Le nom peut rester provisoire pendant le développement.

Exemple technique temporaire :

```text
poll-qr
```

ou :

```text
sondage-qr
```

## Action Lu’uma — GitHub

Créer un nouveau dépôt GitHub dédié.

Recommandation initiale :

- dépôt public si cela ne pose pas problème ;
- licence à décider ;
- README initial minimal ;
- aucune donnée réelle de jeunes dans le dépôt ;
- aucune clé API dans le dépôt.

Le site GitHub Pages sera associé à CE dépôt, pas à Soi-Libre.

## Action ChatGPT

Préparer si besoin :

- propositions de nom ;
- architecture du README ;
- charte de nommage ;
- règles de dépôt.

## Action Codex

Une fois le dépôt créé :

- créer la structure initiale ;
- ajouter `.gitignore` ;
- ajouter documentation ;
- mettre en place les tests ;
- préparer une page Web vide déployable.

## Critère de sortie

- dépôt dédié créé ;
- nom technique fixé ;
- README présent ;
- aucune dépendance à Soi-Libre.

---

# 5. Jalon 1 — figer le MVP fonctionnel

## Objectif

Définir précisément ce que doit savoir faire la première version utile.

## MVP recommandé

Le MVP doit permettre :

1. créer un sondage à choix unique ;
2. créer 2 à 6 réponses ;
3. choisir anonyme ou nominatif ;
4. choisir un seuil d’affichage des résultats ;
5. verrouiller automatiquement le sondage après le premier vote ;
6. générer un QR d’accès ;
7. voter depuis un navigateur ;
8. confirmer le vote ;
9. afficher les résultats lorsque la règle le permet ;
10. générer une affiche simple ;
11. exporter un PDF simple ;
12. fonctionner d’abord sans comptes complexes.

## Hors MVP

Reporter :

- classement ;
- jugement majoritaire ;
- Condorcet ;
- propositions collaboratives ;
- commentaires riches ;
- signatures aveugles ;
- relais chiffré ;
- synchronisation multi-maître avancée ;
- serveur Android ;
- hotspot automatique.

## Action ChatGPT

Produire :

- `MVP_SCOPE.md` ;
- cas d’usage ;
- règles exactes ;
- exclusions explicites.

## Action Lu’uma

Valider / corriger ce MVP.

## Action Codex

Ne rien développer hors MVP sans justification.

## Critère de sortie

Un fichier `MVP_SCOPE.md` approuvé.

---

# 6. Jalon 2 — modèle de données commun

## Objectif

Créer le contrat central qui sera partagé par Web, relais et Android.

## Entités minimales à définir

```text
Context
Group
User
Poll
PollDefinition
PollStyle
PollAccessRules
VoteEligibility
Ballot
ResultPublicationRules
SyncEvent
```

## Pour chaque entité

Définir :

- identifiant UUID ;
- champs ;
- types ;
- obligatoire / facultatif ;
- valeur par défaut ;
- version du schéma ;
- règles de validation ;
- propriété locale / distante ;
- caractère sensible ;
- capacité à être modifié après premier vote.

## Exemple important

Séparer :

```text
PollDefinition
```

de :

```text
PollStyle
```

afin que le style reste modifiable après verrouillage.

## Action ChatGPT

Créer / auditer :

- diagramme conceptuel ;
- tables de champs ;
- règles ;
- invariants.

## Action Codex

Transformer cela en :

- schémas JSON ;
- types TypeScript ;
- validateurs ;
- tests.

## Action Lu’uma

Valider les notions fonctionnelles, pas le détail SQL.

## Critère de sortie

Tout sondage peut être sérialisé dans un format indépendant du stockage.

---

# 7. Jalon 3 — matrice des modes de vote

## Objectif

Éviter les ambiguïtés entre anonymat, compte et unicité.

Créer une matrice couvrant au minimum :

| Compte | Anonyme | Vote unique | Méthode |
|---|---|---|---|
| non | oui | faible | navigateur / jeton |
| non | oui | fort | jeton unique |
| oui | oui | fort | séparation droit / bulletin |
| oui | non | fort | utilisateur lié au bulletin |

Ajouter :

- téléphone personnel ;
- téléphone collectif ;
- QR direct ;
- QR principal ;
- Web Internet ;
- Android local.

## Action ChatGPT

Construire et challenger la matrice.

## Action Codex

Implémenter uniquement les cas validés pour le MVP.

## Critère de sortie

Chaque combinaison autorisée possède une règle claire.

---

# 8. Jalon 4 — architecture du dépôt

## Structure recommandée

```text
/
├── README.md
├── docs/
├── web/
├── shared/
├── relay/
├── android/
├── schemas/
├── tests/
└── scripts/
```

## `shared/`

Doit contenir le maximum de logique indépendante de la plateforme :

```text
models
validation
poll-engine
result-rules
qr
serialization
sync
crypto
```

## Action Codex

Créer le squelette et les conventions.

## Action ChatGPT

Auditer la structure.

## Critère de sortie

La logique métier peut être testée sans navigateur, sans Cloudflare et sans Android.

---

# 9. Jalon 5 — environnement de développement

## Actions humaines immédiates

GitHub existe déjà puisque Soi-Libre utilise GitHub.

À préparer côté ordinateur lorsque nécessaire :

- Git ;
- Node.js compatible avec la version Capacitor retenue ;
- éditeur / Codex ;
- navigateur Chromium ;
- éventuellement Firefox pour tests.

Android Studio n’est PAS obligatoire à ce stade.

## Plus tard pour Android

Installer :

- Android Studio ;
- Android SDK ;
- outils de plateforme nécessaires.

Capacitor actuel nécessite Node moderne et Android Studio / SDK pour la cible Android. Toujours vérifier les prérequis officiels au moment de démarrer ce jalon.

## Action Codex

Créer :

- `package.json` ;
- scripts `dev`, `test`, `build`, `lint` ;
- environnement de tests ;
- build statique GitHub Pages.

## Critère de sortie

Une commande locale lance le projet et une autre exécute tous les tests.

---

# 10. Jalon 6 — prototype UX sans serveur

## Objectif

Construire d’abord les parcours.

## Écrans minimum

### Créateur

```text
Accueil
→ Nouveau sondage
→ Question
→ Réponses
→ Confidentialité
→ Résultats
→ Aperçu
→ Publier localement
```

### Votant

```text
Question
→ grands choix
→ confirmation
→ merci
```

### Résultats

```text
Question
→ nombre de votes
→ graphique
```

## Règle

Aucune connexion Cloudflare à ce stade.

Utiliser des données fictives / mémoire locale.

## Action ChatGPT

Auditer :

- vocabulaire ;
- compréhension enfant 10 ans ;
- compréhension enfant 6 ans ;
- nombre d’étapes ;
- accessibilité.

## Action Codex

Développer le prototype responsive.

## Action Lu’uma

Tester sur :

- ordinateur ;
- petit téléphone ;
- grand téléphone.

## Critère de sortie

Créer et voter doit être compréhensible sans explication technique.

---

# 11. Jalon 7 — moteur de sondage local

## Objectif

Rendre le prototype fonctionnel avant réseau.

Implémenter :

- création ;
- état brouillon ;
- publication ;
- vote ;
- premier vote → verrouillage ;
- résultats ;
- seuil ;
- fermeture ;
- validation.

## Tests obligatoires

- impossible de supprimer une réponse après premier vote ;
- impossible de modifier la question après premier vote ;
- style encore modifiable ;
- résultats bloqués sous seuil ;
- un vote invalide est rejeté ;
- un identifiant inexistant est rejeté.

## Action Codex

Coder et écrire les tests.

## Action ChatGPT

Auditer les invariants.

## Critère de sortie

Le moteur passe tous ses tests sans dépendre de l’UI.

---

# 12. Jalon 8 — QR codes

## À implémenter

- QR page de vote ;
- QR pré-sélection d’une réponse ;
- QR résultats ;
- QR gestion.

## Règle absolue

Le QR pré-sélectionné NE DOIT PAS enregistrer directement un vote.

Parcours :

```text
scan
→ page
→ réponse pré-sélectionnée
→ confirmation humaine
→ vote
```

## Tests humains

Tester avec plusieurs applications de scan QR et appareils.

## Critère de sortie

Aucun scan ou aperçu automatique ne peut produire un vote.

---

# 13. Jalon 9 — affiches et PDF

## Première version

Ne pas créer immédiatement un Canva miniature.

Créer d’abord :

- 3 modèles A4 portrait ;
- 1 modèle A4 paysage ;
- QR principal ;
- option QR par réponse ;
- QR résultats facultatif ;
- question ;
- choix ;
- consigne.

## Action ChatGPT

Concevoir la hiérarchie visuelle et les règles automatiques.

## Action Codex

Créer moteur de rendu HTML/SVG/Canvas selon choix technique.

## Action Lu’uma

Imprimer de vraies feuilles A4.

Tester :

- QR à 50 cm ;
- QR à 1 m ;
- impression noir et blanc ;
- imprimante moyenne qualité ;
- téléphone ancien.

## Critère de sortie

Tous les QR imprimés restent lisibles et l’affiche reste compréhensible.

---

# 14. Jalon 10 — GitHub Pages

## Objectif

Publier le front-end statique.

## Action Lu’uma

Dans le dépôt :

- activer GitHub Pages ;
- choisir la méthode de déploiement recommandée ;
- vérifier l’URL publique.

GitHub Pages peut publier un site directement depuis un dépôt GitHub.

## Action Codex

Créer le workflow de build / publication.

## Sécurité

Aucun secret dans le bundle Web.

Interdit :

```text
API_PRIVATE_KEY
DB_PASSWORD
ADMIN_SECRET
```

dans le JavaScript livré au navigateur.

## Critère de sortie

La version publique fonctionne sans backend avec les fonctionnalités locales du MVP.

---

# 15. Jalon 11 — création du compte Cloudflare

Ne créer / configurer Cloudflare qu’à ce stade, pas avant.

## Action Lu’uma

Créer un compte Cloudflare si nécessaire.

Activer :

- Workers ;
- D1.

Ne pas acheter de domaine au départ.

Utiliser l’URL technique fournie pour le développement.

## Action humaine importante

Activer :

- authentification forte du compte Cloudflare ;
- récupération de compte ;
- stockage sécurisé des codes de récupération.

## Action Codex

Créer un environnement :

```text
development
```

et plus tard :

```text
production
```

## Critère de sortie

Un Worker de test répond et accède à une base D1 de développement.

---

# 16. Jalon 12 — définir l’API du relais

## Objectif

Ne pas faire dépendre l’application de Cloudflare.

Créer un contrat abstrait.

Exemples :

```text
POST /contexts
POST /polls
GET  /polls/:id
POST /polls/:id/votes
GET  /polls/:id/results
POST /sync
```

## Définir

- format requête ;
- format réponse ;
- erreurs ;
- authentification ;
- version API ;
- idempotence ;
- UUID ;
- validation.

## Action ChatGPT

Auditer le protocole pour portabilité.

## Action Codex

Créer :

```text
RelayAdapter
CloudflareRelayAdapter
```

L’UI ne doit appeler que `RelayAdapter`.

## Critère de sortie

Un faux relais mémoire peut remplacer Cloudflare dans les tests.

---

# 17. Jalon 13 — relais connecté MVP

## Implémenter

- création d’un sondage distant ;
- récupération ;
- vote ;
- résultats ;
- verrouillage serveur ;
- règles de publication.

## Important

Les règles critiques doivent être validées côté serveur.

Exemple :

Même si un utilisateur modifie le JavaScript du navigateur, il ne doit pas pouvoir :

- voter pour une option inexistante ;
- modifier un sondage verrouillé ;
- accéder à des résultats bloqués.

## Action Codex

Développer Worker + D1 + migrations.

## Action ChatGPT

Faire audit API / permissions.

## Critère de sortie

Deux téléphones distincts peuvent voter sur le même sondage via Internet.

---

# 18. Jalon 14 — contextes et groupes

## Implémenter

```text
Context
Group
Membership
```

## Tests

Contexte A ne peut jamais lire :

- utilisateurs de B ;
- sondages de B ;
- votes de B.

## Action Codex

Ajouter tests d’isolation.

## Action ChatGPT

Audit de cloisonnement.

## Critère de sortie

Tests automatiques démontrent l’isolation entre contextes.

---

# 19. Jalon 15 — comptes et rôles

## Ajouter

- pseudo ;
- secret ;
- rôle ;
- groupe ;
- activation / désactivation.

Rôles :

```text
admin
creator
user
```

## Sécurité

Ne jamais conserver les mots de passe en clair.

Prévoir :

- hachage moderne ;
- sel ;
- sessions ;
- expiration ;
- réinitialisation.

## UX enfant

Ne pas demander :

- email obligatoire ;
- téléphone ;
- vraie identité,

sauf nécessité explicitement décidée.

## Action Lu’uma

Décider si le pseudo doit être :

- choisi par le jeune ;
- attribué par l’administrateur ;
- les deux.

## Critère de sortie

Un compte ne voit que ce que son rôle autorise.

---

# 20. Jalon 16 — vote nominatif

## Objectif

Implémenter le cas simple avant anonymat fort.

Structure :

```text
user_id
poll_id
ballot
```

quand le sondage est explicitement nominatif.

## Tests

- second vote refusé si vote unique ;
- identité visible uniquement aux rôles prévus ;
- export conforme aux paramètres.

## Critère de sortie

Fonctionnement stable.

---

# 21. Jalon 17 — anonymat structurel v1

## Objectif

Séparer identité et bulletin.

Deux espaces conceptuels :

```text
VoteEligibility
```

et :

```text
Ballot
```

Ne pas stocker dans le bulletin :

- user_id ;
- pseudo ;
- IP ;
- fingerprint ;
- user-agent inutile.

## Action ChatGPT

Auditer le modèle d’anonymat.

## Action Codex

Implémenter séparation et tests.

## Critère de sortie

Un export brut de la table des bulletins ne permet pas d’identifier les votants.

---

# 22. Jalon 18 — règles de publication des résultats

Supporter :

- seuil minimal ;
- date ;
- fermeture ;
- activation manuelle.

Exemples :

```text
votes >= 5
```

```text
votes >= 10 AND poll.closed
```

## Tests de confidentialité

Avec 1, 2, 3 ou 4 votes si seuil = 5 :

- pas de résultat ;
- pas de pourcentage ;
- pas de fuite dans l’API.

## Critère de sortie

Le navigateur ne reçoit même pas les résultats tant qu’ils sont bloqués.

---

# 23. Jalon 19 — journal de synchronisation

Ne pas faire Android avant ce jalon.

## Définir

Événements :

```text
poll.created
poll.updated
poll.locked
poll.closed
style.updated
vote.cast
account.created
account.disabled
```

Chaque événement :

- UUID ;
- type ;
- version ;
- timestamp logique ;
- origine ;
- payload.

## Objectif

Préparer :

- Android offline ;
- resynchronisation ;
- migration de relais.

## Action ChatGPT

Audit des conflits possibles.

## Action Codex

Créer moteur de sync avec faux client local.

## Critère de sortie

Deux bases de test peuvent converger sans doublonner un vote.

---

# 24. Jalon 20 — format de sauvegarde `.sondagebox`

Avant Android, définir ce format.

## Contenu possible

```text
manifest.json
schema-version
context
groups
accounts
polls
ballots
events
assets
```

Conteneur éventuellement ZIP chiffré ou format équivalent.

## Exigences

- versionné ;
- importable ;
- exportable ;
- contrôlé par hash ;
- migration future ;
- sauvegarde atomique.

## Action ChatGPT

Concevoir exigences et scénarios de restauration.

## Action Codex

Implémenter export/import Web de test.

## Critère de sortie

Un contexte exporté puis supprimé peut être recréé intégralement depuis le fichier.

---

# 25. Jalon 21 — préparation Android

Maintenant seulement.

## Action Lu’uma

Installer Android Studio si tu veux compiler / tester localement.

Sinon Codex peut préparer le projet et un workflow GitHub Actions peut être étudié pour produire des APK de test.

Installer / vérifier :

- Android Studio ;
- SDK Android ;
- téléphone Android avec mode développeur si test USB.

## Action sécurité

Ne PAS encore créer de clé de signature de production avant que le processus de sauvegarde des clés soit décidé.

## Action Codex

Ajouter Capacitor au projet Web.

Créer Android :

```text
npx cap add android
```

Adapter le build.

## Critère de sortie

La même interface Web s’ouvre dans une APK de test.

---

# 26. Jalon 22 — pont natif Kotlin

## Objectif

Ne pas confier les données importantes au stockage WebView.

Créer une interface côté JS :

```text
StorageAdapter
```

Implémentations :

```text
WebStorageAdapter
AndroidRoomAdapter
```

Le pont Kotlin expose les opérations nécessaires.

## Ne pas exposer

Des requêtes SQL arbitraires depuis JavaScript.

Exposer des opérations métier ou CRUD contrôlées.

## Critère de sortie

Le Web et Android utilisent les mêmes modèles mais des stockages différents.

---

# 27. Jalon 23 — Room / SQLite

## Implémenter

- schéma Room ;
- migrations ;
- transactions ;
- contraintes ;
- index ;
- journal de sync local.

## Tests critiques

1. créer contexte ;
2. créer 100 sondages ;
3. voter ;
4. fermer app ;
5. redémarrer Android ;
6. redémarrer appareil ;
7. rouvrir ;
8. vérifier données.

Puis :

9. installer une mise à jour APK signée avec la même clé ;
10. vérifier conservation.

## Critère de sortie

Aucune perte lors des usages normaux.

---

# 28. Jalon 24 — sauvegarde Android

## Implémenter

- exporter `.sondagebox` ;
- importer ;
- sauvegarde manuelle ;
- éventuellement rappel de sauvegarde ;
- chiffrement.

## UX possible

```text
Dernière sauvegarde :
il y a 6 jours

[ Sauvegarder maintenant ]
```

## Action Lu’uma

Tester réellement :

- export ;
- copie ailleurs ;
- désinstallation test sur appareil secondaire ;
- réinstallation ;
- restauration.

## Critère de sortie

Restauration réellement vérifiée, pas seulement supposée.

---

# 29. Jalon 25 — synchronisation Android ↔ relais

## Cas 1

Android a Internet.

```text
Android
↔
Relay
```

## Cas 2

Android était offline.

Il pousse ses nouveaux événements.

## Cas 3

Le relais a reçu des votes pendant l’absence d’Android.

Android les récupère.

## Cas critique

Les votes ne doivent jamais être doublonnés.

## Action Codex

Tests automatisés avec déconnexion simulée.

## Action Lu’uma

Test réel :

1. couper Wi-Fi Android ;
2. agir localement ;
3. voter depuis autre téléphone via relais ;
4. réactiver Wi-Fi ;
5. synchroniser ;
6. comparer résultats.

## Critère de sortie

Les deux côtés convergent.

---

# 30. Jalon 26 — serveur HTTP local Android

## Objectif

Rendre l’établissement autonome.

Ajouter bouton :

```text
Ouvrir une urne locale
```

L’application lance un serveur local.

## Interface

Afficher :

- état ;
- adresse ;
- QR ;
- nombre de participants ;
- bouton arrêt.

## Action Codex

Créer module Kotlin dédié.

## Sécurité

Le serveur doit :

- écouter uniquement selon configuration ;
- valider les requêtes ;
- limiter les endpoints ;
- ne jamais donner accès à l’administration sans authentification.

## Critère de sortie

Trois téléphones sur le même Wi-Fi peuvent voter sans Internet.

---

# 31. Jalon 27 — réseau local / hotspot

À faire après le serveur local.

## Étape A

Support Wi-Fi déjà existant.

## Étape B

Étudier hotspot local Android.

## Action Lu’uma

Tester sur l’appareil Android cible réel.

Certains fabricants Android peuvent avoir des comportements différents.

## Critère de sortie

L’usage sans infrastructure Internet est documenté et reproductible.

---

# 32. Jalon 28 — téléphone collectif

Ajouter mode :

```text
Téléphone collectif
```

Après vote :

```text
Merci

Participant suivant
```

Puis nettoyage de l’état de session.

## Important

Ne pas permettre au participant suivant de voir le vote précédent.

## Critère de sortie

10 votes successifs peuvent être déposés proprement sur le même appareil.

---

# 33. Jalon 29 — cryptographie avancée

Seulement lorsque le système de base fonctionne.

Étudier :

- chiffrement des sauvegardes ;
- chiffrement de certains bulletins ;
- gestion des clés ;
- jetons anonymes ;
- signatures aveugles ;
- relais aveugle.

## Règle

Ne pas inventer de protocole cryptographique maison.

Utiliser des primitives et constructions établies.

## Action ChatGPT

Faire une revue d’architecture et identifier ce qui mérite éventuellement un audit externe.

## Action Codex

Implémenter seulement après spécification précise.

---

# 34. Jalon 30 — relais différé/chiffré

## Objectif

Permettre :

```text
vote
→ paquet chiffré
→ relais
→ récupération Android
→ déchiffrement local
```

Le serveur peut rester incapable de lire le bulletin.

## Questions à résoudre

- déduplication ;
- droit de vote ;
- révocation ;
- récupération de clé ;
- perte de tablette ;
- rotation de clé.

## Critère de sortie

Le relais peut être compromis sans révéler le contenu prévu comme opaque.

---

# 35. Jalon 31 — audit sécurité

Avant usage réel avec des mineurs.

## Audit automatique

- dépendances ;
- XSS ;
- injections ;
- SQL ;
- CSRF si applicable ;
- permissions ;
- API ;
- exposition de secrets.

## Audit logique

- isolation contextes ;
- anonymat ;
- résultats ;
- verrouillage ;
- vote unique ;
- récupération de mot de passe.

## Audit vie privée

Lister précisément :

```text
ce qui est collecté
pourquoi
où
combien de temps
qui peut le voir
comment le supprimer
```

## Critère de sortie

Aucun risque critique connu.

---

# 36. Jalon 32 — documentation confidentialité

Créer :

- politique de confidentialité ;
- notice simple enfant ;
- notice administrateur ;
- description du sondage anonyme ;
- description du vote nominatif ;
- fonctionnement des services externes.

## Important

Le nouveau projet peut transmettre certaines données.

Il ne doit donc pas reprendre la promesse Soi-Libre :

```text
Aucune donnée personnelle envoyée
```

## Critère de sortie

Un adulte responsable comprend ce que fait réellement le système.

---

# 37. Jalon 33 — pilote humain adulte

Avant enfants.

Tester avec 5 à 10 adultes.

Scénario :

1. créer contexte ;
2. créer comptes ;
3. créer sondage ;
4. imprimer affiche ;
5. scanner ;
6. voter ;
7. résultats ;
8. export ;
9. offline ;
10. restauration.

Collecter :

- erreurs ;
- hésitations ;
- vocabulaire incompris ;
- temps.

## Critère de sortie

Aucun blocage majeur.

---

# 38. Jalon 34 — pilote jeunesse

Faire un petit test encadré.

## Groupe possible

- quelques 6–9 ans pour vote ;
- quelques 10–14 ans pour création ;
- animateur pour administration.

## Observer

Ne pas expliquer immédiatement.

Observer :

- où ils cliquent ;
- ce qu’ils ignorent ;
- ce qu’ils comprennent ;
- où ils demandent de l’aide.

## Questions

- « Qu’est-ce que tu penses que ce bouton fait ? »
- « Comment ferais-tu pour voter ? »
- « Comment saurais-tu si ton vote est enregistré ? »

## Critère de sortie

Le parcours correspond réellement aux âges visés.

---

# 39. Jalon 35 — accessibilité et responsive

Tester :

- petit Android ;
- grand Android ;
- iPhone si possible ;
- tablette ;
- ordinateur ;
- zoom texte ;
- contraste ;
- mode sombre si prévu ;
- clavier ;
- lecteur d’écran pour fonctions essentielles.

## Critère de sortie

Aucun écran indispensable n’exige une taille précise.

---

# 40. Jalon 36 — release candidate

Créer :

```text
v0.9-rc1
```

Geler les nouvelles fonctionnalités.

Ne faire que :

- bugs ;
- sécurité ;
- UX bloquante ;
- documentation.

Créer jeu de tests final.

---

# 41. Jalon 37 — production Web

Séparer :

```text
dev
staging
production
```

## Action Lu’uma

Sécuriser les comptes :

- GitHub ;
- Cloudflare ;
- email de récupération.

## Action Codex

Déployer :

- GitHub Pages production ;
- Worker production ;
- D1 production.

Sauvegarder les migrations.

---

# 42. Jalon 38 — signature Android de production

## Action Lu’uma

Créer une clé de signature Android de production.

IMPORTANT :

Cette clé doit être sauvegardée hors du dépôt.

Prévoir deux copies sécurisées.

Sans cette clé, une future mise à jour peut devenir impossible selon le mode de distribution.

## Action Codex

Configurer le build sans exposer la clé.

Utiliser secrets CI si nécessaire.

---

# 43. Jalon 39 — première version stable

Cible possible :

```text
v1.0
```

Doit contenir uniquement les fonctions réellement stabilisées.

Une bonne v1.0 vaut mieux qu’un système immense à moitié fiable.

---

# 44. Développement futur après v1

Possibilités :

- jugement majoritaire ;
- classement ;
- vote multiple ;
- sondage collaboratif ;
- propositions citoyennes ;
- sondage récurrent ;
- API publique ;
- intégration Framaforms ;
- thèmes d’affiches avancés ;
- statistiques longitudinales ;
- plusieurs appareils Android synchronisés ;
- auto-hébergement ;
- relais PHP/SQLite alternatif.

---

# 45. Checklist humaine condensée

## À faire maintenant

- [ ] choisir un nom provisoire ;
- [ ] créer le nouveau dépôt GitHub ;
- [ ] garder le projet séparé de Soi-Libre ;
- [ ] valider le périmètre MVP.

## Après prototype local

- [ ] activer GitHub Pages ;
- [ ] tester le site sur téléphone.

## Avant relais

- [ ] créer / sécuriser compte Cloudflare ;
- [ ] conserver codes de récupération.

## Avant Android

- [ ] installer Android Studio ou décider build CI ;
- [ ] avoir un téléphone Android de test.

## Avant production

- [ ] créer clé de signature Android ;
- [ ] sauvegarder clé hors dépôt ;
- [ ] créer sauvegardes du contexte ;
- [ ] valider politique de confidentialité ;
- [ ] faire pilote adulte ;
- [ ] faire pilote jeunesse.

---

# 46. Checklist ChatGPT

- [ ] cadrage MVP ;
- [ ] modèle de données ;
- [ ] matrice anonymat ;
- [ ] audit UX ;
- [ ] audit API ;
- [ ] audit synchronisation ;
- [ ] audit anonymat ;
- [ ] architecture cryptographique ;
- [ ] scénarios de tests ;
- [ ] audit des livraisons Codex ;
- [ ] consolidation des retours terrain.

---

# 47. Checklist Codex

- [ ] squelette dépôt ;
- [ ] modèles partagés ;
- [ ] validateurs ;
- [ ] tests ;
- [ ] prototype Web ;
- [ ] moteur sondage ;
- [ ] QR ;
- [ ] PDF ;
- [ ] GitHub Pages ;
- [ ] RelayAdapter ;
- [ ] Worker ;
- [ ] D1 ;
- [ ] comptes ;
- [ ] contextes ;
- [ ] anonymat v1 ;
- [ ] sync ;
- [ ] Capacitor ;
- [ ] Kotlin bridge ;
- [ ] Room ;
- [ ] sauvegardes ;
- [ ] serveur local ;
- [ ] build Android ;
- [ ] documentation.

---

# 48. Règle de passage entre étapes

Ne jamais considérer une fonctionnalité terminée parce que :

> « elle marche chez le développeur ».

Elle doit passer quatre niveaux :

```text
CODE
↓
TESTS AUTOMATIQUES
↓
TEST HUMAIN
↓
TEST DANS LA SITUATION RÉELLE
```

Exemple QR :

```text
QR généré
≠
QR réellement lisible sur une affiche imprimée
```

Exemple Android :

```text
base sauvegardée
≠
restauration réellement testée après réinstallation
```

---

# 49. Priorités si le projet doit être raccourci

Si le temps ou l’énergie devient limité, conserver dans cet ordre :

## Priorité 1

Web + relais + sondage simple.

## Priorité 2

Contextes + comptes + anonymat structurel.

## Priorité 3

Affiches / QR / PDF.

## Priorité 4

Android + Room + sauvegarde.

## Priorité 5

Serveur local Android.

## Priorité 6

Relais chiffré / cryptographie avancée.

Ainsi le projet reste utile à chaque étape.

---

# 50. Premier cycle concret recommandé

Voici ce qui peut être fait immédiatement.

## Étape A — Lu’uma

Décider :

```text
nom provisoire du projet
nom du dépôt
```

Créer le dépôt GitHub.

## Étape B — ChatGPT

À partir du document de référence :

1. produire `MVP_SCOPE.md` ;
2. produire `DATA_MODEL_V0.md` ;
3. produire `VOTE_MODES_MATRIX.md` ;
4. produire `UX_FLOWS_V0.md`.

## Étape C — Codex

Avec ces cinq documents :

- créer le squelette ;
- créer modèles / schémas ;
- créer tests ;
- créer prototype Web ;
- ne pas créer Cloudflare ni Android.

## Étape D — ChatGPT

Auditer la première livraison Codex.

## Étape E — Lu’uma

Tester le prototype dans le navigateur et donner les retours.

## Étape F — Codex

Corriger et terminer :

```text
création → vote → résultats → verrouillage
```

## Étape G

Seulement ensuite :

```text
QR → affiche → PDF → GitHub Pages
```

## Étape H

Puis commencer le relais Internet.

---

# 51. Vision du chemin critique

Le chemin critique est :

```text
MODÈLE
  ↓
MOTEUR
  ↓
UX
  ↓
QR
  ↓
WEB PUBLIC
  ↓
RELAIS
  ↓
COMPTES
  ↓
ANONYMAT
  ↓
SYNC
  ↓
ANDROID
```

Si une étape supérieure révèle un problème dans une étape inférieure, corriger la fondation avant de continuer.

---

# 52. Résultat recherché à la fin

Un établissement doit pouvoir choisir :

## Mode connecté

```text
QR permanent
→ téléphone
→ Web
→ relais
→ vote disponible à tout moment
```

## Mode autonome

```text
Android
→ serveur local
→ téléphones
→ Room / SQLite
```

## Mode hybride

```text
Web + relais
↔ synchronisation
↔ Android
```

## Mode confidentialité renforcée

```text
bulletin chiffré
→ relais aveugle
→ Android
→ déchiffrement
```

Sans reconstruire le sondage à chaque changement de mode.

---

# 53. Décision architecturale majeure à préserver

Le projet doit toujours rester :

```text
UN MODÈLE DE SONDAGE
+
UN MOTEUR
+
PLUSIEURS ADAPTATEURS
```

et non :

```text
une app Web
+
une autre app Android
+
un troisième système offline
```

C’est cette décision qui rend l’ensemble réaliste à maintenir.

---

# 54. Prochaine action immédiate

La prochaine vraie étape n’est pas encore de coder Cloudflare ou Android.

Elle est :

```text
1. nom provisoire
2. dépôt GitHub dédié
3. MVP_SCOPE.md
4. DATA_MODEL_V0.md
5. VOTE_MODES_MATRIX.md
6. UX_FLOWS_V0.md
7. première livraison Codex Web local
```

Une fois cette première boucle validée, le projet disposera d’une fondation suffisamment saine pour progresser rapidement sans accumuler de dette architecturale.
