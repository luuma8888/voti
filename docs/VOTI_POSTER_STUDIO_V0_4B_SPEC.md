# Voti — v0.4B — Parcours QR direct et Studio d’affiches premium

## Statut

Lot fonctionnel suivant v0.4A validé humainement.

Ce lot traite trois retours UX prioritaires de Lu’uma :

1. le QR par choix doit conduire directement à l’écran de confirmation du choix ;
2. les affiches PDF doivent devenir réellement personnalisables, premium et illustrables ;
3. l’accès aux QR depuis la gestion doit être beaucoup plus identifiable.

Aucune modification Cloudflare, Worker, D1, Turnstile ou protocole distant n’est nécessaire.

---

# 1. Objectifs

Ajouter :

- parcours QR par choix raccourci vers la confirmation ;
- bouton explicite `Autre choix` ;
- aucun vote automatique ;
- bouton de gestion `QR & partager le sondage` avec icône QR décorative ;
- Studio d’affiche Voti avec aperçu ;
- plusieurs compositions d’affiche réellement différentes ;
- palettes prédéfinies + couleurs personnalisables ;
- typographies locales/génériques ;
- image de fond d’affiche ;
- images de question et de choix dans les affiches ;
- médias d’affiche optionnels locaux, distincts des médias du sondage distant ;
- sauvegarde locale de la configuration d’affiche ;
- conservation des téléchargements PNG/SVG QR indépendants.

Le PDF détaillé des résultats fait désormais partie de ce lot.

---

# 2. QR par choix — nouveau parcours

Route canonique conservée :

```text
#/p/<pollId>/choice/<choiceId>
```

Lorsqu’un poll publié est ouvert et que `choiceId` est valide :

- NE PAS afficher d’abord la liste des choix ;
- ouvrir directement l’écran de confirmation ;
- afficher clairement la question ;
- afficher clairement le choix concerné ;
- afficher son image si elle existe et est disponible ;
- proposer :
  - `Oui, je confirme`
  - `Autre choix`

Aucune requête de vote avant `Oui, je confirme`.

Le simple scan ne crée :
- aucun bulletin ;
- aucun `castVote` ;
- aucun compteur ;
- aucune mutation distante.

## Autre choix

`Autre choix` doit :

1. abandonner la présélection QR courante ;
2. remplacer la route courante par la route publique normale :

```text
#/p/<pollId>
```

3. afficher la liste complète des réponses ;
4. permettre un choix classique ;
5. éviter qu’un rerender réapplique immédiatement le choix QR.

Préférer `history.replaceState` / remplacement de hash adapté plutôt qu’une boucle d’historique.

Après sélection d’un autre choix :
- écran de confirmation normal ;
- confirmation explicite requise.

## Refresh

- refresh de la route QR originale valide => confirmation du choix QR ;
- refresh après `Autre choix` => vue normale des choix ;
- jamais de vote automatique.

## Choice invalide

Si le choiceId n’existe plus :
- aucun choix automatique ;
- vue normale des réponses ;
- message court :
  `Ce choix n’est plus disponible. Choisis une autre réponse.`

## Sondage fermé

Route QR choix :
- affiche le sondage fermé ;
- aucun écran permettant de confirmer un vote ;
- résultats disponibles selon les règles existantes.

---

# 3. Tests QR direct

Tester avec compteur D1 local indépendant :

- ouverture QR choix valide => écran confirmation directement ;
- zéro bulletin avant confirmation ;
- zéro POST vote avant confirmation ;
- bouton `Autre choix` ;
- route normalisée après `Autre choix` ;
- possibilité de choisir une autre réponse ;
- confirmation du choix initial => exactement un bulletin ;
- confirmation du choix alternatif => exactement un bulletin ;
- double clic => un bulletin ;
- refresh avant confirmation => zéro bulletin ;
- retour/rerender/storage event => zéro bulletin ;
- choice invalide ;
- sondage fermé ;
- sondage supprimé.

Tester à 320/360/1200 px et clavier.

---

# 4. Bouton QR plus explicite

Dans la gestion d’un sondage en ligne, remplacer l’action peu identifiable :

```text
Partager le sondage
```

par une action visuellement évidente du type :

```text
[icône QR décorative] QR & partager le sondage
```

ou :

```text
[icône QR décorative] QR, partage & affiches
```

