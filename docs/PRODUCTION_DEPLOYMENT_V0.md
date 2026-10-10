# Voti — pilote de production gratuit v0.3D

## Autorité et état

Lu’uma a validé le Gate A, puis imposé **gratuit uniquement, arrêt aux limites**.
La variante **sans images utilisateur distantes** a été explicitement approuvée.
Cet arbitrage plus récent remplace, pour ce pilote seulement, le provisionnement
R2 et la recette des images distantes prévus dans `VOTI_DEPLOY_V0_3D_SPEC.md`.
Le document d'autorité d'origine reste inchangé. L'architecture R2 et ses tests
locaux restent disponibles ; ni upload alternatif ni stockage de blobs D1.

État : **Gate B autorisé**, migrations D1 et Worker réellement déployés le
10 octobre 2026. Secret installé manuellement, binding chiffré confirmé ; le
contrôle Siteverify a révélé un bug de fetch workerd, corrigé et redéployé.
Le jeton factice est maintenant refusé avec `403 HUMAN_VERIFICATION_FAILED`.
Gate C explicitement autorisé et exécuté : commit/push sur main et Pages publié.
**Recette textuelle Chromebook ↔ téléphone confirmée par Lu’uma**, publication
Turnstile réelle jusqu'à transfert de clé et suppression, sans vote effectué par
l'agent. Deux corrections ciblées explicitement autorisées en cours de recette :
accents CSS (`e2b7a54`), puis liens de résultats (`8204e95`). Pilote contrôlé
validé, pas une ouverture publique large ni un audit exhaustif de charge/sécurité.

## Ressources vérifiées

| Élément | Valeur publique |
| --- | --- |
| Compte Cloudflare | `1c74451e938197bbcd316939932fc778` |
| Forfait Workers | **Free**, confirmé par Lu’uma dans le tableau de bord (« Number of Workers: 100 ») |
| Worker déployé | `voti-relay` |
| D1 créé | `voti-production` |
| D1 UUID | `bb3329c1-7de3-4147-8d07-af8679b6cd12` |
| Juridiction D1 | `eu`, création explicite et vérification API |
| Sous-domaine enregistré | `voti-luuma8888.workers.dev` |
| URL Worker active | `https://voti-relay.voti-luuma8888.workers.dev` |
| relayId | `voti-production` |
| Turnstile créé | `Voti publication`, Managed, `no_clearance` |
| Site key **publique** | `0x4AAAAAAFSr8Ez4dZ22j76S` |
| Hôte widget et Siteverify | `luuma8888.github.io` uniquement |
| Action Siteverify | `voti-publication` |
| Site Pages publié | `https://luuma8888.github.io/voti/` |
| R2 | **Non activé, aucun bucket créé ni binding de production** |

La connexion OAuth Wrangler et le connecteur officiel Cloudflare sont actifs.
Les API d'abonnement ont refusé l'accès ; les entitlements sont vides. Aucun
forfait n'a été déduit de `default_usage_model: standard` : la confirmation
du forfait Free provient du tableau de bord lu par Lu’uma.

## Gratuité et limites

Conserver Workers **Free**, sans upgrade, R2, Images, domaine payant ou service
supplémentaire. Les limites Workers Free interrompent le service, au lieu de
facturer un dépassement. D1 Free refuse aussi les opérations dépassant ses
limites. Il n'y a pas de bascule vers Paid autorisée dans ce lot.

- Workers : 100 000 requêtes/jour, limite CPU Free ; indisponibilité possible.
- D1 : 5 millions de lignes lues et 100 000 écrites/jour ; 5 Go par compte,
  limites propres à chaque base également applicables.
- Turnstile : offre Free, challenge uniquement au démarrage d'une publication.
- Les quotas edge applicatifs ne sont **pas** des plafonds financiers globaux.
- Une alerte de budget ne bloque pas la dépense. R2 est donc exclu plutôt que
  présenté à tort comme gratuit sans risque de dépassement.
- Si quelqu'un passe ultérieurement le compte sur Paid, la configuration seule
  ne constitue plus une garantie de zéro facture. Revérifier le forfait avant
  toute opération de déploiement, et ne jamais effectuer cet upgrade ici.

