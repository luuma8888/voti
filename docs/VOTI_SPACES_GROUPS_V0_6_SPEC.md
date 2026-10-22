# Voti v0.6 — Espaces, groupes, cartes membre et vote contrôlé

## Statut

Spécification fonctionnelle et technique préparatoire.

Base attendue :
- Voti v0.5 publiée et validée humainement ;
- mini-lot v0.5.1 UX appliqué avant v0.6 ;
- profil de production gratuit, sans R2 ;
- architecture actuelle QR / relais / D1 / PDF / commentaires conservée sauf évolution explicitement décrite ici.

v0.6 est un lot structurel. Il ajoute une seconde façon d’utiliser Voti :

1. **Mode libre**, sans compte, sans groupe, conservant la simplicité actuelle ;
2. **Mode Espace**, avec groupes, membres, rôles, cartes QR membre et contrôle d’éligibilité.

Le but n’est PAS de construire un système classique de comptes avec e-mail/mot de passe.

---

# 1. Principes directeurs

Voti doit rester utilisable de deux façons parallèles.

## Mode libre

Créer et voter sans compte ni appartenance à un Espace.

Ce mode conserve les usages actuels :
- sondage libre ;
- accès par URL / QR ;
- participation anonyme ou identifiée selon les règles v0.5 ;
- aucune garantie stricte « une personne = un vote » faute d’identité de membre.

## Mode Espace

Un Espace Voti représente un collectif ou une structure.

Exemples :

```text
Accueil jeunes de Couiza
Conseil des enfants
Maison des jeunes
Classe CM2
Association
```

Un Espace peut contenir plusieurs Groupes.

Exemple :

```text
Accueil jeunes de Couiza
├── 8–10 ans
├── 11–13 ans
└── Conseil de jeunes
```

Les sondages d’Espace peuvent cibler :
- tout l’Espace ;
- un Groupe ;
- plusieurs Groupes.

---

# 2. Terminologie UX

Éviter de parler de « compte enfant » dans l’interface.

Utiliser plutôt :

```text
Carte Voti
Carte de membre
Mon espace
Mes sondages
```

Les administrateurs / créateurs peuvent avoir un accès persistant à l’Espace.

Les participants qui ne font que voter utilisent une **carte membre QR temporaire**, sans compte classique.

---

# 3. Entités conceptuelles

Prévoir au minimum :

```text
Space
Group
SpaceMember
GroupMembership
StaffAccess / SpaceAccess
MemberCredential
Invitation
PollAudienceSnapshot
PollMemberEligibility
```

Les noms de tables/classes peuvent différer si une architecture plus propre est démontrée.

Les responsabilités doivent rester séparées.

---

# 4. Espace Voti

Un Espace contient au minimum :

```text
spaceId
name
status
```

Éviter toute donnée personnelle obligatoire inutile.

Pas d’adresse, e-mail, téléphone ou identité légale imposés en v0.6.

Un administrateur peut :
- renommer l’Espace ;
- créer/renommer/supprimer des Groupes ;
- inviter des membres ;
- révoquer des membres ;
- gérer les rôles ;
- créer/gérer tous les sondages de l’Espace.

---

# 5. Groupes

Un Groupe appartient à un Espace.

Exemple conceptuel :

```text
groupId
spaceId
name
status
```

Un membre peut appartenir :
- à aucun Groupe ;
- à un Groupe ;
- à plusieurs Groupes.

La suppression d’un Groupe ne doit pas réécrire les anciens bulletins.

Ne jamais supprimer silencieusement l’historique d’un sondage déjà terminé.

---

# 6. Rôles

Trois rôles initiaux :

```text
Administrateur
Créateur
Participant
```

## Administrateur

Peut :
- gérer l’Espace ;
- gérer les Groupes ;
- gérer les membres ;
- gérer les rôles ;
- gérer tous les sondages de l’Espace ;
- révoquer/régénérer les cartes membre ;
- voir les données administratives autorisées.

## Créateur

Peut :
- créer des sondages dans les périmètres autorisés ;
- gérer ses sondages ou les sondages du périmètre accordé ;
- modérer les commentaires si autorisé ;
- consulter les informations administratives prévues par le mode anonyme/identifié.

## Participant

Peut :
- accéder aux sondages correspondant à son Espace / ses Groupes ;
- voter ;
- consulter les résultats si le sondage l’autorise.

---

# 7. Portée des rôles

Le rôle principal est défini au niveau de l’Espace.

Prévoir une restriction facultative par Groupe pour les Créateurs.

Exemple :

```text
Alice = Créatrice
groupScopes = [11–13 ans, Conseil de jeunes]
```

Ne pas créer une matrice ACL complexe.

Objectif v0.6 :
- Administrateur global Espace ;
- Créateur global ou limité à certains Groupes ;
- Participant membre de ses Groupes.

