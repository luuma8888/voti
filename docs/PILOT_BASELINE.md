# Voti — Baseline pilote stable

## Identification

- Jalon : **première version pilote stable de Voti**.
- Date du gel : **25 octobre 2026**, après validation visuelle par Lu’uma.
- Commit applicatif : `7cd51b852a308cd44e87fd448e7821e0e5d24e3e`.
- Tag Git annoté : **`pilot-2026-10-25`**, sur ce commit applicatif.
- Branche publiée : `main` ; dépôt : <https://github.com/luuma8888/voti>.
- Frontend : <https://luuma8888.github.io/voti/>, commit ci-dessus ; déploiement
  GitHub Pages `7315422673`, succès le `2026-10-25T15:50:14Z`.
- HTML publié : **1 883 818 octets** ; SHA-256 :
  `43898781320d1aaec819497708a50adaffb37fdd06a33b3120265611beae1941`.
- Worker : `voti-relay`, <https://voti-relay.voti-luuma8888.workers.dev> ;
  version `a76e0c99-b577-4785-a477-c8471f4b89c6` à 100 % ; déploiement
  `16296ca0-f8f7-4c16-b331-08d4c311ac22` créé le `2026-10-25T15:36:24.71056Z`.
- D1 : `voti-production`, migrations `0001` à `0005` déjà appliquées ;
  aucune migration pour la dernière release Sondages. Cloudflare Free, aucun R2.

Aucun tag préexistant ne définissait une convention de release. La version
technique `0.0.1` de `package.json` n’est pas utilisée comme nom de ce jalon.
Ce manifeste est ajouté dans un commit documentaire **postérieur** : le tag
conserve exactement le code, les assets et le build réellement validés et publiés.
Une publication automatique du commit documentaire ne change pas ces octets.

## Statut

Version pilote stable, utilisable pour les premiers pilotes terrain en structure
jeunesse. Elle n’est pas présentée comme une version institutionnelle finale.
**Aucun défaut bloquant connu au moment du gel.** Le gel n’atteste pas une recette
humaine exhaustive de toutes les combinaisons de réglages et d’appareils.

## Périmètre stabilisé

- Espaces, Membres, Groupes, identités visuelles prédéfinies et vues Liste/Vignettes.
- Cartes Voti, QR, création/remplacement par lots, lot temporaire de session,
  PDF, thèmes, fonds illustrés et mosaïques de groupes HD.
- Sondages Espace : création Guidée et Express, brouillon modifiable, publication,
  participation, résultats, fermeture et administration.
- UX Sondages revue : état et suivi des participations en haut, disponibilité des
  résultats contextualisée, résumé distinct, édition repliée, sauvegarde explicite.
- Minimum recommandé proportionnel actif dans les parcours de création Espace.

## Validation disponible

Deux configurations précises ont été validées humainement :

- Guidée : vote anonyme simple pour trois membres, attente à deux participations,
  fermeture puis résultats anonymes, consultation par le non-votant et sortie
  sans identité participante résiduelle.
- Express : brouillon, ajustement avant publication et résultats pendant l’ouverture.

Les observations et leurs limites restent dans le
[rapport de recette humaine](CODEX_SPACE_POLL_HUMAN_RECIPE_REPORT.md).
UX-01 à UX-09 et le minimum proportionnel sont décrits dans le
[rapport d’implémentation](CODEX_SPACE_POLL_UX_IMPLEMENTATION_REPORT.md), sans
réécriture des constats historiques.

Les derniers contrôles de livraison sont PASS : `npm test` (424 tests),
`npm run check` (151 fichiers JS), `test:space-ui` (2 953 contrôles Chromium
et 2 pilote), build production et `git diff --check`. Les suites Espaces,
participation, navigateur/Mode libre/offline, free-pilot, commentaires et
card-polish sont également documentées PASS dans les rapports d’implémentation et
de [préparation de release](CODEX_SPACE_POLL_RELEASE_READY_REPORT.md).

Après déploiement Worker puis frontend : quatre comptages authentifiés ont
confirmé une réponse strictement agrégée `{ kind, eligible }` ; accès sans
credential valide refusés. Les 69 vérifications navigateur à 1440 et 390 px
sont PASS : aucune exception JS, erreur réseau ou tentative d’écriture ;
contrôleur publié vérifié avec 5 éligibles et minimum recommandé 2.
La projection de l’Espace fictif est restée strictement identique avant/après.
Les anciens minimums des sondages n’ont pas changé. Les sondages de production
étant déjà verrouillés, aucune édition métier ni nouvelle création n’a été
effectuée lors de ce smoke test.

La vérification visuelle post-déploiement par Lu’uma n’a révélé aucune anomalie.
Cette opération de gel ne rejoue ni les recettes ni les suites lourdes.

## Règles importantes gelées

- Participation anonyme ou identifiée selon la configuration ; en mode anonyme,
  séparation structurelle entre membre/droit de vote et bulletin.
