# Voti v0.5 — participation et commentaires

Statut : **v0.5 publiée et clôturée, audit et recette humaine validés par Lu’uma**.
Migration0003, Worker et Pages vérifiés ; trois réserves UX explicitement
reportées au prochain lot, aucun code changé pendant la recette.

## Périmètre et garde-fous

Autorité : `VOTI_PARTICIPATION_COMMENTS_V0_5_SPEC.md`.
Pendant le développement et les tests locaux : aucun commit, push, déploiement
Worker/Pages ou changement Cloudflare distant. La progression de production
ensuite explicitement autorisée est consignée en fin de rapport.
Les modifications documentaires et captures déjà présentes avant le lot sont conservées.

## Plan d'implémentation

1. Modèle partagé et migration locale explicite, préservant les empreintes v0.4C.
2. Soumission atomique vote/commentaire/Participation, contrats relais et nouvelle migration D1 additive.
3. Interface de saisie, administration/modération et projections publiques sans identité.
4. PDF Rapport opt-in ; Synthèse inchangée.
5. Tests Node, D1 réel local, navigateur, PDF/Poppler et régressions complètes.
6. Documentation finale puis archive d'audit v0.5, sans fichiers personnels/secrets.

## Choix techniques préparatoires

- Snapshot local version 3 ; sondages historiques version 2 conservés tels quels.
- Les champs absents des définitions historiques signifient anonymous / disabled / private,
  sans injection dans leur définition et sans recalcul de leur empreinte v2.
- Les nouveaux sondages version 3 déclarent les trois nouvelles règles sémantiques.
- `privacy: named` correspond à une participation **déclarée, non vérifiée**, sans compte.
- Noms/pseudonymes bornés à 60 points de code Unicode ; commentaires à 300 ; trim.
- Reçu SHA-256 par action, contextualisé par pollId + actionId, pour refuser un retry
  dont le contenu change et éviter de recréer un commentaire supprimé. Ce reçu ne
  constitue ni une identité stable, ni un mécanisme une-personne-un-vote.

## Architecture réalisée

### Modèle et compatibilité

`shared/participation.js` centralise règles historiques effectives, normalisation,
comptage Unicode, reçu de protocole, projections publique/admin et modération locale.
Le moteur reste indépendant du DOM/fetch/Cloudflare. Les modifications sont préparées
sur une copie ; Repository valide puis publie un snapshot local unique sous Web Lock.
PollDefinition v3 et snapshot v3 explicites, anciens Poll v2 conservés dans le snapshot.
L'import rejette données orphelines, identités anonymes, textes/versions incohérents,
et contenu présent ne correspondant pas au reçu de soumission.

La compatibilité v2 n'injecte aucun nouveau champ ni défaut dans la définition hashée.
Un ancien sondage devient v3 uniquement après changement explicite des nouveaux réglages
avant son premier vote. Le mécanisme historique v1→v2 reste celui du lot assets.
BackupVersion 1 conservée avec snapshot 3 explicite ; backup local sensible (noms et
commentaires locaux), aucune capacité admin ni bulletin distant ajouté.

### D1 et atomicité

Nouvelle migration uniquement : `relay/cloudflare/migrations/0003_participation_comments.sql`.
Tables participations/comments distinctes ; colonnes participation_id/submission_digest
additives sur ballots. Pas de date individuelle ou métadonnée réseau. Anciennes lignes
sans colonnes renseignées restent valides. Aucune réécriture de JSON ou hash historique.
FK/cascades, unicité de participation liée et triggers de cohérence/immutabilité renforcent
la validation de service. Migration 0001/0002 inchangée.

Batch de soumission :

1. Garde transactionnelle définition/hash/statut/choix et retry existant cohérent.
2. Marqueur de nouvelle action seulement si aucun bulletin pour pollId+actionId.
3. Participation uniquement identified et action nouvelle.
4. Bulletin : son trigger historique verrouille et change la révision du poll.
5. Commentaire uniquement non vide et action nouvelle.
6. Nettoyage des gardes dans la même transaction.

Les prélectures servent à normaliser/classifier, pas à garantir seules l'autorité :
le hash courant est revérifié dans le batch. L'échec de n'importe quel INSERT annule
tout, y compris verrouillage et révision. Retry concurrent : aucune Participation/
commentaire supplémentaire. Même action avec autre contenu = IDEMPOTENCY_CONFLICT.
Un commentaire supprimé ne réapparaît pas au retry grâce au reçu conservé avec le vote.
SHA-256 standard via Web Crypto, aucune cryptographie maison ou promesse d'anonymat réseau.

### Relais / modération / résultats

RelayAdapter, RelayClient, HttpRelayAdapter et simulation mémoire étendus : castVote
enrichi ; getComments ; getParticipations ; updateCommentStatus ; deleteComment.
Lectures paginées 25 entrées, curseur contextualisé par poll. Administration Bearer,
CAS poll + révision propre du commentaire. Texte non modifiable, routes strictes.
La modération ne modifie ni stats ni révision publique du sondage.
Le cache de connexion préserve le dernier état public connu lors d'une réponse admin
non sémantique, sans y conserver de nom/commentaire/Participation.

