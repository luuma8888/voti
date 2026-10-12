# Voti — v0.4A — QR, partage et affiche PDF

## Statut

Premier lot fonctionnel après validation du pilote Internet v0.3D et du micro-lot UX v0.3E.

Ce lot introduit les fonctions QR centrales de Voti et une première affiche PDF imprimable.

Aucune modification Cloudflare/D1/Worker n'est nécessaire.

---

# 1. Objectifs

Ajouter à Voti :

1. QR d'accès au sondage ;
2. QR par choix ;
3. QR de résultats ;
4. QR secret de transfert d'administration ;
5. centre de partage clair pour le créateur ;
6. téléchargement individuel des QR ;
7. export d'une affiche PDF stylisée utilisant les QR ;
8. routes publiques robustes pour les QR par choix ;
9. préparation d'une architecture réutilisable pour les futurs exports PDF de résultats.

Le vote par QR de choix ne doit JAMAIS voter automatiquement.

---

# 2. Principes fondamentaux

## QR public d'accès

Encode exactement l'URL publique du sondage :

```text
https://luuma8888.github.io/voti/#/p/<pollId>
```

## QR de résultats

Encode :

```text
https://luuma8888.github.io/voti/#/p/<pollId>/results
```

La page fonctionne même si les résultats sont encore sous le seuil :
elle affiche alors l'état verrouillé normal.

## QR par choix

Introduire une route publique canonique du type :

```text
https://luuma8888.github.io/voti/#/p/<pollId>/choice/<choiceId>
```

ou une structure équivalente propre.

IMPORTANT :

Scanner ce QR :
- ouvre le sondage ;
- présélectionne ce choix ;
- montre clairement le choix présélectionné ;
- exige toujours l'action humaine Continuer / Confirmer ;
- n'envoie aucun vote automatiquement ;
- ne crée aucun bulletin avant confirmation.

Aucun vote ne doit être déclenché par :
- navigation ;
- chargement ;
- scan ;
- refresh ;
- retour arrière ;
- préselection.

Si le choiceId est invalide ou ne correspond pas au sondage :
- ne jamais sélectionner un autre choix automatiquement ;
- afficher le sondage normalement ;
- expliquer brièvement que le choix du QR n'est plus disponible.

## QR administration

Le QR administration est SECRET.

Il ne doit jamais être :
- ajouté à une affiche publique ;
- inclus dans un PDF public ;
- affiché avec les QR de vote sans séparation explicite ;
- enregistré dans les logs ;
- envoyé au Worker dans l'URL.

Il sert uniquement à transférer volontairement l'administration vers un autre appareil.

---

# 3. Génération QR locale

Aucun service QR externe.

La génération doit être entièrement locale dans le navigateur.

Préférer une bibliothèque QR JS mature et petite, embarquée dans le build, plutôt qu'une implémentation artisanale de Reed-Solomon.

Contraintes :

- aucune requête réseau au runtime pour générer un QR ;
- fonctionne dans l'HTML autonome ;
- build one-file conservé ;
- licence compatible et documentée ;
- niveau de correction d'erreur adapté, au moins M ;
- quiet zone d'au moins 4 modules ;
- contraste noir/blanc ou équivalent très élevé ;
- aucun logo superposé dans les modules ;
- taille minimale suffisante pour écran et impression.

Si une dépendance npm est ajoutée :
- elle doit être bundlée ;
- aucune CDN ;
- documenter poids et licence ;
- vérifier que le mode offline reste autonome.

---

# 4. API interne QR

Créer une abstraction réutilisable indépendante de l'UI, par exemple :

```text
buildPollUrl(...)
buildChoiceUrl(...)
buildResultsUrl(...)
buildAdminTransferUrl(...)

createQrMatrix(...)
renderQrSvg(...)
renderQrCanvas(...)
downloadQrPng(...)
downloadQrSvg(...)
```

Les noms exacts peuvent différer.

La logique URL et la logique QR ne doivent pas être dupliquées dans plusieurs vues.

Préparer le rendu pour être réutilisable par l'affiche PDF.

---

# 5. Centre de partage du créateur

Dans la gestion d'un sondage EN LIGNE, ajouter une section claire :

```text
Partager le sondage
```

Elle propose au minimum :

- Lien de vote ;
- QR de vote ;
- QR par choix ;
- QR des résultats ;
- Affiche PDF ;
- Transférer l'administration — séparé visuellement et marqué SECRET.