---

# 8. Accès administrateur / créateur

Pas de compte classique e-mail/mot de passe en v0.6.

Les accès persistants des administrateurs/créateurs peuvent rester basés sur une capacité secrète locale, cohérente avec Voti.

Prévoir :
- accès persistant sur leur appareil ;
- transfert volontaire via QR SECRET ou export sécurisé si nécessaire ;
- révocation possible.

Ne jamais confondre cette capacité avec la carte participant.

---

# 9. Carte membre Voti

Chaque participant peut disposer d’une **Carte Voti** imprimable ou affichable sous forme QR.

La carte sert de credential de membre.

Elle est :
- secrète ;
- révocable ;
- régénérable ;
- transportable ;
- utilisable sur n’importe quel appareil.

Elle ne contient pas en clair le nom/pseudo si cela peut être évité.

Préférer un token aléatoire fort.

Le serveur doit stocker une représentation adaptée, idéalement un digest de la capacité plutôt que le secret brut lorsque l’architecture le permet.

---

# 10. Pas de session persistante participant

Décision v0.6 :

**Toujours temporaire pour les participants.**

Ne pas proposer :

```text
Se souvenir de moi
Rester connecté
```

Une carte membre doit être rescanée lors d’une nouvelle utilisation.

Objectifs :
- limiter les blagues « voter à la place de » sur téléphones prêtés ;
- encourager l’enfant à garder sa carte ;
- permettre l’utilisation d’un téléphone collectif ;
- ne pas laisser l’identité d’un enfant persistée sur l’appareil d’un autre.

---

# 11. Parcours participant — sondage d’abord

Parcours principal ultra-court :

```text
Scanner QR sondage
→ Voti indique « Présente ta Carte Voti »
→ scanner Carte Voti
→ éligibilité vérifiée
→ voter
→ succès
→ identité temporaire oubliée automatiquement
```

Aucun écran « connexion », « profil », « déconnexion » nécessaire.

Après vote :
- session membre supprimée ;
- appareil remis dans un état neutre.

---

# 12. Parcours participant — carte d’abord

La Carte Voti peut également être scannée directement.

Parcours :

```text
Scanner Carte Voti
→ Mon espace
→ liste courte des sondages accessibles
→ choisir un sondage
→ voter
→ succès
→ identité temporaire oubliée automatiquement
```

La Carte Voti a donc deux fonctions :

1. identification lorsqu’un sondage la demande ;
2. ouverture de `Mon espace`.

---

# 13. Mon espace participant

Interface simple.

Afficher :
- prénom/pseudonyme de membre ;
- nom de l’Espace ;
- Groupes ;
- sondages accessibles ;
- état simple :
  - À voter
  - Déjà participé
  - Fermé
  - Résultats disponibles

Ne pas afficher de menus administratifs.

Après fin de l’action / vote :
- effacer la session temporaire.

Si l’utilisateur quitte/refraîchit avant vote :
- une nouvelle lecture de la carte peut être requise.

Aucune persistance longue dans localStorage/IndexedDB.

---

# 14. Carte perdue / compromise

Administrateur :

```text
Révoquer la carte
Régénérer la carte
```

Une nouvelle carte invalide l’ancienne.

Informer simplement l’administrateur.

Texte enfant possible :

```text
Ta Carte Voti sert à participer à ton nom dans les sondages de ton groupe.
Garde-la pour toi.
```

Ne pas employer un discours anxiogène.

---

# 15. Limite importante d’une carte compromise

Pour un sondage anonyme déjà voté avec une carte volée/utilisée par quelqu’un d’autre :

Voti ne peut pas identifier proprement quel bulletin anonyme supprimer sans casser l’anonymat.

Ne pas inventer une fonction dangereuse de « retrouver le bulletin de ce membre ».

La régénération protège les futurs usages.

Documenter cette limite.

---

# 16. Invitations individuelles

Un administrateur peut créer une invitation individuelle.

Elle permet :
- créer/activer un membre ;
- choisir ou confirmer un prénom/pseudonyme ;
- recevoir/afficher la Carte Voti.

L’invitation est :
- révocable ;
- consommable selon la stratégie choisie ;
- expirante si cela reste simple.

Ne pas demander e-mail ou téléphone.

---

# 17. Invitation de Groupe

Un administrateur peut aussi créer une invitation pour rejoindre un Groupe.

Elle peut permettre à plusieurs enfants de créer leur carte avec un pseudo.

Prévoir au minimum :
- fermeture manuelle ;
- limite d’utilisations configurable OU valeur raisonnable ;
- expiration facultative si facile à intégrer.

Ne jamais créer une invitation publique éternelle sans contrôle.

---

# 18. Identité membre

Identité déclarative seulement.

Exemple :

```text
displayName = "Léa"
```

ou pseudonyme.

