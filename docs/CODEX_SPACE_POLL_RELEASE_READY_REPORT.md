# Sondages Espace — préparation à la publication

Date : 25 octobre 2026. Passe de finalisation uniquement, sans push ni déploiement.

## État final et périmètre Git

HEAD de départ : `ade085dbd7f6cb7db2760db10a4866ec3bc35ee9`, branche `main`.
Le commit local de cette passe doit avoir ce HEAD comme parent, sans réécriture.

### A. Lot Sondages et documentation — manifeste explicite

23 chemins autorisés au commit : 21 fichiers de l’implémentation, le rapport
humain associé inchangé et ce rapport de finalisation. Le rapport humain était
non suivi ; l’inclure sans le réécrire évite une référence documentaire manquante
au sein du commit. Le build `index.html` est inclus comme le prévoit le dépôt.

- `docs/CODEX_SPACE_POLL_HUMAN_RECIPE_REPORT.md`
- `docs/CODEX_SPACE_POLL_RELEASE_READY_REPORT.md`
- `docs/CODEX_SPACE_POLL_UX_IMPLEMENTATION_REPORT.md`
- `docs/RELAY_CONTRACT_V0.md`
- `docs/SPACES_GROUPS_V0.md`
- `docs/UX_FLOWS_V0.md`
- `index.html`
- `relay/cloudflare/spaces-service.js`
- `scripts/browser-space-layout.mjs`
- `scripts/browser-spaces-ux.mjs`
- `scripts/browser-spaces.mjs`
- `scripts/browser-test.mjs`
- `scripts/spaces-checks.mjs`
- `shared/space-wire.js`
- `tests/space-ux.test.js`
- `tests/spaces.test.js`
- `web/space-poll-editor.js`
- `web/space-poll-form.js`
- `web/space-poll-management.js`
- `web/space-poll-minimum.js`
- `web/space-ux.js`
- `web/spaces-ui.js`
- `web/styles.css`

### B. Modifications antérieures exclues et préservées

Les neuf rapports suivants étaient modifiés avant le lot ; leurs octets ne sont
pas changés par la finalisation et aucun n’est stagé :

- `docs/CODEX_CARD_UX_POLISH_REPORT.md`
- `docs/CODEX_POSTER_V0_4B_REPORT.md`
- `docs/CODEX_PRODUCTION_DEPLOYMENT_V0_6_REPORT.md`
- `docs/CODEX_QR_V0_4A_REPORT.md`
- `docs/CODEX_SPACES_GROUPS_V0_6_REPORT.md`
- `docs/CODEX_UX_V0_3E_REPORT.md`
- `docs/CODEX_V0_6_1_UX_REPORT.md`
- `docs/CODEX_V0_6_2_SPACE_UI_REPORT.md`
- `docs/CODEX_V0_6_2_VISUAL_IDENTITIES_REPORT.md`

Les cinq captures personnelles `Screenshot … .png`, les archives de transfert/
revue `VOTI_GROUPS_HD_V2_CODEX.zip`, `VOTI_V0_6_2_VISUAL_REVIEW.zip`, `browser-test.zip`,
`docs/Rapports codex.zip` et le document non suivi `docs/VOTI_UX_V0_3E_SPEC.md`
restent hors commit. Le rapport humain est la seule exception liée à ce lot,
explicitée plus haut ; son SHA-256 reste celui de la phase de recette.

### C. Générés et ignorés

Les captures, profils, journaux et bases de test sous `.browser-tests/` et
`.relay-local/` sont ignorés et exclus. Aucune archive, carte, PDF, credential,
base ou sauvegarde de données n’est inclus. Les fichiers WebP et le branding
ne changent pas. `index.html` est le seul artefact généré du manifeste Git.

## Revue finale et corrections

Revue ciblée du diff de l’application, des deux modules ajoutés, du contrat,
du service Worker, des scénarios/tests et de la documentation, ainsi que du
catalogue intégré au build. Aucun défaut bloquant ni changement de règle métier
relevé. Les sections des zones déjà validées ne sont pas refondues.

Correction de finalisation : retrait de l’import `SPACE_RELEASE_LABELS` devenu
inutile dans `web/spaces-ui.js` après extraction de la gestion du sondage.
Aucun comportement fonctionnel n’est modifié par ce nettoyage.

Ajout d’une assertion navigateur sur l’absence de `getAudienceSize` : un Worker
simulé renvoie HTTP 404/NOT_FOUND ; le formulaire reste ouvert avec une erreur
visible et aucun brouillon n’est créé. Une fois le contrat rétabli, le parcours
continue normalement. Aucun test supprimé ni délai relâché.

## Contrat getAudienceSize et minimum recommandé

