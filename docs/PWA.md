# Installer Voti sur un appareil compatible

**Voti peut être installé sur un appareil compatible pour un accès plus direct.**
Cette phrase pourra être reprise dans les futurs guides utilisateurs et le kit
de transmission terrain ; aucun manuel complet n’est ajouté ici.

## La même application Web

L’installation ajoute une icône Voti et permet l’ouverture dans une fenêtre
dédiée, sans barre d’adresse permanente. Elle utilise toujours le même frontend,
le même relais et les mêmes règles. Aucun APK, compte supplémentaire ou store.
Elle ne transfère pas les accès ni les données d’un appareil à un autre.

Cette amélioration est **postérieure** à la baseline `pilot-2026-10-25`.
Le tag et [son manifeste](PILOT_BASELINE.md) restent inchangés ; l’installation
PWA ne fait pas partie de cette version historique gelée.

## Installation

Ouvrir <https://luuma8888.github.io/voti/> :

- **Android / Chrome récent :** menu ⋮ → Installer l’application ou Ajouter à
  l’écran d’accueil → Installer, selon les libellés proposés. Lancer ensuite Voti
  depuis son icône.
- **Chromebook :** dans Chrome, utiliser l’icône d’installation de la barre
  d’adresse ou l’entrée d’installation du menu, puis ouvrir Voti dans le lanceur.
- **Ordinateur compatible :** Chrome ou Edge proposent une commande d’installation
  dans la barre d’adresse ou le menu. L’application s’ouvre dans sa propre fenêtre.

La disponibilité et le libellé dépendent du navigateur, de sa version et des
politiques de l’appareil. Une structure peut devoir demander à son administrateur
d’autoriser l’installation. Aucun bouton d’installation automatique ni popup
forcé dans Voti. En l’absence de commande compatible, continuer dans le navigateur.
Les anciens navigateurs peuvent proposer seulement un raccourci.

Le lancement ouvre l’accueil général sous `/voti/#home`. Les liens Espace,
sondage, participant et QR conservent leurs URL et contrôles habituels. Un lien
reçu peut s’ouvrir dans le navigateur plutôt que l’application selon le système ;
aucune interception de liens n’est ajoutée. Les liens externes gardent leur
comportement Web habituel.

## Mises à jour et connexion

Il n’y a **aucun service worker, précache, synchronisation ou cache API ajouté**.
Les mises à jour suivent les déploiements Web habituels et le cache HTTP normal
du navigateur/hébergeur. Fermer puis rouvrir l’application ou la recharger permet
de récupérer la version publiée, après sa propagation. Une fenêtre déjà ouverte
n’est pas rechargée de force pendant un vote ou une modification.

Internet reste nécessaire aux Espaces, à leur gestion et aux opérations distantes.
Cette installation n’ajoute **pas de mode offline métier**. Les possibilités
locales déjà présentes dans le Mode libre et les besoins d’export/sauvegarde
restent inchangés. Comme aujourd’hui, un rechargement détruit les credentials de
Cartes disponibles uniquement dans la mémoire de l’onglet : télécharger les PDF
nécessaires avant de recharger. Installer n’est pas une sauvegarde.

## Configuration technique et confidentialité

- `manifest.webmanifest` : nom Voti, `display: standalone`, `id: ./`,
  `start_url: ./#home`, `scope: ./`, langue française, orientation libre.
  Ces chemins fonctionnent sous `/voti/` sur GitHub Pages et à la racine en local.
- Couleurs initiales Pop : thème `#e9e2f5`, arrière-plan `#fdfbff`. Les thèmes
  de l’application restent disponibles ; la couleur de fenêtre native est fixe.
- Trois PNG publics dans `assets/pwa/` : 192, 512 et maskable 512. Ils sont
  dérivés du logo existant `assets/branding/source/voti-logo-source.png`, sans
  nouveau dessin. Fond opaque ; logo contenu dans la zone sûre circulaire de
  l’icône maskable. Les PNG livrés ne nécessitent aucune bibliothèque runtime.
- Le template lie le manifeste et les icônes ; scripts, CSS et logique restent
  embarqués comme auparavant. Servir le dépôt complet, pas seulement `index.html`.
  Le serveur `npm run dev` sert également ces seuls nouveaux fichiers publics.
- Aucun stockage PWA de credentials, profils, groupes, sondages, réponses ou votes.
  Aucun changement du stockage existant, aucune donnée sensible dans le manifeste,
  aucun cookie, tracking, CDN, service distant ou dépendance supplémentaire.

Le choix de ne pas ajouter de worker suit l’installation depuis le menu des
Chrome modernes : [critères d’installation Chrome](https://developer.chrome.com/blog/update-install-criteria)
et [critères manifest actuels](https://web.dev/articles/install-criteria).
Il n’ajoute pas de promesse sur l’affichage automatique d’une invitation à installer.

## Vérifications et limites

Commandes locales, avec les prérequis Node/Chromium habituels du dépôt :

```sh
npm run build:production
npm run test:pwa
npm test
npm run check
# Les tests généraux reconstruisent aussi des variantes locales : finir par
npm run build:production
git diff --check
```

`test:pwa` vérifie le JSON, les chemins, les dimensions PNG réelles, les MIME,
GET/HEAD et la liste fermée des assets publics, puis démarre un serveur et un
profil Chromium isolés. Il vérifie la détection du manifeste, les erreurs
d’installabilité, le chargement des trois icônes, le retour de navigation,
le responsive 390/1440, le chargement d’une nouvelle version et l’absence de
service worker/Cache Storage. Aucune requête production n’est nécessaire.
Sorties locales ignorées : `.browser-tests/pwa/`.

Vérification locale du 26 octobre 2026 : 4 tests PWA et 28 contrôles sous
Chromium `150.0.7871.181` PASS ; aucune erreur d’installabilité à la racine ou
sous `/voti/`, aucune exception JS, aucun appel externe, worker ou Cache Storage.
Suite générale : 428 tests PASS ; syntaxe : 154 fichiers JS PASS ;
`git diff --check` PASS. Les suites lourdes métier ne sont pas rejouées : aucun
bootstrap, routage ni code métier n’a changé. La comparaison au HTML de départ
confirme seulement quatre ajouts de métadonnées, CSS et modules identiques.
Build production : **1 884 069 octets** (+251) ; SHA-256
`d63c916714451196fd927d72ce02687c29411b6e6dabbe6c88a82cdc27b9dfa7`.
Les trois icônes totalisent **206 755 octets**, hors HTML.

Le contrôle technique sous Chromium ne simule pas une installation réelle
Android/ChromeOS ni l’interface de leur lanceur. La seule vérification humaine
restante, après publication autorisée, est d’ouvrir Voti, installer depuis Chrome,
puis lancer l’icône. Pas de nouvelle recette complète des sondages.

Une évolution offline pourra être étudiée séparément si le terrain la demande,
avec un périmètre et des garanties de confidentialité explicites.