Choisir la formulation la plus claire après inspection de la place disponible.

## Icône

Créer une petite icône QR décorative :
- inline SVG ou CSS ;
- trois repères carrés rappelant un QR ;
- volontairement NON scannable ;
- pas de dépendance externe ;
- `aria-hidden=true` si le texte porte déjà le sens ;
- visible en thème clair/Nuit ;
- ne pas utiliser un emoji dépendant de l’OS.

Le bouton reste >=44 px sur mobile.

Tester que l’utilisateur comprend visuellement que ce bouton mène aux QR.

---

# 5. Studio d’affiches premium

Remplacer les deux simples boutons PDF par une expérience :

```text
Créer une affiche
```

ouvrant un Studio d’affiche local.

Le Studio doit rester suffisamment simple pour un enfant d’environ 10 ans :

## Niveau simple visible immédiatement

- type d’affiche ;
- disposition ;
- palette ;
- typographie ;
- aperçu ;
- bouton `Télécharger le PDF`.

## Section avancée

Repliable :

- couleurs personnalisées ;
- image de fond ;
- intensité/voile du fond ;
- options d’images ;
- réglages secondaires compatibles avec l’accessibilité.

Ne pas transformer Voti en logiciel PAO complexe.

---

# 6. Types d’affiches

Conserver les deux intentions :

## A — QR d’accès

Un QR principal pour entrer dans le sondage.

## B — QR par choix

Un QR par réponse.

Le choix du type est distinct de la disposition graphique.

---

# 7. Dispositions graphiques

Fournir au minimum 4 compositions réellement différentes et premium.

Noms indicatifs :

### 1. Essentielle
- grande question ;
- contenu très aéré ;
- QR central dominant ;
- design minimal contemporain.

### 2. Cartes
- question en tête ;
- choix dans des cartes structurées ;
- très adaptée au mode QR par choix.

### 3. Magazine
- grande zone visuelle / image ;
- hiérarchie éditoriale ;
- asymétrie maîtrisée ;
- QR intégré dans une zone calme.

### 4. Mosaïque
- composition plus vivante ;
- blocs équilibrés ;
- particulièrement adaptée à 3–6 choix.

Une cinquième disposition `Illustrée` peut être ajoutée si elle apporte réellement une composition distincte et reste maintenable.

Les layouts doivent adapter leur structure entre :
- mode accès ;
- mode QR par choix ;
- 2, 3, 4, 5, 6 choix ;
- portrait/paysage si nécessaire.

Ne pas faire quatre variations où seules les couleurs changent.

---

# 8. Aperçu d’affiche

Ajouter un aperçu réel dans le Studio.

Il doit :
- utiliser le même plan/rendu que le PDF final ;
- se mettre à jour après réglage ;
- être affiché à une taille adaptée ;
- ne pas générer un PDF complet à chaque clic si cela coûte trop cher ;
- refléter fidèlement layout, couleurs, typo, images et QR.

À 360 px :
- aperçu redimensionné ;
- aucun scroll horizontal global ;
- contrôles utilisables.

Prévoir éventuellement un bouton :
`Agrandir l’aperçu`

si cela s’intègre proprement.

---

# 9. Palettes

Fournir plusieurs palettes prêtes à l’emploi, indépendantes du thème de l’application.

Au minimum :

- Voti Pop ;
- Lagon ;
- Jardin ;
- Lavande ;
- Pêche solaire ;
- Nuit élégante ;
- Ivoire premium ;
- Minimal noir & blanc.

Chaque palette définit :
- fond ;
- surface ;
- accent principal ;
- accent secondaire ;
- texte ;
- texte secondaire.

Le QR reste noir/blanc ou sur une surface blanche dédiée à contraste maximal.

## Palette personnalisée

Section avancée :
- couleur principale ;
- couleur secondaire ;
- fond.

Le système doit :
- préserver automatiquement une couleur texte lisible ;
- refuser/corriger les associations manifestement illisibles ;
- ne jamais colorer les modules QR au point de réduire leur fiabilité.

---

# 10. Typographie

Aucune police distante.

Pas de fichier de police externe ajouté uniquement pour ce lot.

Fournir 3 à 4 styles typographiques à partir de piles locales/génériques robustes, par exemple :

