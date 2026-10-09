# Application de sondages QR — document de référence du projet

**Statut :** document de continuité / architecture initiale  
**Destinataires :** Lu’uma + Codex  
**Objectif :** regrouper les décisions prises jusqu’ici concernant la conception fonctionnelle, UX, technique et architecturale de l’application.

---

# 1. Vision générale

Le projet vise à créer une application de sondages et de votes extrêmement simple à utiliser, notamment dans des structures jeunesse, avec une forte attention portée à :

- la simplicité de création d’un sondage ;
- la simplicité du vote depuis un téléphone ;
- l’usage de QR codes ;
- la possibilité de créer de belles affiches imprimables ;
- la confidentialité ;
- l’anonymat réel lorsque demandé ;
- la possibilité de voter une seule fois lorsque nécessaire ;
- l’autonomie d’un établissement ;
- le fonctionnement avec peu ou pas d’Internet ;
- la gratuité ou quasi-gratuité ;
- l’absence de serveur à administrer localement ;
- la portabilité technique ;
- l’indépendance vis-à-vis d’un fournisseur unique.

L’application est pensée en particulier pour des établissements jeunesse, associations, accueils collectifs de mineurs, espaces jeunes, groupes, établissements éducatifs, structures d’animation ou contextes similaires.

Elle doit néanmoins pouvoir être utilisée plus largement.

L’objectif n’est pas de créer un simple formulaire de type Google Forms ou Framaforms, mais un outil de décision collective simple, visuel, accessible aux enfants, capable de fonctionner aussi bien :

- dans une salle avec plusieurs téléphones ;
- avec un téléphone collectif ;
- avec une tablette d’établissement ;
- avec un sondage accessible à distance pendant plusieurs jours ;
- avec Internet ;
- sans Internet ;
- avec comptes ;
- sans comptes ;
- de manière anonyme ou nominative.

---

# 2. Publics et simplicité visée

Deux niveaux d’UX sont particulièrement importants.

## 2.1 Création du sondage

La création d’un sondage, d’une affiche et de QR codes doit être utilisable par un enfant d’environ **10 ans**.

Le parcours ne doit pas présenter directement des notions techniques complexes.

Exemple de parcours :

1. Que veux-tu demander ?
2. Quelles réponses proposes-tu ?
3. Qui peut voter ?
4. Les votes sont-ils secrets ?
5. Quand montrer les résultats ?
6. À quoi doit ressembler l’affiche ?
7. Publier / imprimer / ouvrir le vote.

Les réglages avancés doivent être accessibles séparément.

## 2.2 Vote

Voter avec un téléphone doit être possible dès environ **6 ans**.

L’interface de vote doit donc privilégier :

- de gros boutons ;
- peu de texte ;
- des cartes visuelles ;
- éventuellement des images et pictogrammes ;
- un bouton de confirmation très clair ;
- une navigation minimale ;
- l’absence d’éléments administratifs ;
- éventuellement la lecture vocale de la question.

---

# 3. Principe architectural général

Le projet ne doit pas être pensé comme trois applications concurrentes, mais comme **un même système disposant de plusieurs modes complémentaires**.

Le noyau métier reste commun.

Les trois grands modes envisagés sont :

1. **Application Web connectée via GitHub Pages + relais Internet**
2. **Application Android autonome / semi-autonome**
3. **Mode de relais différé ou chiffré**

Ces modes doivent partager autant que possible :

- le même modèle de sondage ;
- les mêmes identifiants ;
- les mêmes règles ;
- les mêmes écrans ;
- les mêmes modèles d’affiches ;
- les mêmes QR ;
- les mêmes exports ;
- le même protocole de synchronisation.

---

# 4. Hébergement Web

Le projet NE DOIT PAS être intégré au site Soi-Libre.

Soi-Libre conserve sa contrainte forte :

> « Aucune donnée personnelle envoyée »

Cette contrainte est incompatible avec les fonctionnalités connectées prévues ici.

Le projet doit donc avoir :

- son propre dépôt GitHub ;
- son propre site GitHub Pages ;
- sa propre identité ;
- sa propre politique de confidentialité ;
- ses propres données ;
- sa propre API ;
- ses propres comptes éventuels ;
- aucun partage de stockage ou d’authentification avec Soi-Libre.

Le site Soi-Libre actuel est :

`https://luuma8888.github.io/soi-libre/`

Il doit rester techniquement et fonctionnellement séparé.

---

# 5. Architecture cible

Architecture conceptuelle :