Pas de vérification civile.

Deux membres peuvent éventuellement porter le même displayName.

L’identité technique repose sur `memberId` / credential, pas sur le texte du nom.

---

# 19. Audience d’un sondage

Ajouter une portée :

```text
pollAudience:
- free_public
- space
- groups
```

Pour `groups` :

```text
groupIds: [...]
```

Un sondage peut donc être :

- libre/public ;
- réservé à tout l’Espace ;
- réservé à un ou plusieurs Groupes.

---

# 20. Mode libre

Le mode libre reste accessible sans créer d’Espace.

Créateur :
- peut créer comme aujourd’hui.

Votant :
- vote comme aujourd’hui.

Les règles v0.5 restent valides :
- participation anonyme ou identifiée ;
- commentaires ;
- QR ;
- résultats.

Mode libre :
**aucune garantie une personne = un vote**.

Ne pas prétendre le contraire.

---

# 21. Sondage d’Espace/Groupe — unicité obligatoire

Pour tout sondage dont l’audience est :

```text
space
groups
```

une règle devient obligatoire :

> **Une seule participation par membre pour ce sondage.**

Pas d’option pour la désactiver en v0.6.

Cela vaut pour :
- anonyme ;
- identifié.

Un même membre utilisant sa carte sur plusieurs appareils ne peut pas voter deux fois.

---

# 22. Snapshot d’éligibilité figé

À la publication du sondage d’Espace/Groupe :

créer un **snapshot des membres éligibles**.

Le snapshot est figé.

Un enfant rejoignant le Groupe trois jours plus tard :
- ne devient pas automatiquement éligible à un sondage déjà publié.

Un changement de membership ultérieur :
- ne réécrit pas silencieusement l’audience historique.

But :
- stabilité de `X / Y participants` ;
- condition « tout le monde a voté » déterministe ;
- audit cohérent.

---

# 23. Avant publication

Tant que le sondage n’est pas publié / aucun snapshot final n’est créé :

le créateur peut modifier :
- Espace ;
- Groupes ciblés ;
- règles.

À publication :
- snapshot créé.

Après premier vote :
- règles sémantiques verrouillées comme actuellement.

Ne pas modifier rétroactivement l’éligibilité après votes.

---

# 24. Registre d’éligibilité

Créer conceptuellement une structure :

```text
PollMemberEligibility
```

contenant au minimum :

```text
pollId
memberId
status
```

Statuts possibles :

```text
eligible
consumed
```

La forme exacte peut différer.

---

# 25. Anonymat de Groupe — invariant principal

Pour un sondage anonyme réservé à un Espace/Groupe :

Voti doit pouvoir savoir :

```text
Ce membre est éligible.
Ce membre a déjà participé.
```

MAIS ne doit pas savoir par jointure directe :

```text
Quel bulletin est le sien.
```

L’enregistrement :

```text
consommation éligibilité + insertion bulletin
```

doit être atomique.

Ne stocker aucune clé commune inutile permettant :

```text
memberId → ballotId
```

Le bulletin anonyme ne doit pas contenir :
- memberId ;
- membershipId ;
- eligibilityId ;
- carte token ;
- displayName.

Éviter également les timestamps individuels précis si le modèle actuel ne les utilise pas.

Ne pas promettre un anonymat cryptographique/E2E absolu : absence de lien applicatif direct, pas impossibilité mathématique d’inférence opérateur.

---

# 26. Une participation anonyme par membre

Transaction conceptuelle :

1. authentifier temporairement la Carte Voti ;
2. vérifier snapshot éligible ;
3. vérifier `not consumed` ;
4. valider le vote ;
5. marquer l’éligibilité `consumed` ;
6. insérer le bulletin anonyme sans identifiant membre ;
7. insérer commentaire anonyme éventuel selon v0.5 ;
8. commit atomique.

Si une étape échoue :
- rien n’est consommé ;
- aucun bulletin orphelin.

Retry idempotent.

---

# 27. Ce que voit le membre anonyme

Dans `Mon espace` :

```text
À voter
```

puis après consommation :

```text
Déjà participé
```

Il ne voit pas nécessairement son ancien choix.

Ne pas stocker localement le bulletin sur l’appareil partagé pour le lui rappeler.

---

# 28. Ce que voit l’admin — sondage anonyme

Administrateur/créateur autorisé voit :

```text
8 participations sur 12
```

Il ne voit PAS par défaut :
- liste « Léa a voté » ;
- liste « Hugo n’a pas voté » ;
- tableau nominatif de participation.

Motif :
dans un petit groupe, cette information pourrait faciliter la déduction des votes.

Pas d’option nominative v0.6 pour le suivi d’un sondage anonyme.

---

# 29. Sondage identifié de Groupe

Pour un sondage `identified` d’Espace/Groupe :

