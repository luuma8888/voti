# VOTE_MODES_MATRIX.md — Voti

## 1. Objectif

Clarifier la différence entre :
- identité ;
- anonymat ;
- droit de vote ;
- unicité ;
- appareil utilisé.

## 2. Cas principaux

| Cas | Compte | Anonyme | Unicité réelle | Solution |
|---|---:|---:|---:|---|
| Public simple | Non | Oui possible | Faible | formulaire public, protections UX seulement |
| Jeton unique | Non | Oui | Forte par jeton | code/QR à usage unique |
| Compte nominatif | Oui | Non | Forte par compte | compte lié au bulletin |
| Compte + anonyme | Oui | Oui | Forte | droit de vote séparé du bulletin |
| Téléphone collectif | Facultatif | Oui/Non | Selon jeton/compte | nettoyage de session entre personnes |
| Sondage externe | Selon service | Selon service | Selon service | Voti ne promet aucune garantie propre |

## 3. Règle de communication

Voti ne doit jamais annoncer :
`une personne = un vote`
si aucun mécanisme ne permet de l’assurer.

Éviter IP, fingerprint ou stockage navigateur comme fausse garantie.

## 4. MVP

Le MVP n’implémente pas encore l’unicité forte entre appareils.

Il doit néanmoins :
- empêcher un double clic / double envoi accidentel ;
- supporter des bulletins distincts ;
- préparer le modèle aux futurs jetons et comptes ;
- expliquer dans l’interface de développement que l’unicité forte viendra avec comptes ou jetons.

## 5. Futur vote anonyme avec compte

Séquence cible :

```text
authentification
-> vérification du droit de vote
-> émission/validation d’un droit opaque
-> bulletin enregistré séparément
-> droit marqué utilisé
```

La structure ne doit pas permettre une jointure triviale :
`user -> ballot`.

## 6. QR par réponse

Un QR par choix encode uniquement :
- sondage ;
- choix pré-sélectionné.

Séquence :

```text
scan
-> chargement du sondage
-> choix déjà sélectionné
-> confirmation visible
-> envoi du bulletin
```

Jamais :

```text
scan
-> vote enregistré
```

## 7. Téléphone collectif

Après chaque vote :
- afficher confirmation ;
- purger tout état propre au votant précédent ;
- revenir à l’écran initial ;
- ne jamais afficher le bulletin précédent au participant suivant.

## 8. Résultats et anonymat

Le seuil de publication réduit certains risques de déduction mais ne constitue pas à lui seul un anonymat cryptographique.

Valeur par défaut :
`5 réponses`.

Le seuil est configurable à la création.