```text
NOUVEAU PROJET GITHUB
        │
        ├── GitHub Pages
        │      │
        │      ├── création de sondages
        │      ├── vote
        │      ├── résultats
        │      ├── QR / affiches / PDF
        │      └── connexion au relais
        │
        ├── Relais Internet optionnel
        │      ├── comptes
        │      ├── droits
        │      ├── votes
        │      ├── synchronisation
        │      └── stockage minimal / chiffré
        │
        └── Application Android
               ├── même cœur HTML/CSS/JS
               ├── Capacitor
               ├── couche native Kotlin
               ├── Room / SQLite
               ├── serveur local autonome
               ├── sauvegarde chiffrée
               └── synchronisation avec le relais
```

---

# 6. Application Web

La version Web doit être accessible via GitHub Pages.

Elle doit pouvoir servir à :

- créer un sondage ;
- administrer un contexte ;
- voter ;
- afficher les résultats ;
- créer les affiches ;
- créer les QR codes ;
- générer des PDF ;
- créer des graphiques ;
- fonctionner partiellement offline ;
- importer/exporter des données ;
- utiliser un relais Internet lorsque nécessaire.

Le stockage navigateur ne doit pas être considéré comme source de vérité durable.

IndexedDB ou un stockage local navigateur peut servir comme :

- cache ;
- brouillon ;
- stockage de travail ;
- mode offline temporaire.

Mais les données importantes ne doivent pas dépendre exclusivement du stockage navigateur mobile, qui peut être supprimé ou réinitialisé.

---

# 7. Application Android

L’application Android est importante pour rendre un établissement réellement autonome.

Elle ne doit pas être développée comme une deuxième application totalement distincte si cela peut être évité.

Le choix actuel privilégié est :

- interface principale en HTML/CSS/JavaScript ;
- emballage via **Capacitor** ;
- stockage critique via une couche native Android ;
- **Room / SQLite** pour les données persistantes ;
- module Kotlin maison pour les fonctions sensibles.

La structure visée est :

```text
Interface HTML / CSS / JavaScript
             │
          Capacitor
             │
       pont natif Kotlin
             │
            Room
             │
           SQLite
```

Le stockage critique NE DOIT PAS reposer uniquement sur :

- `localStorage` ;
- IndexedDB ;
- stockage WebView.

## 7.1 Pourquoi ne pas passer toute l’application en Jetpack Compose

Une application totalement native Kotlin/Jetpack Compose serait plus complexe à maintenir et obligerait à dupliquer beaucoup d’interface.

Le principal besoin critique est la persistance native des données.

Cette persistance peut être assurée par Room/SQLite même avec une interface Web embarquée.

Jetpack Compose ne rendrait pas à lui seul les données plus persistantes.

## 7.2 Données Android

Les données Android doivent persister normalement après :

- fermeture de l’application ;
- redémarrage ;
- mise en veille ;
- mise à jour de l’application.

Elles peuvent néanmoins être supprimées en cas :

- de désinstallation ;
- d’effacement manuel des données ;
- de corruption ou incident exceptionnel.

Il faut donc prévoir une sauvegarde indépendante.

---

# 8. Sauvegardes Android

Le système doit permettre de créer une sauvegarde complète, par exemple sous la forme :

`mon-contexte.sondagebox`

Ce fichier doit idéalement être :

- exportable ;
- importable ;
- chiffré ;
- versionné ;
- compatible avec les versions futures du logiciel.

Il peut contenir :

- contexte ;
- groupes ;
- comptes ;
- sondages ;
- résultats ;
- paramètres ;
- éventuellement les votes selon le niveau de confidentialité.

Le fichier peut être enregistré dans :

- Documents ;
- clé USB ;
- stockage externe ;
- Nextcloud ;
- Google Drive ;
- autre emplacement choisi par l’utilisateur.

Le format de sauvegarde ne doit pas être propriétaire de manière opaque : il doit être documenté ou suffisamment stable pour permettre une migration future.

---

# 9. Serveur local Android

L’application Android peut lancer un petit serveur HTTP local pour permettre aux jeunes de voter depuis leurs propres téléphones.

Exemple :

```text
Tablette / téléphone Android établissement
        │
        ├── base Room / SQLite
        ├── serveur HTTP local
        │
        └── QR
              │
              ▼
Téléphones des jeunes
              │
          navigateur
              │
            vote
```

Le serveur local peut fonctionner via :

- Wi-Fi commun ;
- réseau local ;
- hotspot local créé par l’appareil Android.

## 9.1 Avantage

L’établissement peut continuer à fonctionner sans Internet.

