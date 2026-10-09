# Voti — Identité visuelle, palettes et thèmes v0.2B.1

## Résumé et périmètre

La livraison ajoute cinq ambiances cohérentes, un sélecteur avec prévisualisations locales, des surfaces mieux différenciées et une hiérarchie des actions plus nette. Le header et la liste conservent leur compacité. Aucun moteur, modèle, format JSON, stockage de sondages, règle de publication ou bulletin n'est modifié.

Documents lus intégralement avant les modifications : `AGENTS.md`, `MVP_SCOPE.md`, `LOCAL_MVP_DECISIONS.md`, `VOTI_UX_V0_2_SPEC.md`, `VOTI_UX_V0_2B_1_SPEC.md`, `CODEX_UX_V0_2A_REPORT.md` et `CODEX_UX_V0_2A_1_REPORT.md`. La spécification v0.2B.1 fait autorité. Le dépôt était propre hormis cette nouvelle spécification non suivie, qui n'a pas été modifiée.

## Cause exacte de l'encadrement perçu rouge

Dans `web/app.js`, `heading()` créait un titre `h1` avec `tabindex="-1"`, puis appelait `node.focus()` dans une microtâche à chaque rendu. Dans `web/styles.css`, la règle générale `:where(...,[tabindex]):focus-visible` appliquait un outline de 3 px à ces titres. Sa couleur fixe était **`#b86c14`**, orange-brun, et non un rouge d'erreur ; le mode sombre utilisait **`#f2b85f`**. Ces couleurs étaient étrangères à la palette active. Le titre étant un bloc large, l'anneau pouvait entourer une grande zone plutôt que son texte.

La pseudo-classe `:focus-visible` dépend des heuristiques du navigateur et du contexte de l'interaction précédente ; transférer le focus par script peut conserver son indication visible, notamment après une interaction clavier. Ce n'était ni un état de validation ni une animation d'erreur. L'encadrement disparaissait lorsque le focus quittait le titre. Aucun minuteur ne le supprimait dans l'application.

Correction :

- Conservation du titre focusable et du transfert de focus, pour annoncer et repérer le nouvel écran.
- Suivi léger de l'origine de l'interaction, par `pointerdown` et `keydown`, sans bloquer ces événements.
- Suppression de l'outline uniquement sur les titres ciblés par navigation non clavier, jamais sur tous les éléments focusables. Le focus clavier du titre reste visible.
- Titres ajustés à leur contenu, avec largeur maximale de 100 % et retour à la ligne conservé.
- Anneau de 3 px en `:focus-visible`, utilisant la couleur du thème actif. `--app-focus` est résolu à la racine : les aperçus des autres palettes ne remplacent pas le focus global.
- Vraies interactions CDP testées : navigation souris sans encadrement du titre, navigation Entrée avec titre focalisé et outline visible ; touche Tab et focus des liens restent testés.

## Fichiers créés

- `web/themes.js` : catalogue des cinq thèmes et normalisation de la préférence.
- `tests/themes.test.js` : sept tests de catalogue, compatibilité, palettes complètes, contrastes et CSS local/focus.
- `docs/CODEX_UX_V0_2B_1_REPORT.md` : présent rapport.

## Fichiers modifiés

- `web/styles.css` : tokens des cinq palettes, surfaces, focus, boutons, badges, lignes, aperçu des thèmes, champs et impression.
- `web/app.js` : origine du focus, page d'apparence globale, sélection/persistance, badge de gestion et clarification du réglage d'accent propre au sondage.
- `web/index.template.html` : thème initial Pop et bouton « Thème ».
- `scripts/browser-test.mjs` : thèmes, persistance, contrastes, quatre largeurs, interactions réelles et captures locales.
- `tests/build.test.js` : neuf modules embarqués au lieu de huit.
- `index.html` : build autonome régénéré.

`shared/`, `web/storage.js`, les fixtures et les tests métier existants restent inchangés. Le contrôle `git diff --name-only -- shared web/storage.js` ne retourne aucun fichier.

## Architecture des thèmes

Les palettes sont centralisées dans `web/styles.css`, avec les mêmes custom properties pour chaque thème : fond général, header, surface principale, surface ponctuelle, texte, texte secondaire, bordures, accent, texte sur accent, couleur secondaire, ambre, pêche, résultat positif, surface secondaire, focus, ombre, couleurs/fonds des trois statuts et danger.

La racine porte `data-theme`. Les composants consomment les tokens ; aucune palette ne se limite à remplacer `accent`. Les options de prévisualisation réutilisent les mêmes tokens CSS, sans reproduire les couleurs en JavaScript. `web/themes.js` ne contient que les identifiants, noms, descriptions et la normalisation.

La clé existante **`voti.theme`** est conservée : `light`, une valeur absente ou inconnue devient `pop` ; `dark` reste Nuit. Les cinq nouvelles valeurs sont persistées immédiatement, sans écriture des sondages. En cas d'impossibilité d'enregistrement, le thème s'applique à la session et un message indique que la préférence ne peut pas être conservée. Aucun changement de StorageAdapter.

