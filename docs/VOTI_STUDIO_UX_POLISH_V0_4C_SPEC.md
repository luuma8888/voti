# Voti — v0.4C — Studio & UX polish

## Statut

Lot d’amélioration ciblé après validation humaine de v0.4B.

v0.4B est considéré comme fonctionnellement validé. v0.4C ne doit pas rouvrir le moteur QR, le relais, D1, Turnstile, les règles de vote ou les règles de résultats.

Ce lot transforme surtout le Studio d’affiches de « fonctionnel et déjà utilisable » vers une expérience réellement maîtrisable visuellement, plus claire, plus souple et plus agréable.

Aucune mutation Cloudflare, aucun déploiement Worker et aucune migration ne sont attendus.

---

# 1. Objectifs

Traiter les retours UX humains restants :

1. corriger le fonctionnement des couleurs personnalisées ;
2. clarifier la page de partage avec de gros accès visuels ;
3. améliorer fortement la typographie ;
4. rendre le header / branding de l’affiche plus discret ou masquable ;
5. améliorer les surfaces de texte sur photo ;
6. réduire la pagination prématurée ;
7. rendre la taille des QR et la densité des cartes plus configurables ;
8. donner un vrai contrôle de cadrage des images ;
9. mieux distinguer Local / En ligne dans l’application ;
10. renforcer l’avertissement du QR SECRET.

Le lot doit rester un polish UX/design, pas une refonte métier.

---

# 2. Hors périmètre strict

Ne pas modifier :

- Cloudflare Worker ;
- D1 ;
- Turnstile ;
- bindings ;
- profil sans R2 ;
- schéma métier ;
- PollDefinition ;
- definitionHash ;
- RelayAdapter ;
- protocole de vote ;
- protocole admin ;
- seuil / règles de résultats ;
- QR routes publiques ;
- QR admin ;
- PDF résultats en tant que fonction métier ;
- backup général ;
- Android / Capacitor ;
- comptes / groupes ;
- scanner QR intégré ;
- unicité par personne.

Aucun service externe.

---

# 3. Page de partage — hiérarchie plus évidente

La page actuelle ne doit plus donner l’impression d’être une page technique.

Créer en haut trois grosses entrées visuelles principales :

## A — Un QR pour chaque choix
Sous-texte possible :
`Chaque QR ouvre directement la confirmation d’une réponse.`

## B — QR des résultats
Sous-texte :
`À afficher ou partager pour consulter les résultats lorsqu’ils sont disponibles.`

## C — Créer une affiche PDF
Sous-texte :
`Compose une affiche Voti avec QR, couleurs et images.`

Ces trois entrées doivent :

- être grandes et immédiatement compréhensibles ;
- fonctionner clavier / mobile ;
- être >=44 px ;
- utiliser de petites illustrations/icônes décoratives cohérentes ;
- ne pas être de vrais QR sauf dans leur contenu détaillé ;
- rester lisibles en thème Nuit.

Le QR général de vote peut rester disponible dans la page, mais ne doit pas brouiller cette hiérarchie.

Ne supprimer aucune fonction existante :
- lien de vote ;
- QR vote ;
- PNG/SVG ;
- QR par choix ;
- QR résultats ;
- Studio ;
- transfert SECRET.

Réorganiser l’information plutôt que supprimer.

---

# 4. Couleurs personnalisées — corriger le modèle UX

Le retour humain v0.4B considère le comportement actuel comme non validé :
- conflit apparent avec la palette ;
- résultat perçu comme aléatoire ;
- couleur secondaire sans effet visible.

Ce point est PRIORITAIRE.

## 4.1 Initialisation

Quand une palette prédéfinie est active :

- les champs de couleurs personnalisées affichent les valeurs effectives de la palette ;
- ils restent synchronisés avec la palette tant que l’utilisateur n’a pas modifié manuellement une couleur.

Exemple :

Palette = Lagon
→ principal / secondaire / fond affichent les couleurs Lagon.

Changer vers Jardin
→ ces champs changent aussi, SI aucune personnalisation manuelle n’a commencé.

## 4.2 Passage à Personnalisé

Dès que l’utilisateur modifie une couleur :

- le mode devient clairement `Personnalisé` ;
- la palette prédéfinie n’écrase plus silencieusement cette valeur ;
- l’UI indique que le design est personnalisé.

Prévoir une action :

`Revenir à la palette`

