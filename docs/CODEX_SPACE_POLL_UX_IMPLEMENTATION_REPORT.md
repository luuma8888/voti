# Sondages Espace — implémentation après les recettes humaines

Date : 25 octobre 2026. Lot strictement local, sans commit/push/déploiement.
HEAD initial : `ade085dbd7f6cb7db2760db10a4866ec3bc35ee9`, branche main.

## Autorité et état initial

`CODEX_SPACE_POLL_HUMAN_RECIPE_REPORT.md` a été lu intégralement avant modification.
Il reste intact comme historique des deux recettes Guidée et Express validées.
Les neuf rapports historiques déjà modifiés, captures/archives personnelles et
sources de transfert ne font pas partie du lot et restent préservés.

Fichiers réellement inspectés : création/formulaire/moteur de présentation,
gestion et participant Espaces, état d’édition existant, styles et tests associés.
Pas de nouvel audit général ; aucune intervention dans les zones graphiques ou
la gestion Membres/Groupes/Cartes/PDF déjà validées.

## Architecture retenue

La gestion garde une racine et son titre montés : état et X/Y en haut, actions
administratives, état de Résultats et action associée, diffusion, résumé, édition
repliable puis apparence/suppression secondaires. Le formulaire distingue
L’essentiel et Participation et résultats. Les commentaires et les listes
identifiées existants conservent leurs API et contrôles.

La gestion du sondage est extraite dans `web/space-poll-management.js`, afin de
ne pas agrandir le contrôleur Espaces. Elle réutilise `editActions` sans modifier
ce composant ni les fiches Membres/Groupes. Annuler, garde de navigation, sticky,
progression et erreur restent communs ; la confirmation visible et le nouveau
résumé sont mis à jour sans réinitialiser la page. Les champs sont désactivés
pendant l’envoi pour éviter une perte de saisie tardive.

## Minimum recommandé

`web/space-poll-minimum.js` porte le calcul et l’état de recommandation :
`max(2, ceil(0.25 × N))`. L’Admin peut compter son roster déjà autorisé ; avant
création, une lecture agrégée fraîche vérifie N. Le Créateur utilise cette lecture
sans obtenir les noms. Une union de groupes dédoublonne les membres actifs.

Tant que la valeur n’est pas personnalisée, une nouvelle audience recalcule.
L’origine est mémorisée pour le brouillon créé dans cette visite. Une saisie
manuelle la conserve, même entre Guidée/Express/Avancé. L’action Utiliser la
recommandation réactive le calcul volontairement. Après reload, un minimum déjà
enregistré est conservé par précaution : aucune métadonnée de provenance en D1
n’a été ajoutée. Une reprise automatique exige alors cette action explicite.
Aucun contrôle automatique n’est installé dans l’édition d’un sondage publié ;
les valeurs existantes et les snapshots ne sont jamais recalculés rétroactivement.

N=0 ou 1 conserve 2 et affiche que cette audience ne peut atteindre le minimum
recommandé, même à la fermeture. Un minimum personnalisé supérieur à N est aussi
expliqué. Les validations serveur existantes restent inchangées.

## Addition serveur strictement nécessaire

Les Créateurs n’ont pas de roster dans getSpace. Une approximation ou une somme
des tailles de groupes aurait été fausse pour les multi-appartenances. Ajout de
la lecture `getAudienceSize` dans le contrat Espace et SpacesService : seule
réponse `{ kind: 'audienceSize', eligible }`, aucune identité. Les contrôles staff,
creatorAllowsAudience et groupes existants s’appliquent ; scope interdit et Carte
participant refusés. Requête SQL paramétrée COUNT + EXISTS, sans mutation ni
migration. Les projections historiques restent identiques.