la Carte Voti fournit automatiquement l’identité de membre.

Ne pas redemander :

```text
Ton nom ou pseudonyme
```

à chaque vote.

Afficher clairement :

```text
Ce sondage est identifié.
Ta réponse sera associée à ta Carte Voti.
```

L’identité membre peut être reliée au vote/commentaire selon le modèle v0.5 identified.

---

# 30. Suivi nominatif — identifié seulement

Dans un sondage identifié de Groupe :

administrateur/créateur autorisé peut voir :

```text
A participé
N’a pas encore participé
```

par membre.

But :
permettre de rappeler aux enfants qui ont oublié de voter.

Cette fonctionnalité est INTERDITE pour les sondages anonymes.

Prévoir filtre simple :

```text
Tous
A participé
À relancer
```

Pas de système de notification automatique en v0.6.

---

# 31. Commentaires

Conserver les règles v0.5.

Anonyme :
- commentaire sans identité ;
- avertissement anonymat.

Identifié :
- commentaire associé à l’identité membre ;
- règles de confidentialité existantes.

Modération inchangée.

Ne pas créer un nouveau système de commentaires de Groupe.

---

# 32. Publication des résultats — nouvelles conditions

Étendre les conditions existantes.

Prévoir au minimum :

```text
À partir de N participations
Quand tous les membres éligibles ont participé
À la clôture
Quand tous les membres ont participé OU à la clôture
```

Conserver les comportements historiques nécessaires pour les sondages libres.

---

# 33. « Tout le monde a voté »

La condition utilise :

```text
consumedEligibilityCount === eligibleSnapshotCount
```

et NON la taille actuelle du Groupe.

Le dénominateur est celui du snapshot figé à publication.

---

# 34. Tout le monde OU clôture

C’est le mode recommandé pour beaucoup d’usages jeunesse.

Résultats disponibles lorsque :

```text
allEligibleParticipated === true
OR
poll.status === closed
```

sous réserve des protections de confidentialité existantes.

---

# 35. Seuil de confidentialité existant

Ne jamais affaiblir silencieusement les protections existantes.

Si Voti possède un seuil plancher de confidentialité indépendant :
- le préserver ;
- documenter son interaction avec `all participated` / `closed`.

Ne pas rendre publiquement un résultat qu’une règle existante impose encore de masquer sans décision explicite.

---

# 36. Audience des résultats

Pour un sondage d’Espace/Groupe, ajouter :

```text
resultsAudience:
- poll_audience
- admins_only
```

## poll_audience

Résultats accessibles aux membres autorisés du sondage une fois les conditions remplies.

## admins_only

Résultats réservés aux administrateurs/créateurs autorisés.

Ne pas construire d’ACL plus complexe en v0.6.

---

# 37. Résultats en direct

Pas d’interdiction générale supplémentaire.

Les options de publication du sondage font autorité.

Si le créateur choisit un mode permettant des résultats avant clôture :
- accepter ce comportement.

Pour un sondage anonyme, la confidentialité dépend donc du réglage choisi par le créateur et du seuil existant.

Afficher des explications UX suffisamment claires lors du choix.

---

# 38. Suppression d’un membre

L’administrateur peut révoquer un membre.

Effets :
- Carte Voti invalide ;
- futur accès refusé ;
- adhésions actives retirées selon confirmation.

Ne PAS supprimer automatiquement :
- anciens votes ;
- anciens commentaires ;
- anciens résultats.

L’historique reste cohérent.

Pour un sondage déjà publié avec snapshot figé :
- ne pas réécrire silencieusement le snapshot historique.

Le mode `all_or_closed` permet de clore un sondage si un membre initialement éligible ne participera finalement pas.

---

# 39. Suppression / fermeture d’un Groupe

Avant suppression d’un Groupe :
- confirmation claire ;
- indiquer nombre de membres / sondages actifs concernés.

Ne pas casser les sondages historiques.

Si des sondages actifs ciblent ce Groupe :
- refuser ou demander résolution explicite plutôt que suppression silencieuse.

---

# 40. Suppression des sondages — correction attendue

Corriger la lacune actuelle : une copie locale doit pouvoir être réellement supprimée.

Prévoir selon contexte :

```text
Supprimer de cet appareil
Supprimer en ligne
Supprimer partout
```

## Supprimer de cet appareil

Supprime :
- copie locale ;
- design/media locaux associés selon les règles actuelles ;
- repères UI associés.

Ne touche pas au serveur.

## Supprimer en ligne

Supprime le sondage distant et ses données métier serveur.

La copie locale peut rester si l’utilisateur le souhaite, mais elle doit ensuite pouvoir être supprimée.

## Supprimer partout

Si l’utilisateur possède les droits :
- suppression distante ;
- puis suppression locale ;
- comportement atomique UX raisonnable avec rapport d’échec partiel explicite.

