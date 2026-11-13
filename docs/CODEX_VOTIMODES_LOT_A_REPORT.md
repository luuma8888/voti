# VOTIMODES — Lot A

Implémentation et contrôles du lot A terminés. Migration et Worker publiés ;
le frontend est porté par le commit contenant cette note.
Référence initiale : `main`, `6d60c85ffe8d93d361f3690b116923542150bc11`.
Le HTML public a été comparé à ce HEAD : identique (SHA-256
`4cac395366e508a094856d3d297473930b5b8ef7fb38dc76da5e44d0519ed10b`).
Baseline `pilot-2026-10-25` inchangée, commit applicatif
`7cd51b852a308cd44e87fd448e7821e0e5d24e3e`.

Source prioritaire lue intégralement :
`byluuma/GPT-Image-VOTIMODES-002-VOTI_REGLES_V2.md`, version 2.0,
SHA-256 `2014542eb3b3e50601a96a3808e194521a8fb2d5f6d4d923d4192dd871c76faf`.
La section 12 (duplication) est exclue du lot. Les anciens rapports déjà modifiés,
les archives et les fichiers personnels de transfert restent hors périmètre.

## Diagnostic ciblé du HEAD

| Chemin | Modules réels |
| --- | --- |
| Création Express / Guidée / Avancé | `web/space-poll-editor.js`, `space-poll-form.js`, `space-ux.js` |
| Brouillon, publication, audience figée | `relay/cloudflare/spaces-service.js` : prepare, publishSpacePoll |
| Édition avant premier vote | updateSpacePoll, `web/space-poll-management.js` |
| Verrouillage | semanticHash, trigger definition_locked et contrôle locked |
| Carte et session temporaire | `web/spaces-ui.js`, `shared/spaces.js` |
| Atomicité et unicité | SpacesService.vote, db.batch, mutation_guards, controlled_vote_guards, poll_member_eligibility |
| Résultats et autorisations | CloudflareRelay.projection, eligible, groupResultsAvailable |
| QR par réponse / QR général | `web/sharing.js`, `web/print-layout.js`, `shared/qr-links.js` |
| Worker et D1 | `relay/cloudflare/worker.js`, service.js, spaces-service.js, migrations |
| Tests historiques | poll-engine, participation, spaces, space-ux et scripts navigateur/Worker locaux |

Le Single stocke une choice_id par bulletin. Le lien de participation identifié
est optionnel ; il n’est pas créé dans un sondage anonyme. Le compteur consumed
et le bulletin sont écrits dans le même batch transactionnel.

## Contrat additif

- Single : `mode: single_choice`, ou absence historique de mode. Aucun voteConfig.
  Aucune réécriture des anciens sondages/bulletins, aucun recalcul des résultats.
- Multiple : `mode: multiple_choice`, `voteConfig: {version:1,limit:N,rule:up_to|exact}`.
- Classé : `mode: ranked_choice`, `voteConfig: {version:1,limit:K,rule:up_to|exact|all}`.
  Toute la liste enregistre K égal au nombre de propositions.
- La validation générique refuse les nouveaux modes hors schéma Espace/contextuel.
  Le moteur du Mode libre, ses bulletins et ses calculs restent inchangés.
- `castMemberVote` conserve son payload historique et refuse un sondage nouveau mode.
- `castMemberBallot` transmet pollId/actionId/selectionIds/comment/expectedDefinitionHash.
  Aucun mode, N, K ou score du navigateur n’est accepté dans le payload.
- L’ensemble Multiple est trié avant digest/persistance : l’ordre des clics n’a aucun
  sens. La liste Ranked conserve son ordre. Vide, doublons, étrangers et quantités
  incompatibles sont rejetés. Le digest couvre le bulletin complet normalisé.

## Migration 0006

