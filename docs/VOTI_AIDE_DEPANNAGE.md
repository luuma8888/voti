# Aide & dépannage Voti

<!-- D3 — source éditable, 26 octobre 2026.
Source principale : VOTI_GUIDE.md ; compléments : VOTI_DEMARRAGE_RAPIDE.md et
VOTI_GUIDE_KIT_PLAN.md. Référence applicative : 601aeb04c171fae6b4f4928d694f9ce8c4ddf190.
Montage après polish : quatre pages A4 portrait, corps principal 12 pt.
Les anciens sauts servent de repères éditoriaux ; le montage regroupe les familles.
Entrées courtes, titres compacts ; conserver chaque entrée d’un seul tenant.
Aucune image intégrée : les symptômes et renvois vers D2 suffisent ici.
Captures existantes inchangées ; aucun nouveau cliché ni nouvelle copie.
Mise en page et export : guides/build_guides.py ; vérifier les pages après modification.
-->

<a id="page-1"></a>
## Avant de commencer

Vérifie Internet pour les Espaces, le [bon site Voti](https://luuma8888.github.io/voti/),
le bon Espace, ton rôle (**Administrateur**, **Créateur**, **Participant**),
l’appareil ou profil utilisé et le message affiché. Ces rôles ne dépendent pas de l’âge.

**Ne partage jamais un fichier d’accès, une Carte Voti ou son QR sur un canal public
pour demander de l’aide.** Ne recharge pas si une saisie ou des Cartes restent à conserver.
Une Carte ouvre la participation ; un fichier de gestion donne des droits de gestion.

## Accès à Voti / Espaces

### Mes Espaces est vide sur un nouvel appareil

**Vérifie :** l’accès n’est pas transféré automatiquement, même en installant Voti.
**À faire :** dans **Espaces & groupes**, importe le fichier d’accès correspondant
avec **Choisir un fichier**.
**Si ça bloque encore :** contacte l’Administrateur.
Voir [Retrouver son Espace](VOTI_GUIDE.md#p04).

### Accès refusé ou Espace inaccessible

**Vérifie :** connexion, site, fichier du bon Espace et bon profil ; l’accès peut
être révoqué ou l’Espace archivé.
**À faire :** demande à l’Administrateur de vérifier les droits.
**Si ça bloque encore :** voir [Besoin d’aide](#besoin-aide). Ne recrée pas un
Espace pour tenter de retrouver l’ancien.

### Mon fichier d’accès est perdu

**Vérifie :** l’Espace s’ouvre-t-il encore sur un appareil ?
**À faire :** si oui, **Réglages → Exporter mon accès SECRET**, puis garde cette copie privée.
**Si ça bloque encore :** contacte un autre Administrateur ou le support Voti s’il
t’a été communiqué. Sans accès valide, aucune récupération automatique par e-mail
n’est proposée. Voir [Conserver son accès](VOTI_GUIDE.md#p05).

## Cartes Voti

### Mauvaise Carte ou pseudo incorrect

**Vérifie :** le pseudo affiché correspond-il à ta propre Carte ?
**À faire :** ne confirme aucun vote. Utilise **Terminer** s’il est proposé ; sinon
quitte le parcours, puis présente la bonne Carte.
**Si ça bloque encore :** l’Administrateur vérifie le membre.
Voir [Participer avec sa Carte](VOTI_GUIDE.md#p29).

### Ma Carte est perdue ou a pu être copiée

**Vérifie :** un PDF privé est-il encore disponible ? La Carte est-elle compromise ?
**À faire :** demande à l’Administrateur le remplacement ou la révocation appropriée.
Remplacer invalide l’ancienne Carte ; révoquer n’en fournit pas de nouvelle.
**Si ça bloque encore :** voir [Remplacer ou révoquer une Carte](VOTI_GUIDE.md#p19).
Le QR d’origine ne se reconstitue pas depuis le serveur.

### La caméra ne fonctionne pas ou le QR ne se lit pas

**Vérifie :** permission caméra, navigateur et QR entier, net et visible.
**À faire :** utilise **Choisir un fichier** avec une photo privée si le parcours
le propose. Pour ouvrir un lien QR, le scanner habituel du téléphone peut aussi servir.
**Si ça bloque encore :** demande de l’aide sur place, sans envoyer la photo de ta
Carte à une personne extérieure. Voir [Présenter sa Carte](VOTI_GUIDE.md#participer).

## Membres / Groupes

### Mauvais groupe ou sondage invisible pour un membre

**Vérifie :** avec l’Administrateur, l’affiliation actuelle et les personnes retenues
lors de la publication.
**À faire :** l’Administrateur corrige si nécessaire depuis la fiche du membre,
puis **Enregistrer**.
Cela ne change pas rétroactivement l’audience d’un sondage publié.
**Si ça bloque encore :** demande au Créateur de vérifier la publication et l’audience.
Voir [Modifier les groupes d’un membre](VOTI_GUIDE.md#p13).

<div class="page-break" style="break-before: page; page-break-before: always;"></div>

<a id="page-2"></a>
## Sondages / Participation

### Le sondage existe, mais personne ne peut voter

**Vérifie :** est-il encore **Brouillon** ? **Créer n’est pas publier.**
**À faire :** avec les droits de gestion, ouvre **Gérer**, vérifie le résumé et les
membres concernés, puis **Publier pour les membres**.
**Si ça bloque encore :** contacte le Créateur ou l’Administrateur.
Voir [Publier le sondage](VOTI_GUIDE.md#p27).

### Le bouton de modification a disparu ou un champ est bloqué

**Vérifie :** premier vote reçu, sondage fermé ou audience déjà publiée ?
**À faire :** respecte le verrouillage ; l’audience est figée à publication,
le contenu et les règles au premier vote. Ce n’est pas forcément une panne.
**Si ça bloque encore :** voir [Ce qui reste modifiable](VOTI_GUIDE.md#modifier)
avec la personne qui gère le sondage.

### Mes changements ne semblent pas enregistrés

**Vérifie :** connexion, **Modifications non enregistrées**, confirmation ou erreur réseau.
**À faire :** garde les saisies ; utilise la barre **Enregistrer** —
**Enregistrer les règles** pour le sondage. Attends **Modifications enregistrées.**
**Si ça bloque encore :** garde l’écran ouvert ; demande de l’aide avant de recharger.
Voir [Enregistrer les modifications](VOTI_GUIDE.md#p26).

### Voti indique « Déjà participé »

**Vérifie :** bon pseudo et bon sondage ?
**À faire :** ne renvoie pas de vote : un membre vote une seule fois par sondage.
Remplacer sa Carte ne réinitialise pas sa participation.
**Si ça bloque encore :** demande à l’Administrateur de vérifier la bonne Carte,
sans attendre l’effacement d’un vote. Voir [Participer](VOTI_GUIDE.md#p29).

### Le sondage est fermé

**Vérifie :** l’état **Fermé**.
**À faire :** aucun nouveau vote n’est possible ; consulte les résultats si autorisé,
puis choisis **« Terminer »** si proposé, ou reviens à l’accueil.
**Si ça bloque encore :** contacte la personne qui gère le sondage.
Voir [Fermeture](VOTI_GUIDE.md#p32).

## Résultats

### Les résultats ne sont pas disponibles

**Vérifie :** commence par le motif affiché près de **Résultats**. Trois points comptent :

1. **Minimum atteint ?** Assez de personnes doivent avoir participé.
2. **Règle satisfaite ?** Le sondage peut attendre toutes les participations,
   la fermeture, ou l’un de ces deux événements selon le réglage.
3. **Consultation autorisée ?** Les résultats peuvent être réservés à la gestion.

**À faire :** suis le motif, sans changer de Carte pour contourner l’attente.
**Fermer un sondage ne permet jamais de contourner le minimum.**
**Si ça bloque encore :** contacte le Créateur ou l’Administrateur.
Voir [Comprendre les résultats](VOTI_GUIDE.md#resultats).

<div class="page-break" style="break-before: page; page-break-before: always;"></div>

<a id="page-3"></a>
## Lots de Cartes / Invitations

### Je ne retrouve plus le PDF des Cartes après rechargement

**Vérifie :** existe-t-il un PDF déjà téléchargé ? Le lot de session est temporaire.
**À faire :** retrouve ce fichier privé ; sinon, demande un remplacement si nécessaire.
La nouvelle Carte invalide l’ancienne : ce n’est pas sa copie identique.
**Si ça bloque encore :** voir [Retrouver le lot de session](VOTI_GUIDE.md#p17).
Voti ne récupère pas le secret original depuis le serveur.

### Le nouveau lot et le lot de session n’ont pas la même taille

**Vérifie :** quel bouton PDF est utilisé ?
**À faire :** **PDF de ces … cartes** = nouveau lot ; **PDF des … cartes** = toutes
les Cartes encore disponibles dans la session.
**Si ça bloque encore :** voir [Comprendre les deux lots](VOTI_GUIDE.md#p18).

### Un lot n’a réussi qu’en partie

**Vérifie :** nombres de réussites, échecs, Cartes **à vérifier** et **non traitées**.
**À faire :** conserve le PDF des réussites ; utilise **Vérifier les cartes** si
proposé avant de relancer. Ne remplace pas toute la sélection à l’aveugle.
**Si ça bloque encore :** l’Administrateur examine le bilan.
Voir [Créer un lot de Cartes](VOTI_GUIDE.md#p18).

### L’invitation a expiré ou toutes ses utilisations sont prises

**Vérifie :** expiration et usages avec l’Administrateur.
**À faire :** il crée une autre invitation si nécessaire.
**Si ça bloque encore :** voir [Gérer une invitation](VOTI_GUIDE.md#p21).
L’ancien lien secret ne se récupère pas depuis le serveur.

## Installation / PWA

### Je ne vois pas « Installer Voti »

**Vérifie :** navigateur compatible, site en HTTPS, installation déjà présente
et éventuelles restrictions de l’appareil.
**À faire :** continue dans le navigateur si l’installation n’est pas proposée.
**Si ça bloque encore :** voir [Installer Voti](VOTI_GUIDE.md#installer) ; demande
une autorisation si l’appareil est géré.

### J’ai l’impression d’avoir une ancienne version

**Vérifie :** une action est-elle en cours ?
**À faire :** termine-la, enregistre et télécharge les Cartes utiles, puis recharge.
Les Espaces nécessitent Internet.
**Si ça bloque encore :** indique ce qui paraît ancien.
Voir [Installation et mises à jour](VOTI_GUIDE.md#installer).

## Retrait des données

### Je veux supprimer un membre ou tout l’Espace

**Vérifie :** retrait d’accès et effacement sont différents.
**À faire :** consulte les conséquences : les actions décrites ne suppriment pas
totalement un membre ou un Espace.
**Si ça bloque encore :** contacte la personne responsable de l’Espace.
Voir [Actions avancées](VOTI_GUIDE.md#avance).

> **Ces actions ne signifient pas la même chose**
> Révoquer une **Carte** coupe son accès ; un **membre**, son droit de participer ;
> un **accès de gestion**, ses droits. Les votes passés restent. Archiver un **Espace**
> conserve l’historique, sans restauration dans l’interface. Supprimer un **sondage** retire ses
> données en ligne, pas les PDF distribués. [Conséquences détaillées](VOTI_GUIDE.md#avance).

<a id="besoin-aide"></a>
## Besoin d’aide ?

1. Note le message affiché par Voti.
2. Note l’écran où le problème apparaît.
3. Indique ton rôle : **Administrateur**, **Créateur** ou **Participant**.
4. Ne partage aucun secret, QR de Carte ou fichier d’accès publiquement.
5. Contacte la personne responsable de l’Espace ou le support Voti s’il t’a été communiqué.

Pour retrouver les procédures : [Guide Voti complet](VOTI_GUIDE.md).