Ne jamais laisser une copie locale impossible à supprimer.

---

# 41. Anciens sondages

Les anciens sondages ne nécessitent pas de fonctionnalité spéciale de migration vers un Espace.

Ils peuvent rester en Mode libre.

Ne PAS les supprimer automatiquement.

L’utilisateur doit pouvoir les supprimer proprement grâce aux nouvelles actions locales/distantes.

Compatibilité minimale :
- lecture ;
- suppression ;
- comportement libre existant.

---

# 42. Interface accueil

Distinguer clairement :

```text
Mes sondages libres
Mes espaces
```

ou architecture UX équivalente.

Ne pas surcharger l’accueil.

Ajouter une entrée :

```text
Espaces & groupes
```

distincte des sondages.

---

# 43. Zone Espaces & groupes

Vue dédiée.

Afficher :
- Espaces administrés ;
- Espaces où l’utilisateur est Créateur ;
- Groupes ;
- membres ;
- invitations ;
- cartes membre ;
- rôles.

Ne pas mettre les actions avancées dans l’accueil principal.

---

# 44. Création d’un Espace

Parcours court :

```text
Nom de l’Espace
→ Créer
```

Puis éventuellement :

```text
Créer un premier Groupe
Inviter des membres
Créer un sondage
```

Pas d’adresse/e-mail obligatoire.

---

# 45. Création d’un Groupe

Simple :

```text
Nom
```

Éviter catégories administratives inutiles.

---

# 46. Création d’un membre individuel

Admin peut créer :

```text
Nom ou pseudonyme
Groupes
```

Puis générer :

```text
Carte Voti
```

Possibilité d’imprimer / afficher le QR.

Ne jamais mettre de secret admin dans la Carte Voti.

---

# 47. Impression des cartes membre

Prévoir une sortie imprimable simple, éventuellement PDF A4 :

- plusieurs petites cartes par page ;
- nom/pseudonyme ;
- nom de l’Espace ;
- QR membre ;
- phrase courte :
  `Garde cette carte pour toi.`

Pas besoin d’un Studio complet en v0.6.

Aucune donnée supplémentaire sensible.

---

# 48. QR carte membre

Le QR membre ne doit pas contenir :
- URL admin ;
- capacité admin ;
- nom complet en clair si non nécessaire.

Préférer une route du type :

```text
#/member/<opaque-token>
```

ou forme équivalente.

Token suffisamment aléatoire.

---

# 49. QR sondage + QR membre

Supporter les deux ordres :

```text
Sondage → Membre
```

et :

```text
Membre → Sondage
```

L’utilisateur ne doit pas avoir à copier de code manuellement.

Utiliser caméra/scan selon capacités disponibles ; sinon permettre saisie/import adaptée si nécessaire.

---

# 50. Téléphone collectif

Cas prioritaire.

Exemple :

1. téléphone collectif affiche/scanne le sondage ;
2. enfant présente sa Carte Voti ;
3. vote ;
4. succès ;
5. Voti efface l’identité temporaire ;
6. téléphone prêt pour l’enfant suivant.

Tester explicitement :
- enfant A ;
- vote ;
- enfant B ;
- aucune identité A résiduelle.

---

# 51. Téléphone emprunté

Même règle.

Aucune persistance participant après vote.

Pas de liste des cartes récemment utilisées.

Pas de pseudo dans localStorage durable.

---

# 52. Rôles et capacités secrètes

Les tokens/capacités :
- member ;
- creator ;
- admin ;

doivent être distincts.

Ne jamais permettre qu’une Carte Voti participant ouvre l’administration.

Tests d’autorisation croisée obligatoires.

---

# 53. Révocation

Tester :
- ancienne carte participant refusée après rotation ;
- nouvelle carte fonctionne ;
- anciens votes conservés ;
- aucun vote supplémentaire possible dans un sondage déjà consommé pour ce membre.

---

# 54. Sécurité des invitations

Token invitation :
- aléatoire ;
- scope Espace/Groupe ;
- révocable ;
- borné dans le temps ou dans les usages lorsque configuré.

Pas de séquence devinable.

Rate limit raisonnable.

---

# 55. Modèle D1

v0.6 nécessitera probablement une nouvelle migration additive.

Créer nouvelle migration, par exemple :

```text
0004_spaces_groups_members.sql
```

Nom exact à choisir selon convention du dépôt.

Ne modifier aucune migration déjà appliquée.

Probables tables :

```text
spaces
groups
space_members
group_memberships
space_access
member_credentials
invitations
poll_audiences
poll_audience_groups
poll_member_eligibility
```

ou architecture équivalente plus compacte.

---

# 56. Données sensibles

Carte membre = credential sensible.

Ne jamais logguer :
- token brut ;
- QR payload ;
- capacité admin/créateur ;
- noms/pseudos dans logs de maintenance si évitable.