- Une participation par membre ; audience figée par snapshot à publication.
- Disponibilité selon `threshold`, `all_eligible`, `closed` ou
  `all_eligible_or_closed`, avec minimum de confidentialité et audience de
  résultats respectés, y compris à la fermeture ; `admins_only` reste distinct.
- Pour les sondages Espace, recommandation : **`max(2, ceil(0.25 × N))`**, où N
  compte les membres éligibles distincts de l’audience. Un membre de plusieurs
  groupes ciblés ne compte qu’une fois. Jamais de réduction automatique à 1.
- La recommandation est modifiable avant publication. Un changement d’audience
  recalcule uniquement une valeur encore automatique. Une valeur personnalisée
  est conservée ; « Utiliser la recommandation » réactive explicitement le calcul.
  À la réouverture d’un brouillon, la valeur enregistrée fait autorité.
- Aucun recalcul rétroactif des sondages publiés ou fermés, aucun contournement du
  minimum pour une audience trop petite. Le Mode libre garde ses propres défauts.
- Permissions Administrateur / Créateur / Participant séparées ; périmètre du
  Créateur limité respecté. Fond et règles verrouillés après le premier vote ;
  apparence encore modifiable.
- Credentials bruts des Cartes uniquement en mémoire temporaire pour l’export,
  jamais persistés en clair ; aucune persistance de session participante.
- Illustrations Membres/Groupes prédéfinies embarquées uniquement ; pas d’upload
  personnel, média distant, CDN ou stockage R2.

Les anciens rapports et consignes décrivant un minimum fixe historique de 5 ne
sont pas réécrits : pour la recommandation des sondages Espace de ce jalon, la
formule et les rapports de release ci-dessus font référence.

## Limites du jalon

- **Acceptées :** vote à choix unique ; fonctionnement des Espaces en ligne via
  le relais. Le lot de Cartes exportables disparaît au rechargement/à la fermeture
  de l’onglet ; cela ne révoque pas les Cartes serveur. Une audience d’un seul
  membre ne peut pas satisfaire le minimum recommandé de 2.
- **Moins éprouvées humainement dans ces deux recettes :** participation
  identifiée, commentaires/modération, résultats administrateur, règles
  `all_eligible` et `closed` seules, certaines variantes de périmètre Créateur et
  de snapshot. Elles bénéficient des tests techniques ; voir les limites du
  rapport humain, sans en déduire une validation humaine supplémentaire.
- **Non bloquant :** un libellé long de sélecteur natif peut être tronqué sur
  mobile dans l’état fermé ; choix et résumé restent accessibles.
- La diffusion terrain et ses supports restent à préparer ; ce jalon ne constitue
  ni une certification ni une sauvegarde des données de production.

## Récupération et dépendances

Depuis un clone propre, avec un working tree sans modifications à préserver :

```sh
git fetch origin --tags
git checkout --detach pilot-2026-10-25
```

Le tag restaure le frontend, son HTML de production, les sources Worker, les
migrations, les bibliothèques embarquées et les assets WebP versionnés. Les
540 variantes runtime (132 membres et 36 groupes) sont suivies ; les médias
et bibliothèques nécessaires ne dépendent pas d’un dossier de transfert local.
`package-lock.json` fixe les dépendances de construction/test ; respecter les
préconditions Node indiquées dans `package.json`. Le HTML validé ne nécessite
pas une reconstruction pour être récupéré. Aucun CDN runtime indispensable.

Le fonctionnement en ligne nécessite toujours GitHub Pages et le relais
Cloudflare/D1 configurés. Configurations publiques et migrations sont versionnées ;
les secrets et données ne le sont volontairement pas. **Un checkout ne restaure
ni D1, ni ses données, ni les secrets, ni un déploiement Cloudflare.** Conserver
leurs sauvegardes séparément, hors Git ; aucun secret n’est inclus ici.
Une restauration du service doit vérifier la compatibilité des données et publier
le Worker compatible `getAudienceSize` avant le frontend, sans rollback D1 aveugle.

Les rapports historiques modifiés localement, captures, archives, profils,
fichiers d’accès et `byluuma/` sont exclus du gel documentaire. Les versions déjà
commitées des rapports restent naturellement présentes dans l’historique du tag.

## Prochaine phase — transmission terrain

Préparer un kit permettant à une structure extérieure d’utiliser Voti facilement :

- guide administrateur/professionnel, démarrage rapide et procédures pas à pas ;
- captures réelles de l’application et schémas très simplifiés, sobres, peu chargés ;
- exemples d’usage en MECS, accueil de loisirs et autres structures jeunesse ;
- explication des rôles, données, conservation, suppression et récupération ;
- support minimal de dépannage.

Cette phase est enregistrée comme priorité suivante. Aucun de ces manuels n’est
créé par l’opération de gel.