## 9.2 Limite

Le serveur local Android ne doit PAS devenir le chemin normal obligatoire du vote.

Si le serveur local doit être activé manuellement, cela empêcherait les jeunes de voter à tout moment lorsqu’ils sont hors de la présence de l’appareil Android.

Le serveur Android doit donc plutôt être considéré comme :

- mode autonome ;
- mode hors connexion ;
- mode de secours ;
- mode séance locale ;
- solution d’indépendance.

Il ne doit pas être nécessaire pour les QR permanents utilisés plusieurs jours.

---

# 10. Relais Internet

Le mode Web connecté nécessite un petit relais Internet.

GitHub Pages héberge l’interface mais ne joue pas le rôle de serveur applicatif ou de base de données.

Le relais Internet doit fournir une API minimale.

Une première implémentation possible est :

- Cloudflare Workers ;
- Cloudflare D1.

Mais l’application NE DOIT PAS être conçue autour de Cloudflare en dur.

Le relais doit être interchangeable.

Le protocole doit appartenir au projet.

Exemple d’API abstraite :

```text
createContext()
createPoll()
updatePoll()
getPoll()
submitVote()
syncChanges()
issueVotingToken()
getResults()
createAccount()
disableAccount()
```

Un jour, le relais pourrait être remplacé par :

- PHP + SQLite ;
- Node + PostgreSQL ;
- autre service ;
- auto-hébergement ;
- autre fournisseur.

Le cœur de l’application ne doit pas dépendre structurellement du fournisseur choisi.

---

# 11. Rôle du relais Internet

Le relais Internet permet :

- aux QR permanents de fonctionner à tout moment ;
- aux jeunes de voter sans que l’application Android soit ouverte ;
- le vote distant ;
- la synchronisation ;
- la récupération des votes plus tard ;
- l’accès aux résultats autorisés.

Le relais ne doit pas devenir la seule copie des données.

L’application Android doit pouvoir conserver une copie complète du contexte.

Ainsi :

```text
cloud = disponibilité
local = autonomie / souveraineté
```

---

# 12. Mode différé / relais chiffré

Un troisième mode doit être étudié.

Principe :

```text
Téléphone du votant
       ↓
chiffrement local
       ↓
relais Internet
       ↓
enveloppe chiffrée
       ↓
application Android
       ↓
déchiffrement local
```

Le relais joue alors le rôle de boîte aux lettres.

Il n’a pas nécessairement besoin de connaître le contenu du bulletin.

Cette approche peut être particulièrement utile pour :

- votes anonymes ;
- commentaires ;
- contextes sensibles ;
- structures souhaitant réduire la confiance accordée au serveur.

Ce mode pourra être développé après stabilisation du cœur du projet.

---

# 13. Contextes

L’application doit permettre de créer des **contextes**.

Un contexte représente une cloison humaine, organisationnelle et technique.

Exemples :

- Espace Jeunes de Limoux ;
- collège ;
- centre social ;
- association ;
- groupe citoyen ;
- séjour ;
- accueil jeunesse.

Un contexte peut contenir un ou plusieurs groupes.

Exemple :

```text
Contexte : Espace Jeunes

Groupes :
- 11–13 ans
- 14–17 ans
- Conseil des jeunes
- Animateurs
```

Un utilisateur peut éventuellement appartenir à plusieurs groupes.

---

# 14. Contextes publics et privés

Un contexte peut être public ou privé.

## 14.1 Contexte privé

Dans un contexte privé :

- comptes isolés ;
- groupes isolés ;
- sondages isolés ;
- votes isolés ;
- administration isolée ;
- pas de relation implicite avec les autres contextes.

Deux comptes ayant le même pseudo dans deux contextes différents doivent rester indépendants.

Chaque donnée doit contenir ou être reliée à un `context_id`.

Les autorisations doivent être vérifiées côté relais, pas uniquement dans l’interface.

---

# 15. Rôles utilisateurs

Trois rôles principaux sont prévus.

## 15.1 Administrateur

Adulte responsable du contexte.

Peut :

- gérer le contexte ;
- gérer les groupes ;
- créer / désactiver des comptes ;
- attribuer les rôles ;
- autoriser des créateurs ;
- administrer les paramètres ;
- éventuellement intervenir sur les sondages selon les règles.

L’administrateur ne doit pas pouvoir réécrire le contenu d’un sondage après le premier vote.

## 15.2 Créateur

Enfant ou adulte.

Peut :

- créer un sondage ;
- publier un sondage ;
- gérer son sondage ;
- fermer le sondage ;
- modifier son apparence ;
- générer les affiches ;
- afficher les résultats si autorisé.

