# Voti v0.3E — confirmations stylisées accessibles

Date : 12 octobre 2026. Base : état final v0.3D, commit `53bdf80`.
Départ : `git status -sb` propre, main synchronisé avec origin/main.

## Résumé et périmètre

Les trois confirmations natives sont remplacées par un composant Voti partagé :
remplacement de clé administrateur, fermeture locale/distante, suppression en ligne.
Un vrai `<dialog>` modal, cohérent avec les cinq thèmes, attend un choix explicite.
Aucune dépendance ajoutée ; aucune règle métier, donnée, migration, configuration
ou implémentation de relais modifiée. Aucun déploiement Worker ni mutation du
relais de production ; aucun ZIP d'audit créé. Les anciennes archives ignorées
restent intactes. Après la procédure de recette locale, Lu’uma a déclaré :
« Je valide, tu peux commiter et pusher ». Cette autorisation explicite permet
le commit et la publication du frontend v0.3E sur main/GitHub Pages, sans
redéploiement Worker. Elle ne constitue pas une confirmation séparée de chaque
parcours distant sur téléphone : ceux-ci restent couverts par les tests locaux.

## Architecture du composant

`web/confirmation.js` exporte :

```js
confirmAction({ title, description, actionLabel, danger = false, trigger })
// Promise<boolean> : true seulement après activation explicite de l'action
```

Le module ne dépend ni du domaine ni du relais et n'effectue aucune requête ou
écriture. Aucun accès DOM à son import. Construction par `createElement` et
`textContent`, sans HTML interprété. Un seul dialogue à la fois : une demande
concurrente est refusée, sans remplacer la confirmation en cours.

`showModal()` place le dialogue dans la top layer et rend le reste du document
inerte. Le composant retire ses écouteurs via AbortController et déconnecte son
observateur à la sortie. Résolution unique : le double clic sur un bouton retiré
ne déclenche pas une deuxième action. Navigation, retrait du déclencheur ou
du dialogue, fermeture externe et refus d'ouverture annulent, jamais consentent.
Une route changée avant l'action ne peut pas valider une ancienne confirmation.
Les navigateurs sans showModal sont refusés de façon sûre, sans repli natif ni
action automatique ; cible inchangée : navigateurs modernes compatibles avec Voti.

Dans `web/app.js`, les trois parcours attendent le résultat avant de poursuivre
les opérations existantes. Un événement de fichier supplémentaire pendant
l'import actif est ignoré. La vérification réelle de la clé auprès du relais
reste **avant** le dialogue ; le remplacement explicite/CAS existant reste
**après** confirmation. Aucune révision ou validation serveur contournée.

## Présentation et vocabulaire

| Parcours | Titre | Action explicite |
| --- | --- | --- |
| Conflit de clé | Remplacer la clé d’administration ? | Remplacer la clé |
| Fermeture | Fermer ce sondage ? | Fermer le sondage |
| Suppression | Supprimer définitivement ce sondage ? | Supprimer définitivement |

Chaque dialogue explique brièvement la conséquence et offre « Annuler ».
La fermeture rappelle que le minimum de réponses demeure nécessaire ; elle ne
promet pas la publication après fermeture sous seuil. Le remplacement concerne
la clé conservée dans ce navigateur, pas la définition du sondage. La suppression
annonce la perte des liens publics, des votes/assets distants et la conservation
de la copie locale sans bulletins distants.

La classe card réutilise les surfaces, bordures et tokens des thèmes Pop,
Nature, Douceur, Nuit et Minimal. L'accent du cadre du déclencheur est conservé
quand disponible. Le conflit depuis Sauvegarde utilise le thème global.
Suppression : titre, bordure et bouton danger ; fermeture/remplacement : action
principale non alarmiste. Le focus reste dans la palette normale, jamais rouge.

