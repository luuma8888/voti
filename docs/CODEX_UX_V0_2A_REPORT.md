# Voti — Rapport UX v0.2A

Date : 9 octobre 2026. Statut : livré, contrôles automatisés réussis ; validation humaine à réaliser.
Autorité du lot : `VOTI_UX_V0_2_SPEC.md`, avec maintien des décisions du MVP local.

## Résumé UX

L'accueil présente désormais une liste compacte de sondages, avec recherche, filtres,
tri, états explicites et accès direct aux résultats. Le grand titre d'invitation est
supprimé. Le header identifie Voti sans hero, avec la signature discrète sur grand écran.
Les sauvegardes sont déplacées dans une page dédiée. Les règles métier et le stockage
existant sont conservés ; aucune nouvelle dépendance ou fonctionnalité hors périmètre.

## Fichiers créés

- `web/poll-library.js` : projection d'affichage, recherche, filtres et tri indépendants du DOM.
- `tests/poll-library.test.js` : 13 tests de la liste et des actions, avec 20 et 500 sondages.
- `docs/CODEX_UX_V0_2A_REPORT.md` : présent rapport.

## Fichiers modifiés

- `web/app.js` : accueil, actions contextuelles, page Sauvegarde, navigation active,
  repères de page, annonce des opérations et statut sur la page résultats.
- `web/index.template.html` : header compact, navigation principale, lien d'évitement,
  zone d'annonce et informations locales en pied de page repliable.
- `web/styles.css` : présentation compacte, liste, badges, filtres, barre mobile,
  accessibilité, responsive et conservation de jour/nuit et du CSS d'impression.
- `index.html` : livraison autonome régénérée depuis les sources.
- `tests/fixtures.js` : génération de collections fictives à plusieurs statuts.
- `tests/build.test.js` : nombre de modules embarqués adapté de 7 à 8.
- `scripts/browser-test.mjs` : parcours adaptés à la nouvelle navigation et contrôles UX.
- `scripts/browser-navigation.mjs` : le signal d'initialisation attend la liste de
  sondages plutôt que le champ d'import déplacé vers Sauvegarde ; la synchronisation
  par document/loader CDP est conservée.
- `README.md` : description de l'accueil et emplacement actuel des sauvegardes.

Le fichier `VOTI_UX_V0_2_SPEC.md` fourni par Lu’uma est conservé tel quel.
Les documents et rapports précédents ne sont pas réécrits. Aucun fichier de `shared/`
ni `web/storage.js` n'est modifié : moteur, publication, validation, sérialisation,
empreinte, modèle, StorageAdapter et clés localStorage restent identiques.

## Changements visuels

- Header mesuré : 68 px sur ordinateur, 56 px à 360 px ; dans les plages de la spécification.
- Identité Voti et petite marque typographique, sans image ni ressource externe.
- Signature « Choisir ensemble, simplement. » discrète, masquée sur petit écran.
- Titre « Mes sondages » et résumé court, sans carte décorative ni grand espace réservé.
- Liste principale sur une colonne, lignes arrondies légères, plutôt qu'une grille de cartes.
- Sur ordinateur, actions à droite ; sur mobile, actions sous les informations.
- Question, badge textuel, nombre de choix, date de création et état des résultats.
- Nombre de réponses uniquement lorsque la projection métier l'autorise, masqué par défaut
  pour les résultats verrouillés. Le résumé compte des sondages, pas des bulletins cachés.
- Palette claire chaleureuse et mode nuit conservé ; typographies système uniquement.
- Réglages d'apparence existants conservés ; aucun thème riche ajouté dans ce lot.
- Deux captures locales vérifiées visuellement : `.browser-tests/ux-v0-2a-desktop.png`
  et `.browser-tests/ux-v0-2a-mobile.png`, ignorées par Git et contenant des données fictives.

## Nouvelle navigation

Navigation principale : **Accueil · Nouveau sondage · Sauvegarde**.
Sur ordinateur, elle figure dans le header. Sur mobile, une barre inférieure fixe
préserve son accès, avec l'espace nécessaire pour ne pas recouvrir la fin du contenu.
La création ne dépend pas d'un bouton desktop masqué sur mobile.

La page active est indiquée par `aria-current="page"`, un traitement visuel et un
repère textuel : Gestion, Vote, Résultats, Modification, Apparence, etc.
Le titre du document suit la page. Les routes de sondage conservent leurs UUID et
fragments, compatibles avec `/voti/`. La nouvelle route est `#backup`.

Un lien « Aller au contenu » permet de rejoindre le contenu au clavier sans changer
la route. Le focus rejoint le titre à chaque navigation ; recherche et filtres ne
recréent pas l'écran entier et n'arrachent pas le focus pendant la saisie.