Sous seuil (ou closed non fermé), aucune présence/counter/commentaire public. Après
publication, seulement visible/public_with_results et jamais une identité. Les
commentaires privés restent dans la projection admin, disponible avant seuil.
Pas de liste de bulletins exposée. Vote enrichi = un POST votes et son quota existant,
aucun endpoint public indépendant de création de commentaire, aucun challenge au vote.

DeletePoll : suppression ballots d'abord (cascade comments), puis poll (cascade
participations et relations existantes). Cron/rétention/GC inchangés. Production,
CORS, configuration gratuite sans R2 et Turnstile non modifiés.

### Interface

Création en quatre étapes conservée ; les trois nouvelles règles apparaissent avec
les règles de résultats. Édition avant premier vote, refus UI/moteur/serveur ensuite.
Vote/QR direct : nom obligatoire seulement identified, commentaire facultatif,
compteur 300 caractères, notices visibles. Saisie mémoire non persistée chez le votant
distant. Après premier envoi, contenu figé pour retry ; succès seulement après reçu complet.
Succès durable, message complémentaire pour commentaire, approbation/publication expliquées.

Zone Commentaires / Participations & commentaires regroupée par choix, Actualiser,
actions selon état, suppression avec dialogue Voti accessible v0.3E. Annulation sans
mutation, double clic bloqué, CAS conflit rechargé/informé. Textes via textContent ;
pas de HTML/Markdown exécuté. Résultats publics regroupés sous choix, chargement de
pages suivantes sans noms. Styles responsive et cinq thèmes hérités, cibles 44 px.

### PDF

Synthèse inchangée. Rapport : commentaires publics approuvés en option OFF par défaut.
Identités seulement identifié + admin explicite, OFF par défaut et avertissement visible.
Relecture des projections au téléchargement, available obligatoire avant toute collecte.
Le moteur PDF reçoit des projections dédiées, pas de bulletins bruts ou capacité.
Textes bruts Canvas, pagination A4, rappel du choix en début de page de continuation,
QR résultats identiques. 500 entrées et 32 pages maximum, refus explicite au-delà.
Guide PDF utilisé pour rasterisation/inspection réelle avec Poppler et décodage QR.

## Tests ajoutés et vérifications

- `tests/participation.test.js` : défauts, anonymat, identified/Unicode/doublons,
  bornes/contrôles, espaces absents, idempotence de contenu et suppression, hash,
  verrouillage, CAS, seuil/closed/private, migration v0.4C sans réécriture.
- `tests/participation-relay.test.js` : deux clients mémoire, droits, modération,
  CAS, suppression et pagination publique/admin sans identité ni actionId.
- `tests/participation-pdf.test.js` : options OFF, admin explicitement requis,
  commentaires publics, seuil inviolable, plan sans objets privés.
- `scripts/participation-checks.mjs` : vrai Worker/D1 local, COUNT des trois tables,
  anonymous participation_id NULL/0 Participation, identified joins/Emma duplicable,
  retries concurrents, corruption de contenu, modération/CAS, ancienne définition,
  private/closed, suppression/cascades. Injections d'échec par triggers de fixture
  sur participations/ballots/comments : zéro orphelin et aucun verrouillage partiel.
- `scripts/browser-participation.mjs` : vrai app DOM 320/360/1200 et cinq thèmes,
  notices/limites, absence de vote avant confirmation, double clic, succès durable,
  admin/public/XSS, annulation/suppression dialog, options PDF OFF. Trois PDF détaillés.
- Extension navigateur HTTP : QR identified direct, refresh sans vote (COUNT D1),
  exactement un vote enrichi, lecture admin/modération, public sans identité.
- Contrôles audit : .env/.dev.vars même suivis refusés, screenshots/ZIP/PDF/clé exclus.

Les fixtures historiques images ont été mises à jour pour fabriquer un vrai v1
depuis un état v3 (suppression explicite des nouveaux champs/objets), pas pour
assouplir l'import. Le test assets navigateur attend le snapshot3 avec références
préservées. Le scénario participation précède celui des assets pour ne pas effacer
ses fixtures avant la vérification de persistance offline.
Le test quota edge utilise maintenant une rafale bornée : 125 GET séquentiels pouvaient
chevaucher une fenêtre et ne pas atteindre le 429. Quota serveur inchangé, vrai binding
toujours testé ; aucune suppression d'assertion anti-abus.

## Commandes / résultats exacts

Commandes exécutées avec Node 22 local, sans ressources distantes. Aucune commande
de production ni mutation Git distante. Les suites complètes ont été suivies du
durcissement ciblé des séquences UTF-16 invalides, revérifié dans Node, le vrai relais
local (deux refus supplémentaires) et Chromium participation/PDF. La dernière
correction locale de CAS utilise aussi un code structuré, jamais l'analyse d'un
message texte ; tests Node et check rejoués, builds refaits ensuite. Aucun changement
des parcours nominaux, du contrat historique ou de la mise en page après ces suites.