Le bouton compact **Thème** du header ouvre `#appearance`, intitulé « L'apparence de Voti ». Chaque option propose nom, description, cinq échantillons, un bouton nommé et `aria-pressed`, ainsi que le texte « Sélectionné ✓ ». Le changement ne reconstruit pas la page : le focus reste sur le bouton choisi.

## Les cinq thèmes

| Thème | Surfaces et structure | Accents |
| --- | --- | --- |
| Voti Pop, défaut | Fond légèrement lavande `#f3eff8`, header violet clair `#e9e2f5`, contenu presque blanc `#fdfbff`, texte bleu nuit `#25334b` | Prune `#684397`, lagon `#137680`, ambre et pêche, résultats vert profond. |
| Nature | Fond organique `#edf3ed`, header sauge `#dcebe2`, contenu ivoire vert `#fbfdf9` | Vert profond `#286449`, turquoise `#196d7b`, terre douce et pêche. |
| Douceur | Fond pastel `#f5f0f6`, header lavande `#ece5f4`, contenu rosé très clair `#fffafb` | Prune douce `#72528e`, bleu tendre renforcé `#486c91`, pêche et vert apaisé. Les textes ne sont pas pastel pâle. |
| Nuit | Fond bleu nuit `#171c2a`, header prune sombre `#29263e`, contenu `#202638`, surfaces `#2a3145` | Lavande lumineuse `#c9aff0`, turquoise `#8bddd7`, ambre doux, texte clair et boutons à texte sombre. |
| Minimal | Fond gris bleu `#edf0f3`, header neutre `#dfe5ec`, contenu `#fafbfc` | Bleu ardoise `#3f536b`, variations sobres, statuts légèrement teintés et toujours nommés. |

Le rouge est réservé aux erreurs et actions dangereuses. Les touches pêche restent douces, sans servir de couleur de focus ou de statut neutre.

## Structure visuelle et hiérarchie

- Header pleine largeur, surface teintée, bordure basse et ombre légère ; hauteur inchangée : 68 px desktop, 56 px mobile.
- Fond général différencié, surface principale claire ou sombre selon le thème, sans grande carte décorative ni hero. Largeur maximale et espacements compacts conservés.
- Sections ponctuelles sur une surface distincte ; options avancées sur fond secondaire ; footer teinté et séparé du contenu.
- Liste compacte conservée : bordure gauche ambre pour Brouillon, turquoise pour Ouvert, prune/bleu pour Fermé ; badges textuels dans chaque cas. Hover et focus interne subtils.
- Création, publication et confirmation restent des actions principales pleines. Résultats disponibles utilisent un fond secondaire affirmé, distinct de Gérer ; Résultats verrouillés restent activables avec leur texte explicite.
- Actions secondaires sur surfaces légères ; actions discrètes sans fond fort ; danger avec texte et bordure dédiés. Aucun changement des routes, critères de disponibilité ou transitions métier.
- Champs délimités par une couleur lisible, placeholders dans le texte secondaire du thème ; cibles tactiles de 44 px conservées.
- Recherche et tri empilés à 360/480 px, navigation « Créer » sur mobile, filtres défilables et repères de pages conservés.
- CSS d'impression maintenu : fond blanc, informations et badges textuels lisibles, outils interactifs masqués.

## Tests et contrastes

Sept nouveaux tests Node vérifient le catalogue et ses identifiants, la clé de préférence et les valeurs historiques, les cinq ensembles complets de tokens, les contrastes et l'absence de CSS distant. Le test de build vérifie toujours l'absence de script/CSS externe et les imports embarqués. Le moteur conserve tous ses tests antérieurs.

Dans Chromium : cinq thèmes et 25 échantillons ; sélection explicite ; changement et persistance de chaque valeur ; absence de mutation du stockage métier ; rechargement `file://` hors ligne conservant Nature ; navigation souris et clavier avec contrôle du focus ; sélecteur mobile accessible et non débordant.

Pour chaque thème, **12 couples de texte** sont vérifiés à **4,5:1 minimum** : texte/surface, texte/contenu, texte secondaire/header, texte secondaire/fond, accent/surface, texte sur action principale, texte sur action résultats, résultat positif/contenu, les trois badges et erreur/fond d'erreur. **Quatre couples de focus** sont vérifiés à **3:1 minimum** : surface, contenu, header, surface secondaire. Soit **80 mesures de contraste**, aussi vérifiées sur les propriétés calculées du navigateur.

| Thème | Minimum texte parmi les 12 couples | Minimum focus parmi les 4 couples |
| --- | ---: | ---: |
| Voti Pop | 5,00:1 | 5,70:1 |
| Nature | 4,85:1 | 5,12:1 |
| Douceur | 4,91:1 | 5,55:1 |
| Nuit | 6,70:1 | 7,67:1 |
| Minimal | 4,84:1 | 5,55:1 |

