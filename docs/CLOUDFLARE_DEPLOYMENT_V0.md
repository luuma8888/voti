# Voti — préparation du déploiement Cloudflare

> **Mise à jour v0.3D :** le Gate A a permis de créer D1 UE, le sous-domaine
> workers.dev et Turnstile. Lu’uma a validé un pilote **Workers Free uniquement,
> sans R2 ni images distantes**. Les exemples R2 ci-dessous sont historiques et
> **ne doivent pas être exécutés pour ce pilote**. Gate B autorisé : migrations
> D1 et Worker déployés ; secret installé, bug fetch workerd corrigé,
> jeton factice refusé en 403. HTML connecté construit ; challenge humain réel
> et recette restant à terminer.
> Gate C autorisé par Lu’uma ; publication Pages en cours, pilote non validé.
> Voir l'état exact et les
> instructions prioritaires dans [PRODUCTION_DEPLOYMENT_V0.md](PRODUCTION_DEPLOYMENT_V0.md).

**État historique v0.3C : aucune ressource distante n'avait été créée ou modifiée. Aucune commande de cette
section distante ne doit être exécutée sans instruction explicite de Lu’uma.**
La configuration livrée est locale, avec un database_id factice, bindings non
distants et `workers_dev: false`. Elle ne constitue pas une configuration de production.

## Avant autorisation

1. Valider compte, noms des ressources, domaine du Worker et coûts/quotas attendus.
2. Choisir les juridictions UE, les règles de logs/rétention et les personnes ayant
   accès au tableau de bord/aux données. Ne jamais commiter de token de compte.
3. Valider l'UX d'export/import explicite du fichier SECRET d'administration ;
   il reste hors backup général. Pas de compte de récupération.
4. Auditer upload et limites CPU/coûts. v0.3C renforce structure/hash/CRC PNG,
   inflation bornée et scanlines ; aucun décodage complet WebP serveur.
5. Prévoir suivi du cron/nettoyage, sauvegardes D1/R2 et procédure de restauration.
6. Autoriser explicitement un widget Turnstile de production, ses hostnames,
   sa site key publique et son secret Worker. Ne pas utiliser de clés factices.
7. Valider les quotas collectifs (création 30/min/PoP, public/admin 120/min,
   assets 600/min/image/PoP), alertes de coût et pilote contrôlé. Ce ne sont pas
   des quotas financiers mondiaux exacts.

## Juridictions recommandées