| Commande | Résultat final observé |
| --- | --- |
| npm test | Succès, 374 tests Node, aucun échec |
| npm run check | Succès, 93 fichiers JS syntaxiquement vérifiés |
| npm run build | Succès, HTML autonome 1 282 434 octets |
| npm run build:production | Succès, HTML pilote gratuit 1 282 682 octets, dernier build |
| npm run test:browser | 2 927 contrôles Chromium, file:// et /voti/ |
| npm run test:poster | 97 contrôles, 8 PDF A4, 30 QR décodés |
| npm run test:poster-studio | 188 contrôles, 13 PDF A4, 51 QR décodés |
| npm run test:poster-polish | 117 contrôles, 7 PDF A4, 36 QR décodés |
| npm run test:relay | 118 contrôles HTTP/Worker/D1/R2 locaux |
| npm run test:integration | 117 contrôles relais + 3 097 Chromium |
| npm run test:free-pilot | 65 contrôles HTTP/D1 sans R2 + 3 099 Chromium |
| npm run test:participation | 177 contrôles Chromium, 3 PDF détaillés générés |
| npm run test:comments | 37 contrôles Poppler 300 dpi, 3 PDF A4, 7 QR décodés |
| git diff --check | Succès, aucune erreur de whitespace |

Inspection visuelle réelle : premières pages et page de continuation identifiée
des PDF v0.5 rasterisés, lisibilité/association/QR sans chevauchement observé. Pas
de validation papier revendiquée. Pseudonyme fictif accentué/emoji/RTL également
vérifié dans le raster identifié final. Artefacts fictifs uniquement dans .browser-tests,
ignorés et exclus de l'audit.

Échecs intermédiaires résolus : assertions de version historique/module/routes/nom
de ZIP ; sélecteur checkbox qui supposait un label parent alors que l'UI utilise
htmlFor ; scénario de participation écrasant la fixture d'assets ; test de quota
GET séquentiel chevauchant la fenêtre edge. Aucun échec supprimé ou ignoré :
les assertions correspondantes ont été corrigées et les suites relancées.

À l'issue du développement local, build production sans R2 :
SHA-256 `9e550cb5a02eef911db452c65015319dab102b756f60669bb9624bf7e80a5734`.
À ce stade initial, aucune vérification de Pages v0.5 ni publication revendiquée.
Les opérations ensuite autorisées et réalisées figurent dans la section production.

## Fichiers du lot

Créés : shared/participation.js ; web/participation-ui.js ; nouvelle migration0003 ;
trois tests participation*.test.js ; scripts/participation-checks.mjs et
browser-participation.mjs ; docs/PARTICIPATION_V0.md, COMMENTS_AND_IDENTITY_V0.md,
CODEX_PARTICIPATION_V0_5_REPORT.md.

Modifiés : shared/model.js, migration.js, validation.js, poll-engine.js,
result-rules.js, relay.js, relay-client.js, relay-wire.js ; web/app.js,
http-relay.js, participation styles.css, poster-studio.js, print-layout.js ;
relay/cloudflare/service.js, worker.js, abuse.js ; tests/fixtures historiques assets,
poll-engine, HTTP/build, in-memory-relay, audit ; scripts/browser-test.mjs,
browser-assets.mjs, relay-integration.mjs, free-pilot-integration.mjs,
test-posters.mjs, audit-bundle.mjs ; package.json (scripts seuls), .gitignore ;
README et docs DATA_MODEL/UX_FLOWS/RELAY_CONTRACT/CLOUDFLARE_RELAY/
CLOUDFLARE_DEPLOYMENT/privacy/RESULTS_PDF ; notes d'évolution MVP_SCOPE/VOTE_MODES_MATRIX.
index.html est régénéré localement, production en dernier ; aucun push/Pages.

Hors lot conservés tels qu'à l'entrée : anciens rapports QR4A/Poster4B/UX3E,
spec UX3E non suivie, captures personnelles à la racine. Les améliorations déjà
présentes du mécanisme d'audit excluant ces captures ont été préservées.
La spécification v0.5 fournie par Lu’uma n'est pas modifiée.

## Dépendances

Aucune dépendance ajoutée. Réutilisation Node/node:test, Wrangler/D1 locaux,
Web Crypto, Canvas/pdf-lib, jsQR tests, Poppler ; pas de CDN/font/réseau de rendu.
Les skills Workers/Wrangler ont guidé les transactions réelles et le développement
local ; la recommandation générique de logs reste écartée au profit de la privacy Voti.

## Limites et écarts explicites

- Identité déclarée non vérifiée, aucune garantie une personne = un vote.
- Aucune anonymisation automatique du texte ; notice et modération.
- Aucun anonymat réseau/E2E garanti, hébergeur susceptible de logs propres.
- Commentaires privés export PDF non proposés (priorité explicitement permise par spec) ;
  administration complète conservée, aucune fuite vers un PDF public.
- Administration/PDF bornés à 500 entrées, PDF 32 pages ; chargement public paginé.
- Reçu de soumission non réversible directement conservé jusqu'à suppression du poll ;
  ce n'est ni du chiffrement ni un hash de personne. Un détenteur des données internes
  pourrait vérifier un contenu supposé : aucune promesse d'effacement cryptographique.
- PDF raster, non balisé/sélectionnable, limites existantes de polices système/emoji ;
  inspection locale ne constitue pas une validation physique imprimante/téléphone.
- Compatibilité lecture v1/v2 vers v3 ; retour arrière vers ancien frontend exige une
  sauvegarde antérieure, aucun downgrade automatique des données de participation.