Ne pas surcharger l'écran principal :
préférer un panneau, une vue ou un dialogue dédié cohérent avec Voti.

Chaque QR public doit afficher :
- un libellé compréhensible ;
- le QR suffisamment grand ;
- le lien ou sa destination en texte secondaire ;
- Copier le lien lorsque pertinent ;
- Télécharger PNG ;
- Télécharger SVG si raisonnable.

Le téléchargement SVG est recommandé pour l'impression.

---

# 6. QR par choix — UX

Pour 2 à 6 choix :

- afficher une carte par choix ;
- libellé du choix clairement associé ;
- QR assez grand ;
- bouton téléchargement ;
- aucun QR ambigu.

Sur mobile :
- une colonne ou deux selon espace ;
- aucune miniature illisible.

Sur desktop :
- grille fluide.

Ne pas afficher des images utilisateur distantes puisque le pilote Internet actuel les désactive.

---

# 7. QR administration — sécurité

Réutiliser la capacité d'administration existante.

La route de transfert doit utiliser uniquement le fragment client de l'URL, jamais query/path HTTP contenant le secret envoyé au serveur.

Forme possible :

```text
https://luuma8888.github.io/voti/#/admin/import/<payload-base64url>
```

où le payload contient la même information que le fichier SECRET d'administration versionné.

Contraintes indispensables :

1. le fragment n'est jamais envoyé au Worker par HTTP ;
2. dès le chargement, extraire le payload en mémoire ;
3. remplacer immédiatement l'URL visible/historique par une route sans secret, AVANT la vérification distante ;
4. ne pas écrire la capacité dans console/log/analytics ;
5. afficher un écran :
   `Clé d'administration détectée`;
6. expliquer que son possesseur peut gérer/supprimer le sondage ;
7. demander une confirmation explicite ;
8. utiliser `verifyAdmin` avant stockage ;
9. réutiliser les règles existantes de conflit de capacité ;
10. annuler = aucun stockage ;
11. mauvais payload = aucun stockage.

Ne jamais importer automatiquement simplement parce que le QR a été scanné.

Le QR secret doit être affiché uniquement après une action explicite du créateur, avec avertissement.

Prévoir :
- bouton `Afficher le QR secret`;
- bouton `Masquer`;
- pas d'affichage permanent au chargement de la gestion ;
- éventuellement téléchargement uniquement après avertissement explicite, sinon ne pas proposer le téléchargement.

Le QR administration ne doit jamais se retrouver dans le PDF d'affiche.

---

# 8. Affiche PDF Voti

Ajouter une première exportation PDF stylisée pour un sondage distant.

Nom possible :

```text
voti-affiche-<pollId>.pdf
```

Aucune génération serveur.

Tout est généré localement dans le navigateur.

## Mode A — accès unique

Affiche A4, destinée à être imprimée et affichée.

Contient :
- identité Voti discrète ;
- question très lisible ;
- description si présente ;
- liste des choix ;
- grand QR `Accéder au vote`;
- petit bloc `Voir les résultats` avec QR résultats ;
- indication courte :
  `Scanne pour participer`.

Le QR principal doit être visuellement dominant.

## Mode B — un QR par choix

Affiche contenant :
- question ;
- un bloc par choix ;
- libellé ;
- QR correspondant au choix ;
- phrase claire :
  `Le QR présélectionne ce choix. Le vote doit ensuite être confirmé.`;
- QR résultats séparé.

Pour 2 à 6 choix, adapter automatiquement la grille.

Pour 5–6 choix :
- paysage A4 ou composition adaptée si nécessaire ;
- ne pas réduire les QR sous une taille raisonnablement scannable.

Le résultat doit rester sur une seule page si c'est raisonnablement possible.
Si la lisibilité serait sacrifiée, préférer deux pages documentées plutôt que des QR trop petits.

---

# 9. Technique PDF

Préserver le mode one-file/offline.

Aucun service externe.

Une petite dépendance client PDF est acceptable si nécessaire et bundlée.

Privilégier une solution simple et déterministe.

Une approche acceptable :

```text
Canvas haute résolution
→ rendu texte/QR/branding
→ PNG
→ page PDF A4
```

Cela évite d'embarquer une police spécifique et conserve les caractères rendus par le navigateur.

Si cette approche est choisie :
- rendu suffisamment haute résolution pour impression ;
- QR dessiné sur grille de pixels entière ;
- ne pas lisser les modules QR ;
- limites mémoire raisonnables ;
- tester accents français et textes longs.