- Moderne — `system-ui, sans-serif`
- Douce — pile sans-serif arrondie/friendly avec fallback sûr
- Éditoriale — `Georgia, serif`
- Affiche — sans-serif plus affirmée avec poids/espacement adaptés

Les noms exacts peuvent être améliorés.

Le réglage typographique peut agir sur :
- famille ;
- poids des titres ;
- échelle de titre ;
- espacement raisonnable.

Ne jamais compromettre :
- accents français ;
- textes longs ;
- lisibilité enfant/adulte ;
- pagination.

---

# 11. Image de fond d’affiche

Permettre de choisir une image locale uniquement pour l’affiche.

Elle :
- n’est jamais envoyée au Worker ;
- ne change pas PollDefinition ;
- ne change pas definitionHash ;
- ne modifie pas le sondage public ;
- ne nécessite pas R2.

Réutiliser autant que possible le pipeline d’image local existant :
- JPEG/PNG/WebP ;
- décodage navigateur ;
- orientation normalisée ;
- métadonnées retirées via réencodage ;
- taille bornée.

Prévoir :

```text
Mode :
- Remplir
- Ajuster
```

et :

```text
Position/focale :
- centre
- haut
- bas
```

Une interface de point focal plus fine est facultative si elle reste simple.

Réglage :
- intensité/visibilité du fond ;
- voile clair/sombre automatique ou curseur borné.

Le texte et les QR doivent toujours reposer sur des surfaces suffisamment contrastées.

---

# 12. Images de question et de choix

Le Studio doit savoir utiliser des images associées à la question et aux réponses de manière professionnelle.

## Source prioritaire

Si le sondage possède déjà localement :
- `pollImageAssetId`
- `choice.imageRef`

et que les assets sont disponibles :
- proposer automatiquement `Utiliser les images du sondage`.

## Limite production actuelle

Le pilote Internet gratuit conserve :

```text
REMOTE_ASSETS_ENABLED=false
```

Donc ne jamais :
- activer R2 ;
- envoyer ces images au relais ;
- prétendre que le votant distant les verra.

Les images peuvent néanmoins servir à l’AFFICHE LOCALE si elles existent dans la bibliothèque du créateur.

## Médias d’affiche uniquement

Pour permettre de personnaliser l’affiche d’un sondage en ligne textuel, autoriser aussi :

- image principale d’affiche ;
- image optionnelle par choix ;

stockées localement comme médias d’affiche uniquement.

Ces médias :
- ne changent pas le sondage ;
- ne sont jamais envoyés au relais ;
- ne sont pas des `imageRef` métier ;
- servent seulement aux exports/aperçus.

L’UI doit le dire clairement :
`Cette image personnalise seulement l’affiche.`

---

# 13. Rendu professionnel des images

Ne pas simplement coller une photo rectangulaire brute.

Prévoir selon layout :

- crop propre `cover` ;
- respect du ratio ;
- coins arrondis maîtrisés ;
- cartes/surfaces ;
- masque/voile si image de fond ;
- marges cohérentes ;
- pas d’étirement ;
- gestion portrait/paysage/carré ;
- hiérarchie question > choix > QR.

Pour un choix :
- image proche de son libellé et de son QR ;
- association visuelle non ambiguë.

Pour une image principale :
- zone hero, bandeau, carte ou arrière-plan selon layout.

Tester des fixtures :
- portrait ;
- paysage ;
- carré ;
- très claire ;
- très sombre.

---

# 14. Persistance des réglages d’affiche

La personnalisation d’affiche ne fait PAS partie de `PollDefinition`.

Créer un stockage local dédié, versionné, par exemple :

```text
voti.poster.v1
```

ou un adapter équivalent.

Il peut mémoriser par pollId :

```text
formatVersion
layout
posterMode
palette
customColors
typography
background settings
poster-only media refs
question/choice media preferences
```

Contraintes :

- aucune capacité admin ;
- aucun bulletin ;
- aucun secret ;
- aucune mutation du relay ;
- aucun impact sur definitionHash ;
- style modifiable après premier vote et après fermeture tant que la copie locale existe.

Le comportement après suppression distante doit rester local uniquement.

## Assets

Si des assets sont utilisés uniquement par un design d’affiche :
- ils ne doivent pas être supprimés par le sweep comme « inutilisés » ;
- ils doivent pouvoir être nettoyés lorsque le design qui les référence est supprimé/remplacé.

