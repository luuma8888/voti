# Voti v0.5.1 — UX cleanup après v0.5

## Objectif

Mini-lot strictement UX, sans changement métier, modèle de données, protocole, migration ou infrastructure.

Traiter uniquement les trois réserves humaines reportées après validation de v0.5.

## 1. Compteur de commentaires sur l’accueil créateur

Dans la bibliothèque / liste des sondages du créateur :

- afficher une petite icône commentaire + un nombre uniquement si ce nombre est > 0 ;
- ce compteur appartient uniquement à l’espace créateur autorisé ;
- il ne doit jamais révéler publiquement l’existence de commentaires privés, en attente, masqués ou bloqués sous le seuil ;
- le nombre affiché doit être défini clairement et rester cohérent avec les données accessibles au créateur.

Préférence : compter les commentaires existants côté administration, quel que soit leur statut de modération, puisque la vue est privée au créateur.

Ne pas modifier les projections publiques.

## 2. Hiérarchie visuelle de la liste des réponses dans “Gérer”

Améliorer uniquement la présentation.

Problème observé :
les choix/réponses (“Oui”, “Non”, etc.) se confondent visuellement avec le message :

“Le premier vote a verrouillé la question, les choix et les règles. Vous pouvez encore changer l’apparence.”

Attendu :
- bloc réponses clairement identifiable ;
- titre ou repère visuel explicite ;
- séparation nette du message de verrouillage ;
- rendu lisible mobile et desktop ;
- aucun changement de logique métier.

## 3. Avertissement PDF identités conditionnel

Dans le panneau Rapport :

Texte actuel :
“Ce PDF contiendra les noms ou pseudonymes associés aux réponses.”

Ce texte ne doit être affiché que lorsque l’option :

“Inclure les identités des participants”

est effectivement activée.

Si l’option est désactivée :
- ne pas afficher cet avertissement ;
- conserver le comportement actuel : aucune identité dans le PDF.

Ne modifier ni la collecte des identités, ni les projections, ni le générateur PDF au-delà de cette logique d’affichage.

## 4. Périmètre interdit

Ne pas modifier :
- modèle de données ;
- PollDefinition ;
- migration D1 ;
- Worker ;
- RelayAdapter ;
- protocoles ;
- quotas ;
- Turnstile ;
- R2 ;
- règles d’anonymat ;
- modération ;
- calcul des résultats ;
- contenu des PDF, sauf si nécessaire pour la condition d’affichage de l’avertissement UI ;
- logique de vote.

## 5. Tests

Ajouter / adapter uniquement les tests concernés.

Vérifier au minimum :

1. accueil créateur :
   - 0 commentaire => aucun compteur ;
   - >0 => icône + nombre ;
   - aucun compteur public ;
   - aucun changement des projections publiques ;

2. Gérer :
   - bloc réponses visuellement distinct ;
   - message de verrouillage séparé ;
   - 320 / 360 / 1200 px ;
   - cinq thèmes + Nuit si le harnais existant le permet ;

3. PDF :
   - option identités OFF => avertissement absent ;
   - option ON => avertissement visible ;
   - identité OFF => PDF sans identité ;
   - identité ON => comportement v0.5 inchangé.

## 6. Vérifications finales

Exécuter au minimum :

- npm test
- npm run check
- npm run test:browser avec ciblage UX si disponible
- tests participation/PDF ciblés concernés
- npm run build
- npm run build:production
- git diff --check

Pas besoin de relancer les grosses suites Worker/D1 si aucun code backend/protocole n’est modifié.

## 7. Publication

Après tests :
- rapport court `docs/CODEX_V0_5_1_UX_REPORT.md`
- pas de ZIP complet si aucun besoin d’audit lourd ;
- ne pas toucher Cloudflare ;
- commit/push uniquement après accord de Lu’uma.