qui réinitialise les couleurs custom depuis la palette choisie.

## 4.3 Sémantique visible des couleurs

Chaque couleur doit avoir un rôle clair et visible.

Par exemple :

- Principale : boutons, accents forts, titres ou éléments dominants ;
- Secondaire : éléments complémentaires, badges, cartes, séparateurs, accents alternés ;
- Fond : fond général.

La couleur secondaire doit avoir un effet réellement observable dans TOUS les layouts où elle est annoncée.

Ne pas créer de réglage sans effet perceptible.

## 4.4 Contraste

Conserver les protections automatiques :

- texte >= 4,5:1 lorsque applicable ;
- éléments graphiques essentiels >= 3:1 ;
- QR jamais recolorés de manière risquée.

Si une couleur utilisateur est problématique :
- corriger uniquement la couleur de texte / surface nécessaire ;
- ne pas remplacer silencieusement toutes les couleurs du design.

L’UI doit rester prévisible.

---

# 5. Panneau avancé — meilleure organisation

Le panneau avancé actuel est jugé trop étroit / vertical.

Réorganiser en sections clairement distinctes :

## Couleurs personnalisées
- principale ;
- secondaire ;
- fond ;
- surfaces si nécessaire.

## Choisir des images
- image principale ;
- image de fond ;
- images de choix.

## Cadrage
- ratio ;
- mode Remplir / Ajuster ;
- zone visible.

## Surfaces et lisibilité
- transparence des blocs texte ;
- voile de fond ;
- style du bloc QR.

Sur desktop :
- utiliser une grille 2 colonnes lorsque l’espace le permet.

Sur mobile :
- une colonne claire.

Éviter une longue colonne de contrôles sans structure.

---

# 6. Typographies — amélioration majeure

Le retour humain demande :
- styles visibles directement dans le sélecteur ;
- davantage de variété ;
- titre et texte réglables séparément ;
- titres plus fantaisistes possibles.

## 6.1 Séparer titre et corps

Ajouter :

- Typographie du titre ;
- Typographie du texte.

Le titre peut être plus expressif.
Le texte courant doit rester prioritairement lisible.

## 6.2 Choix

Fournir au minimum 6 styles de titre et 4 styles de corps, sans police distante et sans fichier de police externe.

Utiliser uniquement des piles locales / génériques robustes.

Exemples de familles / intentions :

Titres :
- Moderne
- Arrondie
- Éditoriale
- Affiche
- Manuscrite douce (fallback générique cursive prudent)
- Fantaisie sobre

Corps :
- Moderne
- Douce
- Éditoriale
- Compacte

Les noms finaux peuvent être améliorés.

## 6.3 Aperçu directement dans le contrôle

Éviter une simple liste où tous les noms ont la même apparence si le navigateur le permet proprement.

Préférer :
- cartes / boutons de choix typographiques ;
- nom du style rendu avec sa propre pile ;
- mini échantillon visuel.

Si un `<select>` stylé ne permet pas un rendu fiable multi-navigateurs, utiliser un groupe de boutons/radios accessible.

## 6.4 Robustesse

Tester :
- accents français ;
- très long titre ;
- texte multi-ligne ;
- fallback absent ;
- impression PDF ;
- aperçu.

Aucune police téléchargée.

---

# 7. Header / branding de l’affiche

Le branding Voti doit rester présent par défaut mais ne pas écraser le contenu.

Ajouter un réglage simple :

`En-tête Voti`

avec au minimum :

- Normal ;
- Discret ;
- Masqué.

## Normal
Branding actuel ou proche.

## Discret
Logo/symbole plus petit, moins haut, moins dominant.

## Masqué
Pas de header Voti visuel.

Même masqué :
- ne pas supprimer les mentions fonctionnelles utiles ;
- ne pas affecter le QR.

Ce réglage reste local au PosterDesign.

---

# 8. Surface QR — éviter la grande bande blanche

Le retour humain valide la lisibilité actuelle mais estime que la grande surface blanche pleine largeur cache trop les photos.

Conserver une surface blanche/opaque suffisante autour du QR pour garantir la scannabilité.

Ajouter des variantes de présentation :

## Large
Surface structurée actuelle.

## Compacte
QR centré dans une carte blanche avec marge raisonnable.

## Minimal
Surface blanche limitée au QR + quiet zone + petite marge de sécurité.