Ne pas créer de fuite infinie d’assets locaux.

---

# 15. Backup

Ne pas modifier silencieusement le format général de backup existant.

Pour v0.4B :
- la configuration d’affiche peut rester locale hors backup général ;
- documenter clairement cette limite.

Si l’architecture existante rend l’ajout à un backup versionné trivial et sûr, le proposer dans le rapport mais NE PAS changer le format sans justification/autorité claire.

---

# 16. PDF

Conserver :
- A4 ;
- génération locale ;
- QR testables ;
- aucun secret ;
- pdf-lib actuel ;
- environ 300 dpi ;
- pagination plutôt que réduction excessive.

Étendre `poster.js` en séparant davantage :

```text
PosterDesign
PosterLayout
PosterPlan
PosterRenderer
PosterExport
```

ou structure équivalente.

Éviter une grosse fonction avec des `if` par preset.

Le plan doit pouvoir être testé sans canvas lorsque possible.

---

# 17. Affiches et QR individuels

Conserver en permanence la possibilité indépendante de télécharger :

- QR vote PNG ;
- QR vote SVG ;
- QR résultat PNG/SVG ;
- QR par choix PNG/SVG.

Même avec le Studio d’affiche.

L’utilisateur doit toujours pouvoir utiliser ses QR dans Canva, LibreOffice, Word, GIMP ou une création personnelle.

Le Studio n’enferme jamais l’utilisateur dans les templates Voti.

---

# 18. Accessibilité du Studio

- contrôles natifs correctement étiquetés ;
- clavier complet ;
- focus visible ;
- cibles >=44 px ;
- aperçu avec description ;
- pas d’information uniquement par couleur ;
- palette sélectionnée identifiable autrement que par couleur ;
- color inputs avec valeur texte ou nom ;
- dialogues v0.3E ;
- `prefers-reduced-motion`.

Pour les images :
- aucune obligation de fournir un alt public dans le PDF, mais l’éditeur doit décrire clairement quelle image est affectée à quelle zone.

---

# 19. Performance

Le build v0.4A dépasse déjà 1 Mo.

Ne pas ajouter une grosse dépendance de design.

Réutiliser :
- Canvas ;
- pdf-lib ;
- pipeline image existant ;
- QR existant.

L’aperçu ne doit pas recréer inutilement des canvases 2480×3508 à chaque interaction.

Utiliser :
- preview basse/moyenne résolution ;
- export pleine résolution seulement au téléchargement.

Libérer explicitement canvases/object URLs temporaires.

Tester plusieurs changements successifs sans croissance mémoire évidente.

---

# 20. Tests du Studio

Tests Node/unitaires :

- validation PosterDesign ;
- migration/version format ;
- presets ;
- couleurs ;
- typographies ;
- layout 2/3/6 choix ;
- calcul des zones ;
- crop cover/contain ;
- fond + voile ;
- médias d’affiche ;
- aucune mutation PollDefinition ;
- aucune capacité/secret ;
- stockage local.

Tests navigateur :

- ouvrir Studio ;
- choisir 4 layouts ;
- changer palette ;
- couleurs custom ;
- typo ;
- image fond ;
- retirer image ;
- image question ;
- images choix ;
- 320/360/1200 px ;
- cinq thèmes app ;
- Nuit ;
- aperçu mis à jour ;
- télécharger PDF ;
- téléchargements QR toujours présents.

Tests PDF/Poppler :

- au moins une affiche par layout ;
- modes access + choices ;
- 2/3/6 choix ;
- image portrait ;
- paysage ;
- carré ;
- fond clair/sombre ;
- texte long ;
- pagination ;
- QR redécodés depuis raster final ;
- aucun chevauchement ;
- aucun secret.

---

# 21. Régressions QR choix

Ajouter un vrai scénario Chromium :

```text
ouvrir #/p/<poll>/choice/<choice>
=> directement confirmation
=> COUNT ballots = 0
=> Autre choix
=> route #/p/<poll>
=> choisir autre réponse
=> COUNT = 0
=> confirmer
=> COUNT = 1
```

Et scénario :

```text
ouvrir QR choice
=> directement confirmation
=> confirmer
=> COUNT = 1
```

Aucun test ne doit seulement vérifier le DOM sans vérifier l’absence réelle de mutation.

---

# 22. Régressions générales

Conserver :

