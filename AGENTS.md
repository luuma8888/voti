# AGENTS.md — Voti

## Projet

Voti est une application de sondages et de choix collectifs pensée en priorité pour les structures jeunesse, mais utilisable plus largement.

Objectifs principaux :
- création simple d’un sondage, accessible vers 10 ans ;
- vote simple depuis un téléphone, accessible vers 6 ans ;
- QR codes d’accès, de choix, de résultats et de gestion ;
- affiches imprimables et PDF ;
- fonctionnement Web via GitHub Pages + relais Internet ;
- application Android autonome via Capacitor + couche Kotlin/Room ;
- indépendance vis-à-vis d’un fournisseur unique ;
- confidentialité et anonymat structurels lorsqu’ils sont demandés.

## Documents d’autorité à lire avant toute modification importante

1. `docs/application_sondages_qr_reference_v0.md`
2. `docs/application_sondages_qr_plan_action_v0.md`
3. `docs/MVP_SCOPE.md`
4. `docs/DATA_MODEL_V0.md`
5. `docs/VOTE_MODES_MATRIX.md`
6. `docs/UX_FLOWS_V0.md`

Si une décision de ces documents semble contradictoire, ne pas inventer silencieusement : signaler le conflit et proposer une résolution minimale.

## Décisions structurantes à préserver

- Le projet est séparé de Soi-Libre.
- Le dépôt et GitHub Pages de Voti sont dédiés au projet.
- Voti doit avoir un cœur commun Web/Android.
- Ne pas créer trois applications indépendantes.
- Le Web doit rester déployable sur GitHub Pages.
- Le relais Internet doit être abstrait et remplaçable.
- Android utilisera Capacitor pour l’interface partagée et Room/SQLite via couche native pour les données critiques.
- Les données importantes ne doivent pas dépendre uniquement de `localStorage`, IndexedDB ou du stockage WebView.
- Le serveur local Android est un mode d’autonomie, pas le chemin normal permanent.
- Un sondage est verrouillé sur le fond après son premier vote.
- Le style visuel reste modifiable après verrouillage.
- Un QR associé à une réponse ne vote jamais automatiquement : il pré-sélectionne puis demande confirmation.
- Par défaut les résultats ne sont pas publiés avant 5 réponses, seuil configurable.
- Les votes anonymes doivent séparer techniquement droit de vote et bulletin.
- Les contextes privés doivent être cloisonnés.
- Ne jamais mettre de clé, secret, mot de passe, donnée réelle de mineur ou base réelle dans Git.
- Ne pas implémenter de cryptographie maison.

## Discipline de développement

Avant de coder :
1. lire les documents pertinents ;
2. expliquer brièvement le plan ;
3. identifier les fichiers à toucher ;
4. éviter les refactorings non nécessaires.

Après modification :
1. exécuter les tests pertinents ;
2. signaler les tests non exécutés ;
3. résumer les changements ;
4. signaler les risques ou points ouverts ;
5. ne pas commit/push sauf demande explicite.

## Priorité actuelle

Phase fondation / MVP Web local uniquement.

Ne pas commencer :
- Cloudflare ;
- D1 ;
- comptes réels ;
- Capacitor ;
- Android Studio ;
- Room ;
- serveur local Android ;
- signatures aveugles ;
- chiffrement avancé ;
- synchronisation distribuée complète.

Le premier objectif de développement est :
`créer un sondage -> voter -> verrouiller -> afficher ou masquer les résultats selon les règles`.

## UX

Toujours privilégier :
- gros contrôles tactiles ;
- vocabulaire simple ;
- peu d’actions par écran ;
- responsive mobile d’abord ;
- aucune nécessité de comprendre le jargon électoral ou technique ;
- confirmation claire après vote ;
- différencier nettement espace créateur et espace votant.

## Qualité

La logique métier doit pouvoir être testée indépendamment du navigateur, du relais Internet et d’Android.

Les règles critiques doivent exister dans le moteur commun, pas seulement dans l’interface.
