# Contrôle du pack documentaire Voti

> Le contrôle initial ci-dessous décrit l’export du 26 octobre.
> L’état courant après polish est consigné dans la section finale du 27 octobre.

Édition du 26 octobre 2026. Application de référence :
`601aeb04c171fae6b4f4928d694f9ce8c4ddf190`.

## Livrables contrôlés

| Document | Pages A4 | Captures | SHA-256 du PDF |
|---|---:|---:|---|
| Démarrage rapide | 4 | 4 | `212e6cba064fa62c489db355caf92cb611a625e4b9190d43f06f79649c1633e6` |
| Guide complet | 21 | 13 | `cb84094c3f9278e1a212529a46f0a23a61c3264a639d2c87be33caa2285b9f9f` |
| Aide & dépannage | 3 | 0 | `ca9561ebe94ed200fcc5b789b194a54b3a9f181d5522959a0b68f6ee2c0258f6` |

Le guide complet dépasse l'estimation de 14–18 pages pour conserver les
36 procédures et une taille de texte confortable. Les limites de D1 et D3 sont
respectées. La page 4 de D1 est une fiche Participant autonome.

## Contrôles effectués

- **28 pages inspectées individuellement** après rendu Poppler. Aucun
  débordement, texte coupé, capture déformée, légende orpheline ou page vide
  accidentelle relevé. Les rendus de travail sont ignorés dans
  `.browser-tests/guide-pdf/`.
- Simulation A4, dont la fiche Participant à 150 dpi ; pas d'impression physique.
  Lecture écran contrôlée. Simulation de lecture mobile à 390 px et avec zoom :
  un PDF A4 demande du zoom et du déplacement, sans mise en page réactive.
  Aucun test sur appareil physique n'est revendiqué.
- S1, S2, S3 et S4 inspectés dans les pages PDF rendues en niveaux de gris :
  texte, contours et flèches restent lisibles sans dépendre de la couleur.
- Corps éditorial de 12 pt pour D1 et 11,5 pt pour D2/D3 ; titres, légendes et
  encadrés cohérents. Polices intégrées, titres de document et langue française
  renseignés ; texte sélectionnable. Aucune certification PDF/UA revendiquée.
- `python3 docs/guides/check_guides.py` : **PASS**. Format A4, marges de texte,
  nombre de captures par page, destinations, numérotation et présence des
  36 procédures contrôlés. D2 contient 37 liens internes et un sommaire cliquable.
  Les 36 renvois relatifs entre PDF sont résolus dans le pack ; leur ouverture
  reste dépendante des autorisations du lecteur PDF. Conserver les PDF ensemble.
- Les empreintes des PDF correspondent à `build-manifest.json`, qui référence
  aussi les textes sources et les images réellement intégrées.

## Images et confidentialité

La banque existante est réutilisée. Trois recadrages documentaires sont générés
sans nouvelle prise de vue ; leurs coordonnées sont consignées dans `README.md`.
Les 14 PNG distincts intégrés ont été inspectés : données fictives, aucun fichier
d'accès, credential, token ou barre d'adresse sensible visible. La Carte garde
son cache opaque « Exemple — QR masqué ». Un contrôle PNG avec UPNG et jsQR
sur ces 14 fichiers n'a décodé **aucun contenu QR**. Ce contrôle complète
l'inspection visuelle ; il ne remplace pas la vérification des masques.

C39/C40 ne sont pas disponibles. La procédure PWA textuelle est conservée sans
fabriquer de vues de navigateur. Ces illustrations restent facultatives.

## Fidélité et périmètre

Les termes Administrateur, Créateur et Participant restent des rôles fonctionnels,
sans association à un âge ou un contexte. Le fil rouge est fictif : La Cabane Voti,
Soleil/Lune, Soleil A/B/C et Parc/Cinéma/Jeux. Les règles et procédures sources
sont conservées ; seules quelques formulations et notes de montage ont été
raccourcies ou actualisées. Les conséquences de remplacement, révocation,
suppression et archivage restent distinguées. Aucun support ou mécanisme de
récupération supplémentaire n'est promis.

Aucun code applicatif, dépendance applicative, tag de baseline ou déploiement
n'a été modifié. Les 813 fichiers protégés du relevé initial (hors les trois
sources éditoriales autorisées) ont les mêmes empreintes, y compris les captures
originales, le plan et les rapports historiques préexistants. Les suites
applicatives complètes ne sont pas relancées pour ce montage documentaire.
Aucun commit ni push n'est effectué.

## Verdict

**DOCUMENTATION PACK READY** — aucun obstacle identifié à une diffusion du pack.
Les sources et la procédure de régénération sont conservées avec les livrables.

## Polish ciblé D1 / D3 — 27 octobre 2026

### Comparaison avant / après

| Critère | Avant | Après |
|---|---|---|
| D1 | 4 pages, titres et paragraphes en flux continu | 4 pages ; organisation en zone pastel, trois lignes de rôles, étapes numérotées, Créer / Publier / Suivre, rappels regroupés |
| D3 | 3 pages ; Vérifie / À faire / Si ça bloque mêlés dans les paragraphes | 4 pages ; 20 fiches entières, familles en bandeaux, trois niveaux séparés, action signalée par un retrait et un trait |
| Corps principal | D1 12 pt ; D3 11,5 pt | D1 et D3 12 pt ; renvois secondaires D3 11,5 pt |
| Figures D1 | Proches du flux de texte | Marges dédiées autour des quatre captures, légendes séparées ; masques inchangés |
| Libellés | « Participant suivant » pouvait se lire comme un sujet | « choisis “Participant suivant” » ; “Autre choix” et “Terminer” explicités également |

