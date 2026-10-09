# Décisions du MVP local — Voti

Statut : arbitrages validés par Lu’uma, faisant autorité pour cette phase.
Ces décisions précisent les documents v0. Les références historiques restent conservées.

## 1. Accès et QR

Le prototype collecte uniquement dans le navigateur possédant les données. Il ne propose ni collecte multi-appareils, ni génération de QR. Les QR de vote partagés attendront un premier relais Internet. Moteur et UX locale passent en premier.

## 2. Publication des résultats

`minimumResponses` est toujours un plancher obligatoire, par défaut 5.
`threshold` exige le seuil ; `closed` exige la fermeture ET le seuil.
Les futurs modes `manual` et `date` respecteront également ce plancher.
Fermer à 3 votes avec un seuil de 5 ne publie pas les résultats.

## 3. Identité et confidentialité

Le MVP fonctionne uniquement en mode anonyme/prototype local. Aucun vote nominatif simulé n’est proposé. `named` est réservé à l’avenir. Aucune promesse d’anonymat fort contre le propriétaire de l’appareil ou l’inspection du stockage. Aucun compte ni identité collectée.

## 4. Sources et livraison

Sources JavaScript modulaires, testables et maintenables ; build vers un unique `index.html` autonome contenant HTML, CSS et JavaScript. Aucun CDN ni dépendance réseau à l’exécution.

## 5. Modification et verrouillage

Le fond d’un brouillon ou d’un sondage publié reste modifiable jusqu’au premier bulletin accepté. Ce premier bulletin verrouille atomiquement les propriétés sémantiques. Après verrouillage, seule l’apparence reste modifiable ; la fermeture reste une transition de cycle de vie autorisée.

## 6. Bulletins minimaux

Un bulletin anonyme ne contient aucun horodatage précis, aucune identité ni métadonnée de session. Seuls ses identifiants (`id`, `pollId`, `choiceId`) sont nécessaires au MVP. Un horodatage global de verrouillage peut exister sans liaison identité/bulletin.

## 7. Empreinte sémantique

L’empreinte de verrouillage couvre la définition complète (dont mode et privacy), les règles d’accès et les règles de résultats immuables. Le style est exclu. Utiliser SHA-256 via une primitive standard ; l’empreinte n’est ni une signature ni une protection contre un propriétaire malveillant du stockage.

## 8. Compteur

Le nombre actuel de réponses est masqué par défaut tant que les résultats ne sont pas publiables.

## 9. Import et export

JSON de prototype versionné, distinct du futur `.sondagebox`. Validation complète avant toute écriture. Version inconnue et incohérences refusées explicitement. Aucun remplacement silencieux ni fusion complexe. Les statistiques sont dérivées des bulletins et recalculables.

## 10. Stockage

Un `StorageAdapter` isole le moteur du stockage. `localStorage` est acceptable pour ces petites données sans images. Il ne constitue pas une sauvegarde durable ; export/import constitue la voie de sauvegarde du prototype.

## 11. Stack et exclusions

HTML, CSS, JavaScript moderne modulaire, JSDoc utile, aucun framework UI. Node.js pour les outils, `node:test` pour les tests. esbuild est autorisé comme dépendance de développement pour le bundling. Toute autre dépendance exige une nécessité démontrée.

Ne pas implémenter : Cloudflare, D1, relais, QR, PDF, Android, Capacitor, Room, comptes, groupes, authentification, vote nominatif réel, chiffrement avancé ou synchronisation distribuée. Aucun commit ni push sans demande explicite.