Valeurs affichées arrondies ; les assertions utilisent les valeurs non arrondies. Les vérifications navigateur couvrent aussi les surfaces distinctes, le focus associé à la palette et les badges textuels. Les cinq thèmes passent à 360, 480, 768 et 1200 px sans débordement horizontal ni augmentation du header. La liste de 20 sondages, les parcours métier, l'import/export, le clavier, l'impression et le smoke HTTP sous `/voti/` restent testés.

## Commandes et résultats exacts

| Commande | Résultat |
| --- | --- |
| `npm test` | Succès, code 0 ; huit unités de fichiers affichées par le reporter dans le harnais sandbox. |
| `node --test --test-reporter=tap tests/*.test.js` hors restrictions du harnais | 84 tests, 84 réussis, 0 échec, 0 ignoré, 0 annulé. |
| `node tests/themes.test.js` | 7 tests réussis, 0 échec. |
| `npm run check` | Succès : 23 fichiers JavaScript. |
| `npm run build` | Succès : `index.html` autonome, neuf modules, 83 353 octets. |
| `npm run test:browser` | Dernier passage : 224 contrôles réussis. |
| `git diff --check` | Succès, aucune erreur d'espacement. |

Le navigateur a été exécuté quatre fois durant le lot : un premier passage à 217 contrôles, puis trois passages réussis à 224 après enrichissement des contrôles. Le dernier utilise la livraison finale. Chromium et le serveur local nécessitent l'autorisation de processus/ports locaux ; cache npm, profils et captures restent dans les répertoires ignorés du dépôt. Aucune dépendance ajoutée, aucune ressource réseau à l'exécution hors chargement initial du HTML servi localement.

Dix captures sont générées dans `.browser-tests/ux-v0-2b-1-{theme}-{360|1200}.png`, ainsi qu'une capture du sélecteur. Inspection visuelle réalisée sur Voti Pop desktop, Nuit mobile et sélecteur mobile. Ces fichiers sont des artefacts de test locaux, pas des images ajoutées à l'application.

## Écarts et limites

Aucun écart au périmètre fonctionnel. Les cinq thèmes concernent l'apparence globale de l'application. Les styles historiques `mint`, `lavender`, `peach` restent des **accents de sondage**, désormais nommés ainsi dans leur formulaire. Ils réutilisent les couleurs fonctionnelles du thème courant. Les remplacer par cinq identifiants nouveaux dans les sondages aurait modifié le modèle et la validation/import, contrairement à la demande de préserver le moteur. Aucun nouveau format ni migration des données métier n'est introduit.

Pas d'éditeur de thèmes, d'image, d'AssetAdapter, d'IndexedDB ni de fonctionnalité reportée. Aucun commit, push ou déploiement.

Les contrôles de contraste ne sont pas une certification WCAG exhaustive : toutes les combinaisons hover/disabled et tous les comportements des technologies d'assistance ne sont pas audités. Les règles de focus dépendent encore des heuristiques natives pour les contrôles ordinaires ; la navigation des titres est explicitement contextualisée et testée dans Chromium. Le premier rendu utilise Pop avant lecture de la préférence, ce qui peut provoquer un bref changement de palette sur un appareil lent. La préférence ne synchronise pas les onglets déjà ouverts ; elle est relue au chargement.

## Validation humaine

Aucune décision métier manquante ne bloque le lot. À valider avant les images : identité Pop et niveau de couleur, compréhension de la distinction entre thème de Voti et accent du sondage, poids des actions Résultats/Gérer, lisibilité des cinq thèmes sur téléphone et Chromebook réels. Tester Safari/Firefox, lecteurs d'écran, zoom et agrandissement du texte, navigation clavier et rendu imprimé réel. Le responsive automatisé est une émulation Chromium, pas un essai physique multi-navigateurs.

## Recommandations pour v0.2B.2

Définir séparément un contrat AssetAdapter avant d'ajouter des images : identifiants/références stables, limites de dimensions et taille, types acceptés, traitement des entrées malformées, redimensionnement/compression et erreurs de quota. Prévoir IndexedDB côté Web sans blobs/base64 massifs dans localStorage, et préparer un adaptateur remplaçable pour les futurs stockages. Définir l'export/import d'assets et sa validation complète avant écriture, sans remplacement silencieux, avec récupération en cas d'échec.

Conserver le texte obligatoire des choix, les résultats conditionnels et la séparation du moteur/DOM. Les images ne doivent jamais modifier le sens du sondage après verrouillage sans arbitrage explicite. Fixer humainement leur rôle et les propriétés visuelles modifiables avant d'étendre le modèle. Préserver la liste compacte avec des vignettes bornées et tester les assets dans les cinq thèmes, au clavier et à 360 px. Ce rapport ne met en œuvre aucun de ces travaux.