## Recherche, filtres et tri

Recherche locale sur question, description et libellés des choix. Elle ignore casse
et accents ; espaces multiples et espaces aux extrémités sont normalisés. La recherche
porte sur la chaîne saisie, sans moteur distant ni recherche floue.

Filtres : Tous, Brouillons, Ouverts, Fermés, Résultats disponibles. Les boutons exposent
leur sélection avec `aria-pressed`. Leur rangée défile horizontalement sur petit écran,
sans faire déborder la page entière.

Tri : Plus récents (défaut), Plus anciens et A–Z avec comparaison française et numérique.
La date utilisée est `createdAt`, sans ajouter un champ de dernière modification.
En cas d'égalité, l'UUID départage de manière déterministe.

Recherche, filtre et tri se combinent. Ils sont conservés en mémoire durant la navigation
locale, puis reviennent aux défauts au rechargement. Aucun changement du stockage métier.
Un compteur annonce les sondages affichés et un état vide permet de réinitialiser la
recherche et le filtre sans supprimer de données.

Pour calculer les états, les bulletins sont regroupés une seule fois par sondage.
La projection réutilise `getResults` du moteur pour chaque groupe ; elle ne parcourt
pas toute la liste des bulletins pour chaque sondage. Les statistiques cachées ne
servent pas à décider de la publication.

## Résultats et actions depuis l'accueil

| État | Actions |
|---|---|
| Brouillon | Modifier, Publier |
| Ouvert | Voter, Résultats ou Résultats 🔒, Gérer |
| Fermé avec résultats disponibles | Résultats (action principale), Gérer |
| Fermé sous les conditions de publication | Résultats 🔒, Gérer |

La disponibilité des résultats est distincte du statut du sondage. Une fermeture
sous le seuil ne publie rien. Les liens Résultats rejoignent directement la page
correspondante, avec son statut, sa distribution ou l'explication de son verrouillage.
Les liens verrouillés restent activables, avec un nom accessible explicite.

Publier depuis la liste appelle la même opération métier que depuis Gestion. La
projection et les critères actifs sont recalculés après sauvegarde. Modifier rejoint
le parcours d'édition existant. Aucun simple chargement ou filtre ne crée de bulletin.

## Sauvegarde & transfert

Page secondaire accessible depuis la navigation, retirée de la liste courante.
Deux actions : **Exporter une sauvegarde** et **Importer une sauvegarde**.

L'export relit et valide le stockage actuel puis prépare `voti-sauvegarde.json`.
Le message demande de vérifier l'enregistrement du fichier : il ne prétend pas suivre
une sauvegarde effectivement conservée, et aucune date de dernier export n'est inventée.

Le bouton Importer ouvre le choix de fichier. La validation exhaustive, la limite
de taille, le refus de version inconnue et l'exigence d'un espace vide sont conservés.
Aucune fusion ni remplacement. Une confirmation indique la restauration réussie.
Les informations sur le caractère temporaire du stockage et la sensibilité des bulletins
restent présentes, avec un vocabulaire simple.

Le JSON n'est plus une information de l'accueil. « Options avancées », fermé par défaut,
charge à la demande une consultation technique en lecture seule. Les données sont
affectées à `textarea.value`, sans interprétation HTML. Le panneau précise qu'elles
incluent les bulletins même lorsque les résultats ne sont pas publiables.

## Tests ajoutés et adaptés

Les 13 nouveaux tests Node couvrent : collection valide de 20 sondages ; trois statuts ;
recherche sans accents, par description et choix ; absence de correspondance ; tous
les filtres ; combinaison recherche/filtre ; trois tris ; égalités déterministes ;
actions selon statut ; accès direct aux résultats fermés ; compteur masqué sous seuil ;
absence de mutation ; projection et recherche sur 500 sondages.

La fixture de 20 sondages contient initialement 4 brouillons, 8 ouverts, 8 fermés,
8 résultats disponibles et 12 verrouillés. Le test de publication transforme ensuite
un brouillon en ouvert : les captures montrent donc 3 brouillons et 9 ouverts, toujours
20 sondages et 8 résultats disponibles. Les fixtures ne sont jamais ajoutées automatiquement
au stockage de l'utilisateur.

Le parcours Chromium existant conserve ses assertions métier, d'import et de sécurité.
Les sélecteurs et déplacements sont adaptés à la page Sauvegarde et à la nouvelle
création, puis complétés par les essais de recherche/filtres/tri/actions sur 20 sondages,
accès direct disponible et verrouillé, publication depuis la liste et lien d'évitement.