D1 peut contenir displayName pour le fonctionnement identifié/admin.

Documentation privacy mise à jour.

---

# 57. Digest de credential

Si architecture compatible :

stocker côté serveur :

```text
credentialDigest
```

plutôt que secret membre brut.

La carte transporte le secret.

Serveur calcule son digest pour lookup/validation.

Documenter algorithme et rotation.

Pas de cryptographie maison.

---

# 58. Public API

Ne jamais exposer :
- liste des membres d’un Espace ;
- displayName ;
- group membership ;
- éligibilité nominative ;
- statut individuel de vote anonyme.

Les endpoints publics retournent uniquement ce qui est nécessaire au sondage.

---

# 59. Endpoint membre

La validation d’une Carte Voti peut retourner une projection participant minimale :

```text
memberDisplayName
spaceName
groups nécessaires
polls accessibles
```

Ne jamais renvoyer capacités admin.

---

# 60. Statut « déjà participé »

Pour le membre lui-même :
- autorisé.

Pour admin :
- anonyme => agrégat uniquement ;
- identifié => liste nominative autorisée.

Les projections doivent être distinctes, pas seulement masquées côté CSS.

---

# 61. Concurrence / double vote

Cas important :

Même Carte Voti scannée presque simultanément sur deux appareils.

Pour un sondage d’Espace/Groupe :

exactement un vote accepté.

Utiliser contrainte D1 / transaction autoritaire.

L’autre requête reçoit un état :

```text
ALREADY_PARTICIPATED
```

sans révéler le choix.

---

# 62. Idempotence

Conserver actionId.

Une soumission avec la même action :
- ne duplique pas ballot ;
- ne consomme pas deux fois ;
- ne crée pas deux commentaires.

Le registre d’éligibilité doit être cohérent avec retry.

---

# 63. Commentaire anonyme de Groupe

Ne jamais inclure memberId dans commentaire anonyme.

Même si le serveur authentifie temporairement la Carte Voti pour autoriser la soumission.

Après transaction :
- commentaire relié au choix ;
- pas au membre.

---

# 64. Commentaire identifié de Groupe

Peut référencer la Participation / Member de manière adaptée au modèle identified.

Public :
- règles v0.5 ;
- pas de nom public par défaut.

Admin :
- identité visible.

---

# 65. Fermeture

Admin/créateur autorisé peut fermer le sondage.

Après fermeture :
- plus de votes ;
- cartes membre refusées pour nouvelle participation ;
- statut Mon espace = Fermé.

---

# 66. Rappels manuels — identifié

Pour un sondage identifié :

admin peut voir :

```text
À relancer (3)
```

et la liste des membres correspondants.

Pas d’envoi automatique d’e-mail/SMS/push.

Simple aide visuelle.

---

# 67. Anonyme — pas de liste à relancer

Pour un sondage anonyme :

ne pas afficher les noms de ceux qui n’ont pas voté.

Seulement :

```text
9 / 12 participations
```

Même l’Administrateur.

---

# 68. ResultsAudience

Tester :

- poll_audience ;
- admins_only.

Pour `poll_audience`, un membre non ciblé ne doit pas voir les résultats réservés.

Une Carte Voti peut être requise pour consulter des résultats privés d’Espace/Groupe.

---

# 69. QR résultats

Pour sondage privé Groupe :

QR résultats seul ne suffit pas nécessairement.

Parcours :

```text
QR résultats
→ Carte Voti
→ autorisation audience
→ résultats
```

Admin capability continue à fonctionner pour administration.

---

# 70. Export PDF résultats

Conserver v0.5.

Pour un sondage identifié :
- identités opt-in admin comme aujourd’hui.

Pour anonyme :
- aucune identité.

L’Espace/Groupe peut être affiché comme contexte du rapport si utile et non sensible.

---

# 71. Backup

Documenter que les données locales administrateur/créateur peuvent contenir :
- Espaces ;
- Groupes ;
- noms/pseudonymes membres ;
- capacités locales.

Éviter d’exporter secrets serveur inutiles.

Backup sensible :
avertissement clair.

Carte membre exportée/imprimée = secret participant.

---

# 72. Suppression Espace

Ne pas nécessairement implémenter suppression totale d’un Espace si trop risqué pour v0.6.

Si implémentée :
- confirmation forte ;
- cascade documentée ;
- sondages, Groupes, membres, credentials ;
- aucune suppression silencieuse.

Sinon :
- désactivation/archivage acceptable pour v0.6, documenter.

---

# 73. Pas de comptes classiques

Hors périmètre :

- e-mail ;
- mot de passe ;
- OAuth ;
- reset password ;
- login enfant classique ;
- profil social ;
- avatar ;
- messagerie.

L’accès Voti reste capability-based.

---

