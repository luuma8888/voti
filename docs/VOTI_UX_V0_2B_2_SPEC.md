# Voti — Lot v0.2B.2 — Images, assets et identité graphique

## 1. Objectif

Ajouter à Voti :

1. les trois assets de marque validés :
   - emblème / logo ;
   - fond abstrait ;
   - mascotte gecko ;
2. l’image facultative d’un sondage ;
3. l’image facultative de chaque choix ;
4. une architecture de stockage d’assets propre et remplaçable ;
5. la sauvegarde/restauration des assets ;
6. la compatibilité avec le build autonome mono-HTML.

Le texte d’un choix reste toujours obligatoire.

---

## 2. Assets de marque validés

Les fichiers source fournis dans ce bundle sont :

- `assets/branding/source/voti-logo-source.png`
- `assets/branding/source/voti-background-source.png`
- `assets/branding/source/voti-mascot-source.png`

Versions optimisées Web fournies :

- `assets/branding/voti-logo.webp`
- `assets/branding/voti-background.webp`
- `assets/branding/voti-mascot.webp`

Caractéristiques :

- logo source : 1254 × 1254, transparence réelle ;
- mascotte source : 1324 × 1188, transparence réelle ;
- fond source : 1672 × 941, opaque ;
- logo Web : 512 × 512 ;
- mascotte Web : 900 × 808 ;
- fond Web : 1600 × 900.

Les versions Web optimisées sont destinées à l’application.
Les PNG source servent d’autorité graphique et ne doivent pas être intégrés tels quels au bundle HTML final.

---

## 3. Usage visuel des assets de marque

### Logo

Utiliser le symbole dans le header, à côté du texte `Voti`.

Le mot `Voti` reste du vrai texte HTML.

Le logo :
- ne doit pas remplacer le nom accessible ;
- doit rester lisible à petite taille ;
- ne doit pas augmenter la hauteur du header ;
- peut être décoratif (`alt=""`) si le texte `Voti` est adjacent.

Taille visuelle indicative :
- 28–36 px desktop ;
- 26–32 px mobile.

### Fond

Utiliser principalement dans le thème `Voti Pop`.

Le fond doit rester très discret :
- il structure l’espace ;
- il ne concurrence jamais textes ou cartes ;
- il ne doit pas réduire les contrastes.

Approche possible :
- pseudo-élément ou couche de fond dédiée ;
- faible opacité ;
- `background-size: cover`;
- pas de parallax ;
- pas d’animation.

Les autres thèmes peuvent conserver leur identité propre sans ce visuel si son utilisation nuit à leur cohérence.

### Mascotte

Usage volontairement ponctuel.

Recommandé :
- état vide de la bibliothèque ;
- première création ;
- quelques messages positifs / onboarding.

Éviter :
- mascotte géante persistante ;
- mascotte sur chaque sondage ;
- répétition à chaque écran ;
- surcharge visuelle.

Elle doit personnaliser Voti sans rendre l’application infantile pour les adolescents.

---

## 4. Distinction fondamentale : branding vs assets utilisateur

Les assets de marque :
- sont statiques ;
- appartiennent à l’application ;
- sont embarqués au build ;
- ne passent pas par IndexedDB.

Les images ajoutées par les créateurs :
- sont des données utilisateur ;
- passent par `AssetAdapter`;
- sont stockées en IndexedDB côté Web ;
- sont référencées par identifiant dans les sondages ;
- sont intégrées à l’export/import.

Ne jamais mélanger ces deux catégories.

---

## 5. AssetAdapter

Créer une abstraction indépendante du DOM et de l’implémentation IndexedDB.

Contrat minimal recommandé :

- `put(asset)`
- `get(id)`
- `delete(id)`
- `has(id)`
- `listMetadata()`
- opérations nécessaires à import/export et nettoyage

Un asset doit contenir au minimum :