Pour D1, choisir la juridiction `eu`, plutôt qu'un simple indice de localisation.
Elle contraint le stockage et l'exécution de cette base dans l'UE selon les
garanties du fournisseur. [Localisation D1](https://developers.cloudflare.com/d1/configuration/data-location/).

Pour R2, créer le bucket en juridiction `eu` et renseigner aussi cette juridiction
dans le binding. Garder tout accès public/R2.dev désactivé.
[Juridictions R2](https://developers.cloudflare.com/r2/reference/data-location/).

Ces choix ne signifient **pas** que tous les échanges HTTP, traitements Worker,
terminaisons réseau et journaux du fournisseur restent exclusivement dans l'UE.
Ne pas présenter la juridiction du stockage comme une garantie d'anonymat réseau.

## Commandes futures — exemples NON exécutés

Après instruction explicite et vérification des noms :

```sh
npx wrangler d1 create voti-production --jurisdiction eu
npx wrangler r2 bucket create voti-production-assets --jurisdiction eu
```

Créer alors un fichier de configuration de production distinct : véritable D1
database_id, nom du bucket et juridiction, relayId définitif stable, domaine/route,
namespace de rate limiting propre. Ne pas réutiliser les données locales de tests.
La capacité est liée au relayId : ne pas changer cet identifiant après publication.

Configurer trois bindings Rate Limiting distincts (LIMITER, CREATION_LIMITER,
ASSET_LIMITER) avec namespaces dédiés. Conserver le cron et les deux migrations.
TURNSTILE_MODE doit être `siteverify`, jamais `local-test`. Configurer
TURNSTILE_HOSTNAMES exactement (`luuma8888.github.io` pour ce site), et le widget
autorisé uniquement sur les hôtes validés ; action attendue `voti-publication`.
Ne pas recopier les overrides CLI de développement.

Après autorisation explicite distincte, exemple documentaire de dépôt du secret :

```sh
npx wrangler secret put TURNSTILE_SECRET --config relay/cloudflare/wrangler.production.jsonc
```

Saisie confidentielle ; aucune valeur dans Git, variables publiques du build,
historique de commande ou rapport. Cette commande **n'a pas été exécutée**.
Le Worker sans secret/hostname conforme refuse les nouvelles préparations.

L'origine autorisée du site est `https://luuma8888.github.io`, sans sous-chemin.
L'URL du site est dans `/voti/`, mais CORS compare une origine et non un chemin.
Retirer les origines localhost en production si elles ne sont pas nécessaires.
Conserver HTTPS, pas de cookies, pas d'URL R2 publique ni d'observabilité du corps des requêtes.

Après revue de cette configuration et autorisation séparée :

```sh
npx wrangler d1 migrations apply voti-production --remote --config relay/cloudflare/wrangler.production.jsonc
npx wrangler deploy --config relay/cloudflare/wrangler.production.jsonc
```

Ces commandes sont des instructions documentaires : le fichier production n'est
pas généré dans ce lot et **aucun deploy/migration distante n'a été lancé**.

## Configurer le HTML du site

Après connaissance de l'URL HTTPS réellement déployée, construire avec :

```sh
VOTI_RELAY_ID=voti-production VOTI_RELAY_URL=https://URL-WORKER-VALIDEE VOTI_TURNSTILE_SITE_KEY=SITE-KEY-PUBLIQUE-VALIDEE npm run build
```

Remplacer le placeholder par l'origine validée ; ne pas y mettre `/api/v1`, de
secret, query ou fragment. Paramètres publics : relayId, baseUrl, site key et
turnstileMode=siteverify ; aucun secret Worker n'est lu par le build.
L'HTML continue d'embarquer JS/CSS/branding ; les sondages distants nécessitent
Internet. Le HTML livré à la fin du lot est volontairement **non configuré**.

## Recette après déploiement — lot ultérieur

Vérifier d'abord un sondage fictif sans données réelles : Chromebook créateur,
téléphone votant, images, premier verrouillage, seuil, fermeture, indisponibilité,
retry avec même action, CORS et absence de cookie/secret dans l'URL. Contrôler le
cron et le nettoyage d'une préparation expirée. Ne pas commencer QR/PDF, comptes
ou synchronisation différée dans cette recette.

Ajouter recette Turnstile réelle (création seulement), absence de challenge au
vote, indisponibilité du challenge, export de clé puis import dans un autre profil,
refus de mauvaise clé et confirmation de conflit, suppression, NOT_FOUND sur
toutes les vues, drainage du garbage et panne/reprise. Inspecter quotas et coûts
d'une arrivée simultanée normale, et l'état du scheduled/backlog. Le cache navigateur
des images peut rester frais 5 minutes ; copies déjà téléchargées non révocables.

Politique actée : préparation 24 h ; publié/fermé sans expiration automatique ;
suppression D1 immédiate et R2 éventuelle rejouable. Vérifier séparément les journaux
et copies opérateur Cloudflare (rétention non garantie ici), juridictions,
Time Travel/sauvegardes et procédure d'effacement/restauration.

L'état livré reste sans relais. Localement, worker:local active explicitement le
simulateur Turnstile offline ; construire/dev avec VOTI_TURNSTILE_MODE=local-test
et URL loopback seulement. Les tests ne valident pas un widget réellement provisionné.

Les tests locaux sont décrits dans `CLOUDFLARE_RELAY_V0.md`. Ils ne remplacent pas
une recette Internet réelle, une revue de sécurité ou la validation des coûts.