# 74. Pas d’Android dans v0.6

Android / LAN / offline reste lot futur.

Ne pas coupler v0.6 à Capacitor/Room.

Mais garder le cœur métier indépendant du DOM pour réutilisation future.

---

# 75. Tests — Mode libre

Régression complète :

- créer sans Espace ;
- publier ;
- voter ;
- commentaire ;
- identified ;
- anonymous ;
- QR ;
- résultats ;
- PDF ;
- suppression locale/distante.

---

# 76. Tests — Espace

Créer :
- 1 Espace ;
- 3 Groupes ;
- plusieurs membres ;
- Admin ;
- Créateur limité ;
- Participants.

Tester permissions.

---

# 77. Tests — invitations

Individuelle :
- création ;
- consommation ;
- carte créée ;
- retry ;
- révocation.

Groupe :
- plusieurs utilisations ;
- fermeture ;
- limite ;
- token invalide.

---

# 78. Tests — carte membre

- QR valide ;
- token invalide ;
- carte révoquée ;
- carte régénérée ;
- ancienne refusée ;
- nouvelle acceptée ;
- aucun secret dans logs/URL secondaire inutile.

---

# 79. Tests — appareil partagé

A vote :
- session temporaire A.

Après succès :
- A absent.

B scanne :
- session B.

Vérifier :
- aucune fuite A ;
- aucun displayName A ;
- aucune autorisation A.

320 / 360 px.

---

# 80. Tests — snapshot

Publier avec 10 membres.

Ajouter ensuite un 11e membre au Groupe.

Snapshot :
toujours 10.

Le 11e :
- non éligible au sondage déjà publié ;
- éligible aux futurs sondages.

---

# 81. Tests — une réponse par membre

Même carte :
- premier vote succès ;
- deuxième tentative refus ALREADY_PARTICIPATED.

Deux appareils simultanés :
- exactement un vote.

D1 COUNT :
- un consumed ;
- un ballot.

---

# 82. Tests — anonymat Groupe

Inspection D1 réelle locale.

Vérifier :
- eligibility contient memberId ;
- ballot ne contient aucune clé membre ;
- commentaire anonyme non plus ;
- aucune table de jointure ballot↔member ;
- projection admin anonyme ne donne pas liste nominative ;
- projection publique non plus.

---

# 83. Tests — identified Groupe

- carte fournit identité ;
- aucun champ nom demandé ;
- admin voit qui a participé ;
- admin voit qui n’a pas participé ;
- réponse/commentaire correctement associé ;
- public ne voit toujours pas nom sans règle explicite future.

---

# 84. Tests — nouvelles règles de résultats

Tester :
- threshold ;
- all_eligible ;
- closed ;
- all_eligible_or_closed.

Snapshot 3 membres :
- 2/3 => all false ;
- 3/3 => visible si autres règles satisfaites ;
- close à 2/3 => visible seulement pour mode closed / all_or_closed.

---

# 85. Tests — audience résultats

Poll Groupe A.

Membre Groupe A :
- accès.

Membre Groupe B uniquement :
- refus.

Admin :
- accès.

Admins_only :
- participants refusés.

---

# 86. Tests — suppression locale

Cas :
- local uniquement ;
- local + distant ;
- distant déjà supprimé ;
- erreur réseau.

Toujours possibilité de retirer la copie locale.

Vérifier suppression PosterDesign/médias locaux selon règles existantes.

---

# 87. Tests — suppression partout

- remote delete succès + local delete succès ;
- remote échec => ne pas prétendre « partout supprimé » ;
- local échec => signaler explicitement ;
- aucun ghost brouillon non supprimable.

---

# 88. Tests — rôles

Participant :
- jamais admin.

Créateur limité Groupe A :
- crée pour A ;
- refus Groupe B.

Admin :
- tout Espace.

Carte membre :
- jamais accès gestion.

---

# 89. Tests — XSS / Unicode

Space/Group/displayName :
texte brut.

Tester :
- accents ;
- emoji ;
- RTL ;
- `<script>` ;
- HTML ;
- longueurs limites.

---

# 90. Tests — cleanup

Révocation/suppression :
- credentials nettoyés ;
- invitations expirées/révoquées ;
- aucun secret orphelin exploitable.

Cron :
adapter si nécessaire.

---

# 91. Tests navigateur

Parcours réels Chromium :

1. mode libre ;
2. création Espace ;
3. création Groupe ;
4. membre + Carte Voti ;
5. sondage Groupe anonyme ;
6. appareil partagé A/B ;
7. identified ;
8. résultats all/closed ;
9. Mon espace ;
10. suppression locale/distante.

Tailles :
- 320 ;
- 360 ;
- 768 ;
- 1200+.

Thèmes existants.

---

# 92. Tests D1 / Worker

Ajouter suite ciblée v0.6.