- Frontend v0.5 non publiable seul contre l'ancien Worker v0.4C : ordre migration
  additive puis Worker compatible avant frontend respecté après autorisation.

## Validations attendues au stade local — historique

Audit ChatGPT de ce diff, revue du reçu d'idempotence et des données sensibles/backup ;
recette UX participation/commentaire/modération et PDF nominatif avant publication.
Accord séparé obligatoire pour toute migration/déploiement Worker et Pages.
Aucune recette physique v0.5 à ce stade local ; confirmations obtenues ensuite
détaillées plus bas. Aucune identité réelle ni donnée réelle de mineur utilisée.

## Archive du développement local — historique

Archive : `VOTI_AUDIT_V0_5.zip`, créée après les tests et ce rapport par
`npm run audit:bundle`. Le mécanisme utilise exclusivement les chemins Git
admissibles et exclut ZIP récursifs, exports admin/PDF, captures personnelles,
.env/.dev.vars, bases/caches/profils/medias runtime ignorés. Une vérification du
répertoire ZIP et des chemins admissibles contrôle ces exclusions après création.
Les assets de marque sources, les sources applicatives et les fixtures fictives
de code restent inclus ; aucune donnée utilisateur runtime. Aucun ZIP commité.

Contrôle final réussi : 162 chemins admissibles, chaque entrée décompressée comparée
octet par octet au fichier courant ; zéro ZIP récursif, capture, PDF temporaire,
export admin, runtime/base/cache local ou capacité admin littérale. Archive ignorée
par Git. Aucun fichier staged, commit/push/déploiement à ce stade local.

## Pré-déploiement production — Gate A suspendu (13 octobre 2026)

Lu’uma a validé l'audit et autorisé un déploiement contrôlé, dans l'ordre :
sauvegarde/contrôles, migration0003, Worker compatible, puis frontend et recette
humaine. Les constatations ci-dessous sont des contrôles techniques, pas une
validation humaine de v0.5.

- Avant cet ajout documentaire, les 162 entrées du ZIP audité correspondaient
  exactement aux fichiers courants. Aucun changement applicatif effectué.
- Le build production local correspond aux valeurs auditées : 1 282 682 octets,
  SHA-256 `9e550cb5a02eef911db452c65015319dab102b756f60669bb9624bf7e80a5734`.
- Authentification Wrangler OAuth opérationnelle sur le compte du pilote.
  Configuration locale de production inchangée : profil sans R2, assets distants
  désactivés, aucun changement de bindings, Turnstile ou quotas.
- Lectures D1 : seules `0001_initial.sql` et `0002_cleanup_indexes.sql` sont
  appliquées ; seule `0003_participation_comments.sql` est en attente. Schéma
  historique attendu, trois colonnes originales de ballots, 1 sondage et
  5 bulletins comptés. Aucun bulletin brut ni secret consulté ou affiché.
- **Blocage reproduit sans écriture** : `EXPLAIN CREATE TRIGGER` contenant
  `SELECT CASE ... END;` retourne `incomplete input: SQLITE_ERROR`, code 7500.
  La variante `SELECT (CASE ... END);` réussit avec `changes=0`,
  `rows_written=0` et `changed_db=false`. EXPLAIN compile la requête mais
  n'exécute pas la création du trigger.