## 15.3 Utilisateur

Enfant ou adulte.

Peut :

- voter ;
- voir éventuellement les résultats ;
- disposer éventuellement d’un compte simple.

---

# 16. Comptes

Les comptes doivent être très simples.

Exemple :

```text
pseudo
mot de passe / phrase secrète
```

Le compte sert notamment à :

- gérer l’accès ;
- gérer les groupes ;
- permettre un vote unique ;
- attribuer un rôle ;
- rendre possible un sondage nominatif.

Les mots de passe ne doivent jamais être stockés en clair.

Le système doit utiliser une méthode moderne de dérivation / hachage des mots de passe.

Pour les jeunes, il est possible d’envisager des secrets faciles à retenir, par exemple :

```text
lune bateau kiwi dragon
```

Un administrateur peut réinitialiser un accès mais ne doit pas pouvoir lire le secret actuel.

---

# 17. Vote unique

Le projet doit distinguer plusieurs situations.

## 17.1 Compte utilisateur

Le système peut garantir qu’un compte ne vote qu’une fois.

## 17.2 Jeton individuel

Le système peut fournir un QR ou un code à usage unique.

## 17.3 Vote public sans compte

Il n’est pas possible de garantir réellement :

> une personne = un vote

uniquement avec :

- cookie ;
- IP ;
- localStorage ;
- fingerprint.

Ces mécanismes sont contournables et/ou problématiques pour la vie privée.

L’interface doit donc être honnête sur le niveau de garantie.

---

# 18. Anonymat

Deux types de sondages doivent au minimum être possibles :

- nominatif ;
- anonyme.

Dans un sondage anonyme, l’objectif est fort :

> administrateur, créateur et utilisateurs ne doivent pas pouvoir déterminer qui a voté quoi.

Le modèle de données ne doit pas simplement cacher l’identité dans l’interface.

Il ne faut pas stocker directement :

```text
user_id -> réponse
```

pour un sondage anonyme.

Il faut séparer :

```text
DROIT DE VOTE
Utilisateur X a utilisé son droit
```

de :

```text
BULLETIN
Bulletin Y = choix B
```

Sans lien récupérable entre X et Y.

---

# 19. Anonymat avancé

Une architecture cryptographique plus forte doit être étudiée.

Une piste évoquée est l’utilisation de jetons anonymes ou de signatures aveugles.

Principe conceptuel :

```text
utilisateur authentifié
        ↓
obtient un droit de vote
        ↓
reçoit un jeton anonyme valide
        ↓
session d’identité terminée
        ↓
vote avec le jeton
        ↓
le serveur vérifie :
- jeton valide
- jeton jamais utilisé
```

Le serveur sait alors qu’un droit de vote a été utilisé sans pouvoir nécessairement relier le bulletin à l’identité.

Cette partie doit être conçue avec prudence avant implémentation.

---

# 20. Métadonnées des votes anonymes

Il faut éviter de réidentifier indirectement un bulletin.

Exemple problématique :

```text
vote = 14:32:17.438
connexion utilisateur = 14:32:16
```

Cela permettrait parfois de déduire l’identité.

Pour les sondages anonymes, limiter les données conservées :

- pas d’identifiant utilisateur dans le bulletin ;
- pas d’IP stockée volontairement ;
- pas de fingerprint ;
- pas de user-agent si inutile ;
- horodatage supprimé, arrondi ou découplé si nécessaire ;
- commentaire dissocié de l’identité.

---

# 21. Immutabilité du sondage après le premier vote

Une fois qu’un sondage reçoit sa première réponse, son contenu de fond ne peut plus être modifié.

Doivent devenir immuables :

- question ;
- réponses ;
- type de scrutin ;
- règles essentielles ;
- anonymat ;
- paramètres ayant un impact sur le sens du vote.

Le serveur doit appliquer cette règle.

Il ne faut pas se contenter de désactiver un bouton dans l’interface.

Le sondage peut avoir :

```text
locked_at
definition_hash
```

`definition_hash` représente une empreinte cryptographique de la définition du sondage.

---

# 22. Style modifiable après premier vote

Le style visuel reste modifiable.

Il faut séparer clairement :

```text
poll_definition
```

de :

```text
poster_style
```

Le créateur peut continuer à modifier :

- couleur ;
- fond ;
- thème ;
- police ;
- disposition ;
- illustrations ;
- présentation des QR ;
- format papier.

Mais jamais changer le sens du vote après la première réponse.

---