`0006_vote_modes.sql` ajoute la colonne nullable selection_json à ballots et des
gardes de validation/immutabilité. Les anciennes colonnes restent en place.
choice_id sert d’ancrage technique compatible aux contraintes/commentaires existants ;
les nouveaux agrégats utilisent exclusivement selection_json. Cet ancrage ne doit
jamais être interprété comme le bulletin complet d’un nouveau mode.
La migration ne réécrit ni les anciennes définitions ni les bulletins historiques.
Son application unique est suivie par le registre de migrations Wrangler existant.
Le test de migration compare les données avant/après et rejoue l’ancien INSERT.

La transaction d’unicité est conservée : une consommation et un bulletin complet
par batch, retour arrière complet si une garde échoue. Aucun identifiant membre
n’est ajouté au bulletin anonyme. Les protections actionId, révision, snapshot,
révocation/remplacement de Carte et idempotence restent en vigueur.

## Agrégats et confidentialité

Single conserve la projection historique. Les deux nouveaux modes sont agrégés
côté serveur, à partir du même instantané SQL que les règles et les compteurs.
Les tableaux de bulletins lus côté serveur ne figurent jamais dans les réponses.
Multiple : nombre de participants par option, pourcentage / nombre de bulletins.
Ranked : K-r+1, classement par points, rang partagé et Égalité sans départage caché.
Les quatre règles de disponibilité, le minimum sur les participants et les droits
existants sont appliqués avant toute projection de résultat.

Pour les nouveaux modes anonymes, les commentaires publics et de gestion utilisent
choiceId:null et un marqueur mode explicite : ils ne révèlent pas indirectement
la première sélection ou préférence d’un bulletin. Les participations anonymes
ne contiennent aucune selectionIds ni identité. En mode identifié uniquement,
les vues de gestion autorisées peuvent restituer selectionIds au complet.

## Frontend et compatibilité de publication

Le choix de mode est intégré à l’étape des réponses commune aux trois parcours.
Express conserve ses défauts et le nouveau mode ; son récapitulatif est visible
avant la création du brouillon. Le passage entre parcours conserve les réglages.
Une quantité devenue impossible bloque la sauvegarde, sans réduction silencieuse.
L’édition est verrouillée comme les autres éléments sémantiques au premier vote.

`getVoteModes({spaceId})` exige un accès de gestion et vérifie la présence de la
colonne migrée ; version 1 est retournée sans identité ni roster. L’interface
ne déverrouille les deux modes expérimentaux qu’après cette réponse. Un ancien
Worker laisse Single disponible, sans exposer les nouvelles options.

Le Single garde ses boutons, sa confirmation et ses QR individuels. Les anciens
liens de choix d’un sondage devenu Multiple/Ranked reviennent explicitement au
bulletin général, sans présélection ni enregistrement. Les QR individuels sont
indisponibles dans le partage et les plans d’affiche des deux nouveaux modes.

Les nouveaux bulletins restent locaux en mémoire jusqu’à la confirmation serveur.
Le classement annonce le premier rang avant le premier clic. Retour, reset et
récapitulatif permettent de corriger ; aucune soumission avant Oui, je confirme.
En cas de confirmation incertaine, le bulletin expérimental reste gelé et la
reprise utilise la même action et le même contenu. Le succès et l’effacement
de l’identité n’arrivent qu’après réponse serveur positive.

## Limite expérimentale explicite

Le PDF historique de résultats n’interprète pas les classements en points.
Son export est donc indisponible pour les deux nouveaux modes, avec explication
visible. Leurs résultats complets restent consultables à l’écran. Les PDF Single,
les Cartes, les guides pilotes, les assets, la mascotte et la PWA ne sont pas modifiés.

## Validation disponible

- Tests calcul/contrats/migration ciblés : 15 tests PASS, dont mode absent,
  mode nul refusé, ancien INSERT, données historiques préservées, quotas, scores et égalités.
