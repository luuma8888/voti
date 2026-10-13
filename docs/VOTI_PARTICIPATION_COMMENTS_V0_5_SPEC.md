# Voti — v0.5 — Participation enrichie, commentaires et participation identifiée

## Statut

Lot fonctionnel suivant v0.4C, validé humainement et clôturé.

v0.5 introduit deux évolutions structurantes :

1. commentaires facultatifs associés au vote ;
2. participation anonyme OU identifiée.

Le lot doit préserver les invariants existants de Voti :
- vote explicite ;
- seuil de résultats ;
- anonymat réel lorsque le mode anonyme est choisi ;
- absence de collecte inutile ;
- séparation des données sensibles ;
- profil de production gratuit actuel, sans R2 ;
- aucune dépendance à des comptes utilisateurs dans cette version.

---

# 1. Objectifs

Ajouter :

- mode `Vote simple` ;
- mode `Vote + commentaire facultatif` ;
- commentaires activés par défaut à la création ;
- activation/désactivation modifiable jusqu’au premier vote accepté ;
- commentaire maximum 300 caractères ;
- commentaire associé au choix voté ;
- commentaires privés ou visibles avec les résultats ;
- visibilité privée par défaut ;
- modération obligatoire avant publication des commentaires publics ;
- statuts de modération ;
- masquage/réaffichage ;
- suppression définitive avec confirmation ;
- participation `anonyme` ou `identifiée` ;
- identité déclarative `nom ou pseudonyme` en mode identifié ;
- administration permettant de relier identité → choix → commentaire ;
- identités privées côté public par défaut ;
- export PDF Rapport avec inclusion optionnelle des commentaires visibles ;
- export PDF Rapport avec inclusion optionnelle des identités en mode identifié ;
- textes de confidentialité adaptés aux deux modes ;
- stockage séparé du bulletin, de la participation et du commentaire.

---

# 2. Hors périmètre strict

Ne pas ajouter dans v0.5 :

- comptes utilisateurs ;
- authentification ;
- mot de passe ;
- e-mail ;
- récupération de compte ;
- vérification d’identité ;
- unicité réelle par personne ;
- groupes / organisations ;
- invitation nominative ;
- suppression/modification de son commentaire par le votant après coup ;
- notifications ;
- pièces jointes dans les commentaires ;
- réponses à des commentaires ;
- likes/réactions ;
- modération automatique par IA ;
- images distantes / R2 ;
- Android ;
- synchronisation offline ;
- CAPTCHA supplémentaire au vote ;
- IP / fingerprint / User-Agent dans les bulletins ou commentaires.

---

# 3. Modes de participation

Ajouter à la définition du sondage :

```text
participationIdentityMode:
- anonymous
- identified
```

UI :

```text
Participation
○ Anonyme
○ Identifiée
```

Libellés explicites :

### Anonyme
`Les réponses ne sont pas reliées à un nom ou pseudonyme.`

### Identifiée
`Chaque participant saisit un nom ou pseudonyme associé à sa réponse.`

Valeur par défaut recommandée :

```text
anonymous
```

Le choix du mode est modifiable tant qu’aucun vote n’a été accepté.

Après le premier vote accepté :
- verrouillé ;
- même comportement que les autres règles sémantiques.

Ne jamais permettre de transformer après coup un sondage anonyme en identifié, ou inversement.

---

# 4. Participation anonyme — invariant fort

En mode `anonymous` :

- aucun champ nom ;
- aucun pseudonyme ;
- aucun participantId persistant ;
- aucun identifiant interne permettant de relier la réponse à une personne ;
- aucun objet Participation ;
- aucun lien identité → bulletin ;
- aucun champ caché d’identité dans commentaire ou bulletin.

Le vote doit rester conforme à l’architecture anonyme existante.

Le commentaire anonyme peut uniquement contenir :

```text
choiceId
text
moderationStatus
commentId
```

et métadonnées strictement nécessaires au protocole, sans identité.

Ne jamais stocker :
- IP ;
- User-Agent ;
- fingerprint ;
- nom d’appareil ;
- compte ;
- identifiant navigateur ;
- identifiant stable participant.

---

# 5. Participation identifiée

En mode `identified`, avant la confirmation du vote :

Champ obligatoire :

```text
Ton nom ou pseudonyme
```