# 23. Types de sondages

Le système doit proposer des modèles simples.

Exemples :

- Oui / Non ;
- choix d’un jeu ;
- choix d’une activité ;
- choix d’une soirée ;
- choix d’une date ;
- évaluation 1 à 5 ;
- donner son avis ;
- choix avec commentaire ;
- proposition libre ;
- boîte à idées ;
- proposer puis voter ;
- lien vers sondage externe.

Les termes techniques doivent être évités pour les enfants.

Exemple :

> « On choisit »

plutôt que :

> « scrutin uninominal à choix unique ».

Des types plus complexes pourront être ajoutés plus tard :

- choix multiples ;
- classement ;
- vote pondéré ;
- jugement majoritaire ;
- Condorcet ;
- autres méthodes de décision collective.

---

# 24. QR codes

Plusieurs types de QR sont prévus.

## 24.1 QR d’accès au sondage

Ouvre la page de vote.

## 24.2 QR de choix direct

Chaque réponse peut avoir son propre QR.

Exemple :

```text
Cinéma -> QR
Jeux -> QR
Sport -> QR
```

IMPORTANT :

Scanner un QR de choix direct ne doit PAS voter immédiatement.

Le QR doit pré-sélectionner la réponse, puis afficher une confirmation.

Exemple :

```text
Tu choisis :
CINÉMA

[ Confirmer mon vote ]
```

Cela évite les votes accidentels liés aux scanners, aperçus, préchargements ou erreurs de manipulation.

## 24.3 QR de résultats

Permet de consulter les résultats si les conditions sont remplies.

## 24.4 QR de gestion

Permet d’accéder à la page de gestion.

Dans un contexte avec comptes, le QR ne donne pas directement les droits : l’utilisateur doit être authentifié.

Dans un mode autonome sans compte, il est possible d’étudier un QR maître contenant une clé de gestion longue et aléatoire.

Ce QR doit être traité comme un secret.

---

# 25. QR permanents et QR locaux

Deux catégories doivent être distinguées.

## 25.1 QR permanent

Exemple :

```text
https://nouveau-projet.github.io/.../s/ABC123
```

ou une URL du relais.

Avantage :

- fonctionne plusieurs jours ;
- fonctionne à distance ;
- ne dépend pas de l’IP locale.

## 25.2 QR local

Exemple :

```text
http://192.168.x.x:port/s/ABC123
```

Avantage :

- fonctionne sans Internet ;
- très utile en séance.

Inconvénient :

- l’adresse IP peut changer ;
- mauvais choix pour une affiche imprimée plusieurs jours à l’avance.

---

# 26. Affiches imprimables

Après création du sondage, l’application doit permettre de générer une affiche PDF.

L’affiche peut contenir :

- invitation ;
- titre ;
- question ;
- réponses ;
- QR principal ;
- QR par choix ;
- QR résultats ;
- consignes ;
- date de fermeture ;
- informations contextuelles.

L’affiche doit être :

- jolie ;
- claire ;
- fonctionnelle ;
- personnalisable ;
- adaptée aux enfants.

Formats possibles :

- A4 portrait ;
- A4 paysage ;
- A5 ;
- 2 × A5 sur A4 ;
- autres formats à envisager.

---

# 27. Studio d’affiche

L’utilisateur ne doit pas devoir construire une mise en page manuellement.

Le système doit proposer des compositions automatiques adaptées à :

- nombre de réponses ;
- nombre de QR ;
- longueur des textes ;
- orientation ;
- âge du public.

Thèmes possibles :

- jeunesse ;
- nature ;
- école ;
- coloré ;
- sobre ;
- nuit ;
- jeux ;
- personnalisable.

---

# 28. Résultats

L’application doit permettre :

- affichage des résultats ;
- graphiques ;
- génération PDF ;
- export ;
- QR vers résultats.

Le PDF de résultats peut inclure :

- question ;
- nombre de votes ;
- graphiques ;
- pourcentages ;
- commentaires autorisés ;
- date ;
- contexte ;
- QR éventuel.

---

# 29. Seuil minimal avant affichage des résultats

Par défaut, les résultats ne doivent être affichés qu’après un certain nombre de réponses.

Valeur initialement envisagée :

```text
5 réponses
```

Ce nombre est paramétrable lors de la création.

Objectif :

éviter qu’il soit trop facile de déterminer qui a voté quoi lorsqu’il y a très peu de participants.

Le seuil peut être combiné avec d’autres conditions.

Exemples :

```text
nombre de votes >= 5
```

ou :