Une solution vectorielle est également acceptable si elle reste fiable et autonome.

Ne jamais inclure de secret administrateur dans un PDF public.

---

# 10. Style de l'affiche

Reprendre l'identité Voti :
- fond/palette douce ;
- logo ou symbole discret ;
- mascotte légère si elle ne gêne pas ;
- cinq thèmes et accent du sondage lorsqu'il est pertinent.

Mais priorité absolue :
1. question ;
2. choix ;
3. QR ;
4. lisibilité.

Le QR reste noir/blanc ou contraste équivalent sûr.

Éviter :
- décoration à l'intérieur du QR ;
- arrière-plan chargé derrière le QR ;
- texte minuscule ;
- poster enfantin façon maternelle.

L'affiche doit rester adaptée aux enfants, préados, ados et adultes.

---

# 11. Cas non publiés

Pour un sondage uniquement local :

- ne pas produire de faux QR public ;
- expliquer :
  `Publie d'abord ce sondage en ligne pour créer ses QR de partage.`;

L'affiche QR est disponible uniquement pour un sondage réellement rattaché au relais de production/pilote.

Ne jamais inventer une URL permanente pour un poll local.

---

# 12. Sondage fermé

Les QR existants restent valides.

QR vote :
- ouvre le sondage fermé ;
- aucun nouveau vote ;
- accès aux résultats selon les règles existantes.

QR choix :
- ouvre le même sondage fermé ;
- ne permet pas de confirmer un nouveau vote.

QR résultats :
- fonctionne normalement.

Ne pas régénérer des URLs différentes lors de la fermeture.

---

# 13. Suppression

Après suppression distante :
- tous les QR publics conduisent à l'état `sondage introuvable`;
- QR administration ne permet plus l'import : verifyAdmin => NOT_FOUND ;
- aucune capacité locale ne recrée le sondage.

Aucune révocation physique possible d'un PDF/QR déjà imprimé : le document doit simplement pointer vers un poll désormais absent.

---

# 14. Accessibilité

Le centre de partage doit être accessible :
- navigation clavier ;
- labels ;
- focus visible ;
- dialogues conformes au composant v0.3E ;
- QR avec description textuelle de destination ;
- boutons >=44 px ;
- pas de sens transmis uniquement par couleur.

Un QR n'est pas un remplacement du lien texte.

---

# 15. Tests QR unitaires

Tester les builders d'URL :

- poll ;
- résultats ;
- 2/3/6 choix ;
- caractères/IDs invalides ;
- pollId invalide ;
- choiceId invalide ;
- aucun secret dans les URLs publiques.

Tester la génération :
- déterministe pour même payload/options ;
- quiet zone ;
- dimensions ;
- niveau d'erreur ;
- SVG valide ;
- PNG générable.

Si raisonnable, utiliser un décodeur QR distinct EN TEST SEULEMENT afin de vérifier :
`payload -> QR -> décodage -> payload`.

Ne pas ajouter un décodeur au runtime Voti uniquement pour les tests.

---

# 16. Tests navigateur QR public

Tester :

## QR accès
- destination correcte ;
- page sondage correcte.

## QR choix
- route correcte ;
- choix présélectionné ;
- aucun vote envoyé au chargement ;
- compteur distant inchangé avant confirmation ;
- Continuer ;
- confirmation explicite ;
- un seul vote après validation ;
- refresh avant confirmation = aucun vote ;
- invalid choiceId = aucun choix automatique.

## résultats
- sous seuil ;
- au seuil ;
- fermé.

## sondage fermé
- QR vote/choix n'autorise pas de nouveau bulletin.

## suppression
- route publique => NOT_FOUND.

---

# 17. Tests admin QR

Tester obligatoirement :

- payload valide ;
- payload invalide ;
- mauvaise version ;
- mauvais relayId ;
- mauvaise capacité ;
- poll supprimé ;
- capacité déjà présente identique ;
- capacité différente avec dialogue de conflit ;
- annulation ;
- confirmation ;
- verifyAdmin réel/simulé avant stockage ;
- secret retiré de location/history avant requête distante ;
- aucun secret dans query/path HTTP ;
- aucun secret dans logs de test ;
- aucune importation automatique.

Le test doit inspecter l'URL de la requête réseau et confirmer que la capacité n'y figure pas.

---