Le champ accepte :
- prénom ;
- nom choisi ;
- pseudonyme ;
- nom de groupe si le contexte le justifie.

Il ne s’agit PAS d’une identité vérifiée.

Afficher clairement :

`Voti ne vérifie pas cette identité. Deux personnes peuvent utiliser le même nom ou pseudonyme.`

Ne pas bloquer les doublons textuels.

Deux `Emma` doivent pouvoir participer.

Ne pas prétendre garantir :
- une personne = un vote ;
- authenticité du nom ;
- unicité.

Ces fonctions sont reportées à la future couche comptes/groupes.

---

# 6. Objet Participation

En mode identifié uniquement, créer un objet Participation séparé.

Exemple conceptuel :

```json
{
  "participationId": "...",
  "displayName": "Léa"
}
```

Le vote et le commentaire éventuel peuvent référencer :

```text
participationId
```

mais le bulletin ne doit pas contenir directement le nom/pseudonyme si une séparation propre est possible.

Objectif :

```text
Participation
   ↕
Vote
   ↕
Commentaire éventuel
```

Cette architecture doit faciliter v0.6 comptes/groupes sans casser les votes existants.

En mode anonyme :
- aucun objet Participation.

---

# 7. Mode commentaire

Ajouter :

```text
commentMode:
- disabled
- optional
```

Valeur par défaut :

```text
optional
```

UI création/admin :

```text
Participation au sondage

○ Vote + commentaire facultatif
○ Vote simple
```

ou contrôle équivalent très clair.

Le commentaire n’est jamais obligatoire en v0.5.

Le créateur peut passer :
- optional → disabled ;
- disabled → optional ;

uniquement avant le premier vote accepté.

Après :
- verrouillé comme règle sémantique.

---

# 8. Moment du commentaire

Parcours retenu :

```text
Choix
→ commentaire facultatif
→ confirmation finale
→ enregistrement atomique
```

Le commentaire doit être proposé avant la confirmation finale.

Exemple :

```text
Tu choisis :
Pizza

Tu peux ajouter un commentaire (facultatif)
[................................]

Oui, je confirme
Autre choix
```

Le bouton de confirmation enregistre :
- vote ;
- commentaire éventuel ;
- participation éventuelle en mode identifié ;

comme une seule opération logique.

Aucun vote au simple changement de champ.

---

# 9. Longueur du commentaire

Maximum :

```text
300 caractères
```

Afficher compteur :

```text
0 / 300
```

ou équivalent.

Bloquer proprement au-delà.

Accepter :
- accents ;
- emoji raisonnables ;
- ponctuation ;
- retours à la ligne si le modèle les accepte.

Normaliser :
- espaces de bord ;
- commentaire vide après trim = pas de commentaire.

Ne pas transformer silencieusement le contenu.

---

# 10. Texte de confidentialité — mode anonyme

Afficher à proximité du champ commentaire :

```text
Ton commentaire est anonyme.
N’écris pas ton nom, ton prénom, ton adresse, ton école ou une information qui permettrait de te reconnaître.
Évite aussi de donner des informations personnelles sur quelqu’un d’autre.
```

Ton :
- clair ;
- calme ;
- compréhensible par un enfant ;
- non anxiogène.

Ce texte doit être visible AVANT saisie, pas seulement dans une aide cachée.

---

# 11. Texte de confidentialité — mode identifié

Afficher :

```text
Ton nom ou pseudonyme est associé à ta réponse.
N’ajoute pas d’autres informations personnelles inutiles.
```

Si commentaire activé, ce texte apparaît près de l’identité/commentaire.

Ne pas dire que l’identité est publique.

---

# 12. Visibilité des commentaires

Ajouter dans la définition :

```text
commentVisibility:
- private
- public_with_results
```

Valeur par défaut :

```text
private
```

UI :

### Privés
`Seul l’administrateur du sondage peut les lire.`

### Visibles avec les résultats
`Les commentaires approuvés pourront apparaître avec les résultats.`

Ce réglage est modifiable jusqu’au premier vote accepté seulement.

Après :
- verrouillé.

---

# 13. Seuil de confidentialité

Les commentaires publics suivent TOUJOURS les règles existantes de disponibilité des résultats.

Si :

```text
results.available !== true
```

alors :
- aucun commentaire public ;
- aucun compteur public de commentaires ;
- aucune indication « commentaires en attente » ;
- aucune fuite sur leur existence.

