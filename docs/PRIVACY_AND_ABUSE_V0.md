# Voti — confidentialité, anti-abus et rétention v0.3C

Relais testé exclusivement localement. Pas de déploiement ni de données réelles
dans ce lot. Ce document décrit les garanties applicatives, pas celles d'un compte
Cloudflare encore non configuré/audité.

## Anonymat applicatif ≠ anonymat réseau

Un bulletin D1 contient uniquement poll_id, action_id, choice_id. Aucun userId,
IP, User-Agent, fingerprint, session, origine ou timestamp individuel. L'action
aléatoire sert à rejouer une confirmation sans double bulletin ; une autre action
crée un autre vote. **Aucune garantie une-personne-un-vote.** Pas de compte.

Le Worker ne journalise volontairement ni Authorization, clé, IP, User-Agent,
corps de vote ou image. Observability est désactivée dans la configuration locale.
Le fournisseur peut techniquement voir et journaliser les connexions, horaires,
IP et métadonnées de requêtes. Voti ne garantit ni anonymat réseau ni durée de
rétention de ces journaux : leur configuration et contrat restent à vérifier
avant production. HTTPS protège le transport, pas des opérateurs du relais.
Pas de chiffrement E2E ni de cryptographie artisanale.

## Création : deux freins complémentaires

1. Limite edge partagée : clé fixe relayId:creation, 30 appels prepare par 60 s,
   indépendante de pollId et des capacités A/B/C. S'applique avant le corps et
   Siteverify, donc un renouvellement de capacité ne donne pas un nouveau quota.
   Les retries prepare sont également comptés ; administration existante via les
   autres routes reste indépendante. Une saturation collective peut différer la
   création légitime, jamais convertir un vote distant en vote local.
2. Turnstile : jeton vérifié par le Worker auprès de Siteverify seulement pour
   une nouvelle préparation. Secret Worker, site key publique, token POST éphémère
   non persistant. Validation de success, hostname exact, action voti-publication,
   âge du challenge ; rejet des réponses invalides/service absent/timeout. Aucun
   token/capacité dans URL, D1 ou logs. Une reprise existante exige sa capacité.