- `id`
- `mimeType`
- `width`
- `height`
- `byteLength`
- blob binaire
- version de format si nécessaire

Éviter de stocker des blobs ou gros base64 dans `localStorage`.

---

## 6. IndexedDB

Créer une implémentation Web de `AssetAdapter` via IndexedDB.

Objectifs :
- stockage binaire ;
- transactions ;
- validation ;
- erreurs de quota compréhensibles ;
- absence de dépendance externe.

Le stockage métier JSON existant reste séparé.

Les sondages ne stockent que des références stables d’asset.

---

## 7. Images des sondages

Ajouter une image facultative au sondage.

Usage :
- création / édition avant verrouillage ;
- page de vote ;
- page de gestion ;
- éventuellement petite vignette bornée dans la bibliothèque.

La liste principale doit rester compacte.

La vignette ne doit pas transformer chaque ligne en grande carte.

---

## 8. Images des choix

Chaque choix peut recevoir une image facultative.

Le libellé texte reste obligatoire.

Dans la page de vote :

- image + texte ;
- texte toujours lisible ;
- sélection évidente ;
- responsive ;
- clavier ;
- aucun sens transmis uniquement par l’image.

L’image ne doit jamais contenir automatiquement la conséquence du choix.

---

## 9. Images et verrouillage

L’identité de l’image associée au sondage ou à un choix peut influencer l’interprétation du vote.

Pour cette version :

- `pollImageAssetId` et les références d’image des choix sont considérées comme sémantiques ;
- elles sont modifiables tant qu’aucun bulletin n’a été accepté ;
- elles sont verrouillées avec la définition lors du premier vote ;
- elles participent à l’empreinte sémantique.

Ne pas permettre de remplacer une image de choix après le premier vote.

Les paramètres purement visuels futurs (crop/position si séparés) pourront être arbitrés ultérieurement.

---

## 10. Modèle et migration

L’ajout de références d’assets modifie le modèle.

Ne pas contourner cela en glissant les images dans un champ de style existant.

Faire une évolution explicite de schéma.

Exigences :
- migration déterministe des snapshots v1 existants ;
- anciens sondages sans images restent valides ;
- import des anciennes sauvegardes continue à fonctionner via migration explicite ;
- versions inconnues restent refusées ;
- aucun remplacement silencieux.

Documenter précisément le numéro de version et le mécanisme retenu.

---

## 11. Traitement des images importées

Types acceptés recommandés :
- JPEG ;
- PNG ;
- WebP.

Refuser :
- SVG utilisateur dans ce lot ;
- GIF animé ;
- formats inconnus.

Avant stockage :
- décoder réellement l’image ;
- vérifier dimensions ;
- redimensionner si nécessaire ;
- compresser ;
- normaliser l’orientation ;
- supprimer les métadonnées inutiles par réencodage.

Cibles raisonnables à confirmer dans l’implémentation :

### Image de sondage
- côté long max : ~1600 px ;
- taille finale cible : <= 1 Mo.

### Image de choix
- côté long max : ~1000 px ;
- taille finale cible : <= 600 Ko.

Le traitement doit se faire localement dans le navigateur.

Ne jamais envoyer l’image sur un service distant.

---

## 12. UX image

Pendant l’ajout :

- bouton clair `Ajouter une image`;
- aperçu ;
- `Changer l’image`;
- `Retirer l’image`;
- erreur compréhensible ;
- état de traitement si nécessaire.

Ne jamais obliger à ajouter une image.

Sur mobile :
- éviter des previews gigantesques ;
- garder les actions principales visibles ;
- conserver des cibles >= 44 px.

---

## 13. Sauvegarde & transfert

L’export doit inclure les assets utilisateur référencés.

Le format peut rester un fichier de sauvegarde unique.