Mode `closed` :
- fermeture + seuil requis selon les règles actuelles.

Ne pas créer de seuil séparé pour les commentaires.

---

# 14. Modération

Pour `public_with_results` :

tout commentaire nouveau commence :

```text
pending
```

Statuts :

```text
pending
visible
hidden
```

Le créateur peut :

```text
En attente → Visible
En attente → Masqué
Visible → Masqué
Masqué → Visible
```

Ne jamais permettre de modifier le texte du participant.

Le commentaire original doit rester immuable.

---

# 15. Commentaires privés

Pour `private` :

le commentaire est lisible uniquement dans l’administration.

Il n’a pas besoin d’approbation publique.

On peut néanmoins utiliser un statut interne simple, mais l’UI ne doit pas donner l’impression qu’une modération publique est nécessaire.

Le créateur peut toujours :
- lire ;
- supprimer définitivement.

Masquer/réafficher peut rester disponible si l’architecture l’unifie, mais ne doit pas complexifier inutilement le mode privé.

---

# 16. Lecture admin avant seuil

Le créateur/admin peut lire les commentaires immédiatement, même si :
- seuil non atteint ;
- résultats publics bloqués ;
- sondage encore ouvert.

Le seuil protège la publication publique, pas l’administration.

Ajouter éventuellement un rappel :

`Ces commentaires sont visibles dans l’administration même lorsque les résultats publics sont encore masqués.`

Ne jamais prétendre que cela protège contre un commentaire auto-identifiant.

---

# 17. Suppression définitive

Ajouter une action distincte :

```text
Supprimer définitivement
```

avec confirmation v0.3E.

Texte :

`Ce commentaire sera supprimé définitivement. Cette action est irréversible.`

La suppression retire le commentaire.

En mode identifié :
- ne supprimer la Participation que si aucune autre donnée ne la référence et si cela respecte le modèle choisi ;
- ne pas casser le vote.

Le vote reste comptabilisé.

Suppression d’un commentaire != suppression du bulletin.

---

# 18. Immutabilité du commentaire

Le créateur ne peut jamais :
- corriger ;
- reformuler ;
- tronquer ;
- censurer partiellement ;
- éditer.

Actions autorisées :
- visible ;
- masqué ;
- réaffiché ;
- supprimé définitivement.

---

# 19. Enregistrement atomique

Le vote + commentaire éventuel + participation éventuelle doivent être acceptés ou refusés ensemble.

Si le commentaire échoue :
- aucun vote accepté ;
- aucune participation orpheline ;
- message d’erreur ;
- possibilité de réessayer.

Si la Participation échoue :
- aucun vote ;
- aucun commentaire.

Si le vote échoue :
- aucun commentaire ;
- aucune Participation persistée inutilement.

Prévoir transaction D1 ou mécanisme atomique équivalent.

Ne pas accepter « vote réussi, commentaire perdu ».

---

# 20. Idempotence et double clic

Conserver / étendre la logique actionId existante.

Un double clic ne doit créer :
- qu’un vote ;
- qu’un commentaire ;
- qu’une Participation en mode identifié.

Retry réseau avec même action logique :
- pas de duplication.

Tester explicitement les trois objets.

---

# 21. Modèle de données conceptuel

Préférer trois tables / entités distinctes :

```text
ballots
comments
participations
```

ou équivalent.

### ballots

Reste minimal.

Anonyme :

```text
pollId
choiceId
actionId
...
```

Identifié :

```text
pollId
choiceId
actionId
participationId
...
```

### comments

```text
commentId
pollId
choiceId
text
moderationStatus
participationId?   // uniquement identifié
actionId linkage ou clé atomique adaptée
```

### participations

Identifié uniquement :

```text
participationId
pollId
displayName
```

Ne pas mettre de métadonnée inutile.

La structure finale peut différer si Codex démontre une meilleure solution, mais la séparation des responsabilités fait autorité.

---

# 22. Migration D1

v0.5 nécessitera probablement une migration D1.

Créer une nouvelle migration versionnée.

Ne modifier aucune migration déjà appliquée.

Migration :
- additive ;
- compatible avec anciens sondages ;
- anciens polls sans nouveaux champs doivent continuer à fonctionner avec defaults historiques cohérents.

Les anciens sondages doivent rester :

