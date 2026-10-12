# PDF détaillé des résultats — v0.4B

## Autorité et confidentialité

La vue Résultats propose **Télécharger les résultats en PDF** dans une section
repliable. Si `results.available !== true`, le bouton est désactivé et explique
« Les résultats ne sont pas encore disponibles. » Aucun privilège créateur
ne contourne le seuil. threshold exige minimumResponses ; closed exige aussi
la fermeture. Ces règles métier sont inchangées.

L’export distant relit `getPoll` et sa projection de résultats autorisée au clic,
avant génération. Une indisponibilité ou suppression est une erreur, jamais
une reconstruction depuis des bulletins locaux. Le moteur PDF reçoit uniquement
le sondage public et ses agrégats ; il ne connaît ni Repository métier, ni relais,
ni liste de bulletins. Pour un sondage local, l’UI utilise la projection normale
getResults du moteur existant, pas une deuxième logique de publication.

`authorizedResults` exige available:true, état compatible, seuil obligatoire,
choix présents exactement une fois, nombres entiers positifs ou nuls,
total égal à la somme, pourcentages cohérents. Le plan est une whitelist :
ni actionId, ni capacité, bulletin brut, IP, User-Agent ou données réseau.
Une projection incohérente est refusée plutôt que corrigée silencieusement.

## Contenu et styles

Identité/logo Voti, question, description, total, toutes les réponses,
nombre et pourcentage par réponse, barres proportionnelles, statut et date
locale de génération explicitement **date d’export**, jamais date des votes.
Lien et QR résultats publics si la projection concerne un sondage distant
encore consultable. Pas de faux QR public pour le mode local.

- Synthèse : chiffre principal, classement décroissant et barres compactes ;
  égalités conservées, pas de vainqueur arbitraire annoncé.
- Rapport : ordre des réponses et cartes détaillées, libellés longs enveloppés,
  chiffres et barres explicitement associés.

Sondage ouvert : « Résultats au moment de l’export. » Sondage fermé :
« État final connu. » Aucune certification ou garantie officielle ajoutée.
Le document exporté est un instantané ; il ne se met pas à jour après de nouveaux votes.

Huit palettes et quatre typographies du Studio réutilisées dans la fondation v0.4B.
Depuis v0.4C, les piles titre/corps sont distinctes (six/quatre styles) et
l’en-tête peut être Normal/Discret/Masqué ; les mêmes agrégats et règles restent
appliqués, sans refonte de Synthèse/Rapport.
Les médias métier locaux sont optionnels ; l’inclusion des médias affiche-only demande un opt-in
distinct, désactivé par défaut. L’absence d’une image locale ne bloque pas le texte
et les chiffres. Aucun média n’est envoyé au relais ; R2 reste désactivé.

## Technique et qualité

Plan pur `makeResultsPlan`, renderer commun du Studio `paintPrintPage`, export
`exportPrintPdf`. A4 portrait à environ 300 dpi, PNG sans perte, QR noir/blanc
alignés sur pixels entiers, pagination jusqu’à huit pages plutôt que texte
réduit à l’illisible. Une surface pleine résolution à la fois, ressources
libérées à la fin. Aucun service distant ni nouvelle dépendance.

Tests : seuil et closed+seuil, agrégats incohérents, égalités, 100 %/0 %,
2/3/6 choix, accents et libellés longs, ouvert/fermé, cinq palettes rendues,
PDF A4/Poppler et QR redécodés depuis le raster final. Les fixtures PDF utilisent
une projection autorisée, jamais des bulletins pour construire le document.

Limites : PDF raster sans balisage et sans texte sélectionnable ; polices
système et date empêchent une reproductibilité binaire universelle.
Une ancienne copie PDF peut naturellement survivre à la suppression du sondage.
La recette humaine d’impression et de lecture reste à confirmer avant publication.