Le mode Minimal ne doit jamais réduire :
- quiet zone ;
- contraste ;
- taille minimale scannable.

La surface du QR elle-même ne doit pas devenir transparente.

Seuls les blocs autour peuvent l’être.

---

# 9. Transparence des surfaces de texte

Ajouter un réglage de transparence pour les cartes / blocs de texte superposés à une image.

Exemple :

`Fond des textes`
- Opaque
- Doux
- Transparent renforcé

ou curseur borné.

Contraintes :

- texte toujours lisible ;
- si l’image est trop contrastée, ajouter automatiquement un voile local ;
- ne jamais appliquer cette transparence à la surface immédiate du QR.

Le réglage doit avoir un résultat visuel prévisible.

---

# 10. Pagination et densité

Le retour humain considère que la pagination arrive trop tôt, notamment :
- 3 choix en PDF QR par choix passent sur deux pages alors qu’une page semble suffisante.

Objectif :
faire tenir davantage de contenu sur une page SANS réduire la scannabilité.

## 10.1 Nombre de choix par ligne

Ajouter un réglage :

`Choix par ligne`

avec :
- Auto ;
- 1 ;
- 2 ;
- 3.

Selon le layout et le nombre de choix.

Garde-fous :
- ne pas proposer une densité impossible ;
- si QR trop petit ou texte trop long, basculer proprement.

Pour 3 choix :
- permettre 3 sur une ligne si lisible ;
- ou 2 + 1 sur deux lignes sur la même page.

## 10.2 Hauteurs de zones

Permettre quelques réglages simples, pas un éditeur libre :

- taille du titre ;
- espace visuel principal ;
- hauteur des cartes ;
- espace résultats ;
- taille QR.

Utiliser des presets ou curseurs bornés.

Exemple :
`Compact / Équilibré / Aéré`

plutôt que 12 sliders techniques si cela suffit.

---

# 11. Taille du QR

Ajouter un réglage de taille QR borné.

Exemple :
- Petit ;
- Moyen ;
- Grand.

Ou slider avec valeurs sûres.

Le moteur doit imposer automatiquement un minimum physique estimé.

Ne jamais permettre :
- modules trop petits ;
- quiet zone rognée ;
- QR dépassant la carte.

Si la taille demandée ne tient pas :
- ajuster la mise en page ;
- ou informer l’utilisateur.

Ne pas dégrader silencieusement la scannabilité.

---

# 12. Ratios d’image

Ajouter les ratios demandés :

- Original ;
- Carré 1:1 ;
- 16:9 ;
- 9:16 ;
- 3:4 ;
- 4:3.

Applicable au minimum :
- image principale ;
- image de choix.

Le ratio ne doit jamais étirer l’image par défaut.

Conserver les proportions.

L’étirement n’est PAS validé et ne doit pas devenir un mode proposé par défaut.

---

# 13. Contrôle manuel du cadrage

Le simple haut / centre / bas n’est plus suffisant.

Ajouter un vrai contrôle de zone visible.

Solution recommandée :

- aperçu miniature de l’image ;
- drag du point focal ;
- ou cadre de crop déplaçable simple.

Stocker par image :

```text
focalX: 0..1
focalY: 0..1
```

ou équivalent.

Le renderer `cover` utilise ce point focal.

## Interaction

- souris ;
- tactile ;
- clavier si possible via boutons directionnels / champs de secours.

Prévoir :
- Réinitialiser au centre.

Ne pas créer un cropper complexe type Photoshop.

Le but :
choisir quelle partie de l’image reste visible.

---

# 14. Images de choix

Pour les layouts Cartes / Magazine / Mosaïque :

- respecter ratio choisi ;
- point focal individuel possible ;
- ne pas mélanger l’image d’un choix avec le QR d’un autre ;
- association immédiatement claire.

Pour 3 à 6 choix :
tester visuellement la densité.

---

# 15. Distinction Local / En ligne

Le rapport v0.4A avait montré qu’un sondage supprimé du relais peut rester localement avec un état peu clair.

Améliorer les badges / libellés de la bibliothèque et de la gestion.

Éviter qu’un simple badge `Ouvert` donne l’impression qu’un sondage est encore accessible en ligne.

Proposition :

État métier :
- Brouillon
- Ouvert
- Fermé

Contexte :
- Local
- En ligne
- Copie locale d’un sondage supprimé / Non rattaché