```text
participationIdentityMode = anonymous
commentMode = disabled
```

SAUF si le modèle existant contient déjà une valeur explicite.

Ne jamais activer rétroactivement les commentaires sur un sondage existant.

La valeur par défaut `optional` concerne la création de NOUVEAUX sondages via l’UI v0.5.

---

# 23. Compatibilité des anciennes définitions

Mettre à jour version/schema/hash uniquement si nécessaire.

Ancien poll :
- doit rester lisible ;
- vote simple anonyme ;
- aucun commentaire ;
- mêmes résultats.

Ne pas altérer silently les definitionHash historiques.

Prévoir migration/normalisation explicite si le protocole l’exige.

Documenter précisément toute évolution de hash/schema.

---

# 24. Publication / verrouillage

Les nouveaux champs sémantiques font partie de la définition verrouillée après premier vote :

```text
participationIdentityMode
commentMode
commentVisibility
```

Avant premier vote :
- modifiables.

Après :
- verrouillés.

Style d’affiche reste modifiable comme aujourd’hui.

---

# 25. Administration — section Participations

Ajouter une vue claire dans Gérer.

Pour mode anonyme :

```text
Commentaires
```

Pour mode identifié :

```text
Participations & commentaires
```

Afficher par entrée :

Anonyme :
- choix ;
- commentaire ;
- statut ;
- actions modération/suppression.

Identifié :
- nom ou pseudonyme ;
- choix ;
- commentaire éventuel ;
- statut ;
- actions.

Ne pas afficher de données techniques.

---

# 26. Regroupement par choix

Dans l’administration et les résultats publics :

regrouper les commentaires sous leur choix.

Exemple :

```text
Pizza — 8 votes

Commentaires
- « Parce qu’on peut partager. »
- « J’adore le fromage. »
```

En mode identifié côté admin :

```text
Pizza — 8 votes

Léa
« Parce qu’on peut partager. »

Dragon42
« J’adore le fromage. »
```

Côté public :
- ne jamais afficher l’identité par défaut.

---

# 27. Résultats publics

Si commentaires privés :
- aucun commentaire public ;
- pas de compteur public.

Si `public_with_results` ET `results.available === true` :
- afficher seulement commentaires `visible`.

Ne pas afficher :
- pending ;
- hidden ;
- identité participant ;
- nombre d’éléments non publiés.

Si aucun commentaire visible :
- ne pas afficher de section vide.

---

# 28. Compteur public

Afficher un nombre de commentaires uniquement si :
- public_with_results ;
- résultats disponibles ;
- au moins un commentaire visible.

Le compteur représente :
- commentaires visibles seulement.

Ne jamais inclure pending/hidden/private.

---

# 29. PDF Synthèse

Par défaut :
- aucun commentaire ;
- aucune identité.

Conserver le PDF synthétique existant.

---

# 30. PDF Rapport

Ajouter options avant export :

```text
☐ Inclure les commentaires visibles
```

En mode identifié, administration uniquement :

```text
☐ Inclure les identités des participants
```

Valeurs par défaut :
- commentaires : désactivé si nécessaire pour conserver un rapport compact, ou activable explicitement ;
- identités : TOUJOURS désactivé par défaut.

Si `Inclure les identités` :
- disponible uniquement pour export admin ;
- avertissement :
  `Ce PDF contiendra les noms ou pseudonymes associés aux réponses.`

Ne jamais inclure identité dans un PDF public automatique.

---

# 31. PDF et commentaires privés

Le créateur peut exporter un Rapport administratif incluant les commentaires privés si une option explicite le permet.

Bien distinguer :

```text
Commentaires visibles publiquement
Commentaires privés de l’administration
```

Ne pas mélanger les deux sans libellé.

Si cela rend v0.5 trop complexe, priorité à :
- commentaires visibles dans Rapport ;
- commentaires privés consultables dans admin.

Mais documenter la limitation, ne pas inventer un comportement ambigu.

---

# 32. Identité et résultats publics

Même en mode `identified` :

public :
- pourcentages ;
- nombres ;
- commentaires visibles ;
- PAS de nom/pseudo par défaut.

L’identité est privée côté admin.

Pas de réglage public d’identité en v0.5.

---

# 33. Recherche / tri admin

Si simple à intégrer sans surcharger :

filtres :
- Tous ;
- En attente ;
- Visibles ;
- Masqués.