Fond modal discret, ombre douce, largeur maximale 440 px, hauteur bornée au
viewport avec scroll interne. À 320/360 px, les boutons sont empilés en pleine
largeur ; cela évite la coupure maladroite d'un mot observée à la première capture.
Aucune animation ni ressource externe ; prefers-reduced-motion explicitement
respecté. Dialogues masqués à l'impression. Aucun changement de web/themes.js.

## Accessibilité

- Sémantique dialog native, aria-modal, titre et description liés par IDs uniques.
- Annuler reçoit autofocus et le focus effectif à l'ouverture, y compris suppression.
- Tab et Shift+Tab bouclent entre les deux actions ; clavier/pointeur arrière-plan bloqués.
- Échap, Annuler et fermeture extérieure produisent false.
- Entrée initiale annule ; Entrée maintenue n'agit pas. Pour confirmer au clavier,
  l'utilisateur doit déplacer explicitement le focus sur l'action.
- Focus restauré sur le déclencheur encore présent et activable. Une microtâche
  permet à l'import de réactiver son bouton dans finally avant cette restauration.
  Après mutation qui remplace la vue, le focus de navigation existant annonce la
  nouvelle page ; aucun focus forcé sur un ancien contrôle détaché/désactivé.
- Boutons >=44 px, focus visible, pas d'information portée seulement par la couleur.

Références primaires : [dialog HTML](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element),
[showModal et inertie](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal).

## Fichiers créés/modifiés

Créés :

- `web/confirmation.js` : composant partagé.
- `scripts/browser-dialogs.mjs` : tests réels du composant et clavier/pointeur CDP.
- `tests/confirmation.test.js` : contrat UI, sécurité des textes et recherche native.
- `docs/CODEX_UX_V0_3E_REPORT.md` : ce rapport.

Modifiés :

- `web/app.js` : attente des trois confirmations, garde d'import réentrant.
- `web/styles.css` : présentation du dialogue, mobile, mouvement réduit, impression.
- `scripts/browser-hardening.mjs` : vrais dialogues du conflit de clé et suppression.
- `scripts/browser-relay.mjs` : fermeture annulée/confirmée via vrai composant.
- `scripts/browser-test.mjs` : fermeture locale, tests du composant, captures,
  clavier réel et compteur des seules méthodes/URLs HTTP (aucun header/corps secret).
- `tests/themes.test.js` : contrastes de surface, danger et focus des cinq thèmes.
- `tests/build.test.js` : module supplémentaire embarqué, 26 modules au lieu de 25.
- `index.html` : build autonome régénéré ; profil production public préservé en dernier.

`shared/`, `relay/cloudflare/`, migrations, package.json/lock, configuration de
production, données et documentation historique v0.3D inchangés.

## Tests et résultats

8 tests Node supplémentaires : 3 contrats/audits UI et 5 vérifications de thème.
Les comportements du DOM natif sont testés dans Chromium, pas par un faux DOM Node.

Tests navigateur : ouverture/title/description/actions, mouse cancel/confirm,
Échap, Tab/Shift+Tab, restauration, Entrée sûre et confirmation clavier explicite,
Entrée maintenue, arrière-plan réellement non cliquable, double clic, demande
concurrente, navigation/retrait/fermeture externe, absence de support et refus
d'ouverture. 320/360/1200 px, cinq thèmes et trois accents, danger/non-danger,
réduction de mouvement, absence de débordement, aucun vote/stockage ajouté.

Trois parcours : fermeture locale annulée sans écriture, fermeture distante
annulée sans POST puis un seul POST après double clic ; conflit de clé annulé
par Annuler/Échap conservant l'ancienne clé, nouvelle clé vérifiée/remplacée
explicitement ; suppression annulée sans DELETE, un seul DELETE confirmé puis
NOT_FOUND. Les requêtes sont comptées par CDP, sans intercepter le protocole
ni journaliser capacité, Authorization, corps ou images.