- Quatre triggers de la nouvelle migration0003 utilisent la syntaxe refusée :
  participation_validate, ballot_identity_validate, comment_validate et
  comment_moderation_validate. Le même incident avait été traité pour0001
  lors du pilote v0.3D ;
  [signalement dans le dépôt Cloudflare Workers SDK](https://github.com/cloudflare/workers-sdk/issues/4727).

Conformément à l'instruction STOP en cas d'imprévu, aucune migration, aucun
déploiement Worker/Pages, aucun commit/push n'a été effectué. Aucune sauvegarde
D1 pré-migration n'a encore été créée. Les données de production sont inchangées.
L'archive d'audit n'est pas régénérée à ce stade.

Lu’uma a ensuite **explicitement autorisé** cette correction et la reprise du
déploiement contrôlé. Les quatre expressions CASE de0003 ont été parenthésées,
sans modifier0001/0002, le schéma cible ou la sémantique. Aucun code frontend
modifié ; taille et SHA-256 du HTML production inchangés.

Contrôles après correction :

| Commande / contrôle | Résultat |
| --- | --- |
| npm test | Succès, 374 tests Node ; première tentative limitée par la sandbox workerd, relance autorisée réussie |
| npm run check | Succès, 93 fichiers JS |
| node scripts/free-pilot-integration.mjs | Succès, 66 contrôles Worker/HTTP/D1 locaux sans R2, dont participation/atomicité/migration historique |
| npm run test:relay | Succès, 118 contrôles HTTP/Worker/D1/R2 locaux |
| npm run build:production | Succès, 1 282 682 octets, SHA-256 audité identique ; exécuté après les tests qui régénèrent un HTML local |
| wrangler deploy --dry-run (configuration production) | Succès, paquet 66,74 KiB / gzip 17,51 KiB, aucun upload |
| Gate A, lectures D1/Worker | Intégrité quick_check OK, migrations0001/0002 seulement, bindings publics/quotas conformes, secret présent (valeur jamais lue), aucun R2 |

Les grosses suites Chromium/PDF du lot audité n'ont pas été rejouées : correction
SQL syntaxique uniquement, couverte par les tests D1/HTTP réels locaux ci-dessus.
L'archive d'audit finale sera recréée seulement après la recette humaine et le
rapport final, conformément à la demande de Lu’uma.

## Production contrôlée — progression après autorisation

### Gates A et B

- Sauvegarde D1 pré-migration exportée localement, non vide, accès restreint et
  emplacement ignoré par Git. Son contenu et son chemin ne sont pas documentés
  ici et ne doivent pas figurer dans l'archive d'audit.
- Seule `0003_participation_comments.sql` corrigée a été appliquée à
  `voti-production` ; Wrangler rapporte 15 commandes exécutées, migration réussie.
  Aucun changement de0001/0002.
- Vérification après migration en lecture seule : tables comments/participations,
  colonnes ballots.participation_id et ballots.submission_digest, quatre index
  et six nouveaux triggers présents ; quick_check OK et foreign_key_check vide.
- Toutes les colonnes historiques de polls contrôlées, dont definition et
  semantic_hash, ont une empreinte de comparaison strictement identique avant/
  après. Compteurs inchangés : 1 sondage, 5 bulletins ; zéro commentaire et
  zéro Participation. Aucun bulletin brut de production lu.
- Aucun frontend v0.5 publié à ce stade. Recette humaine v0.5 non commencée.

### Gate C — Worker déployé et compatibilité confirmée

- Worker `voti-relay` déployé : version
  `9ea6d58d-0ced-4a76-b7a1-0b5262ad5748`, URL workers.dev existante conservée.
  D1, trois bindings de rate limiting et paramètres publics identiques ; secret
  Turnstile conservé et vérifié seulement par son type, valeur jamais lue.
  Aucun binding R2 ajouté, aucun upgrade/service payant activé.
- Cron conservé : `17 * * * *`. Configuration d'observabilité inchangée.
- Lectures via HttpRelayAdapter : ancien sondage et résultats lisibles, nouveaux
  champs sémantiques absents, aucune présence de commentaire dans la projection.
  CORS production accepté, origine non autorisée refusée, id inconnu → NOT_FOUND.
  D1 confirme zéro commentaire et zéro Participation.
- Le seul ancien sondage est fermé : ne pas le rouvrir ni fabriquer un vote.
  Avant Gate D, demander à Lu’uma de créer un sondage **fictif** avec le frontend
  v0.4C encore publié, puis vérifier un vote simple avec le Worker v0.5. Cette
  étape utilise le vrai parcours Turnstile humain, sans contournement, injection
  SQL de fixture ou modification du sondage historique existant.
- Lu’uma a créé/puis publié un sondage fictif avec le frontend v0.4C et confirmé
  le succès d'un vote depuis le téléphone. Lien public de cette fixture :
  `#/p/3a864d6c-024d-4dcc-88be-9a5471e5f3ad`.
- Vérification via HttpRelayAdapter : anonyme, ouvert, verrouillé après vote,
  trois nouveaux réglages absents de la définition historique, aucune projection
  de commentaires. COUNT D1 réel : **1 bulletin, 0 commentaire, 0 Participation,
  0 bulletin lié à une Participation**. Aucun bulletin brut lu.
- Un premier contrôle D1 a renvoyé un refus7403 ; les lectures de compteurs
  réessayées ont réussi, sans modification de credentials ou de configuration.
  Cause transitoire non démontrée, aucun déploiement effectué pendant ce refus.
- Compatibilité positive obtenue **avant publication du frontend v0.5**.
  La recette humaine participation/commentaires v0.5 reste à effectuer.

### Gate D — frontend préparé pour publication

Build production final inchangé : **1 282 682 octets**, SHA-256
`9e550cb5a02eef911db452c65015319dab102b756f60669bb9624bf7e80a5734`.
Avant push, Pages servait encore exactement le précédent build Git v0.4C :
1 237 179 octets, SHA-256
`2a33ba9f837eb040f5b7be2b8377172572004c0f0ef33709fc37779bb2260a2f`.
Commit/push v0.5 autorisés par Lu’uma ; vérifier la propagation et l'identité
binaire après publication. Aucun ZIP, sauvegarde D1, export admin ou capture
personnelle ne doit être inclus dans le commit.

### Gate D — publication vérifiée

- Commit `b938a2e` (`feat: Voti v0.5 participation et commentaires`) créé et
  poussé sur main après validation des Gates A/B/C. 53 fichiers v0.5 inclus.
  Les anciens rapports QR4A/Poster4B/UX3E et spec UX3E hors lot restent non
  commités ; aucun ZIP, capture, backup D1 ou export admin suivi.
- Pages `https://luuma8888.github.io/voti/` répond HTTP200 et sert exactement
  le build production attendu : **1 282 682 octets**, SHA-256
  `9e550cb5a02eef911db452c65015319dab102b756f60669bb9624bf7e80a5734`.
  Comparaison octet par octet réussie à la troisième lecture de propagation.
- Aucun nouveau déploiement Worker ni changement D1/Turnstile/bindings/R2 lors
  de cette publication frontend. Profil gratuit sans R2 inchangé.
- git diff --check réussi ; le code applicatif et index.html sont commités.
  Cet ajout documentaire de suivi sera finalisé après la recette humaine.

### Recette humaine v0.5 — validée

Le vote simple **de compatibilité v0.4C** ne vaut pas validation des nouveaux
parcours v0.5. Les confirmations physiques obtenues ensuite sont détaillées
ci-dessous ; ne pas revendiquer les étapes encore à effectuer. Guider la
recette une manipulation à la fois ; conserver
les pseudonymes fictifs uniquement et consigner les retours sans correction
silencieuse. Supprimer aussi la fixture de compatibilité à la fin.
L'archive d'audit finale n'est pas recréée avant cette validation et le rapport final.

Confirmations physiques de Lu’uma, après publication v0.5 :

- **A — réglages de création :** valeurs par défaut Anonyme / commentaire
  facultatif / commentaires privés confirmées. Modification provisoire des
  trois réglages puis retour aux valeurs par défaut possible avant tout vote.
  Libellés jugés clairs. Suite de la recette détaillée ci-dessous.

- **B — anonyme + commentaire privé :** premier sondage v0.5 fictif publié
  (`#/p/a65f801f-2ca0-41d0-8a61-c6ed0876ef89`). Réglages distants vérifiés par
  simple GET : anonymous / optional / private, ouvert et non verrouillé.
  Lu’uma confirme sur téléphone la notice d'anonymat et l'absence de champ
  nom/pseudonyme, puis les succès du vote et de l'envoi du commentaire après
  confirmation explicite. Juste avant confirmation, GET attestait locked=false
  et definitionHash=null : aucun vote accepté selon l'invariant du relais ;
  ce contrôle n'est pas présenté comme une lecture de bulletins D1.
  Côté Chromebook, Lu’uma confirme le commentaire immédiatement visible dans
  l'administration, avant seuil, sans identité associée.
- **C — verrouillage :** Lu’uma confirme que les trois réglages participation /
  mode de commentaire / visibilité sont verrouillés après ce premier vote,
  avec une explication claire.
- **D — privé/public :** Lu’uma confirme sur les résultats publics du premier
  sondage l'absence du commentaire privé, de compteur et de message révélant
  son existence.
- **E — second sondage, modération :** sondage fictif anonyme / commentaire
  facultatif / public_with_results publié :
  `#/p/4c41f4dc-20cd-41c7-99b7-107606019fc9`. Le seuil était resté à5 ; Lu’uma
  confirme un oubli et le corrige à2 avant tout vote. GET confirme la correction,
  releaseMode=threshold et l'absence de verrouillage. Aucun défaut applicatif
  revendiqué à propos de cet oubli. Lu’uma confirme ensuite le succès du premier
  vote/commentaire et l'état « En attente » dans l'administration sous le seuil.
- **F — première approbation :** Lu’uma clique « Afficher » et confirme l'état
  « Visible » dans l'administration. Sous seuil, Lu’uma confirme physiquement
  que les résultats restent bloqués et le commentaire approuvé absent. GET
  confirme aucune information de commentaires/total ; getComments renvoie
  RESULTS_LOCKED. Deuxième vote fictif avec commentaire non approuvé confirmé.
  Au seuil2, Lu’uma confirme 2 votes et uniquement le premier commentaire
  approuvé, sous le bon choix, sans identité ; le second reste absent.
  Projection publique contrôlée : 1 commentaire visible, champs limités à
  commentId/choiceId/text, aucune identité/actionId/capacité.
- **F — masquage :** premier clic de Lu’uma sur le second commentaire plutôt
  que le premier ; le contrôle public renvoyait logiquement encore le premier.
  Lu’uma confirme cette erreur de sélection puis masque aussi le premier.
  GET confirme zéro commentaire public et l'absence de section comments dans
  les résultats. Comparaison avec les agrégats publics conservés avant modération :
  total2, nombres et pourcentages strictement inchangés. Lu’uma confirme ensuite
  physiquement la disparition et les chiffres inchangés sur téléphone.
  Aucun défaut applicatif constaté. Lu’uma réaffiche ensuite le premier seulement ;
  GET confirme son retour public (1 visible), agrégats strictement inchangés.
- **G — suppression de commentaire :** Lu’uma ouvre le dialogue puis annule :
  avertissement jugé clair et commentaire toujours présent dans l'administration.
  Nouvelle ouverture et confirmation séparée : disparition du premier commentaire
  de l'administration confirmée par Lu’uma. GET public confirme zéro commentaire
  visible et aucune section comments ; comparaison quantitative avant/après
  strictement identique (total2, nombres par choix et pourcentages). Le second
  commentaire reste masqué, non supprimé pendant cette étape. Aucun bulletin brut
  lu.
- **H — participation identifiée :** troisième sondage fictif publié :
  `#/p/42c3e5bd-440e-4376-bf9d-03a8c22a8342`. GET vérifie identified / optional /
  public_with_results / threshold2, non verrouillé avant vote. Lu’uma confirme
  sur téléphone le champ « Ton nom ou pseudonyme » et les notices identité non
  vérifiée / informations personnelles inutiles déconseillées. Participation
  avec le pseudonyme **fictif** « Emma », succès du vote confirmé.
- **I — doublons déclarés :** deuxième vote pour l'autre choix avec le même
  pseudonyme **fictif** « Emma » accepté. Lu’uma confirme la distinction des
  participations et les associations choix/commentaire dans l'administration.
  Clarification ultérieure de Lu’uma : oubli des commentaires lors de deux votes,
  puis **deux votes supplémentaires** pour ajouter des commentaires. Total public
  réel : **4 votes**, pas2 ; cet écart ne démontre pas un double envoi accidentel.
  Ne pas présenter la recette comme limitée à deux soumissions. Deux pseudonymes
  identiques acceptés ; aucun nom réel utilisé, aucune garantie
  une-personne-un-vote revendiquée.
- **J — contrôle technique public :** un commentaire approuvé, l'autre non
  approuvé ; API publique : 4 votes / 1 commentaire visible. Les objets publics
  de commentaires ne contiennent que commentId/choiceId/text ; aucune identité,
  Participation, actionId ou capacité exposée. Les textes ne sont pas affichés
  par les contrôles. Lu’uma confirme physiquement les 4 votes, uniquement le
  commentaire approuvé et l'absence de nom/pseudonyme affiché publiquement.
- **K — PDF, premières vérifications :** Lu’uma confirme les deux options
  commentaires visibles / identités décochées par défaut dans Rapport. Premier
  PDF sans ces options ouvert à100% : question, total4 et graphique corrects,
  aucun commentaire/pseudonyme ; « Résultats au moment de l’export » présent.
  Deuxième Rapport avec seulement commentaires visibles : commentaire approuvé
  sous le bon choix, sans pseudonyme ni commentaire en attente, confirmé.
  Troisième Rapport : option identités explicitement cochée par Lu’uma,
  commentaires visibles conservés ; associations pseudonymes fictifs / choix,
  commentaire approuvé, mise en page lisible et QR résultats présent confirmés.
  Scan physique de ce QR depuis le PDF affiché : bonne page publique, résultats
  visibles **sans noms/pseudonymes**, confirmé par Lu’uma. Aucun PDF de recette
  transmis au dépôt ou au rapport ; aucune validation papier revendiquée.
  Réserve sur l'avertissement permanent détaillée plus bas, reportée au prochain
  lot par Lu’uma.
- **L — QR par choix identifié :** QR affiché sur Chromebook ; scan physique
  sur téléphone confirmé : écran direct de confirmation du bon choix, champ
  nom/pseudonyme et commentaire facultatif présents. Total public relevé avant
  scan puis après scan/avant confirmation : **4 → 4**, aucun vote automatique.
  Lu’uma saisit le pseudonyme **fictif** « Test QR » et un commentaire fictif,
  confirme explicitement puis valide les succès vote/commentaire. GET après
  confirmation : **4 → 5**, exactement une nouvelle réponse ; toujours un seul
  commentaire approuvé public. Cette validation physique concerne le QR identifié ;
  les variantes anonymes sont couvertes par les tests automatisés du lot.
- **M — sauvegarde :** Lu’uma confirme dans la zone Sauvegarde l'avertissement
  indiquant que le fichier peut contenir commentaires et noms/pseudonymes locaux.
  Aucun contenu de sauvegarde demandé, transmis ou lu pendant la recette.
- **N — nettoyage :** Lu’uma confirme la suppression en ligne des trois sondages
  v0.5 fictifs (« Test », « Codex aime-t-il blaguer ? », « Quel est le meilleur
  prénom ? »), puis de « Compatibilité v0.4C ». Vérification finale : 12 GET
  getPoll/getResults/getComments → NOT_FOUND pour les quatre ids.
  COUNT D1 read-only : zéro ligne correspondante dans polls, ballots, comments,
  participations, publications, asset_links et asset_refs. quick_check OK,
  foreign_key_check vide ; le sondage préexistant non utilisé pour les nouveaux
  votes et son compteur historique sont strictement conservés (empreinte de
  comparaison identique). Worker/bindings toujours identiques, aucun R2.
  Une première tentative CLI du contrôle final n'a pas abouti ; relecture réussie,
  sans changement d'authentification, de configuration ou écriture SQL.
  Aucun bulletin brut, texte de commentaire, pseudonyme interne ou secret lu
  par ces contrôles D1. Les suppressions métier sont définitives en production ;
  aucune sauvegarde opérateur/Time Travel n'est purgée ou réputée purgée ici.

Les étapes physiques A à N sont confirmées comme détaillé ci-dessus. Lu’uma a
**explicitement validé la clôture** avec les trois réserves UX reportées au
prochain lot ci-dessous. Aucun code modifié pendant la recette ; aucun nouveau
build nécessaire. Ni fermeture + seuil ni QR anonyme ne sont revendiqués comme
retestés physiquement dans cette recette ciblée : leurs tests automatisés restent
ceux du lot audité. Aucune validation imprimante, charge publique large ou
anonymat réseau absolu revendiquée.

Note de contrôle ad hoc : la première assertion de pagination publique utilisait
par erreur entries (champ admin) au lieu de items (contrat public). Corrigée dans
la commande de vérification uniquement, contrôle réussi ; aucun code applicatif
modifié et aucun texte de commentaire affiché par ces diagnostics.

### Retour UX à prévoir au lot suivant — non implémenté

Lu’uma : « à l'accueil, sur la liste des sondages, il serait bien d'indiquer le
nombre de commentaires (nombre + icône) quand c'est > 0 », évolution mineure
pour le lot suivant. Contexte : bibliothèque du créateur. Le futur compteur
devra rester dans l'espace créateur autorisé ; ne pas révéler publiquement la
présence de commentaires privés, en attente/masqués ou sous le seuil.
Aucun changement applicatif ou protocolaire réalisé pendant cette recette.

Deuxième retour de Lu’uma, amélioration mineure pour le prochain lot : dans
« Gérer », la liste des réponses n'est pas visuellement identifiée ; « Oui »
puis « Non » sur deux lignes se confondent avec le message précédent :
« Le premier vote a verrouillé la question, les choix et les règles. Vous
pouvez encore changer l’apparence. » Prévoir seulement une meilleure
présentation/hiérarchie visuelle de cette liste, sans changement métier.
Aucune correction réalisée maintenant, conformément à sa demande.

Troisième réserve UX, explicitement **reportée au prochain lot par Lu’uma** :
l'avertissement « Ce PDF contiendra les noms ou pseudonymes associés aux réponses »
reste affiché que l'option identités soit cochée ou non. Cause vérifiée dans
resultsPdfPanel : le paragraphe est ajouté en permanence ; la collecte et
l'inclusion des identités restent bien conditionnées au mode Rapport, à l'option
includeIdentities et à l'autorisation admin. Le PDF option OFF a été confirmé sans pseudonymes.
Proposition pour le prochain lot : avertissement seulement si l'option est active
(ou formulation conditionnelle explicite). Aucun défaut de confidentialité
démontré ici, aucun code modifié ni nouveau build/déploiement pendant la recette.

## Clôture finale validée

Lu’uma valide explicitement la clôture de v0.5, avec les trois améliorations
UX ci-dessus pour le prochain lot. Aucun changement applicatif pendant la
recette ; aucun redéploiement Worker, migration, binding ou Turnstile supplémentaire.
Les quatre sondages fictifs sont supprimés ; les copies locales et les PDF déjà
téléchargés ne sont pas réputés effacés automatiquement.

### Versions réellement publiées

- Migration D1 : `0003_participation_comments.sql`, quatre CASE parenthésés
  après autorisation explicite de Lu’uma ; migrations0001/0002 inchangées.
- Worker : `9ea6d58d-0ced-4a76-b7a1-0b5262ad5748`, endpoint workers.dev existant,
  D1 EU, profil Free sans R2 et configuration conservés.
- Frontend applicatif : commit `b938a2e` poussé sur main. Build local/Git/Pages
  identiques, HTTP200, **1 282 682 octets**, SHA-256
  `9e550cb5a02eef911db452c65015319dab102b756f60669bb9624bf7e80a5734`.
- Clôture documentaire séparée : README, guide de déploiement et présent rapport
  uniquement ; aucune ancienne modification documentaire hors lot, capture ou
  archive à inclure. Aucune nouvelle version applicative produite par cette clôture.

### Contrôles utiles rejoués à la clôture

| Contrôle | Résultat |
| --- | --- |
| node tests/audit-bundle.test.js | 6 tests, 6 réussis, 0 échec |
| npm run check | 93 fichiers JavaScript, succès |
| git diff --check | Succès |
| Diff applicatif depuis b938a2e | Aucun changement dans index/web/shared/relay/scripts/tests/package/lock/configuration |
| Pages / Git / build local | Identité binaire et empreinte ci-dessus confirmées |
| GET après suppressions | 12 contrôles NOT_FOUND pour les quatre fixtures |
| D1, lecture seule | Zéro résidu dans sept tables, intégrité/FK OK, sondage préexistant conservé |

Les grosses suites Chromium/PDF ne sont pas relancées : résultats du lot audité
et régressions après la correction SQL consignés plus haut, aucune nouvelle
modification de code. Le test d'audit invoqué directement affiche ses six cas ;
l'invocation Node --test initiale n'affichait que son conteneur fichier et n'est
pas utilisée pour revendiquer six assertions distinctes.

### Archive de clôture

`VOTI_AUDIT_V0_5.zip` est régénéré **après la documentation finale**, via
`npm run audit:bundle`. Contrôle dédié du manifeste et du ZIP : chaque entrée
décompressée comparée au fichier courant et CRC vérifié ; uniquement chemins
Git admissibles filtrés. Exclusions explicites : anciens ZIP, captures, PDF,
exports admin, backup D1, .env/.dev.vars, runtime/profils/caches/bases locales,
node_modules et médias utilisateur. Les seuls fichiers image admissibles ici
sont les assets de marque validés. Contrôle de capacités littérales et clés
privées dans les sources et les modules embarqués ; aucune valeur secrète lue,
affichée ou ajoutée. ZIP ignoré et non commité. Taille et résultat du contrôle
de l'archive physique fournis dans la sortie de clôture, hors du ZIP lui-même.

Les skills Wrangler/Workers ont guidé les contrôles de déploiement et les lectures
bornées ; leur recommandation générique d'observabilité reste écartée au profit
de la confidentialité actée pour Voti. Aucune garantie exhaustive de sécurité,
de rétention des copies opérateur ou d'anonymat réseau ajoutée à cette validation.
