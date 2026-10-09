# MVP_SCOPE.md — Voti

## 1. But du MVP

Valider un parcours complet et simple :

`Créer -> publier localement -> accéder au vote -> voter -> verrouiller -> consulter les résultats selon les règles`

Le MVP est d’abord Web/local, sans backend distant.

## 2. Public cible

### Créateur
Enfant ou adulte, avec objectif d’usage autonome vers 10 ans.

### Votant
Enfant ou adulte, avec objectif d’usage autonome vers 6 ans.

## 3. Fonctionnalités incluses

### Création
- créer un sondage ;
- question courte ;
- 2 à 6 choix ;
- choix unique ;
- texte obligatoire pour chaque choix ;
- emoji ou pictogramme facultatif ;
- image de choix reportée après première version si elle complexifie trop le MVP ;
- choisir anonyme ou nominatif comme propriété du sondage, même si le nominatif réel sans compte reste simulé/local au MVP ;
- seuil de résultats configurable, valeur par défaut 5 ;
- état brouillon puis publié.

### Vote
- page mobile simple ;
- une seule réponse possible ;
- étape de confirmation ;
- message de réussite ;
- prévention d’un double envoi de la même action côté interface ;
- le moteur doit accepter/rejeter explicitement un bulletin.

### Verrouillage
Au premier bulletin accepté :
- question immuable ;
- liste des choix immuable ;
- type de vote immuable ;
- anonymat immuable ;
- règles principales de résultat immuables si leur modification peut altérer la compréhension du scrutin.

Restent modifiables :
- couleurs ;
- thème ;
- mise en page ;
- éléments visuels sans conséquence sur le sens du vote.

### Résultats
- total des votes ;
- compte par choix ;
- pourcentage ;
- graphique simple ;
- résultats masqués sous le seuil ;
- possibilité de fermer le sondage.

### QR
- QR vers page de vote ;
- QR vers un choix pré-sélectionné ;
- QR vers résultats ;
- aucun QR de choix ne valide le vote sans confirmation humaine.

### Affiche
Première version :
- A4 portrait ;
- titre/question ;
- choix ;
- QR principal ;
- option QR par choix ;
- QR résultats facultatif ;
- rendu imprimable.

### Import/export local
- sérialiser un sondage ;
- exporter un fichier JSON de développement ;
- réimporter ce fichier ;
- ce format n’est pas encore le futur `.sondagebox`.

## 4. Fonctionnalités explicitement hors MVP

- Cloudflare Workers ;
- D1 ;
- authentification réelle ;
- groupes ;
- comptes ;
- vote unique fort entre appareils ;
- serveur local Android ;
- Capacitor ;
- Room ;
- hotspot ;
- commentaires ;
- réponses libres ;
- classement ;
- choix multiples ;
- jugement majoritaire ;
- Condorcet ;
- signatures aveugles ;
- chiffrement avancé ;
- synchronisation distribuée ;
- notifications ;
- analytics.

## 5. Règles de qualité

Le MVP doit :
- être responsive ;
- fonctionner sur navigateur mobile moderne ;
- avoir une logique métier testable hors UI ;
- ne contenir aucun secret ;
- ne dépendre d’aucun CDN si une dépendance peut être intégrée proprement au build ;
- être déployable statiquement sur GitHub Pages.

## 6. Critères d’acceptation

Le MVP est considéré fonctionnel lorsqu’il est possible de :
1. créer un sondage à 3 choix ;
2. le publier ;
3. ouvrir sa page de vote ;
4. voter ;
5. constater son verrouillage ;
6. tenter une modification interdite et obtenir un refus ;
7. modifier son style ;
8. vérifier que les résultats restent masqués sous le seuil ;
9. atteindre le seuil et voir les résultats ;
10. générer et scanner un QR de vote ;
11. générer un QR de choix, vérifier qu’il ne vote pas seul ;
12. imprimer une affiche A4 lisible.