Skill appliqué : [workers-best-practices](/home/luuma/.codex/skills/workers-best-practices/SKILL.md).
API D1 vérifiée dans la [documentation officielle des requêtes préparées](https://developers.cloudflare.com/d1/worker-api/prepared-statements/).
Aucun binding, rate-limiter, secret, forfait, configuration ou observabilité modifié.
**Future publication : Worker compatible avant frontend ; aucun déploiement ici.**

## Couverture UX-01 à UX-09

| Sujet | Réalisation locale |
|---|---|
| UX-01 | Groupes d’actions communs, gap cohérent et séparation des pieds de formulaire, y compris participant |
| UX-02 | Action Résultats dans le même bloc que son état et son motif ; accès explicatif maintenu si bloqué |
| UX-03 | Compteur X/Y avant Fermer le sondage |
| UX-04 | Modifier le sondage replié par défaut |
| UX-05 | Textes dynamiques distincts selon seuil/tous/fermeture/tous ou fermeture/admins_only |
| UX-06 | Note Express annonçant les réglages ajustables avant publication |
| UX-07 | Résumé séparé de l’édition |
| UX-08 | L’essentiel puis Participation et résultats, avec titres/structure et traitement visuel distinct |
| UX-09 | Dirty, Annuler, barre sticky, progression, erreur avec saisies conservées, confirmation locale et navigation protégée |

Les états disponible/indisponible restent exclusivement décidés par le relais.
Le bouton indisponible n’est pas désactivé : il devient Comprendre la disponibilité,
avec son motif déjà lisible. Les noms et compteurs de gestion ne sont jamais
introduits dans une projection participante.

Les captures réelles `management-1440.png`, `management-390.png`, `editing-1440.png`,
`editing-390.png`, `express-1440.png`, `express-390.png` sont sous
`.browser-tests/poll-ux/`, ignorées par Git. Inspection réalisée : suivi visible
avant fermeture, action Résultats contextualisée, édition distincte et repliable,
barre de sauvegarde sticky visible dans les deux formats. Express garde ses trois
sections essentielles et sa note d’ajustement. Aucun débordement horizontal
observé. Ces constats techniques ne constituent pas une nouvelle validation humaine.

## Tests ajoutés et adaptés

- `tests/space-ux.test.js` : calcul sur 0/1/3/8/9/12/20/21/100, union dédoublonnée,
  suivi automatique, personnalisation, reprise explicite, minimum enregistré
  conservé, messages distincts et aucun compteur administratif côté participant.
- `tests/spaces.test.js` : contrat getAudienceSize, bornes et rejet des champs de roster.
- `scripts/spaces-checks.mjs` : vrai D1 local, union de groupes sans doublon,
  audience vide, lecture Créateur autorisée, scopes interdits/Carte refusés et
  absence de mutation de révision.
- `scripts/browser-spaces-ux.mjs` : parcours réel avec 12 membres fictifs répartis
  dans des groupes dont les appartenances se recoupent ; Express avec recalcul,
  personnalisation et changement de présentation, N=0/N=1, édition repliée,
  enregistrement en cours/erreur/réessai, valeurs préservées, Annuler et garde de
  navigation, même racine et même titre après sauvegarde, confirmation près du
  formulaire et aucun recalcul après publication malgré de nouveaux membres.
- `scripts/browser-test.mjs` : appels des contrôles précédents à 1440 et 390 px,
  six captures et barre sticky effectivement dans le viewport. Nettoyage des seuls
  accès des fixtures ajoutées pour ne pas perturber les scénarios historiques.
- `scripts/browser-space-layout.mjs`, `browser-spaces.mjs`, `browser-spaces-ux.mjs` :
  ouverture explicite des détails d’édition, nouvelles attentes du minimum et de
  la zone Résultats. Aucun scénario ni assertion fonctionnelle supprimé.

## Résultats finaux des vérifications

Node verrouillé du dépôt : v22.23.3. Tout le relais et D1 des essais sont locaux,
avec fixtures fictives uniquement. Les sorties et `results.json` sont ignorés sous
`.browser-tests/poll-ux/`.

| Commande | Résultat |
|---|---|
| npm test | PASS — 424 tests |
| npm run check | PASS — 151 fichiers JS |
| npm run test:space-ui | PASS — 2947 contrôles Chromium + 2 pilote ; responsive 360/390/1200/1440/1920 |
| npm run test:spaces | PASS — 368 Chromium + 196 pilote/API/D1 |
| npm run test:spaces-ux | PASS — 368 Chromium + 2 pilote |
| npm run test:participation | PASS — 294 contrôles Chromium |
| npm run test:browser | PASS — 2966 contrôles, dont Mode libre/offline |
| npm run test:free-pilot | PASS — 3138 Chromium + 67 pilote |
| npm run test:comments | PASS — 37 contrôles PDF, 7 QR décodés |
| npm run test:card-polish | PASS — 66 contrôles, 6 PDF, 10 QR à 300 dpi |
| npm run build:production | PASS — HTML production reconstruit, aucun déploiement |
| git diff --check | PASS |

Les tests unitaires ciblés space UX, spaces, participation, participation-relay et
poll-engine ont également terminé sans échec avant les suites complètes.
La génération des PDF Cartes de la suite UI historique est conservée et son
contrôle Poppler à 300 dpi a passé : 10/10 QR décodés, renderer inchangé.

### Incidents de vérification et diagnostic

- Le premier npm test dans le sandbox échoue au démarrage workerd de
  turnstile-runtime ; relance avec autorisation d’exécution locale : PASS.
  Ni régression métier ni modification de Turnstile.
- Des attentes des tests ont été adaptées au nouvel état Résultats présent dès le
  brouillon et à la fin réelle du rendu. L’erreur HTTP est simulée sur l’adaptateur
  qui capture fetch à sa construction, et non par remplacement tardif du fetch global.
- Les nouveaux Espaces fictifs rendaient prématurée une attente historique de Mes
  Espaces ; leurs seuls accès locaux de test sont maintenant retirés après leur
  usage. Aucun changement du code de cette zone.
- Un rendu groupé des PDF Cartes dans la suite UI a dépassé ponctuellement le délai
  RPC de 30 s. Une relance a passé la suite entière : aucun délai augmenté, aucun
  test retiré et aucun renderer Carte/PDF modifié.
- Aucun échec préexistant persistant n’a été confirmé. Toutes les commandes finales
  du tableau sont PASS.

## Build, confidentialité et périmètre

Build à l’issue de la phase d’implémentation, avant finalisation :
**1 883 846 octets** ; SHA-256 :
`c8f43d22ae85d352678f5c6cf55b3f85704f7a194bc5207216f3c107c360730c`.
Variation depuis HEAD : **+21 988 octets** (modules de gestion/recommandation,
styles et catalogue de commande intégrés). Aucune nouvelle dépendance ni asset.

Audit du HTML et de ses 72 modules intégrés : configuration publique exactement
identique à `web/relay-production.json`, images distantes désactivées, aucun secret
reconnu. Les deux nouveaux modules n’utilisent aucun stockage persistant.
La petite Map de provenance du minimum vit dans le contrôleur de gestion de
l’onglet et ne contient que pollId → booléen, jamais d’identité ou de credential.
Aucun nouveau cookie, CDN, média distant, upload, tracking ou log de credential.

Les règles des quatre modes de résultats, le moteur de vote, le snapshot,
les autorisations, les identités et la séparation anonyme sont inchangés. La seule
addition serveur est la lecture agrégée décrite plus haut. Aucun schéma/migration,
aucune configuration Cloudflare, aucun binding, aucune dépendance ni secret changé.
Les assets et les renderers Carte/PDF sont byte-for-byte inchangés dans Git.

## Fichiers du lot

Application :

- `web/space-poll-management.js` (nouveau) ;
- `web/space-poll-minimum.js` (nouveau) ;
- `web/space-poll-editor.js`, `web/space-poll-form.js`, `web/space-ux.js` ;
- `web/spaces-ui.js`, `web/styles.css` ;
- `shared/space-wire.js`, `relay/cloudflare/spaces-service.js` ;
- `index.html` (build généré).

Tests :

- `tests/space-ux.test.js`, `tests/spaces.test.js` ;
- `scripts/spaces-checks.mjs`, `scripts/browser-test.mjs` ;
- `scripts/browser-space-layout.mjs`, `scripts/browser-spaces-ux.mjs`,
  `scripts/browser-spaces.mjs`.

Documentation :

- ce rapport ;
- `docs/UX_FLOWS_V0.md` ;
- `docs/SPACES_GROUPS_V0.md` ;
- `docs/RELAY_CONTRACT_V0.md`.

Le rapport humain de référence et les neuf rapports historiques pré-modifiés
ont été contrôlés par empreintes et restent intacts. Leurs modifications
préexistantes, ainsi que les captures et archives personnelles, sont préservées.

## Vérification visuelle humaine conseillée et limites

Pas de nouvelle recette complète. Trois points suffisent, sur les captures locales
ou ultérieurement sur la version locale avec fixtures :

1. Gestion : état/X-Y/Résultats immédiatement lisibles, motif relié à l’action,
   édition fermée par défaut.
2. Édition : distinction Essentiel/Affinage, barre Enregistrer et confirmation
   facilement repérables sur ordinateur et téléphone.
3. Express : formulaire court, note d’ajustement et minimum recommandé compréhensible.

Les deux scénarios humains précédents restent acquis ; la présentation nouvelle
n’est pas déclarée validée humainement. La provenance du minimum n’est pas stockée
à distance : après reload d’un brouillon, sa valeur est volontairement conservée
jusqu’à une reprise explicite de la recommandation. Avant publication, le nombre
est une lecture de l’audience courante ; le snapshot réel reste celui fixé par
le serveur à la publication, sans changement de sa logique.

Aucun accès aux données de production dans ce lot. Les deux sondages humains
ne sont ni relus, ni modifiés, ni supprimés. Aucun staging, commit, push,
déploiement ni migration distante. Une future publication devra déployer le Worker
compatible getAudienceSize avant le frontend, sans migration.


## Finalisation pour intégration Git

Une passe ultérieure retire uniquement un import inutilisé et ajoute le contrôle
navigateur d’un Worker ne proposant pas encore getAudienceSize. Les empreintes
et résultats ci-dessus décrivent la phase d’implémentation ; le build final,
le manifeste du commit et les contrôles de livraison sont consignés dans
[CODEX_SPACE_POLL_RELEASE_READY_REPORT.md](CODEX_SPACE_POLL_RELEASE_READY_REPORT.md).
Le rapport de recette humaine reste inchangé. Aucun push ou déploiement dans
cette finalisation.