Les contrôles supplémentaires vérifient les tailles de header, l'absence de débordement
à 360 px, les 20 lignes présentes sur mobile, la navigation inférieure et les cibles
tactiles de 44 px minimum. Une vraie touche Tab est envoyée à Chromium pour contrôler
la progression du focus et l'outline visible. Six rapports de contraste de texte sont
calculés (trois couples dans chacun des modes jour et nuit), tous au moins égaux à 4,5:1.

Les ouvertures `file://` hors connexion et le smoke HTTP sur `/voti/` sont maintenus,
avec attente CDP du bon loader puis de la liste initialisée.

## Résultats exacts des vérifications

| Commande | Résultat final |
|---|---|
| `npm test` | Succès : 77 tests (64 existants + 13 nouveaux), aucun échec |
| `node tests/poll-library.test.js` | 13 tests réussis, 0 échec, 0 ignoré, 0 TODO |
| `npm run check` | Succès : 21 fichiers JavaScript |
| `npm run build` | Succès : `index.html` autonome, 74 214 octets, 8 modules embarqués |
| `npm run test:browser` | Succès : 72 contrôles, dont liste 20 sondages, clavier, contrastes, 360 px, offline et `/voti/` |
| `git diff --check` | Succès : aucune erreur d'espacement |

Le reporter Node dans cet environnement représente les sept fichiers de tests.
Le nouveau fichier a également été exécuté directement pour confirmer ses 13 cas.
Les 64 tests existants sont conservés ; l'assertion du build et le repère d'initialisation
du harnais sont adaptés au module et au parcours supplémentaires.

Une première exécution Chromium a validé 65 contrôles ; après ajout de la vérification
clavier, des six contrastes et ajustement du champ de tri mobile, le scénario final
a validé les 72 contrôles ci-dessus. Les captures finales ont été inspectées visuellement.

## Écarts par rapport à la spécification

Aucun écart fonctionnel volontaire au périmètre v0.2A. La disposition mobile choisie
est une barre inférieure simple, option autorisée par la spécification. La consultation
JSON avancée est proposée, sans éditeur ni import par collage. Aucun suivi de dernier
export n'est ajouté. Pagination et virtualisation restent différées comme prévu.

Le moteur, les seuils, le verrouillage, l'empreinte et le format JSON ne sont pas modifiés.
Aucune dépendance ajoutée, aucun CDN, aucune police ou ressource distante. Pas d'image,
AssetAdapter, IndexedDB, QR, PDF, relais, compte, groupe, Android ou Capacitor.
Aucun commit ni push et aucun déploiement GitHub Pages.

## Limites restantes et validation humaine

- Les 500 sondages sont vérifiés sur la projection Node ; le navigateur est testé avec
  20 sondages. Pas de promesse de performance mesurée sur un téléphone ancien avec 500 lignes.
- Toutes les lignes sont rendues, sans pagination ni virtualisation ; les limites du
  stockage local et les garanties réduites du prototype restent inchangées.
- Le contraste automatisé couvre la palette de texte principale, pas un audit complet
  WCAG de tous les éléments ou états.
- Chromium mobile est une émulation à 360 px ; Safari, Firefox, Chromebook réel,
  lecteur d'écran et appareils physiques ne sont pas testés dans ce lot.
- L'enregistrement réel et la conservation d'un téléchargement restent à vérifier
  humainement ; aucune fausse garantie n'est affichée.
- Le port localhost 4173 doit être libre pour le smoke ; profils Chromium et cache npm
  restent dans le dépôt. Les captures et profils fictifs sont ignorés par Git.

Aucun arbitrage métier manquant ne bloque cette livraison. À valider humainement :
lisibilité du header et des lignes, compréhension des deux états, repérage du bouton
Résultats, navigation mobile/clavier, recherche sur les mots utilisés par les jeunes,
et export/restauration réelle depuis la section Sauvegarde. Tester le site public sur
téléphone attend une mission distincte de publication ; ce lot ne déploie rien.

## Recommandations pour v0.2B

Valider cette refonte sur les appareils cibles avant de lui ajouter des images.
Concevoir ensuite le contrat AssetAdapter, les limites de taille, le redimensionnement,
le stockage adapté et l'export/import des assets avant tout ajout d'images. Garder
le texte obligatoire pour chaque choix. Définir quelques thèmes cohérents à partir
de cette base, sans police distante ni studio graphique complexe.

Conserver les tests métier, les projections de disponibilité et le contrôle du
masquage des compteurs lors de ces extensions. Évaluer une pagination seulement si
les essais réels sur de grandes collections en montrent le besoin.