Et filtre par choix.

Mode identifié :
- recherche nom/pseudo facultative si architecture légère.

Pas de moteur complexe.

---

# 34. Suppression du sondage

La suppression distante du poll doit supprimer / rendre inaccessibles :
- ballots ;
- comments ;
- participations ;
- préparations associées selon architecture.

Aucun commentaire/identité orphelin.

Mettre à jour cleanup/retention.

---

# 35. Rétention

Les comments/participations suivent le cycle de vie du sondage.

Pas de rétention indépendante plus longue.

Cron cleanup doit traiter les nouvelles tables.

Ne jamais logguer les textes de commentaire ou noms dans les logs de maintenance.

---

# 36. Rate limiting

Évaluer l’impact des commentaires sur le body et les écritures.

Conserver les protections existantes.

Un vote avec commentaire reste UNE soumission logique.

Ne pas introduire un endpoint public de commentaire séparé permettant du spam libre.

La modération admin suit les rate limits admin existants ou dédiés raisonnables.

---

# 37. Limites de payload

Commentaire :
- 300 caractères applicatifs ;
- limite serveur cohérente en octets UTF-8.

Nom/pseudonyme :
proposer une limite claire, par exemple :

```text
1–60 caractères
```

Normalisation :
- trim ;
- pas de chaîne vide ;
- pas de contrôle invisible dangereux.

Ne pas imposer alphabet latin.

Accepter Unicode.

---

# 38. Sécurité HTML / XSS

Commentaires et pseudonymes = texte brut.

Ne jamais interpréter :
- HTML ;
- Markdown ;
- URL enrichie ;
- script.

Renderer DOM :
- textContent / nodes sûrs.

PDF :
- texte brut.

Tests :
- `<script>`
- `<img onerror>`
- caractères RTL ;
- emoji ;
- apostrophes ;
- guillemets ;
- accents.

---

# 39. Accessibilité

Champ identité :
- label explicite ;
- aide ;
- erreur associée.

Commentaire :
- label ;
- facultatif annoncé ;
- compteur accessible ;
- maximum annoncé ;
- message confidentialité lisible.

Modération :
- boutons explicites ;
- pas d’action uniquement par couleur ;
- focus visible ;
- dialogues de suppression v0.3E.

Mobile :
- 320 / 360 px.

---

# 40. UX enfant

Éviter vocabulaire :
- identité déclarative ;
- modération ;
- projection ;
- participantId.

UI votant :

```text
Ton nom ou pseudonyme
```

```text
Tu veux ajouter quelque chose ? (facultatif)
```

Admin peut employer :

```text
En attente
Afficher
Masquer
Supprimer
```

Textes courts.

---

# 41. Vote QR par choix

Conserver le parcours v0.4 :

QR choix
→ confirmation directe.

Avec commentaires activés :
- écran de confirmation directe inclut le commentaire facultatif ;
- en mode identifié, nom/pseudo doit être saisi avant confirmation ;
- `Autre choix` fonctionne comme actuellement.

Aucun vote au scan.

---

# 42. Vote classique

Parcours anonyme + commentaire :

```text
Choisir
→ Continuer
→ commentaire facultatif
→ confirmer
```

Identifié + commentaire :

```text
Nom/pseudo
→ Choisir
→ Continuer
→ commentaire facultatif
→ confirmer
```

Une autre organisation est acceptable si plus fluide, mais :
- identité avant soumission ;
- commentaire avant confirmation ;
- confirmation explicite finale.

---

# 43. Succès après vote

Le message de succès v0.4 doit rester durable face aux rerenders/storage events.

Ne pas afficher :
- identité dans le succès public si inutile ;
- contenu du commentaire si cela surcharge.

Exemple :

`Ton vote a bien été enregistré.`

Si commentaire :
`Ton commentaire a aussi été envoyé.`

Pour commentaire public :
`Il sera visible seulement s’il est approuvé et lorsque les résultats seront disponibles.`

---

# 44. Échec

Si validation nom échoue :
- pas de vote.

Si commentaire dépasse :
- pas de vote.

Si D1 transaction échoue :
- pas de vote.

Message clair, sans détails backend.

Conserver les valeurs saisies pour permettre correction/réessai.

---

# 45. Admin — approbation

Pour pending :

boutons :