Sources officielles consultées : [Workers](https://developers.cloudflare.com/workers/platform/pricing/),
[limites Workers](https://developers.cloudflare.com/workers/platform/limits/),
[D1 Free](https://developers.cloudflare.com/d1/platform/pricing/),
[enforcement D1](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/),
[Turnstile](https://developers.cloudflare.com/turnstile/plans/),
[R2](https://developers.cloudflare.com/r2/pricing/),
[alertes non bloquantes](https://developers.cloudflare.com/billing/manage/budget-alerts/).

## Configuration distincte et garde-fous

`relay/cloudflare/wrangler.production.jsonc` lie le véritable D1 et le compte
explicitement. `remote: false` protège le développement local ; une migration
distante devra utiliser explicitement `--remote`. Aucune auto-provision de D1.
La juridiction n'est pas un champ de binding D1 supporté par Wrangler 4.149.0 :
elle a été fixée lors de la création, et ne doit pas être remplacée par un hint.

`REMOTE_ASSETS_ENABLED=false` : refus des références d'images lors de préparation,
commit ou modification ; refus des lots d'upload non vides ; route image publique
`NOT_FOUND`. Les lots vides restent des no-op compatibles avec RelayClient,
sans nouvelle révision, D1 écrit ni accès R2. Corps HTTP limités à 65 536 octets.
Le client bloque la publication illustrée **avant** de demander Turnstile.
Il ne supprime jamais silencieusement des images de la définition sémantique.
Les images locales, backups, images de marque intégrées et cinq thèmes restent
inchangés. Une modification d'un sondage distant n'offre pas d'ajout d'image.

CORS production : origine exacte `https://luuma8888.github.io`, sans localhost,
avec `Vary: Origin`, sans cookies. Turnstile : Siteverify serveur réel et hostname
strict ; mode local-test exclu de la production. Observabilité désactivée selon
la politique du projet : aucun log applicatif volontaire de données sensibles.
Ce choix explicite prime sur la recommandation générique du guide Workers
d'activer logs/traces. Cloudflare peut toujours avoir ses propres logs réseau.

Namespaces edge distincts : `34001` public/admin 120/min, `34002` création
30/min/PoP, `34003` assets 600/min (routes désactivées sur ce pilote).
Cron conservé : `17 * * * *`, préparations 24 h, sondages publiés/fermés sans
expiration automatique. Les tables assets/garbage sont conservées et vides ;
aucune migration de domaine ou modification du mécanisme de verrouillage.

## Gate B — exécuté, contrôles négatifs vérifiés

Migrations et déploiement ci-dessous exécutés après confirmation explicite.
Le secret est installé manuellement ; le chemin Siteverify négatif est vérifié.
Le succès d'un challenge humain a ensuite été confirmé par Lu’uma sur Pages.
Historique des opérations approuvées :

1. Appliquer sur **la seule base D1 ci-dessus** `0001_initial.sql` et
   `0002_cleanup_indexes.sql`. Création des tables/triggers/index, aucun import
   de données locales ou personnelles.
2. Déployer le Worker `voti-relay` avec la configuration de production ci-dessus,
   workers.dev et cron. Aucun autre binding payant ou upgrade.
3. Après existence vérifiée du Worker, installer **uniquement** le secret du widget
   approuvé sous `TURNSTILE_SECRET` sur ce même Worker. Fournir et confirmer le
   manifeste exact avant toute récupération/écriture de secret. Ne jamais
   utiliser les commandes du dépôt pour transporter sa valeur, ni l'afficher,
   ni la déposer dans un fichier ou variable publique. Sans ce secret, la
   création reste fermée ; cela n'est pas une validation Turnstile réelle.
4. Contrôles HTTP/CORS réels ; données de pilote fictives seulement et recette
   Turnstile réelle avec Lu’uma. Ne pas simuler un succès humain depuis l'agent.

Commandes de migration/déploiement **effectivement exécutées** avec capture
de sortie non sensible, logs disque et métriques désactivés :

```sh
node_modules/node/bin/node node_modules/wrangler/bin/wrangler.js d1 migrations apply voti-production --remote --config relay/cloudflare/wrangler.production.jsonc
node_modules/node/bin/node node_modules/wrangler/bin/wrangler.js deploy --config relay/cloudflare/wrangler.production.jsonc --no-autoconfig
```

Le dry-run sans upload a été exécuté avec cette configuration. Il vérifie le
packaging, pas les performances CPU Free ni le fonctionnement HTTP réel.

Les migrations sont enregistrées dans `d1_migrations` ; 7 tables métier,
6 triggers et 2 index explicites vérifiés. Le CASE du trigger `ballot_validate`
est parenthésé : correction syntaxique du splitter distant après reproduction
par EXPLAIN sans écriture, pas de changement de règles ni reset de base.
Version Worker : `70e6600c-1011-4f41-9355-ba2653eee158`. Bindings/cron vérifiés,
10 contrôles HTTP/CORS/fail-closed réussis ; aucun sondage réel créé.
Version actuelle après correction fetch Siteverify :
`7d353d36-d74a-4764-ab5c-c90f4129126e`, déploiement
`68b0456d-e4ed-4993-acc7-ed66851c83eb` à 100 %. Neuf nouveaux contrôles HTTP
réels réussis ; secret conservé, bindings/cron inchangés, D1 métier vide au stade
du smoke initial. Après recette et suppression, la base est à nouveau sans
sondage/bulletin/préparation de test ; voir le contrôle final ci-dessous.

### Installation du secret par Lu’uma, sans terminal

Le guide de sécurité Turnstile interdit le transport du secret par les binaires
du dépôt. Aucun Wrangler approuvé hors projet n'est disponible ; utiliser le
gestionnaire de secrets Cloudflare, sans transmettre la valeur dans le chat :

1. Tableau de bord Cloudflare → Turnstile → **Voti publication**.
2. Copier la **Secret key** (pas la Site key). Ne pas la photographier ni la coller
   dans un fichier du projet.
3. Workers & Pages → **voti-relay** → Settings → Variables and Secrets → Add.
4. Type **Secret**, nom exact **TURNSTILE_SECRET**, valeur copiée du widget.
5. Enregistrer/déployer la configuration du secret avec le bouton proposé.
   Ne pas modifier le forfait, bindings ou origines.
6. Signaler seulement « secret installé ». L'agent vérifiera le nom du binding
   et les refus HTTP, jamais sa valeur. Un nom présent ne prouve pas encore
   le succès d'une vérification humaine réelle ; celui-ci sera testé séparément.

Installation déjà réalisée : aucune nouvelle recopie nécessaire. Le 503 initial
venait de `redirect: 'error'`, option refusée par workerd avant l'appel réseau.
Correction : `manual` et refus de toute réponse non-2xx, sans suivre de
redirection. Tests dans workerd réel ajoutés. Binding secret_text toujours
présent, aucune valeur lue ; jeton factice désormais refusé en 403.
Ne pas présenter ce contrôle négatif comme une vérification humaine réussie.

## Frontend et Gate C

La configuration publique est centralisée dans `web/relay-production.json`.
`npm run build:production` construit le HTML connecté actuel de **478 957 octets**
après les corrections autorisées. La commande ne déploie rien et ne lit
aucun secret. Configuration publique : relayId `voti-production`, URL
`https://voti-relay.voti-luuma8888.workers.dev`, site key
`0x4AAAAAAFSr8Ez4dZ22j76S`, mode `siteverify`, images distantes désactivées.
Les 193 tests Node et les suites HTTP/navigateur locales passent.
`npm run build`
reste le build local autonome ; il ne conserve pas la configuration production.

Diff et contrôles de secrets présentés ; Gate C explicitement accordé par
Lu’uma pour commit/push sur main et mise à jour Pages. Opération effectuée,
frontend courant `8204e95`. URL canonique HTTP 200, HTML 478 957 octets identique
au build, SHA-256 `a5ca888deadbc85f414043d5bcffd8c66fab99f0e06440d3a3e899dd588a0d81`.
Ne pas envoyer le ZIP d'audit dans Git. Avant le premier push, la lecture du site
montrait un HTML 475 630 octets sans relais. La liste exacte des fichiers et le diff de configuration embarquée
sont dans `PRODUCTION_PILOT_REPORT_V0.md`.
Le nom d'archive v0.3D est préparé et les anciennes archives `VOTI_AUDIT_*.zip`
sont explicitement exclues, même si déjà suivies par Git.

## Recette physique et retour arrière

Après Gate C et disponibilité du site : Chromebook crée un sondage textuel
fictif, publie en ligne et partage le lien public. Le téléphone ouvre ce lien,
choisit puis confirme ; aucun compte ni challenge au vote. Vérifier ensemble
verrouillage après premier bulletin, résultats masqués à 4 et disponibles à 5,
fermeture, clé admin export/import séparée et suppression confirmée.
La recette d'images distantes est exclue du pilote gratuit. Tester les images
en local séparément. **Aucune action physique n'est déclarée vérifiée sans
retour de Lu’uma.** Les douze étapes textuelles ont maintenant été confirmées,
y compris les deux liens téléphone NOT_FOUND après suppression.

Contrôle final du 10 octobre 2026 : 0 poll/bulletin/préparation/relations pour le
sondage fictif supprimé, files garbage/préparations expirées vides, D1 90 112
octets, juridiction eu. Cron unique `17 * * * *` et trois exécutions réelles
16:17/17:17/18:17 UTC en succès observées via GraphQL. Aucun nettoyage distant
forcé. Agrégats de la fenêtre 15:00–18:35 UTC : 159 invocations/0 erreur runtime,
1 066 lignes D1 lues/94 écrites, CPU P99 5,608 ms. Pas de mesure exhaustive par
route/charge ni d'estimation mensuelle. Accès souscriptions refusé ; confirmation
Free du dashboard par Lu’uma maintenue, sans upgrade. Replay Turnstile réel et
drainage d'une préparation expirant 24 h non testés en production.

Retour arrière frontend : après autorisation, rebuild local sans relais puis
publication du diff validé ; aucune suppression automatique de D1/Turnstile.
Retour arrière Worker : version précédente si disponible, revue de compatibilité
D1 préalable ; aucune annulation des migrations supposée. Ne jamais supprimer
une ressource ou des données réelles sans accord explicite ciblé.
