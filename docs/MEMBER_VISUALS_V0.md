# Identités visuelles prédéfinies Voti

## Politique produit

Membres et groupes utilisent exclusivement les illustrations intégrées : aucune
image personnelle, URL utilisateur, import, upload, R2, blob D1, base64 d'image ou
synchronisation binaire. L'absence d'illustration est un vrai choix, sans placeholder.
Une illustration n'est pas une preuve d'identité. Les images de sondage relèvent
 d'un autre modèle, inchangé par ce lot.

## Source et variantes

`web/assets/voti-visuals/assets-manifest.json` est la source structurée :
132 membres (60 creature, 36 child, 36 adult) à trois variantes et 36 groupes HD V2
à quatre variantes, soit 540 WebP. Les fichiers fournis sont copiés sans recompression ; empreintes de référence dans
`docs/audit/VOTI_VISUAL_CHECKSUMS.sha256`. Les documents de transfert et ZIP restent
hors runtime, dans byluuma ignoré. Le résidu de feuille exclu n'est pas intégré.

- icon 128×128 : grilles et listes de 40 px ; humains déjà cadrés visage/haut du corps.
- medium : aperçu/Vignettes ; humains 256×384, créatures 256×256, groupes 384×384.
- large : fiches et cartes ; humains 384×576, créatures 512×512, groupes 768×768.
- backdrop : groupes uniquement, 1024×1024, fonds de cartes écran/PDF et mosaïques.

Les groupes HD V2 conservent les 36 IDs métier, l’ordre et les libellés français.
Le fichier de transfert G01/09 nommé mushroom_village correspond à l’ID existant
mushroom_village_nook, qui reste inchangé. Les 144 fichiers groupes portent un
suffixe de hash ; le manifeste fournit leurs chemins. La banque V1 est retirée.
Les membres et leurs fichiers restent inchangés.

Le build valide inventaire, types, chemins, dimensions et empreintes. Il compile
uniquement les métadonnées dans le HTML. Les fichiers restent des WebP séparés.
`getMemberVisual`, `getGroupVisual`, `listMemberVisuals`, `listGroupVisuals` et
`filterMemberVisuals(all|creature|child|adult)` résolvent les IDs, jamais un chemin
fourni par l'utilisateur. Les IDs du manifeste sont stables et ne doivent pas
être recyclés. `shared/visual-ids.js` est généré depuis ce JSON ; le build refuse
une désynchronisation. Ce petit catalogue serveur ne contient aucune image.

## Sélection et gestion

La fiche ou le formulaire de création propose Choisir/Changer l'illustration.
Le dialogue natif affiche une grille icon, filtres membres avec comptes, aperçu
medium au survol/focus/tap et validation explicite. Aucune illustration puis
validation remet le champ à NULL. Fermer/Escape/navigation annule. Roving focus,
flèches/Home/End, Tab/Maj+Tab, focus restauré et libellés accessibles.
La sélection est provisoire : Enregistrer le membre/groupe ou Créer valide la fiche.
Un nouveau membre ou groupe n'a aucune illustration par défaut.

La fiche charge le large avec contain, humains verticaux. Les listes ne chargent
que l'icon ; aucune grande carte ou bannière. Les groupes autorisés restent
cloisonnés et un Créateur ne gagne aucun droit de gestion des membres.

## Persistance additive locale

Migration `0005_visual_identities.sql` : `space_members.visual_id TEXT NULL` et
`groups.visual_id TEXT NULL`. Aucun blob, URL, nouvelle entité ou credential.
Les anciennes lignes restent NULL. Les commandes createMember/updateMember et
createGroup/renameGroup acceptent visualId en option : ID connu du bon type ou NULL.
L'omission dans update/rename conserve l'ID courant, NULL l'efface ; CAS et rôles
existants s'appliquent. Les IDs invalides sont refusés en 400 avant mutation.

getSpace/getMemberHome acceptent includeVisuals ; le nouvel adaptateur le demande.
Sans cette option, la projection historique exacte reste valide pour les anciens
clients stricts. Aucun ID ajouté aux bulletins, commentaires, éligibilité ou résultats.
La migration et le Worker ne sont **pas déployés** par ce lot local.

## Carte écran et PDF

Même modèle sémantique : nom/Espace/groupes/thème/credential/IDs/options. Membre
large contain (humain corps entier), groupes icon en miniatures 28 px à l'écran,
56 px dans le raster PDF. Aucun lieu géant face au QR. Le QR reste noir sur blanc
opaque, modules entiers, quiet zone, sans image sous ou sur le code. Aucun cadre
photo vide quand NULL. Les thèmes/options de carte restent en mémoire uniquement.

## Distribution, performance et offline

Le HTML conserve ses modules intégrés, mais le pack graphique est distribué avec
`web/assets/voti-visuals/`. Copier le seul HTML ne suffit pas pour ces illustrations.
Depuis le dossier complet, les fichiers sont disponibles offline sans requête
Internet. Depuis HTTP, le cache navigateur est opportuniste ; aucun nouveau service
worker/PWA ou cache de données privées n'est ajouté. Les opérations du relais
exigent toujours Internet. Les images appartiennent au site/dossier local, sans CDN.

La grille contient 132 icon au maximum, loading=lazy et decoding=async ; medium
à la demande, large seulement fiche/carte ; backdrop uniquement pour les groupes
effectivement utilisés dans un fond de carte/PDF (quatre au maximum, cache partagé). Aucun chargement des 132 large à
l'ouverture. Le dev server expose seulement les chemins du pack public.

## Cache des groupes HD V2

Le catalogue expose `getGroupVisual(id).files.{icon,medium,large,backdrop}` et
conserve les alias plats existants. Une nouvelle image remplace son URL physique
par un suffixe SHA-256 ; l’ID D1 ne change jamais. Un ancien fichier peut rester
en cache sans être demandé par le nouveau catalogue. Le serveur local marque ces
URLs hashées immuables ; Pages conserve ses propres en-têtes, sans dépendance à
leur durée. Aucun rechargement automatique d’un onglet contenant des cartes secrètes.
Pour une future mise à jour, ouvrir une nouvelle version du HTML après avoir
sauvegardé les cartes nécessaires. Le dossier complet reste la distribution offline ;
aucun préchargement global des backdrops ni service worker ajouté.
