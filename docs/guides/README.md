# Guides distribuables Voti

Édition du 26 octobre 2026, application documentée au commit
`601aeb04c171fae6b4f4928d694f9ce8c4ddf190`. La baseline pilote n’est pas modifiée.

## Lire ou transmettre

Conserver les trois PDF dans le même dossier pour utiliser les renvois entre eux :

- `VOTI_DEMARRAGE_RAPIDE.pdf` : démarrer ; la page 4 s’imprime seule pour un Participant.
- `VOTI_GUIDE.pdf` : procédures et règles de référence.
- `VOTI_AIDE_DEPANNAGE.pdf` : retrouver une action sûre par symptôme.

Le guide complet privilégie la lisibilité et la conservation des procédures ; son
volume dépasse l’estimation initiale de 14–18 pages. D1 conserve quatre pages et
D3 cinq pages après la seconde passe de composition du 27 octobre 2026. Le nombre exact figure dans `build-manifest.json`.

Les liens internes et signets permettent la navigation. Les renvois entre PDF
utilisent des destinations relatives ; leur ouverture dépend du lecteur et peut
demander son autorisation. Sur téléphone, utiliser le zoom pour lire un A4 :
les fichiers ne prétendent pas fournir une mise en page réactive ou un mode reflow.

## Sources et nouvel export

Sources éditoriales : `../VOTI_DEMARRAGE_RAPIDE.md`, `../VOTI_GUIDE.md`,
`../VOTI_AIDE_DEPANNAGE.md`. `../VOTI_GUIDE_KIT_PLAN.md` reste le plan de référence.
Les HTML générés, `guides.css`, `build_guides.py`, `diagrams/S1.svg` à `S4.svg`,
`short_layout.py` et les PNG de `../guide-assets/` permettent de maintenir la mise en page.

Depuis la racine du dépôt :

```sh
python3 docs/guides/build_guides.py
python3 docs/guides/check_guides.py
```

Outils utilisés localement : Pandoc, WeasyPrint, Python avec lxml, Pillow et pypdf.
Poppler (`pdftoppm`, `pdftotext`, `pdfinfo`) sert aux contrôles. Polices locales
Noto Sans et DejaVu Sans ; aucun CDN ni ressource distante de rendu.
Les versions constatées sont inscrites dans le manifeste. Aucun changement des
dépendances applicatives de Voti n’est nécessaire.

La génération convertit les ancres Markdown en destinations PDF, conserve les
numéros des listes interrompues par une capture et ne charge que des ressources
locales. Les PDF contiennent leurs polices et ne dépendent pas du dépôt pour être lus.
La génération est reproductible ; les dates internes du PDF peuvent changer son
empreinte binaire d’un export à l’autre.

## Choix de montage

- Fond, procédures, rôles et règles conservés. Seules des formulations redondantes
  de D1/D3 et les notes de montage ont été légèrement raccourcies/actualisées.
- D1 : quatre captures (C14, C31, C35, C36). Deux cadrages sont générés depuis les
  masters nettoyés : C14, carte seule `(12,168)-(652,601)` ; C31, état/compteur et
  fermeture `(0,130)-(1057,425)`. Ce sont des recadrages, pas de nouvelles prises.
  Le cadre C31 ne montre pas la règle d’attente de l’autre exemple Guidé.
- D2 : treize captures. C08, C11, C15, C20, C21, C34 et C37 restent disponibles dans
  la source complète mais sont omises du montage imprimé pour éviter la répétition.
  Aucune procédure textuelle n’est retirée. C14 utilise le cadrage de carte seule.
  C30 est cadrée sur la barre de sauvegarde `(12,12)-(813,84)`, pour repérer
  l’enregistrement sans reproduire une longue colonne de champs déjà expliqués.
  Les écrans mobiles C35/C36 partagent une rangée, avec leurs légendes respectives.