| Commande | Résultat |
| --- | --- |
| npm test | Réussi ; décompte explicite Node sans isolation : 201 tests passés, 0 échec/sauté/annulé |
| npm run check | Réussi, 63 fichiers JavaScript |
| npm run build | Réussi, HTML local 486 453 octets |
| npm run test:browser | Réussi, 2 170 contrôles |
| npm run test:integration | Réussi, 73 contrôles HTTP/D1/R2 locaux + 2 250 contrôles Chromium |
| npm run test:free-pilot | Réussi, 21 contrôles HTTP/D1 sans R2 + 2 252 contrôles Chromium |
| npm run build:production | Exécuté en dernier : réussi, HTML public connecté 486 701 octets, 26 modules, sans secret ni publication |
| git diff --check | Réussi |

Contrastes calculés pour les paires de couleurs du dialogue (texte/cancel/action/
danger, surfaces de hover et trois accents compris, focus sur surface) :

| Thème | Texte minimum | Focus minimum |
| --- | ---: | ---: |
| Voti Pop | 5,924:1 | 6,079:1 |
| Nature | 5,851:1 | 5,851:1 |
| Douceur | 5,813:1 | 5,813:1 |
| Nuit | 5,955:1 | 6,697:1 |
| Minimal | 5,948:1 | 5,953:1 |

Captures cinq thèmes 360 px dans `.browser-tests/ux-v0-3e-*-360.png`, ignorées
par Git ; Pop et Nuit inspectés visuellement. Aucun ZIP créé.

### Incidents de validation

Le premier npm test sous sandbox échouait dans le test workerd existant :
diagnostic explicite `listen EPERM 127.0.0.1`. Relance avec permissions pour
ports locaux réussie, sans modification du test/backend.
Le premier test clavier n'activait pas le bouton : la séquence CDP Entrée
omettait son texte de keypress. Ajout de text/unmodifiedText CR sur keyDown,
puis tests d'ouverture/annulation et confirmation clavier réussis. Aucun
assouplissement d'assertion ni délai arbitraire ajouté à la navigation.
Une relance gratuite a révélé une course du test d'import : hash de gestion
déjà modifié, mais aria-busy=false appartenait encore à Sauvegarde, avant
hashchange/rendu. L'attente exige maintenant le lien public du sondage dans
la gestion effectivement rendue, avant les assertions d'administration.
L'application et le protocole n'ont pas été modifiés pour corriger ce harnais.
La suite complète a été relancée après correction : tous les résultats de la
table ci-dessus proviennent des dernières exécutions réussies. npm test/check
ont encore été relancés après renforcement des contrastes hover, puis le
build de production public a été restauré.
Le skill Wrangler a servi à confirmer le périmètre des scripts existants :
Worker/D1/R2 simulés en local, bindings remote:false, aucun déploiement distant.

## Limites et validation humaine

Validation automatisée sous Chromium 150.0.7871.181 (Debian), Node 22.23.3
verrouillé dans le dépôt. Safari/iOS, Firefox et lecture vocale
réelle ne sont pas revendiqués ; vérifier humainement les annonces, le focus
et le geste retour/Échap sur les appareils visés.
Le backdrop ne confirme ni ne ferme par clic : Annuler/Échap restent explicites.
Navigateurs anciens sans dialog : action refusée, aucun polyfill ou dépendance.
La publication du frontend est désormais autorisée explicitement par Lu’uma.
Le build de production connecté doit être restauré après les tests et avant le
commit, puis la version réellement servie sur Pages doit être vérifiée. Le
Worker reste inchangé en v0.3D ; aucun service payant n'est activé.

À vérifier avec Lu’uma : vocabulaire/conséquences des trois dialogues, rendu
Pop/Nuit mobile, annulation puis confirmation, boucle clavier et retour du focus.
Ces vérifications restent utiles sur les appareils réels, sans prétendre avoir
testé humainement tous les parcours distants. Aucun redéploiement Worker utile.
Aucun ZIP d'audit demandé pour cette publication du micro-lot.
