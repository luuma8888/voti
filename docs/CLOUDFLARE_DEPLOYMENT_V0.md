# Voti — préparation du déploiement Cloudflare

**Aucune ressource distante n'a été créée ou modifiée. Aucune commande de cette
section distante ne doit être exécutée sans instruction explicite de Lu’uma.**
La configuration livrée est locale, avec un database_id factice, bindings non
distants et `workers_dev: false`. Elle ne constitue pas une configuration de production.

## Avant autorisation

1. Valider compte, noms des ressources, domaine du Worker et coûts/quotas attendus.
2. Choisir les juridictions UE, les règles de logs/rétention et les personnes ayant
   accès au tableau de bord/aux données. Ne jamais commiter de token de compte.
3. Valider la perte/transmission des capacités créateur, non couvertes par les
   sauvegardes actuelles. Pas de compte de récupération.
4. Auditer upload, limites de taille/CPU, décodage serveur des images et politique
   anti-abus avant collecte ouverte. Le prototype vérifie structure/hash, pas les pixels serveur.
5. Prévoir suivi du cron/nettoyage, sauvegardes D1/R2 et procédure de restauration.

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
VOTI_RELAY_ID=voti-production VOTI_RELAY_URL=https://URL-WORKER-VALIDEE npm run build
```

Remplacer le placeholder par l'origine validée ; ne pas y mettre `/api/v1`, de
secret, query ou fragment. Les seuls paramètres publics sont relayId et baseUrl.
L'HTML continue d'embarquer JS/CSS/branding ; les sondages distants nécessitent
Internet. Le HTML livré à la fin du lot est volontairement **non configuré**.

## Recette après déploiement — lot ultérieur

Vérifier d'abord un sondage fictif sans données réelles : Chromebook créateur,
téléphone votant, images, premier verrouillage, seuil, fermeture, indisponibilité,
retry avec même action, CORS et absence de cookie/secret dans l'URL. Contrôler le
cron et le nettoyage d'une préparation expirée. Ne pas commencer QR/PDF, comptes
ou synchronisation différée dans cette recette.

Les tests locaux sont décrits dans `CLOUDFLARE_RELAY_V0.md`. Ils ne remplacent pas
une recette Internet réelle, une revue de sécurité ou la validation des coûts.