- v0.3D production gratuite ;
- v0.3E dialogues ;
- v0.4A QR/public/admin ;
- Turnstile création uniquement ;
- mode local/offline ;
- profil production sans R2 ;
- seuil ;
- résultats ;
- fermeture ;
- suppression ;
- admin key ;
- thèmes ;
- 360 px ;
- QR PNG/SVG ;
- PDF actuel.

Aucune mutation Cloudflare.
Aucun déploiement Worker.

---

# 23. Documentation

Créer :

```text
docs/POSTER_STUDIO_V0.md
docs/RESULTS_PDF_V0.md
docs/CODEX_POSTER_V0_4B_REPORT.md
```

Mettre à jour :
- docs/QR_AND_POSTER_V0.md ;
- docs/UX_FLOWS_V0.md ;
- README.md si nécessaire.

Documenter explicitement :

- QR choix => confirmation directe, pas vote ;
- `Autre choix` ;
- layouts ;
- palettes ;
- typo ;
- images de fond ;
- médias d’affiche local-only ;
- limite sans R2 ;
- stockage de design ;
- différence sondage / affiche ;
- liberté de télécharger QR PNG/SVG séparément.

---

# 24. Tests complets

Relancer au minimum :

```text
npm test
npm run check
npm run build
npm run build:production
npm run test:browser
npm run test:poster
npm run test:relay
npm run test:integration
npm run test:free-pilot
git diff --check
```

Ajouter une suite dédiée `test:poster-studio` si cela rend les contrôles plus clairs.

---

# 25. Audit bundle

Après tests et rapport :

```text
VOTI_AUDIT_V0_4B.zip
```

avec le mécanisme existant.

Exclure :
- VOTI_AUDIT_*.zip ;
- PDF temporaires ;
- exports admin ;
- médias utilisateur de test non destinés au repo ;
- caches/profils ;
- bases locales ;
- secrets.

Ne pas commit le ZIP.

---

# 26. Commit/push

Ne pas commit.
Ne pas push.
Ne pas publier Pages.

Attendre audit ChatGPT et validation humaine.

---

# 27. Hors périmètre

Ne pas faire dans ce lot :
- comptes ;
- groupes ;
- Android/Capacitor ;
- R2/images distantes ;
- vote unique par personne ;
- synchronisation offline ;
- domaine personnalisé ;
- scanner QR intégré ;
- éditeur libre type Canva ;
- polices web externes.

---

# 28. Critère de sortie

v0.4B est terminé lorsque :

1. scanner un QR choix amène directement à la confirmation ;
2. `Autre choix` ramène proprement vers la sélection complète ;
3. aucun vote n’est créé avant confirmation ;
4. l’action de gestion vers les QR est visuellement identifiable par une icône QR ;
5. un Studio d’affiche existe ;
6. au moins 4 dispositions réellement différentes existent ;
7. palettes et couleurs personnalisées fonctionnent ;
8. plusieurs styles typographiques fonctionnent ;
9. une image de fond locale peut être utilisée ;
10. images question/choix peuvent être intégrées professionnellement à l’affiche ;
11. médias affiche-only restent locaux et hors PollDefinition ;
12. aperçu et PDF partagent la même logique de design ;
13. QR PDF restent scannables dans les tests ;
14. QR PNG/SVG individuels restent téléchargeables ;
15. tous les tests passent ;
16. aucune ressource Cloudflare n’a été mutée ;
17. rapport + bundle audit sont produits.


# 18 bis. PDF détaillé des résultats

Le lot v0.4B inclut également un export PDF détaillé et premium des résultats agrégés.

Ce PDF est distinct des affiches de vote.

Nom possible :

```text
voti-resultats-<pollId>.pdf
```

## Principe de confidentialité

Le PDF ne doit utiliser QUE la projection de résultats déjà autorisée par le relais.

Il ne doit jamais contenir :
- bulletins bruts ;
- actionId ;
- capacité admin ;
- IP ;
- User-Agent ;
- métadonnées réseau ;
- information permettant d’identifier un votant.

Le créateur ne bénéficie d’aucun contournement du seuil.

Si les résultats ne sont pas encore disponibles selon `resultRules` :
- ne pas générer un PDF contenant des données cachées ;
- désactiver l’export ;
- expliquer simplement :
  `Les résultats ne sont pas encore disponibles.`