Les quatre pages finales de chacun des deux PDF ont été rendues avec Poppler et
inspectées individuellement. La comparaison visuelle avant/après confirme des
zones repérables avant lecture, une meilleure séparation des procédures et une
hiérarchie plus nette. Aucun débordement, texte coupé, légende orpheline ou page
quasi vide accidentelle relevé. D3 conserve une page finale plus remplie ; chaque
fiche y reste entière et l’aide est séparée dans son propre encadré.

Rendus en niveaux de gris inspectés : page 1 de D1 et page 2 de D3. Titres,
contours, numéros et action “À faire” restent identifiables sans couleur.
Simulation d’impression A4 uniquement ; aucune impression physique revendiquée.

Contrôles documentaires : PASS (A4, texte sélectionnable, marges, liens,
numérotation et 20 fiches avec leurs trois niveaux). Les textes et liens de D3
sont comparés à sa source ; aucune instruction ou destination n’est perdue.
Les quatre captures D1 et tous les fichiers d’images d’origine sont conservés.
Aucune nouvelle capture ou ressource distante n’est ajoutée.

D2 n’est pas réexporté : son PDF, son HTML et sa source restent identiques octet
pour octet. Les changements CSS sont limités aux guides courts. Aucun code
applicatif, donnée de production, tag de baseline ou rapport préexistant n’est
modifié. Aucun commit, push ou déploiement.

### Empreintes courantes

- `VOTI_DEMARRAGE_RAPIDE.pdf` : 4 pages, 329164 octets ; SHA-256 `4f25dc56214594356d727e67bf875cb05b24ad8e206ae8fd7fc0e1024ad2b692`.
- `VOTI_GUIDE.pdf` : 21 pages, 860659 octets ; SHA-256 `cb84094c3f9278e1a212529a46f0a23a61c3264a639d2c87be33caa2285b9f9f`.
- `VOTI_AIDE_DEPANNAGE.pdf` : 4 pages, 53398 octets ; SHA-256 `e1112ef7812bcc22757ff74d611189cd4b0a4d082e023513044e329a276873f5`.

**SHORT GUIDES VISUAL POLISH READY**

## Seconde passe — composition visuelle, 27 octobre 2026

**État courant : D1 4 pages, D2 21 pages inchangées, D3 5 pages.**

Les neuf pages des deux nouveaux exports ont été inspectées après rendu Poppler.
Les planches `compare-d1-25.png` et `compare-d3-25.png`, dans la banque privée
`.browser-tests/short-guides-redesign/`, montrent les mêmes pages avant/après à
24 dpi, soit environ 25 % d’un affichage A4 à 96 dpi.

### Critère de composition

- **Différence visible à 25 % : oui.** D1 distingue une page d’organisation avec
  cartes, une page de préparation numérotée, trois phases de gestion et un
  parcours Participant avec les images intégrées aux instructions.
- **Structure identifiable sans lire : oui.** Dans D3, on compte les unités de
  dépannage : 3, 5, 5, 4 et 3 fiches selon la page. L’index est distinct, la fiche
  Résultats plus marquée et la dernière page se termine par un bloc d’aide.
- À taille normale : texte principal 12 pt, étiquettes compactes et légendes
  secondaires ; captures lisibles. Aucun chevauchement, texte coupé, fiche
  scindée, capture déformée ou élément hors marges relevé. Les repères et la
  Carte de la page 2 ne sont plus noyés dans le même flux de paragraphes.
- Niveaux de gris inspectés : page 1 de D1 et page 5 de D3 ; les titres,
  étiquettes, cadres et numéros ne dépendent pas uniquement de la couleur.
  Simulation A4, sans revendication d’impression physique.

### Fidélité et contrôles

`python3 docs/guides/check_guides.py` : PASS. Les 20 symptômes gardent leur contenu
et leurs liens ; les libellés sont raccourcis à “Si ça bloque” selon la demande.
Les cinq conséquences de l’encadré sensible sont explicitement contrôlées.
La navigation interne, les cinq consignes finales, les trois phases Participant,
les deux états, les quatre étapes de préparation, le format A4, les marges et
le texte sélectionnable sont vérifiés.

Les Markdown D1/D2/D3, les images originales, le code applicatif et les fichiers
historiques préexistants n’ont pas changé. D2 n’est pas réexporté : PDF et HTML
identiques, préfixe CSS commun identique et nouveaux styles limités à `.quick`
et `.help`. Aucun commit, push ou déploiement.

### Empreintes de cette seconde passe

- `VOTI_DEMARRAGE_RAPIDE.pdf` : 4 pages ; SHA-256 `0ea1eb6392cb44b0e6e84278b0ec2b1511c56a89e95143f5ca7918c6d0e9c329`.
- `VOTI_GUIDE.pdf` : 21 pages ; SHA-256 `cb84094c3f9278e1a212529a46f0a23a61c3264a639d2c87be33caa2285b9f9f`.
- `VOTI_AIDE_DEPANNAGE.pdf` : 5 pages ; SHA-256 `c1008e00397c34e20c5ed2588a89f69f211ac4939c386ca30aaac095d7393315`.

**SHORT GUIDES VISUAL REDESIGN READY**