Ne pas inventer de nouveau statut métier si ce n’est pas nécessaire.

Utiliser un second badge ou sous-texte de contexte.

Exemples :

```text
Ouvert · Local
Ouvert · En ligne
Fermé · En ligne
Ouvert · Local (ancien lien supprimé)
```

La formulation exacte doit être claire sans être technique.

Ne pas changer le stockage métier pour cela si l’information peut être dérivée des références existantes.

---

# 16. QR SECRET — avertissement renforcé

L’avertissement existant fonctionne mais doit être plus marquant.

Améliorer visuellement :

- icône avertissement vectorielle ;
- accent rouge foncé / danger accessible ;
- fond légèrement teinté ;
- titre explicite.

Texte recommandé :

`Ce QR donne accès à l’administration du sondage.`

Sous-texte :

`Toute personne qui le possède peut gérer ou supprimer ce sondage. Ne le partage pas publiquement.`

Conserver :
- masqué par défaut ;
- clic explicite pour afficher ;
- aucun téléchargement secret automatique ;
- aucune capacité visible dans les logs.

Pas de changement protocolaire.

---

# 17. PDF résultats

Ne pas refondre la fonction.

Mais les améliorations transverses peuvent se refléter dans le PDF résultats lorsque pertinent :

- typographie titre/corps ;
- palettes corrigées ;
- header Normal/Discret/Masqué si cohérent.

Ne pas ajouter de nouveaux agrégats.
Ne pas modifier la confidentialité.
Ne pas modifier les règles available/threshold/closed.

Les styles Synthèse/Rapport restent.

---

# 18. Persistance PosterDesign

Étendre PosterDesign v1 proprement.

Si les nouveaux champs peuvent être ajoutés rétrocompatiblement :
- accepter absence de champ ;
- appliquer valeur par défaut.

Si une version v2 est nécessaire :
- migration explicite v1 → v2 ;
- tests de migration ;
- aucun design existant perdu silencieusement.

Champs possibles :

```text
titleTypography
bodyTypography
headerMode
qrSurfaceMode
textSurfaceOpacity
densityPreset
choicesPerRow
qrSize
imageRatios
focalPoints
```

Les noms finaux peuvent différer.

Ne jamais y ajouter :
- capacité ;
- bulletin ;
- donnée réseau ;
- secret.

---

# 19. UX et accessibilité

Conserver :

- clavier complet ;
- focus visible ;
- cible >=44 px ;
- responsive 320/360 px ;
- thème Nuit ;
- reduced-motion ;
- labels explicites ;
- état sélectionné non transmis uniquement par couleur.

Pour le point focal :
- prévoir une solution accessible sans drag obligatoire.

Pour les typographies :
- nom textuel toujours présent.

Pour les palettes :
- nom textuel toujours présent.

---

# 20. Performance

Pas de grosse nouvelle dépendance.

Réutiliser :
- Canvas ;
- pdf-lib ;
- QR ;
- pipeline image existant ;
- PosterPlan / PrintRenderer.

Le drag du point focal doit mettre à jour l’aperçu avec throttling/debounce raisonnable.

Ne pas générer un PDF pleine résolution pendant un drag.

Libérer les ressources temporaires.

---

# 21. Tests couleurs

Tester explicitement le bug humain v0.4B.

Scénario :

1. sélectionner Lagon ;
2. vérifier principal/secondaire/fond = valeurs Lagon ;
3. changer vers Jardin ;
4. vérifier synchronisation ;
5. modifier secondaire ;
6. vérifier passage en Personnalisé ;
7. vérifier que secondaire change effectivement au moins un élément visible ;
8. changer de palette sans action explicite ;
9. vérifier que la personnalisation n’est pas écrasée ;
10. cliquer Revenir à la palette ;
11. vérifier resynchronisation.

Tester les 8 palettes.

---

# 22. Tests typographie

Tester :

- 6 styles titre ;
- 4 styles corps ;
- indépendance titre/corps ;
- aperçu visible ;
- PDF ;
- accents ;
- long texte ;
- fallback.

---

# 23. Tests layout / pagination

Tester :

- 3 choix sur une page quand paramètres sûrs ;
- 2 + 1 sur une page ;
- 6 choix ;
- Auto ;
- 1/2/3 choix par ligne ;
- QR Petit/Moyen/Grand ;
- Compact/Équilibré/Aéré ;
- texte court ;
- texte long.