Vrai D1 local :
- migrations historiques ;
- nouvelle migration ;
- contraintes ;
- transactions ;
- concurrence ;
- absence de join member-ballot anonyme.

Étendre :
- relay ;
- integration ;
- free-pilot.

Toujours sans R2.

---

# 93. Migration production

NE PAS appliquer en production pendant le développement.

Après audit :
ordre contrôlé comme v0.5 :

1. backup/read-only ;
2. migration additive ;
3. Worker compatible ;
4. compatibilité mode libre/v0.5 ;
5. frontend ;
6. recette humaine.

---

# 94. Documentation

Créer au minimum :

```text
docs/SPACES_GROUPS_V0.md
docs/MEMBER_CARDS_V0.md
docs/GROUP_VOTING_PRIVACY_V0.md
docs/CODEX_SPACES_GROUPS_V0_6_REPORT.md
```

Mettre à jour :
- DATA_MODEL ;
- UX_FLOWS ;
- RELAY_CONTRACT ;
- CLOUDFLARE docs ;
- privacy ;
- README ;
- RESULTS ;
- QR docs ;
- backup docs.

---

# 95. Privacy wording

Documenter clairement :

### Mode libre
Aucune garantie une-personne-un-vote.

### Groupe anonyme
Voti vérifie qu’un membre est autorisé et n’a pas déjà participé, sans conserver de lien direct membre→bulletin.

### Groupe identifié
Administrateurs/créateurs autorisés peuvent savoir :
- qui a participé ;
- qui n’a pas participé ;
- quelle réponse/commentaire est associé au membre.

### Carte Voti
Credential secret ; toute personne qui la possède peut se présenter comme ce membre jusqu’à révocation.

---

# 96. Hors périmètre v0.6

- comptes e-mail/mot de passe ;
- récupération de compte ;
- messagerie ;
- notifications ;
- rappel automatique ;
- suppression ciblée d’un bulletin anonyme par membre ;
- changement rétroactif du snapshot après votes ;
- Android ;
- réseau local ;
- R2 ;
- images distantes ;
- hiérarchie Espace→sous-espace ;
- ACL complexes ;
- identité civile vérifiée.

---

# 97. Exigence de non-régression

v0.5/v0.5.1 :
- commentaires ;
- modération ;
- identified libre ;
- anonymous libre ;
- PDF ;
- QR ;
- Studio ;
- suppression distante ;
- résultats ;
- anti-abus.

Aucune régression.

---

# 98. Audit bundle

Créer après tests :

```text
VOTI_AUDIT_V0_6.zip
```

Exclure :
- cartes membre réelles ;
- QR utilisateur réels ;
- backup D1 ;
- bases locales ;
- exports admin ;
- PDF de recette ;
- captures ;
- secrets ;
- .env/.dev.vars ;
- runtime ;
- profils ;
- caches ;
- node_modules ;
- autres ZIP.

Fixtures :
pseudonymes fictifs uniquement.

---

# 99. Pas de publication avant audit

À la fin du développement :

- ne pas migrer D1 prod ;
- ne pas déployer Worker ;
- ne pas publier Pages ;
- ne pas toucher Turnstile/R2.

Produire :
- rapport complet ;
- ZIP audit ;
- résultats exacts.

Attendre validation de Lu’uma / audit ChatGPT.

---

# 100. Critères de sortie v0.6

v0.6 est prête pour audit lorsque :

1. Mode libre fonctionne toujours sans compte ;
2. Espace + Groupes fonctionnent ;
3. rôles Admin/Créateur/Participant appliqués ;
4. membres sans compte classique ;
5. Carte Voti QR secrète, révocable/régénérable ;
6. aucune session participant persistante ;
7. parcours Sondage→Carte→Vote court ;
8. parcours Carte→Mon espace→Vote court ;
9. session effacée après vote ;
10. audience Public/Espace/Groupes ;
11. snapshot figé à publication ;
12. une réponse par membre obligatoire pour Espace/Groupe ;
13. anonyme sans lien direct member→ballot ;
14. membre voit “Déjà participé” ;
15. admin anonyme voit seulement X/Y ;
16. admin identified voit votants/non-votants ;
17. identified utilise automatiquement l’identité membre ;
18. nouvelles règles résultats all / closed / all_or_closed ;
19. resultsAudience audience/admins_only ;
20. commentaires v0.5 compatibles ;
21. suppression locale réelle disponible ;
22. suppression en ligne / partout claire ;
23. aucune carte membre ne donne accès admin ;
24. invitations individuelles/Groupe fonctionnent ;
25. rotation carte invalide l’ancienne ;
26. double vote concurrent bloqué ;
27. tests D1 réels confirment anonymat structurel ;
28. anciennes fonctions libres non régressées ;
29. production non mutée ;
30. rapport + archive d’audit finalisés.