```text
nombre de votes >= 5
ET sondage ouvert depuis 2 heures
```

ou :

```text
sondage terminé
```

ou :

```text
date >= samedi 18h
```

ou :

```text
créateur a activé la publication
```

---

# 30. Résultats différés

Le QR résultats peut :

- être absent ;
- être présent mais verrouillé ;
- devenir actif après une date ;
- devenir actif après X votes ;
- devenir actif après validation ;
- devenir actif uniquement à la fermeture du sondage.

Avant disponibilité :

```text
Résultats pas encore disponibles
```

Le nombre de réponses actuelles peut lui-même être affiché ou masqué.

---

# 31. Téléphone collectif

Un mode spécifique doit être prévu.

Exemple :

```text
MODE TÉLÉPHONE COLLECTIF
```

Après un vote :

```text
Vote enregistré
Merci !

[ Participant suivant ]
```

Puis l’écran revient automatiquement au début.

Ce mode permet à plusieurs jeunes d’utiliser le même appareil.

---

# 32. Vote par téléphone personnel

Un jeune peut voter depuis son téléphone :

- via QR permanent Internet ;
- via QR local ;
- via lien ;
- via compte ;
- via jeton ;
- via sondage public selon configuration.

Aucune application ne doit être nécessaire côté participant.

Le vote doit fonctionner dans le navigateur.

---

# 33. Sondages externes

L’application doit pouvoir créer une affiche ou un QR pointant vers un service externe.

Exemples :

- Framaforms ;
- Microsoft Forms ;
- Google Forms ;
- autres services libres ou externes.

Dans ce mode :

```text
engine = external
```

L’application ne gère pas elle-même :

- vote ;
- anonymat ;
- unicité ;
- stockage ;
- comptes.

Elle sert à :

- créer le QR ;
- créer l’affiche ;
- présenter le sondage ;
- éventuellement ajouter un lien vers les résultats externes.

L’interface doit clairement indiquer que les garanties dépendent alors du service extérieur.

---

# 34. Synchronisation Web / Android

Le système doit permettre à Android et au relais de conserver des états compatibles.

Exemple :

```text
Android
votes 71,72,73

Relais
votes 74,75

Synchronisation

Android + relais
71,72,73,74,75
```

Chaque objet doit utiliser des identifiants globaux uniques, par exemple UUID.

La synchronisation doit éviter :

- doublons ;
- perte ;
- écrasement silencieux ;
- conflits incohérents.

---

# 35. Journal d’événements

Il est souhaitable d’étudier un modèle de synchronisation reposant partiellement sur un journal d’événements.

Exemples :

```text
poll_created
poll_updated
poll_locked
vote_cast
poll_closed
style_changed
account_created
account_disabled
```

Avantages :

- synchronisation offline plus simple ;
- audit ;
- migrations ;
- résolution des conflits ;
- réplication.

Le modèle exact reste à définir.

---

# 36. Gestion des conflits

La règle d’immutabilité après premier vote simplifie beaucoup la synchronisation.

Les conflits de contenu doivent surtout concerner :

- sondages encore non verrouillés ;
- styles ;
- comptes ;
- groupes ;
- permissions.

Les votes doivent être append-only autant que possible.

---

# 37. Modèle de données — séparation essentielle

Il faut distinguer au minimum :

```text
Context
Group
User
Role
Poll
PollDefinition
PollStyle
PollAccessRules
Ballot
VoteEligibility
AnonymousToken
ResultPublicationRules
ExternalPoll
SyncEvent
BackupMetadata
```

La structure précise reste à concevoir.

---

# 38. Données opérationnelles vs bulletin

Pour les votes anonymes et/ou chiffrés, il est important de distinguer :

## Métadonnées opérationnelles

Exemples :

- poll_id ;
- contexte ;
- statut ;
- jeton utilisé ;
- droits ;
- fermeture ;
- état de synchronisation.

## Contenu du bulletin

Exemples :

- choix ;
- classement ;
- commentaire ;
- note ;
- réponses libres.

Le bulletin peut recevoir un niveau de protection supérieur.

---

# 39. Confidentialité

Les principes sont :

- minimisation ;
- pas de tracking inutile ;
- pas de fingerprinting ;
- pas de publicité ;
- pas d’analytics tiers nécessaires au fonctionnement ;
- pas de stockage inutile de données enfant ;
- séparation claire des contextes ;
- sécurité par défaut.

Les paramètres par défaut doivent être protecteurs.

---

# 40. Web + relais = mode quotidien privilégié

Le mode Web + relais est actuellement considéré comme le meilleur chemin par défaut pour :