La réponse est strictement `{ kind: 'audienceSize', eligible: N }`, N entier borné
0–200 ; aucun nom, liste, credential ou bulletin. Authentification staff, Espace,
groupes actifs et `creatorAllowsAudience` sont vérifiés. Les Cartes participant et
les scopes interdits sont refusés. SQL paramétré COUNT de membres actifs avec
EXISTS pour l’union des groupes : un membre n’est compté qu’une fois.
Aucune écriture ni migration ; les anciennes projections/commandes restent intactes.

Le nouveau frontend dépend du Worker compatible pour la création. Il ne remplace
pas silencieusement un comptage indisponible par une valeur supposée et ne crée
pas le brouillon en cas d’échec. Il n’y a pas de détection automatique de version :
**le frontend ne doit pas être publié avant le Worker compatible**. L’ajout serveur
est compatible avec les anciens clients ; le nouveau frontend fonctionne avec
lui dès sa publication.

`max(2, ceil(0.25 × N))` est une recommandation d’interface. Les validations métier
existantes, dont le champ manuel, restent inchangées. Jamais de réduction automatique
à 1. Tant que la valeur reste automatique, l’audience la recalcule ; une saisie
manuelle la conserve. « Utiliser la recommandation » réactive volontairement le
calcul. Après reload d’un brouillon, son minimum enregistré fait autorité ; la
provenance n’est pas stockée en D1. Aucun recalcul rétroactif après publication,
aucun changement du snapshot, des permissions, des règles de résultats, de
l’anonymat ou du contrôle à la fermeture.

## Visuel existant inspecté

Six PNG réels de fixtures locales, dans `.browser-tests/poll-ux/` :
management/editing/express à 1440 et 390 px. Suivi X/Y avant fermeture, état et
motif Résultats groupés, boutons espacés, édition identifiable et repliée par
défaut, barre sticky utilisable sans chevauchement observé. Express conserve les
seuls champs essentiels. Aucun débordement horizontal ni défaut graphique bloquant
relevé. Le libellé long d’un select natif peut être tronqué dans son état fermé
sur mobile ; son choix et le résumé restent consultables. Aucun nouveau chantier
esthétique ni nouvelle recette humaine demandée.

## Contrôles exécutés

| Contrôle | Résultat final |
|---|---|
| npm test | PASS — 424 tests |
| npm run check | PASS — 151 fichiers JavaScript |
| npm run test:space-ui | PASS — 2953 contrôles Chromium + 2 pilote local |
| npm run build:production | PASS — 1 883 818 octets |
| git diff --check | PASS |

SHA-256 du HTML final : `43898781320d1aaec819497708a50adaffb37fdd06a33b3120265611beae1941`.
Différence de taille depuis l’implémentation : -28 octets, due uniquement
au retrait de l’import inutilisé. Les sorties de cette passe sont dans
`.browser-tests/poll-ux/release-*.log`, résultats `release-results.json`.
Les autres suites lourdes déjà PASS n’ont pas été répétées. Aucune nouvelle
recette humaine ; aucun test, attente métier ou délai supprimé/relâché.

Manifeste staged vérifié à **23/23**, avec `git diff --cached --check` PASS et
scan des textes et des 72 modules du HTML PASS. Aucun fichier interdit stagé. Le
même manifeste sera vérifié sur le commit local. L’identifiant propre du commit est
relevé après sa création, sans second commit documentaire ni amend.
Les empreintes des neuf rapports historiques exclus et du rapport humain restent
identiques ; index vide avant staging. Les 72 modules compilés et les fichiers
du manifeste ne contiennent aucun secret reconnu ; configuration publique
identique au fichier de production existant, médias distants désactivés.

## Ordre de publication et risques résiduels

1. Déployer le Worker du commit local final, compatible `getAudienceSize`, avec
   la configuration production existante. Vérifier sa commande agrégée et les
   anciennes routes avant de publier le frontend. Aucune migration D1 nécessaire.
2. Après validation du backend, pousser normalement le commit frontend sur main
   et laisser le mécanisme GitHub Pages existant publier. Vérifier réellement le
   HTML servi et son empreinte ; le seul push ne prouve pas la publication.

Aucune de ces deux étapes n’est exécutée par cette passe. Aucun rollback vers un
Worker antérieur aux gardes des Espaces ; un éventuel repli doit rester compatible.
Les ressources, bindings, secrets, forfait et données production ne sont pas
consultés ou modifiés ici. Les deux sondages de recette humaine restent conservés.

Risques résiduels : ordre Worker → frontend obligatoire ; provenance du minimum
non persistée, avec conservation prudente à la réouverture ; vérification de
publication et de compatibilité production à faire pendant une mission autorisée
séparée. Aucun défaut bloquant identifié à ce stade de la revue locale.
