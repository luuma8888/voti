# Participation v0.5

## Extension v0.6 — vote contrôlé

Le mode libre conserve ce contrat. En Espace, une Carte Voti remplace la saisie de
nom en identified ; le serveur utilise le nom du membre, pas un texte proposé par
le navigateur. Anonymous ne crée toujours aucune Participation, ni liaison membre.
`member_participations` est une table séparée exclusivement identified, pour garder
les trois colonnes historiques de Participation et la compatibilité du Worker v0.5.
Éligibilité figée/consommée dans une autre table ; la carte est oubliée après vote.
Pas de compte enfant, pas d’identité vérifiée. Une soumission par membre éligible,
pas une garantie d’identité civile. Voir SPACES_GROUPS_V0.md / GROUP_VOTING_PRIVACY_V0.md.

Ce lot est développé et testé localement. Il n'est pas déployé en production.

## Règles

Nouveau sondage : `participationIdentityMode=anonymous`, `commentMode=optional`,
`commentVisibility=private`. Le créateur peut choisir Identifiée, Vote simple ou
Commentaires publics avec les résultats. Ces trois règles participent au hash
sémantique et sont verrouillées au premier vote accepté.

`identified != verified identity` : le nom ou pseudonyme est libre, sans compte,
sans vérification et sans unicité textuelle. Deux « Emma » sont acceptées.
**Voti ne garantit pas encore une personne = un vote.**

## Entités et soumission

- Ballot : identifiants de vote/sondage/choix, reçu de soumission v0.5 ; lien vers
  Participation seulement en mode identified. Jamais de nom dans le bulletin.
- Participation : participationId, pollId, displayName ; aucune en anonymous.
- Comment : commentId, pollId, ballotId/actionId, choiceId, texte brut, état de
  modération, révision ; participationId seulement en identified.

Nom/pseudonyme : trim, 1–60 points de code Unicode ; commentaire : trim,
0–300 points de code. Les espaces seuls sont absents. Unicode/emoji/RTL acceptés,
contrôles non textuels et contrôles de direction masquant le texte refusés.
Pas de HTML/Markdown interprété. Aucun timestamp individuel, IP, User-Agent,
fingerprint, session ou identifiant de personne anonyme ajouté.

Une confirmation inclut tout le contenu. Un batch D1 garde la définition courante,
crée conditionnellement Participation, bulletin et commentaire puis nettoie ses
gardes. Une erreur SQL annule l'ensemble, y compris verrouillage/révision.
Le trigger historique du premier vote reste actif dans cette transaction.

Le reçu SHA-256 standard est contextualisé par pollId **et actionId aléatoire**,
choix et contenu normalisé. Il évite de réutiliser la même action pour un contenu
différent et de recréer un commentaire supprimé lors d'un retry. Ce n'est pas un
hash de personne ni une identité cachée réutilisable entre actions. Il reste
avec le bulletin jusqu'à suppression du sondage ; ce n'est pas du chiffrement.

## Compatibilité

Snapshot métier v3 : `{schemaVersion:3,polls,ballots,comments,participations}`.
Les anciens Poll v2 et leurs trois identifiants de bulletin restent acceptés.
Migration v2 → v3 : validation complète, ajout de deux tableaux vides ; aucune
modification de définition, hash, bulletin ou statut historique. Les règles
absentes sont interprétées anonymous/disabled/private sans modifier le hash.
Migration v1 → v2 conserve le mécanisme précédent d'ajout des références images,
puis applique v2 → v3. Versions inconnues refusées.

Un ancien sondage sans vote peut adopter les champs v3 **seulement après une
modification explicite des nouveaux réglages**. Une édition ordinaire conserve
sa définition v2. Les anciens sondages verrouillés ne changent pas.

Conteneur de backup `voti-backup`, backupVersion 1 inchangé ; version du snapshot
explicitement 3. Les commentaires et identités **locaux** sont inclus et doivent
être traités comme sensibles. Ni votes distants ni capacités admin ajoutés.
Une ancienne application v0.4C ne peut pas lire le snapshot v3 : refus explicite,
pas de downgrade automatique. Conserver une sauvegarde avant changement de version.

## Déploiement futur

Nouvelle migration additive `0003_participation_comments.sql` ; migrations déjà
appliquées inchangées. Production non touchée. Après audit et accord explicite,
prévoir migration D1 puis Worker compatible, puis frontend v0.5. Ne pas publier
le nouveau frontend seul contre le backend v0.4C. Free, sans R2, inchangé.

Sources : [batch D1 transactionnel](https://developers.cloudflare.com/d1/worker-api/d1-database/),
[clés étrangères D1](https://developers.cloudflare.com/d1/sql-api/foreign-keys/).
