# Cartes membre — Voti v0.6

## Credentials et droits

Credential opaque `voti-member-v1.<64 caractères hexadécimaux>` : 32 octets générés
par `crypto.getRandomValues`, soit 256 bits. Aucun nom, pseudo ou rôle dans le QR.
SHA-256 standard, domaine `voti-space-credential-v1`, relayId et type distincts :
le serveur conserve seulement un digest. Pas de cryptographie artisanale.
Types `member`, `staff`, `invitation` non interchangeables.

La carte ouvre uniquement le parcours Participant. Les capacités de gestion utilisent
un fichier SECRET séparé et ne sont jamais intégrées aux cartes membre.

QR : URL Voti `#/member/<credential>`. Le fragment est immédiatement retiré par
`history.replaceState` **avant stockage, rendu ou fetch**. Le credential est ensuite
utilisé uniquement en mémoire, et dans Authorization Bearer sur les demandes privées.
Jamais de query/path HTTP contenant la carte. Le lecteur de QR interne accepte
seulement le même site, sans query, et traite caméra/photo localement.

## Parcours temporaires

- Sondage d’abord : QR sondage → Présente ta Carte Voti → caméra ou photo de carte
  → éligibilité → choix/confirmation → succès → identité oubliée.
- Carte d’abord : QR carte → Mon espace → À toi de participer / Déjà participé / Fermé /
  Résultats disponibles → sondage → succès → identité oubliée.
- QR choix : carte si nécessaire → confirmation directe avec commentaire facultatif ;
  aucune soumission au scan. En identifié, le serveur fournit le nom du membre.

Session en mémoire seulement, maximum cinq minutes, sans cookie/JWT participant,
localStorage, sessionStorage, IndexedDB ou historique de cartes. Le vote réussi,
« Terminer », le changement de parcours, le départ de page et l’expiration effacent
la carte/projection. Un message BroadcastChannel **sans identité ni token** neutralise
les autres onglets participants de ce profil après un vote ; une soumission déjà en
cours termine avant son propre effacement. Les réaffichages ne récréent pas une session.

La durée de cinq minutes concerne le contexte mémoire de l’application, pas la
durée de validité de la carte : le credential imprimé reste utilisable jusqu’à
révocation. Le navigateur, le scanner système ou l’appareil peuvent conserver leurs
propres traces : Voti ne promet pas de nettoyer tout l’historique système.

## Émission, impression et révocation

Le secret brut est montré uniquement à la création/régénération, en mémoire.
Téléchargement explicite de plusieurs cartes sur A4 : huit cartes par page,
nom/pseudo, Espace, QR M avec quiet zone, « Garde cette carte pour toi. ».
La file d’impression est effacée en quittant la gestion ; aucun coffre permanent de
cartes dans le navigateur. Perte avant téléchargement : régénérer, pas récupérer
un ancien secret depuis le serveur. Rechargement d’une invitation acceptée ne
reconstitue pas sa carte : demander une régénération à l’administrateur si perdue.

### Clarifications locales v0.6.1

Avant le vote, « Carte reconnue : nom/pseudonyme » rassure sur la carte lue. Ce texte
provient seulement du profil en mémoire ; il n'est pas ajouté à la soumission anonyme.
Succès, Terminer, sortie du parcours et expiration effacent toujours ce profil.

L'écran d'émission distingue **cette carte** et **le lot disponible pendant cette visite**.
Le lot énumère ses membres ; ce n'est jamais la promesse de récupérer toutes les cartes
depuis le serveur. Les PDF sont nommés d'après l'Espace et le membre ou le nombre de
cartes du lot, sans credential. Huit cartes par A4, QR opaque et zone de silence conservés.
Les noms peuvent apparaître dans ces fichiers : ils restent des documents secrets.

Après révocation, le statut « Carte révoquée » est visible et le bouton de révocation
est désactivé ; la régénération reste proposée. Les règles serveur sont inchangées.

Révoquer carte : accès futur interdit, membre et votes conservés. Régénérer : ancienne
carte invalide, nouveau digest, même membre et même consommation déjà acquise.
Révoquer membre : carte et affiliations actives retirées, historique/snapshot conservés.

## Précautions