- QR permanents ;
- vote à tout moment ;
- vote à distance ;
- sondages affichés plusieurs jours ;
- établissements avec Internet.

La version Android reste une composante forte mais ne doit pas être obligatoire pour utiliser le système.

---

# 41. Android = souveraineté / autonomie

Android apporte :

- copie locale persistante ;
- fonctionnement sans Internet ;
- serveur local ;
- sauvegarde indépendante ;
- import/export ;
- capacité de changer de relais ;
- continuité en cas de panne du fournisseur Internet.

L’établissement ne doit donc pas être dépendant du relais pour conserver ses données principales.

---

# 42. Relais interchangeable

Le projet ne doit pas être captif de Cloudflare.

Même si une première version utilise Cloudflare Workers + D1, les interfaces doivent permettre une migration future.

On veut pouvoir passer à :

```text
Cloudflare
↓
PHP + SQLite
↓
Node
↓
serveur auto-hébergé
↓
autre solution
```

sans reconstruire toute l’application.

---

# 43. Dépendance aux services gratuits

Le projet doit supposer qu’un fournisseur gratuit peut :

- modifier ses quotas ;
- modifier ses conditions ;
- devenir payant ;
- disparaître ;
- bloquer un compte.

L’architecture doit donc privilégier :

- export ;
- sauvegarde ;
- protocoles documentés ;
- API abstraite ;
- possibilité de migrer ;
- réplication locale.

---

# 44. Distribution Android

L’application Android peut être distribuée directement sous forme d’APK.

Il n’est pas nécessaire d’utiliser Google Play pour les usages internes.

Exemple :

```text
Sondages-1.0.apk
Sondages-1.1.apk
```

En conservant la même signature Android, les mises à jour doivent conserver les données.

Un dépôt GitHub Releases peut être utilisé pour distribuer les APK.

---

# 45. Dépôt GitHub

Prévoir un nouveau dépôt dédié.

Structure initiale possible :

```text
/
├── README.md
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── privacy.md
│   ├── sync.md
│   └── qr-flows.md
├── web/
│   ├── index.html
│   ├── src/
│   └── assets/
├── android/
│   ├── capacitor/
│   └── native/
├── relay/
│   ├── api/
│   ├── migrations/
│   └── adapters/
├── shared/
│   ├── models/
│   ├── validation/
│   ├── crypto/
│   ├── qr/
│   └── export/
└── schemas/
```

Cette structure reste indicative.

---

# 46. Cœur partagé

Les éléments suivants doivent autant que possible être mutualisés :

- règles de sondage ;
- validation ;
- modèles ;
- génération QR ;
- rendu des résultats ;
- génération d’affiches ;
- logique d’export ;
- types ;
- sérialisation ;
- logique de synchronisation indépendante du fournisseur ;
- logique d’anonymat côté client lorsque possible.

---

# 47. Priorité de développement suggérée

## Phase 1 — Modèle et architecture

Avant de coder l’interface complète :

- définir objets ;
- définir règles ;
- définir états ;
- définir permissions ;
- définir anonymat ;
- définir synchronisation ;
- définir format de sauvegarde ;
- définir séparation entre local et distant.

## Phase 2 — Web local / statique

Créer :

- assistant de création ;
- modèles de sondage ;
- QR ;
- affiches ;
- PDF ;
- résultats ;
- import/export ;
- cache local.

## Phase 3 — Relais

Ajouter :

- contextes ;
- comptes ;
- groupes ;
- authentification ;
- votes ;
- API ;
- synchronisation ;
- QR permanents.

## Phase 4 — Android

Ajouter :

- Capacitor ;
- Room / SQLite ;
- sauvegarde native ;
- serveur local ;
- hotspot / LAN ;
- synchronisation.

## Phase 5 — Confidentialité avancée

Ajouter :

- jetons anonymes ;
- séparation renforcée identité/bulletin ;
- chiffrement du bulletin ;
- relais différé ;
- signatures aveugles si pertinentes.

---

# 48. Règles UX principales

Toujours privilégier :

- une action principale claire ;
- de gros boutons ;
- une interface responsive ;
- une navigation enfant-compatible ;
- peu d’écrans techniques ;
- un mode avancé séparé ;
- des explications simples ;
- des pictogrammes ;
- un aperçu immédiat des affiches ;
- des erreurs compréhensibles.

---

# 49. Principe de confiance

L’application doit éviter de faire croire à une sécurité qu’elle ne possède pas.

Exemples :