```text
Afficher
Masquer
Supprimer
```

Après visible :

```text
Masquer
Supprimer
```

Après hidden :

```text
Afficher
Supprimer
```

Suppression :
dialogue confirmation.

Double clic :
idempotent / CAS si nécessaire.

---

# 46. Concurrence admin

Deux onglets admin peuvent modérer le même commentaire.

Prévoir révision/CAS ou logique serveur autoritaire.

Si état a changé :
- rafraîchir ;
- message simple ;
- ne pas écraser silencieusement.

---

# 47. Endpoint / RelayAdapter

Étendre proprement le contrat.

Éviter de casser les adapters.

Probables opérations :

```text
castVoteWithParticipation
listAdminComments
moderateComment
deleteComment
```

ou design équivalent.

Ne pas créer de méthode spécifique inutile si le contrat existant permet extension propre.

Public results projection doit inclure uniquement :
- visible comments ;
- seulement si autorisés.

Admin projection :
- comments ;
- participations en mode identifié.

---

# 48. Tests — anonymat réel

Tester qu’en mode anonymous :

- aucune Participation créée ;
- aucun displayName ;
- aucun participantId ;
- bulletin sans identité ;
- commentaire sans identité ;
- résultats publics sans identité ;
- admin sans identité inventée ;
- logs sans identité ;
- PDF sans identité.

Inspection D1 locale réelle.

---

# 49. Tests — identifié

Tester :

- nom obligatoire ;
- pseudo accepté ;
- Unicode ;
- deux `Emma` acceptées ;
- même navigateur peut voter plusieurs fois comme aujourd’hui ;
- participation créée ;
- vote relié ;
- commentaire relié ;
- admin voit identité + choix + commentaire ;
- public ne voit pas identité.

---

# 50. Tests — commentaires

Tester :

- disabled ;
- optional vide ;
- optional rempli ;
- 1 caractère ;
- 300 caractères ;
- 301 rejeté ;
- espaces seulement = absent ;
- emoji / accents ;
- XSS ;
- multiline si autorisé.

---

# 51. Tests — atomicité

Cas artificiels :

- échec insert participation ;
- échec insert vote ;
- échec insert commentaire ;
- transaction rollback ;
- retry même actionId ;
- double clic.

Dans tous les cas :
pas d’orphelin.

COUNT D1 sur les trois tables.

---

# 52. Tests — verrouillage

Avant premier vote :
- changer anonymous ↔ identified ;
- optional ↔ disabled ;
- private ↔ public_with_results.

Après vote :
- les trois réglages verrouillés ;
- aucune mutation possible serveur ou UI.

---

# 53. Tests — modération

Tester :

```text
pending → visible
pending → hidden
visible → hidden
hidden → visible
delete
```

Concurrence :
- double clic ;
- deux onglets ;
- mauvais état attendu.

Texte immuable.

---

# 54. Tests — seuil

Sous seuil :
- admin lit ;
- public ne voit rien ;
- compteur absent.

Seuil atteint :
- visible apparaît ;
- pending/hidden absents.

Mode closed :
- avant fermeture absent ;
- après fermeture + seuil visible.

---

# 55. Tests — résultats

Commentaires groupés sous le bon choix.

Aucun commentaire sans choix valide.

Tous les votes restent comptés même si :
- commentaire masqué ;
- supprimé ;
- pending.

La modération ne change jamais les résultats quantitatifs.

---

# 56. Tests — PDF

Synthèse :
- inchangée sans commentaire/identité.

Rapport :
- commentaires visibles optionnels ;
- identités optionnelles admin seulement ;
- option identité désactivée par défaut ;
- avertissement ;
- pagination ;
- textes longs ;
- accents ;
- XSS affiché comme texte ;
- QR résultats toujours décodable.

Poppler 300 dpi.

---

# 57. Tests — suppression / cleanup

Supprimer poll :
- ballots supprimés/inaccessibles ;
- comments supprimés/inaccessibles ;
- participations supprimées/inaccessibles.

Cron/local cleanup :
- pas d’orphelins.

---

# 58. Tests — anciens sondages

Fixture v0.4C :

- charge sans erreur ;
- anonymous ;
- comments disabled ;
- vote identique à avant ;
- résultats identiques ;
- QR identiques ;
- admin existant fonctionne.

---

# 59. Tests — navigateur

Chromium réel :