# 18. Tests PDF

Tester :

- PDF accès unique ;
- PDF QR par choix ;
- 2 choix ;
- 3 choix ;
- 6 choix ;
- question longue ;
- labels longs ;
- accents français ;
- cinq thèmes au moins via rendu/config ;
- A4 dimensions correctes ;
- 1 page lorsque prévu ;
- pas de secret ;
- pas de capacité admin ;
- QR de résultats présent ;
- les payloads QR dans le renderer correspondent exactement aux URLs testées.

Si un PDF est rasterisé :
- contrôler résolution minimale ;
- absence de lissage des modules QR ;
- taille des QR suffisante.

---

# 19. Test physique demandé après publication

Après validation, commit et push ultérieur, la recette humaine devra inclure :

1. afficher QR vote sur Chromebook ;
2. scanner avec téléphone ;
3. confirmer ouverture du bon sondage ;
4. afficher QR d'un choix ;
5. scanner ;
6. vérifier que le choix est présélectionné MAIS PAS voté ;
7. confirmer manuellement ;
8. afficher QR résultats ;
9. scanner ;
10. imprimer ou ouvrir le PDF à 100 % ;
11. scanner au moins un QR depuis le PDF affiché/imprimé.

Cette recette physique ne doit PAS être déclarée réussie par Codex sans confirmation de Lu’uma.

---

# 20. Régressions

Conserver :
- pilote Internet v0.3D ;
- confirmations stylisées v0.3E ;
- mode local ;
- mode production texte sans R2 ;
- Turnstile création uniquement ;
- vote sans challenge ;
- seuil ;
- fermeture ;
- suppression ;
- transfert fichier admin existant ;
- cinq thèmes ;
- 360 px ;
- offline local.

---

# 21. Tests à relancer

Au minimum :

```text
npm test
npm run check
npm run build
npm run build:production
npm run test:browser
npm run test:relay
npm run test:integration
npm run test:free-pilot
git diff --check
```

Ajouter toute nouvelle suite QR/PDF pertinente.

Aucune mutation Cloudflare distante.
Aucun redéploiement Worker.

---

# 22. Documentation

Créer :

```text
docs/QR_AND_POSTER_V0.md
docs/CODEX_QR_V0_4A_REPORT.md
```

Mettre à jour si nécessaire :
- README.md ;
- UX_FLOWS_V0.md ;
- documentation production si une nouvelle route publique doit y être mentionnée.

Documenter :
- toutes les URLs QR ;
- règle "préselection ≠ vote" ;
- sécurité QR admin ;
- comportement fermé/supprimé ;
- génération locale ;
- dépendances/licences ;
- PDF ;
- limites d'impression/scannabilité.

---

# 23. Bundle audit

Après tous les tests et le rapport :

```text
VOTI_AUDIT_V0_4A.zip
```

via le mécanisme existant.

Toujours exclure :
- tous les VOTI_AUDIT_*.zip ;
- node_modules ;
- runtime Node ;
- caches ;
- profils/captures ;
- .wrangler/.relay-local ;
- bases locales ;
- secrets ;
- fichiers de clés admin exportées ;
- PDF de test temporaires.

Ne pas commit le ZIP.

---

# 24. Commit/push

Ne pas commit.
Ne pas push.
Ne pas modifier GitHub Pages.

Attendre l'audit ChatGPT et la validation humaine.

---

# 25. Hors périmètre

Ne pas ajouter maintenant :

- comptes ;
- groupes ;
- Android/Capacitor ;
- commentaires ;
- vote unique par personne ;
- synchronisation offline ;
- nouveau backend média ;
- R2 ;
- images distantes ;
- domaine personnalisé ;
- refonte globale ;
- PDF détaillé des résultats (prévu pour un lot ultérieur).

---

# 26. Critère de sortie

v0.4A est terminé lorsque :

- les quatre familles de QR existent ;
- les QR sont générés localement ;
- le QR par choix ne vote jamais automatiquement ;
- les liens sont canoniques et robustes ;
- le QR admin est traité comme secret ;
- le secret est retiré de l'URL avant vérification réseau ;
- le centre de partage est utilisable ;
- les QR PNG/SVG sont téléchargeables ;
- l'affiche PDF accès unique fonctionne ;
- l'affiche PDF par choix fonctionne ;
- tous les tests passent ;
- aucune mutation Cloudflare n'a eu lieu ;
- rapport + bundle audit sont produits.
