# MVP_SCOPE.md — Voti

## 1. But du MVP

Valider un parcours complet et simple :

`Créer -> publier localement -> accéder au vote -> voter -> verrouiller -> consulter les résultats selon les règles`

Le MVP est d’abord Web/local, sans backend distant.

Les arbitrages validés dans `LOCAL_MVP_DECISIONS.md` font autorité. La présente livraison est la fondation locale ; QR, affiches et PDF sont reportés.

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
- mode anonyme/prototype local uniquement, sans option nominative ni promesse d’anonymat fort contre l’inspection du stockage ;
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
- toutes les règles de résultat et d’accès immuables, incluses dans l’empreinte sémantique avec la définition.

Un sondage publié reste modifiable tant qu’aucun bulletin n’a été accepté.

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
- mode `closed` : fermeture ET seuil obligatoire ; compteur masqué par défaut avant publication des résultats.

### QR, affiches et PDF — reportés
Pas de génération QR dans la fondation locale. La collecte multi-appareils attend un relais partagé. La règle future reste : présélection puis confirmation, jamais un vote automatique. Affiches et PDF sont hors de cette livraison.

### Import/export local
- sérialiser un sondage ;
- exporter un fichier JSON de développement ;
- réimporter ce fichier ;
- ce format n’est pas encore le futur `.sondagebox`.
- validation complète avant écriture ; version inconnue et incohérences refusées ; collisions refusées, aucun remplacement silencieux ni fusion complexe ; statistiques recalculées depuis les bulletins.

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
10. vérifier le mode fermeture ET seuil ;
11. exporter puis réimporter dans un stockage vide, et refuser un import incohérent ou en collision ;
12. vérifier qu’une navigation ne vote jamais et qu’un double clic ne double pas un bulletin.