Pour cette version, un conteneur JSON versionné avec assets encodés en base64 est acceptable si :
- les images sont déjà bornées/compressées ;
- la taille est contrôlée ;
- l’import valide tout avant écriture ;
- les références sont vérifiées ;
- aucun asset manquant ou ID dupliqué n’est accepté silencieusement.

L’import doit être transactionnel autant que raisonnablement possible :

1. lire ;
2. parser ;
3. valider complètement ;
4. préparer les assets ;
5. écrire ;
6. ne publier le nouvel état que si l’ensemble est cohérent ;
7. nettoyer en cas d’échec.

Ne pas fusionner silencieusement avec un espace non vide si la règle actuelle l’interdit.

---

## 14. Suppression / assets orphelins

Prévoir une stratégie simple :

- lorsqu’une image est remplacée avant verrouillage, supprimer l’ancienne si elle n’est plus référencée ;
- lorsqu’un import échoue, ne pas laisser d’assets partiels ;
- fournir une fonction interne permettant de détecter/nettoyer les assets orphelins.

Ne pas supprimer un asset encore référencé.

---

## 15. Build autonome

Voti doit rester utilisable en HTML autonome.

Les assets de marque optimisés doivent donc être embarqués dans `index.html` au build, sans requête réseau.

Le build doit :
- partir des WebP optimisés ;
- les encoder/inliner automatiquement ;
- ne pas embarquer les PNG source ;
- conserver le fonctionnement `file://` hors ligne.

Les images ajoutées par l’utilisateur restent dans IndexedDB et ne sont évidemment pas intégrées au build statique.

---

## 16. Accessibilité

Vérifier :
- texte obligatoire pour chaque choix ;
- images décoratives avec alt vide ;
- images informatives associées à un texte existant ;
- focus ;
- clavier ;
- contraste ;
- zoom ;
- 360 px ;
- image désactivée/non chargée sans rendre le vote impossible.

---

## 17. Tests obligatoires

Ajouter des tests pour :

### Branding
- trois assets optimisés présents ;
- build autonome les embarquant ;
- aucune requête réseau ;
- logo n’agrandissant pas le header ;
- mascotte non bloquante ;
- fond ne diminuant pas les contrastes principaux.

### AssetAdapter
- put/get/delete ;
- IDs ;
- métadonnées ;
- quota/erreurs simulées ;
- nettoyage.

### Traitement image
- JPEG/PNG/WebP ;
- rejet formats interdits ;
- redimensionnement ;
- taille maximale ;
- dimensions ;
- image malformée.

### Modèle
- migration anciens snapshots ;
- nouvelles références ;
- empreinte sémantique ;
- verrouillage après premier vote ;
- anciens sondages sans images.

### Export/import
- sauvegarde sans asset ;
- avec image de sondage ;
- avec images de choix ;
- IDs et références ;
- asset absent ;
- doublon ;
- données corrompues ;
- échec sans état partiel.

### Browser
- ajout/remplacement/retrait avant vote ;
- vote avec image ;
- verrouillage image après vote ;
- affichage bibliothèque compact ;
- 360 px ;
- les cinq thèmes ;
- `file://` offline ;
- `/voti/`.

---

## 18. Périmètre exclu

Ne pas développer encore :
- QR ;
- PDF ;
- Cloudflare ;
- relais ;
- comptes ;
- groupes ;
- Android ;
- Capacitor ;
- upload distant ;
- synchronisation distribuée ;
- bibliothèque média générale ;
- cropper sophistiqué ;
- filtres photo.

---

## 19. Rapport attendu

Créer :

`docs/CODEX_UX_V0_2B_2_REPORT.md`

Inclure :
- architecture AssetAdapter ;
- choix IndexedDB ;
- migration du schéma ;
- traitement/compression ;
- format de backup ;
- intégration logo/fond/mascotte ;
- fichiers créés/modifiés ;
- tests ;
- résultats exacts ;
- limites ;
- arbitrages ;
- validation humaine restante ;
- préparation du futur relais et Android.