- D3 : texte autonome, sans image nécessaire.
- L’index des procédures de la source D2 est remplacé dans le montage par le
  sommaire cliquable et les signets des procédures. Les destinations P01–P36 restent actives.
- S1–S4 : SVG simples, titres/descriptions, aucune silhouette ni association rôle/âge.
- C39/C40 absentes : aucune fausse image ; la procédure PWA textuelle les remplace.
  Les sources signalent que les deux vues natives pourront être ajoutées plus tard.
- Aucun repère décoratif ajouté aux captures ; les masques opaques existants sont conservés.

## Contrôler après une mise à jour

1. Exécuter la génération puis les contrôles de structure et de liens.
2. Rendre chaque PDF avec Poppler et inspecter toutes les pages, notamment les
   légendes, tableaux, fins de page et reprises de listes.
3. Contrôler chaque image réellement intégrée : données fictives, aucun QR utilisable,
   secret ou fichier d’accès. Ne jamais importer de capture de production privée.
4. Vérifier D1 en quatre pages, D3 en cinq pages, l’autonomie de la page Participant,
   la lecture A4 et les schémas en niveaux de gris.

Les rendus de travail restent ignorés dans `.browser-tests/guide-pdf/`.
Le contrôle ne relance aucun test applicatif et n’accède à aucune donnée de production.
Les PDF ne constituent ni une certification juridique ni une promesse de support :
les limites de récupération et le contact éventuel restent ceux expliqués par les guides.

## Polish des guides courts — 27 octobre 2026

D1 reste en quatre pages ; D3 passe de trois à quatre pages. Les styles dédiés
`.quick` et `.help` séparent les zones, les étapes et les niveaux de dépannage.
Le corps principal est de 12 pt ; les renvois secondaires de D3 sont de 11,5 pt.
Le PDF, le HTML et le Markdown D2 ne sont pas modifiés par cette passe.

Pour ne réexporter que D1 et D3 :

```sh
python3 docs/guides/build_guides.py --only quick help
python3 docs/guides/check_guides.py
```

`short_layout.py` construit les blocs depuis le Markdown sans dupliquer les
textes de procédure. Les 20 symptômes de D3 et leurs renvois sont contrôlés.
Les comparaisons avant/après et les rendus noir et blanc restent privés et
ignorés dans `.browser-tests/short-guides-polish/`.

## Seconde passe — direction visuelle, 27 octobre 2026

État courant : D1 quatre pages ; D3 cinq pages. Cette passe recompose les HTML
sans modifier les Markdown validés. D2 reste identique, y compris les règles
CSS qui lui sont applicables.

- D1 : trois cartes de rôles ; deux blocs de démarrage ; quatre cartes d’étapes ;
  Carte Voti placée face à sa procédure ; phases Créer / Publier / Suivre ;
  deux cartes d’état ; parcours Participant en trois phases avec les captures
  intégrées à Choisir et confirmer.
- D3 : index de sept rubriques cliquables avec numéros de page ; vingt fiches
  numérotées ; trois étiquettes en colonne gauche ; fiche Résultats renforcée ;
  cinq conséquences d’actions sensibles sur cinq lignes ; cinq consignes d’aide
  finale dans une liste. L’invitation est regroupée avec Membres / Groupes,
  les autres lots étant sur la page Résultats / Lots de Cartes.
- Aucun changement des règles ; les textes des fiches et les destinations sont
  contrôlés. Seuls les intitulés de phases et les formulations de l’encadré
  sensible sont adaptés à la présentation demandée. Les espaces françaises
  avant la ponctuation sont insécables pour éviter un “?” seul en début de ligne.
- Les écarts entre cartes et colonnes utilisent des marges explicites : le rendu
  ne dépend pas de la prise en charge de `gap` par la version de WeasyPrint.

Les comparaisons avant/après à 24 dpi (environ 25 % d’un affichage à 96 dpi), les
rendus normaux et les simulations en niveaux de gris sont conservés localement
et ignorés dans `.browser-tests/short-guides-redesign/`.