Pour un mode `closed`, respecter fermeture + seuil.

## Contenu minimum

Lorsque les résultats sont disponibles, le PDF doit présenter :

- identité Voti discrète ;
- question du sondage ;
- description si présente ;
- statut du sondage : ouvert / fermé ;
- nombre total de réponses ;
- date locale de génération du document, clairement présentée comme date d’export et non date des votes ;
- répartition complète des choix ;
- nombre de votes par choix ;
- pourcentage par choix ;
- représentation graphique claire ;
- QR/lien vers la page publique des résultats lorsque le sondage existe encore ;
- mention courte des règles de publication des résultats si utile.

## Visualisation

Prévoir au moins deux styles de restitution sélectionnables :

### Synthèse
- grande question ;
- chiffres principaux ;
- graphique compact ;
- classement lisible.

### Rapport
- question et contexte ;
- répartition détaillée ;
- une ligne/carte par choix ;
- barres de proportion ;
- pourcentage + nombre ;
- espace suffisant pour les libellés longs.

Une troisième variante plus visuelle est possible si elle reste maintenable.

Ne pas utiliser un camembert comme seule représentation.
Pour 2 à 6 choix, privilégier des barres ou cartes proportionnelles faciles à comprendre.

## Style

Réutiliser l’architecture du Studio d’affiche lorsque pertinent :

- palettes ;
- typographies ;
- accent du sondage ;
- logo/symbole Voti ;
- surfaces premium ;
- mise en page imprimable.

Mais le PDF de résultats doit rester distinct d’une affiche de vote :
- plus analytique ;
- plus sobre ;
- priorité aux chiffres et à la comparaison.

Les QR du document doivent rester sur surface claire à fort contraste.

## Images

Si une image de question ou des images de choix sont disponibles localement :
- permettre de les inclure de manière optionnelle ;
- conserver une mise en page professionnelle ;
- ne jamais dépendre d’images distantes non disponibles.

Les médias affiche-only peuvent être proposés dans le PDF de résultats uniquement si l’utilisateur le choisit explicitement et si leur association au choix est claire.

Aucun média local ne doit être envoyé au relais pour produire ce PDF.

## Sondage encore ouvert

Si les résultats sont déjà publics avant fermeture :
- le PDF peut être exporté ;
- indiquer `Sondage ouvert` ;
- ne pas présenter les résultats comme définitifs.

Ajouter une mention :
`Résultats au moment de l’export.`

## Sondage fermé

Indiquer :
`Sondage fermé`

et présenter les résultats comme état final connu du sondage.

Ne pas inventer une certification d’intégrité ou un caractère officiel.

## Sondage supprimé

Si le sondage distant est supprimé mais qu’une projection de résultats n’est plus récupérable :
- ne pas reconstruire les résultats depuis des données inexistantes ;
- une éventuelle copie PDF déjà téléchargée reste naturellement disponible localement.

## Export

Ajouter dans la gestion / vue résultats :

```text
Télécharger les résultats en PDF
```

Disponible uniquement si la projection de résultats est `available:true`.

Le bouton doit être facilement identifiable mais ne pas surcharger la vue publique.

L’export doit être entièrement local dans le navigateur.

Réutiliser pdf-lib / Canvas déjà présents.
Aucune nouvelle grosse dépendance.

## Tests résultats PDF

Tester au minimum :

- résultats sous seuil => export indisponible ;
- threshold atteint => export disponible ;
- mode closed non fermé => export indisponible ;
- mode closed fermé + seuil => disponible ;
- 2 choix ;
- 3 choix ;
- 6 choix ;
- égalité ;
- 100 % sur un choix ;
- libellés longs ;
- accents français ;
- sondage ouvert avec résultats publics ;
- sondage fermé ;
- 5 thèmes / palettes représentatives ;
- PDF A4 ;
- pagination si nécessaire ;
- QR résultats décodable ;
- total = somme des choix ;
- pourcentages cohérents ;
- aucune capacité admin ;
- aucun actionId ;
- aucun bulletin brut ;
- aucun secret.

Rasteriser avec Poppler et inspecter :
- lisibilité ;
- absence de chevauchement ;
- barres/graphiques corrects ;
- chiffres visibles ;
- QR scannable.

Les tests doivent utiliser uniquement la projection publique autorisée, jamais lire directement `ballots` pour fabriquer le document.