Le moteur peut toujours paginer si nécessaire.

Ne jamais forcer une page unique au prix de QR illisibles.

---

# 24. Tests images / cadrage

Fixtures :

- portrait ;
- paysage ;
- carré ;
- sujet en haut ;
- sujet en bas ;
- sujet à gauche ;
- sujet à droite.

Tester :

- ratios ;
- focalX/focalY ;
- reset centre ;
- cover ;
- contain ;
- aperçu ;
- PDF ;
- tactile/interaction simulée si possible.

Vérifier absence d’étirement.

---

# 25. Tests surfaces

Tester :

- photo claire ;
- photo sombre ;
- surface opaque ;
- surface semi-transparente ;
- QR surface Large/Compacte/Minimal ;
- QR toujours décodable après Poppler ;
- texte toujours contrasté.

---

# 26. Tests Local / En ligne

Tester :

- brouillon local ;
- sondage local publié dans le navigateur ;
- sondage en ligne ;
- sondage fermé en ligne ;
- suppression distante avec copie locale conservée.

Vérifier que l’UI ne suggère pas à tort qu’un lien distant supprimé est encore en ligne.

Aucun changement du moteur métier attendu.

---

# 27. Tests QR SECRET

Tester :

- masqué par défaut ;
- avertissement renforcé visible avant affichage ;
- icône accessible ;
- contraste ;
- afficher / masquer ;
- aucune capacité dans console/log ;
- comportement protocolaire identique à v0.4B.

---

# 28. Tests complets

Relancer au minimum :

```text
npm test
npm run check
npm run build
npm run build:production
npm run test:browser
npm run test:poster
npm run test:poster-studio
npm run test:relay
npm run test:integration
npm run test:free-pilot
git diff --check
```

Ajouter si utile :

```text
npm run test:poster-polish
```

pour isoler les nouvelles régressions UX visuelles.

---

# 29. Documentation

Créer :

```text
docs/POSTER_STUDIO_POLISH_V0.md
docs/CODEX_STUDIO_V0_4C_REPORT.md
```

Mettre à jour :

- docs/POSTER_STUDIO_V0.md ;
- docs/QR_AND_POSTER_V0.md ;
- docs/UX_FLOWS_V0.md ;
- README.md si utile.

Documenter :

- couleurs palette/personnalisé ;
- typographies séparées ;
- layouts/densité ;
- taille QR ;
- surface QR ;
- transparence ;
- ratios/cadrage ;
- Local / En ligne ;
- QR SECRET ;
- limites.

---

# 30. Audit bundle

Après tous les tests et le rapport :

```text
VOTI_AUDIT_V0_4C.zip
```

via le mécanisme existant.

Exclure :

- VOTI_AUDIT_*.zip ;
- PDF temporaires ;
- exports admin ;
- médias utilisateur ;
- captures/profils ;
- caches ;
- bases locales ;
- secrets ;
- node_modules ;
- .wrangler ;
- .relay-local.

Ne pas commit le ZIP.

---

# 31. Publication

Ne pas commit.
Ne pas push.
Ne pas publier Pages.
Ne pas modifier Cloudflare.

Attendre audit ChatGPT et validation humaine.

---

# 32. Critères de sortie

v0.4C est terminé lorsque :

1. les couleurs personnalisées ont un comportement déterministe et compréhensible ;
2. la couleur secondaire a un effet visible ;
3. la page de partage présente trois accès principaux clairs ;
4. le titre et le corps ont des typographies séparées ;
5. les choix typographiques sont prévisualisables ;
6. le header peut être Normal / Discret / Masqué ;
7. les surfaces texte ont une transparence réglable avec contraste sûr ;
8. le QR peut utiliser une surface Large / Compacte / Minimal ;
9. la taille du QR est ajustable dans des bornes sûres ;
10. 3 choix peuvent tenir sur une page lorsque le contenu le permet ;
11. le nombre de choix par ligne est contrôlable ;
12. les ratios image sont disponibles ;
13. le point focal peut être réglé manuellement ;
14. aucune image n’est étirée par défaut ;
15. Local / En ligne est plus clair ;
16. l’avertissement QR SECRET est renforcé ;
17. les PDF restent scannables ;
18. tous les tests passent ;
19. aucune ressource Cloudflare n’a été modifiée ;
20. rapport + bundle audit sont produits.
