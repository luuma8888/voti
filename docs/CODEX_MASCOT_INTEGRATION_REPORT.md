# Mascotte Voti — intégration locale ponctuelle

Date : 28 octobre 2026. HEAD de départ : `7401cf7b0d9af306ff81f7a067113ccf9db0b47b`.
Bilan de validation locale, postérieur au pack documentaire gelé.
La publication autorisée ultérieurement est distincte de cette passe de validation.

## Pack officiel

ZIP reçu : `VOTI_MASCOT_ASSETS_CODEX.zip` ; SHA-256
`b51f66ce1ecd25c2c82b394c7603d7b7308ad0d29399b8023b533eb980d117f2`.
CRC vérifié ; README et manifeste lus. Dimensions, poids et alpha des huit images
vérifiés. Le pack n’a pas de fichier CHECKSUMS : des empreintes des octets reçus
sont consignées dans le manifeste d’intégration. Aucune image recréée ou réencodée.

| Usage | Source archivée | WebP utilisé | Dimensions Web | Poids |
|---|---|---|---|---:|
| Accueil principal | `assets/branding/source/mascots/mascot-welcome.png` | `mascot-welcome-36369c377f73.webp` | 487 × 720 | 82334 octets |
| Confirmation positive après vote | `assets/branding/source/mascots/mascot-success.png` | `mascot-success-7697c6282f77.webp` | 443 × 720 | 82546 octets |
| Écran « Présenter ma Carte Voti » | `assets/branding/source/mascots/mascot-card-scan.png` | `mascot-card-scan-0b7e9ee58584.webp` | 503 × 708 | 76442 octets |
| États vides | `assets/branding/source/mascots/mascot-empty.png` | `mascot-empty-4fb491086f6c.webp` | 396 × 571 | 52266 octets |

Les WebP sont dans `assets/branding/mascots/` avec leur manifeste ; leur nom porte
les douze premiers caractères du SHA-256 pour invalider les anciennes URL lors
d’une future modification. Les PNG ne sont pas chargés par l’application.
L’ancien asset `voti-mascot.webp` reste conservé, mais n’est plus embarqué ni utilisé.

## Quatre usages, une mécanique légère

- **Accueil** : posture Welcome dans le même bloc que les accès existants.
  Une seule mascotte, même si la bibliothèque est vide ; aucune dans les lignes.
  Largeur 112 px sur ordinateur, 54 px sur mobile, ratio vertical conservé.
- **États vides** : composant commun pour les listes Membres, Groupes et Sondages
  d’un Espace. Image Empty de 58 px (44 px mobile), titre et explication.
  Les boutons de création existants restent dans l’en-tête, selon les permissions.
  Aucun ajout dans les invitations, les accès, les listes remplies ou les formulaires.
- **Attente de Carte** : posture Card Scan de 96 px (62 px mobile), texte et action
  de scan existants. Le dessin de QR est illustratif : l’image n’est ni un lien ni un déclencheur
  de scan. L’image disparaît visuellement pendant le dialogue
  de scan, sans prendre de place dans la caméra. Aucune mascotte après reconnaissance.
- **Vote réussi** : posture Success, en Mode libre et Espace. Les messages,
  Accueil / Résultats / Participant suivant et l’oubli d’identité restent inchangés.

Le helper `web/mascot.js` utilise le catalogue injecté depuis le manifeste par le
build. Alt vide, `aria-hidden`, aucun contrôle/focus sur l’illustration. Images fixes,
aucune animation, y compris sous `prefers-reduced-motion`. Taille réservée et
`object-fit: contain`. Décodage asynchrone ; lazy loading dans les états vides.
Aucune nouvelle donnée métier, télémétrie, dépendance distante ou persistance.

## Performance et chemins

Les quatre WebP totalisent **293 588 octets**, sans préchargement global. La première
visite charge seulement Welcome (82 334 octets), vérifié par les requêtes Chromium.
La mascotte historique en base64 n’alourdit plus chaque chargement du HTML.

Build de production local : **1 721 086 octets** ; SHA-256 `03cb26ee6adf4ff39d048e7c51543a38a3ab47d4f97610a21201bd785290bc4a`.
Le précédent HTML faisait 1 884 069 octets : baisse brute de 162 983 octets.
HTML + Welcome représentent 1 803 420 octets, soit 80 649 octets bruts de moins
que le HTML précédent. Ce calcul ne mesure ni compression HTTP ni latence réelle.

Les images sont servies depuis le même site, sans CDN. URLs relatives au document :
`/voti/`, racine locale et ouverture `file://` avec le dossier d’assets préservé.
Le serveur de développement et le harnais PWA servent les quatre WebP hachés,
GET/HEAD uniquement ; aucun endpoint d’upload ou stockage d’image ajouté.
Le manifeste PWA, le logo et les icônes sont inchangés. Aucun service worker ajouté.

## Vérifications

- `npm test` : PASS après adaptation du test d’embarquement (logo + fond intégrés,
  quatre postures locales référencées, aucune image source PNG dans le HTML).
- `npm run check` : PASS, 158 fichiers JavaScript.
- `npm run test:browser` : PASS, 2 966 contrôles existants (local, commentaires,
  QR/PDF, dialogues, images, thèmes, clavier, responsive, offline et `/voti/`).
- `npm run test:mascot` : PASS, trois tests de catalogue/serveur/build et 443
  contrôles Chromium, aux largeurs 390 / 768 / 1200 / 1440 px.
- `npm run test:pwa` : PASS, quatre tests et 28 contrôles Chromium, racine et
  `/voti/`, sans erreur d’installabilité, exception ou requête externe.
- `npm run build:production` et `git diff --check` : PASS.

La fixture est fictive et locale. Les listes Espace utilisent les vrais renderers
sur données mémoire ; la soumission UI utilise un adaptateur simulé, pas D1.
Vérifications : scan au clavier puis Escape, actions visibles au-dessus de la
navigation mobile, pas de collision avec l’illustration ni de scroll horizontal,
alt décoratif, cinq thèmes et reduced motion. Le vote ne part qu’après confirmation,
un seul envoi est fait, identité oubliée et aucun credential participant persisté.
Aucune caméra physique ni recette humaine complète revendiquée.

## Cinq captures de revue inspectées

Dans `.browser-tests/mascot-review/` (ignoré par Git) :

1. `home-1440.png` : accueil avec un sondage fictif, actions et liste conservées.
2. `home-390.png` : accès Espace et Carte immédiatement visibles.
3. `empty-members-1200.png` : composant vide commun et action d’ajout conservée.
4. `card-prompt-390.png` : attente de Carte, scan visible, illustration QR décorative.
5. `vote-success-390.png` : réussite et actions suivantes visibles.

Les cinq images ont été inspectées ; pas de mascotte coupée ou de texte comprimé.
Les guides, PDF, banque des identités visuelles, règles, permissions, snapshots,
moteur de vote, Worker/D1 et baseline pilote ne sont pas modifiés.
Les rapports historiques et fichiers personnels préexistants sont préservés.

**MASCOT INTEGRATION READY — localement.**

## Publication autorisée

Le 28 octobre 2026, Lu’uma demande un commit dédié et un push sur `origin/main`
pour vérifier l’intégration en ligne. Les tests ci-dessus correspondent au build
publié, sans nouvelle modification fonctionnelle. Le push utilise la publication
GitHub Pages habituelle ; aucun déploiement Worker, changement D1 ou déplacement
du tag pilote n’est nécessaire. Les rapports historiques modifiés et les fichiers
personnels ne font pas partie de ce commit.