- 320 ;
- 360 ;
- 1200.

Thèmes :
- cinq thèmes ;
- Nuit.

Parcours :
- anonyme simple ;
- anonyme + commentaire ;
- identifié simple ;
- identifié + commentaire ;
- QR choix ;
- modération ;
- résultats ;
- PDF ;
- suppression.

---

# 60. Tests — relais / free pilot

Étendre :

```text
npm run test:relay
npm run test:integration
npm run test:free-pilot
```

avec :
- nouvelles migrations D1 locales ;
- aucune R2 ;
- Turnstile création seulement ;
- commentaire dans vote ne doit pas déclencher Turnstile supplémentaire.

---

# 61. Documentation

Créer :

```text
docs/PARTICIPATION_V0.md
docs/COMMENTS_AND_IDENTITY_V0.md
docs/CODEX_PARTICIPATION_V0_5_REPORT.md
```

Mettre à jour :
- DATA_MODEL ;
- UX_FLOWS ;
- Relay/API docs ;
- privacy/data docs ;
- README ;
- migrations documentation ;
- PDF results guide.

Documenter très clairement :

- anonymous != identified ;
- identified != verified identity ;
- no uniqueness guarantee ;
- comments anonymous warning ;
- public comments moderation ;
- threshold behavior ;
- admin access before threshold ;
- PDF identity option.

---

# 62. Données personnelles / wording

Ne pas présenter Voti comme « aucune donnée personnelle » en mode identifié.

Le mode identifié collecte volontairement un nom ou pseudonyme déclaré.

Le texte produit doit rester précis :
- pseudonyme possible ;
- identité non vérifiée ;
- pas d’IP/fingerprint dans ballot/comment ;
- admin peut voir identité associée à la réponse en mode identifié.

Ne pas mélanger avec la politique de Soi-Libre.

---

# 63. Build et dépendances

Éviter toute grosse nouvelle dépendance.

HTML autonome conservé.

Si migration D1 / Worker change :
- tests workerd/Miniflare locaux ;
- pas de production avant audit.

---

# 64. Commandes finales

Relancer au minimum :

```text
npm test
npm run check
npm run build
npm run build:production
npm run test:browser
npm run test:poster
npm run test:poster-studio
npm run test:poster-polish
npm run test:relay
npm run test:integration
npm run test:free-pilot
git diff --check
```

Ajouter suites spécifiques si utile :

```text
npm run test:participation
npm run test:comments
```

---

# 65. Audit

Créer :

```text
VOTI_AUDIT_V0_5.zip
```

après tests et rapport.

Exclure :
- autres ZIP ;
- PDF temporaires ;
- exports admin ;
- DB locales ;
- comments fixtures sensibles non nécessaires ;
- captures ;
- profils ;
- caches ;
- node_modules ;
- .wrangler ;
- .relay-local ;
- .env / .dev.vars ;
- secrets.

Aucune vraie donnée de mineur dans fixtures/tests.

---

# 66. Publication

Ne pas commit.
Ne pas push.
Ne pas déployer Worker.
Ne pas migrer D1 production.
Ne pas publier Pages.

Attendre audit ChatGPT et validation de Lu’uma.

---

# 67. Critères de sortie

v0.5 est prêt pour audit lorsque :

1. nouveau sondage = commentaires facultatifs activés par défaut ;
2. désactivation possible avant premier vote ;
3. commentaires max 300 caractères ;
4. participation anonymous / identified disponible ;
5. anonymous ne crée aucune donnée d’identité ;
6. identified crée Participation séparée ;
7. nom/pseudo obligatoire mais non unique ;
8. commentaire + vote + participation atomiques ;
9. commentaires publics passent par modération ;
10. admin peut lire avant seuil ;
11. public ne voit que visible + résultats disponibles ;
12. pending/hidden ne fuitent pas ;
13. suppression commentaire n’altère pas le vote ;
14. résultats quantitatifs inchangés par modération ;
15. PDF Rapport peut inclure commentaires visibles ;
16. PDF Rapport admin peut inclure identités avec option désactivée par défaut ;
17. anciens sondages v0.4C restent compatibles ;
18. cleanup/suppression traitent comments/participations ;
19. aucune donnée sensible inutile ajoutée ;
20. tous les tests passent ;
21. rapport + bundle audit produits ;
22. aucune production mutée.