Une copie de carte donne ses droits de participant. Le nom n’est pas vérifié.
Ne pas photographier ni publier les cartes ; fichiers/PDF/QR de carte sont secrets.
L’adulte émetteur peut avoir conservé une copie et l’utiliser : le protocole n’assure
pas une protection cryptographique contre l’émetteur, l’opérateur D1 ou l’hébergeur.
Une carte volée utilisée pour un vote anonyme consomme le droit ; on ne peut ni
retrouver ni retirer le bulletin correspondant par l’identité du membre.

Sur un téléphone collectif, utiliser un profil participant **sans accès de gestion
déjà conservés**. La carte ne confère pas de droits de gestion ; Voti n’est pas un
verrouillage kiosque protégeant les capacités d’un propriétaire ayant prêté son
profil administrateur. Fermer les PDF/QR secrets après impression/transfert.

La recette humaine v0.6 est consignée dans le rapport de déploiement v0.6.
Les changements v0.6.1 sont testés localement ; leur ergonomie réelle reste à valider.
La lecture vidéo est arrêtée en quittant le scanner ; une caméra indisponible laisse
le choix d’une photo. Le scanner système du téléphone reste une alternative pour
le parcours carte d’abord, sans intégrer de service de décodage distant à Voti.
Le scanner v0.6.1 alterne analyse bornée du cadre entier et de son centre (1 280 px
maximum), avec guidage pour rapprocher/agrandir/stabiliser. Caméra simulée et photos
de fixtures ne constituent pas une validation de caméra téléphone réelle.

## Polissage local post-commit v0.6.2

L’émission affiche un véritable aperçu « Ma carte individuelle », avec nom/pseudo
dominant, Espace et groupes secondaires. Un thème de cette carte peut être choisi
parmi Voti Pop, Nature, Douceur, Nuit et Minimal. Le choix vit dans la carte en
mémoire de cette visite, sans stockage navigateur ou serveur, et s’applique au PDF
individuel et à son entrée dans le lot disponible. Les autres cartes gardent leurs
propres choix. Quitter efface toujours la file, sans coffre permanent.

`memberCardModel` fournit les mêmes nom, Espace, groupes, thème et options aux
renderers écran/PDF. Le DOM est responsive ; le PDF garde huit cartes A4 par page.
QR noir, blanc opaque, quiet zone et modules entiers sont inchangés, même en Nuit.
Le titre et le nom plus grands n’empiètent pas sur le QR. Les miniatures groupes
restent secondaires face à l’éventuelle illustration membre et au QR.

La préparation initiale utilisait des manifestes vides. Les vrais packs sont
désormais intégrés dans le lot local décrit ci-dessous : uniquement des
illustrations prédéfinies, jamais une photo personnelle. Voir `MEMBER_VISUALS_V0.md`
pour le catalogue et la persistance locale des seuls IDs, sans migration production.

## Intégration locale des vrais packs

Les vrais WebP fournis remplacent désormais l'échafaudage vide décrit ci-dessus.
Les IDs de membre/groupes choisis dans les fiches sont transmis à la carte lors
de création/régénération/invitation ; les illustrations ne sont jamais dans le QR.
Large membre (humain vertical contain) et petits icon groupes, modèle commun écran
et PDF. Le choix de thème reste temporaire. Les cartes existantes ne deviennent pas
récupérables : aucun coffre de credentials. Voir `MEMBER_VISUALS_V0.md` pour le
catalogue, la migration locale et la distribution du dossier offline complet.


## Harmonisation Carte/UX après validation humaine

Le DOM et le PDF utilisent `card-layout.js` : même surface logique 1120×760,
mêmes zones et retours à la ligne. L’aperçu se réduit sur téléphone sans changer
la composition imprimée. La planche conserve huit cartes A4. Le QR utilise la
plus grande grille entière dans une zone de 456 ; le lien courant donne 424 pixels
logiques, soit environ 35,9 mm imprimés. Quiet zone et blanc opaque restent intacts.
L’illustration membre en contain occupe une zone haute de 448 : corps entier humain,
créature plus grande ; les groupes restent des icon de 62 avec leur nom, trois
maximum puis résumé. Aucun asset, credential ou règle de collecte ne change.
