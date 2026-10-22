# Confidentialité du vote contrôlé — v0.6

## Garantie applicative, pas anonymat absolu

Mode libre : pas d’unicité par personne. Mode Espace : une participation par membre
du snapshot, sous autorité D1. Une carte n’est pas une preuve d’identité vérifiée.
Pas de compte enfant classique, fingerprint, IP, User-Agent ou identité réseau dans
les bulletins/commentaires. Voti ne journalise volontairement ni cartes, capacités,
noms ni commentaires. Les logs/traces propres à l’infrastructure ne sont pas garantis
anonymes ; aucune E2E/signature aveugle ni anonymat cryptographique n’est fourni.

## Séparation anonyme

`poll_member_eligibility(poll_id,member_id,consumed)` contient l’identité du droit,
mais aucun actionId, ballotId, digest ou temps de consommation.
Ballot : les colonnes v0.5 restent ; `participation_id` est NULL en anonyme.
Commentaire : `participation_id` NULL en anonyme. Aucune Participation n’est créée.
Il n’y a donc pas de jointure directe membre → bulletin/commentaire anonyme.
L’actionId aléatoire sert seulement à la soumission/idempotence et n’est jamais
enregistré dans le registre d’éligibilité. Des contraintes interdisent d’utiliser
un memberId comme actionId, ou de créer ensuite un membre recopiant un actionId.

Le contrôle transactionnel utilise une garde transitoire **non nominative** ; elle
est supprimée dans le même batch ou annulée au rollback, pas stockée comme une liaison.
Le bulletin peut être relié à son commentaire, jamais à une identité de membre en anonyme.

## Atomicité et concurrence

Le batch D1 vérifie à nouveau carte/membre/Espace actifs, snapshot non consommé,
statut publié et hash actuel. Puis consommation, Participation seulement en identifié,
bulletin, commentaire éventuel, premier verrouillage/révision et retrait des gardes.
CHECK/FK/UNIQUE/triggers autoritaires ; aucune séquence indépendante SELECT/INSERT/UPDATE.
Un échec annule **toutes** les écritures du batch. Deux appareils avec la même carte :
un accepté, l’autre ALREADY_PARTICIPATED, sans révéler un choix. Retry exact : un seul
bulletin/commentaire/Participation maximum.
La soumission inclut aussi expectedDefinitionHash de la définition affichée. Une
mutation anonyme → identifié pendant la confirmation provoque REVISION_CONFLICT,
zéro écriture et re-confirmation explicite avec la nouvelle notice. La révision des
autres votes ne suffit pas à créer un conflit si les règles n’ont pas changé.
Les garanties de rollback transactionnel de batch sont celles documentées par
[Cloudflare D1](https://developers.cloudflare.com/d1/worker-api/d1-database/).

## Projections

| Destinataire | Anonyme contrôlé | Identifié contrôlé |
| --- | --- | --- |
| Sans carte | définition/résultats privés refusés | idem |
| Membre courant | son propre Déjà participé, sondages et résultats autorisés | idem ; nom automatique lors du vote |
| Gestion autorisée | X/Y, commentaires sans identité, aucune liste nominative de votants/non-votants | roster nominatif, filtre Tous/A participé/À relancer, réponses/commentaires associés |
| Résultats audience | seuil/règle/audience + commentaires approuvés seulement ; aucune identité | idem ; noms jamais exposés à l’audience |

Le seuil minimal reste obligatoire, même all_eligible ou fermeture. `admins_only`
ne renvoie pas d’agrégat aux membres, même si le sondage est publiable.
La gestion peut consulter les commentaires avant seuil, comme v0.5.
PDF Synthèse : aucune identité. Rapport : commentaires visibles sur option ; identités
uniquement en gestion identified, opt-in averti, OFF par défaut. Aucun bulletin/actionId
brut, token ou capacité dans les PDF publics.

## Limites importantes

Un administrateur ayant copié une carte peut emprunter sa projection individuelle ;
la restriction de la projection admin ne neutralise pas un credential participant
compromis. L’opérateur de la base peut lire le registre nominatif interne ; les heures
de requête, l’ordre des transactions, petits groupes, contenu reconnaissable des
commentaires et logs hébergeur permettent des déductions malgré l’absence de jointure.
Ne pas prétendre que la séparation applicative protège contre un opérateur malveillant.

Révoquer un non-votant ne réduit pas le dénominateur figé. Un sondage all_eligible peut
rester bloqué ; c’est volontaire plutôt que de réécrire l’histoire. Un bulletin anonyme
soumis avec carte volée ne peut être retrouvé ou corrigé par membre.

Les tests D1 locaux vérifient les colonnes, zéro Participation anonyme, NULL identité,
absence de jointure, gardes vidées, rollback injecté et concurrence ; ils ne prouvent
pas une indistinguabilité cryptographique. Aucun enfant réel ni donnée de production
n’a été utilisé dans ces tests.