- vote public sans compte : ne pas promettre une unicité absolue ;
- sondage externe : ne pas promettre l’anonymat du service externe ;
- relais Internet : indiquer quelles données transitent ;
- vote anonyme : ne pas conserver de lien identité → bulletin ;
- QR admin : ne pas présenter une simple URL comme une authentification forte.

---

# 50. Questions encore ouvertes

Les éléments suivants ne sont pas encore définitivement décidés.

## Identité du projet

- nom ;
- logo ;
- charte graphique ;
- domaine éventuel ;
- nom du dépôt GitHub.

## Relais

- Cloudflare Workers + D1 ou autre solution initiale ;
- quotas ;
- architecture exacte ;
- coût éventuel à terme ;
- stratégie de migration.

## Authentification

- format exact des comptes ;
- sessions ;
- récupération ;
- méthode de mot de passe ;
- authentification des administrateurs ;
- MFA éventuelle.

## Cryptographie

- chiffrement exact des sauvegardes ;
- chiffrement des bulletins ;
- signatures aveugles ;
- gestion des clés ;
- récupération des clés ;
- rotation.

## Synchronisation

- journal d’événements ou autre modèle ;
- résolution des conflits ;
- granularité ;
- stratégie offline-first.

## Android

- Capacitor version ;
- module Kotlin ;
- Room ;
- serveur HTTP embarqué ;
- API locale ;
- hotspot ;
- compatibilité minimale Android.

## Affiches

- moteur PDF ;
- rendu HTML / Canvas / SVG ;
- templates ;
- thèmes ;
- personnalisation.

---

# 51. Décisions fortes à ne pas réinventer sans raison

Les décisions suivantes sont actuellement considérées comme structurantes :

1. Nouveau dépôt GitHub et nouveau GitHub Pages séparés de Soi-Libre.
2. Soi-Libre ne doit pas être utilisé pour les données de ce projet.
3. Trois modes complémentaires : Web + relais, Android autonome, relais différé/chiffré.
4. Cœur HTML/CSS/JS mutualisé.
5. Android via Capacitor + couche native Kotlin pour les fonctions critiques.
6. Données Android critiques via Room / SQLite.
7. Ne pas dépendre du stockage navigateur mobile pour les données importantes.
8. Le serveur Android local est un mode d’autonomie, pas le chemin normal permanent.
9. Le relais Internet doit être interchangeable.
10. L’établissement doit conserver une copie locale et exportable de ses données.
11. Un sondage est verrouillé après le premier vote.
12. Le style reste modifiable après verrouillage.
13. Le vote anonyme doit séparer techniquement identité et bulletin.
14. Un QR de choix direct ne doit jamais enregistrer un vote sans confirmation.
15. Les résultats sont masqués jusqu’à un seuil configurable, par défaut 5 réponses.
16. Trois rôles principaux : administrateur, créateur, utilisateur.
17. Les contextes privés sont cloisonnés.
18. Le téléphone collectif doit être pris en charge.
19. Les sondages externes sont pris en charge sans prétendre contrôler leur confidentialité.
20. L’application doit être utilisable par un créateur d’environ 10 ans et un votant dès environ 6 ans.

---

# 52. Ligne directrice générale

La philosophie globale peut être résumée ainsi :

```text
SIMPLICITÉ POUR LE JEUNE
+
CONTRÔLE POUR LA STRUCTURE
+
AUTONOMIE LOCALE
+
DISPONIBILITÉ INTERNET
+
ANONYMAT RÉEL LORSQU’IL EST DEMANDÉ
+
PORTABILITÉ
+
PAS DE DÉPENDANCE IRRÉVERSIBLE À UN FOURNISSEUR
```

Le cloud sert principalement à la disponibilité.

Le local sert à l’autonomie, la sauvegarde et la continuité.

Android agit comme coffre local et mode autonome.

Le Web permet l’accessibilité universelle.

Le relais différé/chiffré permet d’aller plus loin dans la confidentialité sans renoncer à l’usage à distance.

---

# 53. Prochaine étape recommandée

Avant le développement complet, produire :

1. un modèle de données versionné ;
2. une matrice des cas de vote ;
3. une matrice anonymat / identité / comptes / jetons ;
4. le protocole de synchronisation ;
5. le format `.sondagebox` ;
6. les flux QR ;
7. les rôles et permissions ;
8. les écrans UX principaux ;
9. l’architecture du relais ;
10. les interfaces entre le cœur JS et la couche Android native.

À partir de ces éléments, Codex pourra commencer le squelette du projet sans risquer de figer prématurément une mauvaise architecture.
