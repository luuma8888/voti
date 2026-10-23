# Identités visuelles intégrées — préparation locale v0.6.2

## Décision produit

Membres : créatures/animaux originaux 2D, carrés, transparents et lisibles en petite
vignette. Groupes : lieux fantasy carrés dans le même langage graphique. Les vrais
packs seront fournis séparément. Aucun personnage sous licence, image personnelle,
upload, URL distante, R2, stockage d’image ou base64 utilisateur. Les éventuelles
images de sondages appartiennent à un autre lot et ne sont pas concernées.

## Manifestes et build offline

`web/assets/member-visuals/manifest.json` et `group-visuals/manifest.json` contiennent
actuellement des tableaux `entries` vides : aucune galerie factice ou vide affichée.
Exemple documentaire d’une future entrée (ne pas l’ajouter avant le vrai fichier) :

```json
{"id":"member_fox_01","type":"member","label":"Renard étoilé","file":"renard-etoile.webp","optionalTags":["créature"]}
```

Même format avec `group_crystal_cave_01`, type `group`. Les IDs sont stables et
indépendants des noms de fichiers. `scripts/visual-assets.mjs` vérifie type, ID,
unicité, label, nom de fichier local PNG/WebP sans chemin/URL, limite 300 Ko,
64–1024 px carrés. Le build lit seulement ces fichiers du dépôt et embarque leurs
octets dans le HTML, sans fetch runtime. Ce base64 compilé est un asset de Voti,
jamais une image utilisateur. Ne pas recycler ou renommer un ID déjà distribué.

`visual-presets.js` ne résout que les IDs du catalogue compilé et des sources
PNG/WebP embarquées ; une URL ou un ID inconnu n’affiche rien. `visual-gallery.js`
offre des radios natifs, labels, focus et « Aucune illustration », ainsi que des
options d’affichage membre/groupes sans persistance. Les catalogues vides masquent
ces composants. Ajouter un vrai fichier et son entrée suffit au build ; aucune
nouvelle logique de résolution n’est nécessaire.

## Rendu préparé

Les listes membres/groupes peuvent consommer `memberVisualId` / `groupVisualId` de
présentation, aujourd’hui absents des projections serveur : vignettes de 40 px,
sans agrandir les lignes. Le modèle Carte accepte un `memberVisualId`, les
`groupVisualIds` correspondants aux groupes, et `visualDisplayOptions`.

Sur la carte écran : membre 80–90 px, groupes 28 px. PDF : membre 180 px, groupes
56 px dans un bloc carte de 1120 px de large (soit environ 90/28 px dans un aperçu
à demi-échelle). Au plus trois groupes illustrés et résumé du surplus. Le QR noir
reste sur blanc opaque avec quiet zone ; aucune illustration derrière ou superposée.
Sans illustration le layout reste utilisable, sans emplacement vide obligatoire.

Les fixtures raster géométriques des tests sont exclusivement locales, explicitement
étiquetées, créées en mémoire et non ajoutées aux manifestes ou au build production.

## Stockage futur — analyse seulement, pas de migration dans ce lot

Modification additive minimale proposée pour un prochain lot avec les vrais packs :

- `space_members.member_visual_id TEXT NULL` et `groups.group_visual_id TEXT NULL` ;
- validation serveur d’IDs autorisés, modification via les commandes de gestion
  existantes et leur CAS ; aucune donnée binaire, URL ou nouveau credential ;
- projections admin/participant limitées à ces IDs, sans ajout au bulletin/commentaire
  anonyme, sans modifier éligibilité, snapshot ou unicité ;
- sauvegardes/exports versionnés pour les seuls IDs, migration additive explicitement
  auditée et autorisée à ce moment-là ; anciens membres/groupes restent à null ;
- cartes émises : thème/options/IDs en mémoire de présentation comme aujourd’hui ;
  aucune récupération du credential côté serveur ni coffre de cartes.

Aucune colonne, migration 0005, commande/projection Worker ou persistance distante
n’est implémentée ici. La sélection durable du visuel d’un membre/groupe attend
ce futur lot ; préparer le renderer ne constitue pas cette fonctionnalité.
