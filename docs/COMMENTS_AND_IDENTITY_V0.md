# Commentaires et identité déclarée — v0.5

## Extension v0.6 — cartes membre et groupes

La modération et les limites v0.5 restent inchangées. Anonyme contrôlé : commentaire
sans participation ni lien membre, administration agrégée X/Y sans roster nominatif.
Identifié contrôlé : nom issu de la carte, Participation reliée au membre via une
table identifiée séparée ; aucune saisie de nom redemandée. Noms jamais publics.
Le seuil/audience est appliqué au relais ; commentaires pending/hidden/private et
leur existence ne sont pas révélés aux résultats de l’audience. Admin les voit comme
avant sous seuil. Suppression commentaire n’enlève pas la consommation ni le bulletin.
La révocation d’un membre conserve l’historique ; supprimer le poll cascade sur ses
commentaires/participations/liaisons/snapshot. Voir GROUP_VOTING_PRIVACY_V0.md.

## Vote

Choix → commentaire facultatif / nom requis si identified → confirmation.
Le QR choix ouvre directement cette confirmation avec les mêmes champs.
Scan, navigation, refresh ou saisie ne produisent aucun vote.

Le commentaire anonyme affiche une notice visible demandant de ne pas inscrire
son identité ou celle d'autrui. L'identité déclarée indique explicitement qu'elle
n'est pas vérifiée et qu'elle sera associée à la réponse.

Envoi : une action aléatoire réutilisée au retry, contenu figé après premier
envoi pour ne pas créer deux versions ambiguës d'une confirmation. Aucun faux
succès en cas d'indisponibilité, aucun bulletin local de secours pour un vote
distant. Le succès reste durable et précise l'envoi du commentaire.

## Administration

Zone « Commentaires » en anonymous, « Participations & commentaires » en identified.
Les entrées sont regroupées par choix. L'administration peut lire avant seuil.
Les noms sont réservés à cette zone authentifiée, jamais dans la projection publique.
Les commentaires privés se lisent et se suppriment ; ils ne peuvent pas être publiés.

Public_with_results : commentaire initial pending. Afficher → visible ; Masquer →
hidden ; retour possible vers visible. Révision propre au commentaire et CAS :
deux onglets ne s'écrasent pas silencieusement. Aucune édition du texte possible.
Supprimer définitivement exige le dialogue accessible Voti. Le vote et ses agrégats
sont conservés. Retry de vote après suppression ne recrée pas le commentaire.

## Publication

Sous seuil (ou avant fermeture si closed), **aucune existence, distribution,
identité ou compteur de commentaires transmis au public**. Après disponibilité,
seuls visible/public_with_results sont projetés, sans nom même en identified.
Pas de section vide ; compteur des seuls visibles. Pages de 25, curseur UUID,
textes bruts. Les endpoints de lecture ne permettent aucune soumission indépendante.

## Données et limites

- Aucune Participation anonyme, aucun lien identité/bulletin en mode anonymous.
- Un commentaire peut néanmoins s'auto-identifier par son texte : prévention
  visible et modération, pas de promesse magique d'anonymisation linguistique.
- L'anonymat applicatif ne garantit pas l'anonymat réseau ; l'hébergeur peut avoir
  ses propres logs. Aucun log applicatif volontaire de nom, texte, IP ou corps de vote.
- Pas de compte, d'identité vérifiée, d'unicité par personne ou de chiffrement avancé.
- Rétention des nouvelles entités = celle du sondage. Pas d'expiration des sondages
  publiés/fermés ; suppression D1 immédiate, cascades et GC R2 existant inchangé.
- La suppression du commentaire retire le texte, mais conserve le reçu de protocole
  contextualisé par action jusqu'à suppression du vote/sondage. Ce reçu peut permettre
  de vérifier un contenu supposé à partir des données internes ; ce n'est pas du
  chiffrement ni une garantie d'effacement cryptographique.
- Administration et PDF actuellement bornés à 500 entrées par chargement/export,
  PDF à 32 pages ; erreur explicite plutôt que troncature silencieuse.
- L'export des commentaires privés dans les PDF n'est pas proposé dans ce lot :
  lecture admin disponible, Rapport limité aux commentaires publics approuvés.
- Les projections administrateur sont éphémères ; aucune copie persistante des noms
  distants dans le cache RemoteConnection ou le Studio.