- Worker/D1 local : 219 contrôles PASS, dont 89 spécifiques aux nouveaux modes.
- Suite gestion Espace : 2965 contrôles PASS, dont 12 refreshs stables.
- Navigateur nouveaux modes : quatre largeurs, onze captures privées ; contrôle
  du rang avant sélection, reset, récapitulatif, confirmation et identité : PASS
  sur la revue finale, avec reprise réseau incertaine, ancien QR incompatible,
  bornes Exactement/Toute la liste et mode Express conservé.
- Aucun test historique supprimé. Les assertions Express sont adaptées uniquement
  pour vérifier la nouvelle présence du récapitulatif, sans retirer les autres contrôles.

## Ordre de publication

1. Vérifier qu’aucune migration inattendue n’est en attente sur voti-production.
2. Appliquer 0006 avec la procédure Wrangler du dépôt, sans mutation de données métier.
3. Publier le Worker voti-relay compatible puis vérifier le contrat agrégé/capacité.
4. Construire le frontend de production et publier le commit Git sur main.
5. Vérifier Pages et le build réellement servi. Aucun déplacement du tag pilote.

D1 batch : [documentation officielle](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).
Les compétences workers-best-practices et wrangler ont été utilisées pour la
validation de la transaction et la préparation de publication.

## Contrôles finaux et références de release

- `npm test` : PASS sur la suite complète ; les derniers cas de garde ont aussi
  été rejoués dans `npm run test:vote-modes` (15 tests).
- `npm run test:vote-modes` : PASS, 219 contrôles HTTP/Worker/D1 locaux,
  dont 89 dédiés aux nouveaux modes et à leur confidentialité.
- `npm run test:vote-modes-ui` : PASS, quatre largeurs (390/768/1200/1440),
  onze captures inspectées dans `.browser-tests/vote-modes/`, profil isolé.
- `npm run test:spaces` : PASS, 196 contrôles backend historiques et 368 Chromium
  (Carte, scan, participation, identité, suppression et PDF de cartes).
- `npm run test:space-ui` : PASS, 2965 contrôles, dont douze refreshs stables.
- `npm run test:browser` : PASS, 2966 contrôles historiques libres, QR/PDF,
  commentaires, dialogues, images, thèmes, clavier, responsive et ouverture locale.
- `npm run check` : PASS, 166 fichiers JavaScript.
- `npm run build:production` et `git diff --check` : PASS.

La revue visuelle a fait supprimer une barre de commandes flottante qui recouvrait
les choix classés sur mobile. Le nouveau contrôle et ses captures ont été rejoués
après correction. Les échecs initiaux des sondes/fixtures n’ont pas été comptés PASS.

Build frontend : 1 746 259 octets ; SHA-256
`fde25e67ee0477824587c2fe37bd802a7a7e2451d53b8b4aa8e2462934044faa`.

Migration distante : seule `0006_vote_modes.sql` était en attente ; appliquée avec
succès à `voti-production`. Aucun ancien bulletin n’est réécrit.
Worker `voti-relay` : version `cbadbbd6-3e4b-4026-8dd6-6a0e7e7cee57`,
URL `https://voti-relay.voti-luuma8888.workers.dev`.
Smokes de production avant frontend : getVoteModes autorisé/version 1, refus d’un
credential fictif invalide (403), getAudienceSize existant agrégé : PASS.
Aucune mutation métier réalisée pour ces smokes ; aucun roster demandé ni secret affiché.
Une première sonde HTTP sans User-Agent explicite a reçu une réponse non JSON ;
les sondes avec User-Agent explicite ont confirmé le contrat publié sans correction applicative.

La publication frontend utilise le push normal sur main et GitHub Pages ; la preuve
finale de publication est la comparaison du HTML public au SHA-256 ci-dessus.
Après création de sondages expérimentaux, conserver un Worker compatible avec les
nouveaux modes : ne pas revenir à une ancienne interprétation des agrégats.
Les sondages expérimentaux restent signalés Expérimental ; le Single reste stable.

LOT B non implémenté. Mode libre, guides pilotes et tag de baseline non modifiés.