L'API Siteverify impose validation serveur, jetons à usage unique et durée de
5 minutes. Voti ne simule pas cette garantie en production ; le fournisseur
refuse les replays. [Documentation Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Le widget est chargé uniquement sur demande de publication, pas pour créer
localement, voter, voir les résultats ou administrer. Ce parcours transmet des
informations techniques au service Turnstile ; le secret n'est jamais dans le
HTML. Voti ne transmet pas le paramètre facultatif remoteip et ne lit aucune IP.
Cloudflare traite néanmoins transitoirement le réseau, le challenge et ses
compteurs edge. Ne pas confondre absence de table d'IP avec absence de traitement
de données par l'infrastructure.

Le binding Rate Limiting est approximatif et local par point de présence. Une
attaque multi-régions ou des humains pouvant résoudre les challenges peuvent
encore engendrer des coûts ; ce n'est ni un quota mondial financier ni une
protection absolue DoS. Prévoir plafonds/alertes opérateur et pilote limité.
[Limites du binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

## Lectures, votes, administration, assets

| Catégorie | Quota / 60 s | Clé |
| --- | ---: | --- |
| Création/préparation | 30 | relayId:creation fixe |
| Vote | 120 | pollId:castVote |
| Sondage / résultats | 120 chacun | pollId:catégorie |
| Administration existante | 120 partagé | SHA-256 contextualisé capacité/poll |
| Asset public | 600 par image | pollId + assetId |

Les quotas ne stockent pas d'IP dans D1. Les namespaces sont distincts et devront
être dédiés au Worker de production. 429 + Retry-After: 60 ; codes structurés
CREATION_RATE_LIMITED ou RATE_LIMITED. Un groupe de 30 clients × 7 images est
testé localement : 210 réponses réussies, sept quotas, pas un quota partagé 120.
Un vote demeure anonyme minimal, sans challenge ni droit d'éligibilité.

R2 reste privé. La lecture vérifie sondage public + référence utilisée, même
lorsqu'un hash est connu. Réponse cache navigateur privé 300 s immutable + ETag
sha256 ; aucun cache edge qui contournerait la vérification. Une image déjà
téléchargée peut être conservée par son destinataire ; sa suppression ne révoque
pas les copies, et le navigateur peut réutiliser une réponse fraîche 5 minutes.
Les nouvelles demandes réseau après suppression reçoivent NOT_FOUND, pas une
indication de l'existence passée du sondage.

## Rétention et suppression

| Donnée | Politique applicative |
| --- | --- |
| Préparation privée non publiée | 24 h ; commit refusé dès échéance, retrait physique au cron |
| Sondage publié | Aucune expiration automatique |
| Sondage fermé | Accessible jusqu'à suppression du créateur |
| Sondage supprimé | Poll/bulletins/relations/préparation supprimés dans le batch D1 |
| Objets R2 déliés | Garbage durable, retry au cron horaire / commande locale |
| Journaux propres à Cloudflare | Durée non garantie par ce lot |

deletePoll exige capacité et révision exacte, et confirmation utilisateur. La
garde transactionnelle est conservée ; bulletins retirés avant poll, relations et
préparations cascades, triggers réservent les clés d'objets dans garbage. Réponse
deleted:true signifie inaccessibilité et suppression métier D1, pas preuve que
tous les objets R2 sont déjà physiquement effacés. Panne R2 : aucun retour public,
file durable survive restart. Le nettoyage est idempotent et borné (25 préparations,
100 objets), ordonné et indexé ; échec d'un objet n'empêche pas les autres. Aucun
cleanup opportuniste sur HTTP. Un scheduled avec échecs signale une erreur générique.
Surveiller backlog, cron et quotas avant production ; aucune durée absolue de
nettoyage promise en cas de panne prolongée. Les sauvegardes fournisseur/Time Travel
éventuelles doivent aussi être examinées : effacement logique n'efface pas toutes
les copies opérateur instantanément.

## Images : garanties réelles et limite du décodeur

Les octets normalisés sont liés au sha256 obligatoire et aux métadonnées exactes.
WebP/PNG seulement sur le relais : JPEG sélectionné est réencodé localement.
Limites générales 1 Mo, 1600 px/côté, 2 560 000 pixels ; choix 600 Ko/1000 px.
Le lot upload est limité à 14 assets et validé entièrement avant écritures R2.
Traitement séquentiel serveur afin de limiter la mémoire temporaire.

WebP : RIFF exact, un seul VP8/VP8L, VP8X unique premier, canvas égal aux dimensions
réelles du bitstream, flags et octets réservés nuls, versions de headers reconnues,
chunks ICC/alpha cohérents, padding nul, chunks inconnus/animation/EXIF/XMP refusés.
PNG : CRC de chaque chunk, en-têtes/fin uniques, IDAT présents et consécutifs,
ordre, whitelist des chunks normalisés ; 8 bits fixe non entrelacé uniquement.
Inflation zlib native lue en streaming avec limite exacte de lignes et filtres
0–4 ; dépassement, corruption ou longueur incohérente refusés. Ce n'est pas un
réencodage serveur, pas une reconstruction complète des pixels PNG, ni un décodage
du flux compressé VP8/VP8L. Un flux WebP plausible mais indécodable peut subsister.
La borne de streaming ne constitue pas un audit exhaustif CPU/mémoire du runtime.

Sources de format : [PNG W3C](https://www.w3.org/TR/png-3/),
[conteneur WebP](https://developers.google.com/speed/webp/docs/riff_container).
L'environnement Worker possède DecompressionStream ; le décodage graphique complet
peut passer par le service/binding Images, architecture/coût supplémentaires non
retenus ici. Aucun gros WASM/native ajouté simplement pour annoncer un décodage.
[API standards Worker](https://developers.cloudflare.com/workers/runtime-apis/web-standards/),
[binding Images](https://developers.cloudflare.com/images/optimization/binding/).
Avant ouverture large, décider revue/décodeur et budget upload ; le pilote ne
doit pas être décrit comme validant totalement toutes les images malveillantes.

## Clé d'administration — fichier SECRET

Fichier JSON indépendant version 1 : version, relayId, pollId, adminCapability.
Capacité aléatoire système 256 bits. Le relais conserve uniquement le dérivé
SHA-256 lié au poll/relay, comparé par primitive native. Authorization Bearer
uniquement ; ni modèle sémantique, bulletin, URL ou backup général.

Export explicite en gestion ; import en gestion ou Sauvegarde & transfert :
structure/tailles/versions/identifiants contrôlés, requête admin authentifiée réelle,
puis stockage. Une capacité différente déjà présente entraîne confirmation puis
comparaison atomique avec l'ancienne clé sous Web Lock. Annulation n'écrit rien ;
clé incorrecte n'écrit rien. Les sondages retrouvés restent administrables sans
restaurer les données métier locales. Ce n'est pas .sondagebox.

Le fichier n'est pas chiffré : toute personne qui le possède peut modifier,
fermer ou supprimer le sondage. Stockage navigateur accessible au propriétaire,
extensions/XSS ; aucun compte de récupération. Conserver la clé hors du navigateur
dans un emplacement protégé et vérifier son téléchargement. Perte de toutes ses
copies = perte d'administration ; suppression ultérieure par procédure opérateur
reste à définir avant service public.

## Tests et production

Tests locaux : mode local-test explicite réservé loopback, token court/replay
simulés en mémoire. Ni secret réel ni appel Internet. Siteverify strict est testé
par injection de réponses positives/négatives/service en erreur, sans prétendre
reproduire la décision humaine du fournisseur. Les clés de test officielles
restent disponibles pour une future recette autorisée, jamais comme protection
de production. [Tests Turnstile officiels](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

Avant tout déploiement, suivre `CLOUDFLARE_DEPLOYMENT_V0.md`. Aucune ressource
distante, secret distant, widget ou configuration Pages n'est modifié ici.
