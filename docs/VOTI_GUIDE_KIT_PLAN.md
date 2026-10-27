# Kit de transmission Voti

Plan éditorial du **26 octobre 2026**, sans rédaction des guides finaux ni PDF.

Référence : HEAD publié **`601aeb04c171fae6b4f4928d694f9ce8c4ddf190`**, branche
`main`, dernière release « feat: make Voti installable as a PWA ». Le distant et
GitHub Pages ont été vérifiés en lecture seule : même commit, publication réussie,
HTML de 1 884 069 octets, SHA-256
`d63c916714451196fd927d72ce02687c29411b6e6dabbe6c88a82cdc27b9dfa7`.
La PWA publiée expose son manifeste : Voti, `standalone`, lancement `./#home`,
scope `./` sous `/voti/`. Aucun service worker ajouté.

La baseline [pilote stable](PILOT_BASELINE.md), tag `pilot-2026-10-25` sur
`7cd51b852a308cd44e87fd448e7821e0e5d24e3e`, reste inchangée. La PWA lui est
postérieure. Aucun nouveau contrôle métier ou recette humaine n’est demandé ici.
Les neuf rapports historiques modifiés localement et les fichiers personnels
restent hors de ce travail ; seul ce plan est révisé.

## Publics

| Rôle fonctionnel | Besoin documentaire | Permissions réelles à expliquer |
| --- | --- | --- |
| Administrateur | Préparer et gérer l’Espace, les membres, groupes, accès et Cartes ; protéger les fichiers | Gère l’Espace et ses fonctions autorisées ; peut aussi créer et gérer les sondages |
| Créateur | Créer et gérer les sondages dans son périmètre | Accès à tout l’Espace ou aux seuls groupes autorisés ; pas automatiquement les droits d’administration de l’Espace, des membres, des Cartes ou des accès |
| Participant | Utiliser sa Carte Voti, répondre, confirmer et terminer | Participe aux sondages auxquels il est éligible et consulte les résultats autorisés ; aucun droit de gestion donné par sa Carte |

**Ces rôles décrivent les permissions dans Voti. Ils ne correspondent pas à un
métier, un âge ou un type d’organisation.** Un Participant peut être enfant,
adolescent ou adulte ; l’Administrateur et le Créateur ne sont pas définis par
une profession ou un statut extérieur à Voti.

Un guide commun, avec repères **Administrateur**, **Créateur** et **Participant**,
suffit. Les procédures indiquent les permissions nécessaires et quand solliciter
un Administrateur. La fiche Participant reste utilisable à tout âge : phrases
courtes, vocabulaire courant, gestes explicites, sans ton infantilisant.
Une aide à la lecture ou à la manipulation est possible selon les besoins de la
personne, sans être une condition attachée à son rôle.

## Objectifs

Permettre à toute personne découvrant Voti de comprendre son fonctionnement,
de retrouver les actions correspondant à son rôle et d’utiliser l’outil sans
connaissance préalable du projet. Le kit doit pouvoir être utilisé seul ou à
plusieurs, avec des explications simples pour les fonctions concernées. Le parcours
principal du kit est **Mode Espace**, avec une courte distinction du Mode libre
présent sur l’accueil : ses droits, sauvegardes et garanties sont différents.

Quelques exemples très courts, placés seulement au début du guide, illustreront
la polyvalence de Voti :

- choisir une activité en famille ;
- choisir une sortie ou une activité dans une classe ou un groupe ;
- recueillir l’avis des membres d’une association ou d’un collectif ;
- organiser un choix dans une structure jeunesse.

Ces exemples montrent des possibilités d’usage. Aucun ne définit le contexte
implicite du produit ou des procédures ; les rôles et les permissions restent
les mêmes quel que soit le contexte.

Le kit présente les fonctions disponibles au HEAD, y compris celles moins
éprouvées humainement ; il ne transforme pas deux recettes précises en validation
de toutes les variantes. La formule actuelle du minimum remplace les anciens
défauts fixes cités dans des documents historiques.

### Sources existantes à réutiliser

| Source du dépôt | Utilisation éditoriale |
| --- | --- |
| [PILOT_BASELINE.md](PILOT_BASELINE.md) | Périmètre stable, limites, distinction version gelée/évolutions |
| [PWA.md](PWA.md) | Base déjà rédigée pour installation, mises à jour et limites ; extraire le contenu pratique, laisser les tests techniques hors guide d’utilisation |
| [SPACES_GROUPS_V0.md](SPACES_GROUPS_V0.md) et [UX_FLOWS_V0.md](UX_FLOWS_V0.md) | Espaces, rôles, navigation, audience, sauvegarde ; lire les évolutions récentes, les sections anciennes restent historiques |
| [MEMBER_CARDS_V0.md](MEMBER_CARDS_V0.md) et [MEMBER_VISUALS_V0.md](MEMBER_VISUALS_V0.md) | Cartes, sessions, régénération, lots, illustrations, limites de récupération |
| [GROUP_VOTING_PRIVACY_V0.md](GROUP_VOTING_PRIVACY_V0.md), [PARTICIPATION_V0.md](PARTICIPATION_V0.md), [COMMENTS_AND_IDENTITY_V0.md](COMMENTS_AND_IDENTITY_V0.md) | Anonyme/identifié, confidentialité, résultats et commentaires |
| [PRIVACY_AND_ABUSE_V0.md](PRIVACY_AND_ABUSE_V0.md) et [DATA_MODEL_V0.md](DATA_MODEL_V0.md) | Données, conservation technique, suppression ; extensions Espaces prioritaires, anciennes sections R2 non applicables au pilote actuel |
| [CODEX_SPACE_POLL_HUMAN_RECIPE_REPORT.md](CODEX_SPACE_POLL_HUMAN_RECIPE_REPORT.md) | Scénarios Guidée/Express acquis et limites de couverture humaine |
| [CODEX_SPACE_POLL_UX_IMPLEMENTATION_REPORT.md](CODEX_SPACE_POLL_UX_IMPLEMENTATION_REPORT.md) et [CODEX_SPACE_POLL_RELEASE_READY_REPORT.md](CODEX_SPACE_POLL_RELEASE_READY_REPORT.md) | UX actuelle, minimum proportionnel et validations techniques ; pas des manuels à distribuer tels quels |
| [QR_AND_POSTER_V0.md](QR_AND_POSTER_V0.md), [POSTER_STUDIO_V0.md](POSTER_STUDIO_V0.md), [RESULTS_PDF_V0.md](RESULTS_PDF_V0.md) | Partage/affiche et export des résultats, sous-section facultative du guide |

Branchements UI consultés : `web/spaces-ui.js`, `space-management.js`,
`space-poll-form.js`, `space-poll-editor.js`, `space-poll-management.js`,
`space-poll-minimum.js`, `edit-actions.js`, `card-session.js`, `card-batch-ui.js`
et `space-storage.js`. Les libellés d’écran priment sur les anciens intitulés des
rapports. Les procédures doivent être reliées à leurs écrans, pas aux noms d’API.

Scénarios de référence : `scripts/browser-space-layout.mjs` (rôles, sections,
trois créations, conservation/validation), `browser-spaces.mjs` (Carte, vote,
identifié, résultats), `browser-spaces-ux.mjs` (minimum, sauvegarde et résultats),
`run-card-ux.mjs`, `run-card-background-batch.mjs`, `run-visual-review.mjs`,
`run-groups-hd-v2.mjs` et `browser-pwa.mjs`. Ils servent à préparer les états de
capture et à vérifier une formulation incertaine, sans nouvelle campagne de tests.

## Documents proposés

**Trois documents distribuables**, mêmes captures réutilisées, pas trois manuels
par rôle. Les noms ci-dessous sont des propositions, aucun de ces fichiers n’est
créé dans cette mission.

| Repère | Document / nom proposé | Volume cible | Contenu et usage |
| --- | --- | --- | --- |
| D1 | Démarrage rapide Voti — `VOTI_DEMARRAGE_RAPIDE` | 4 pages | p. 1 : utilité, rôles, entrée et installation facultative ; p. 2–3 : fiche « Premier sondage » ; p. 4 : mini fiche Participant détachable, utilisable à tout âge |
| D2 | Guide Voti — Comprendre et utiliser — `VOTI_GUIDE` | 14–18 pages | Procédures de référence, repères de rôle, préparation, Cartes, sondages, résultats, administration et données ; dernière page installation détachable issue de PWA.md |
| D3 | Aide & dépannage Voti — `VOTI_AIDE_DEPANNAGE` | 2–3 pages | Symptôme → vérification → action possible → personne à contacter selon le rôle ; lien vers la procédure du guide |

Total indicatif : **20–25 pages**, à confirmer au montage sans réduire les
caractères pour tenir un chiffre. D2 porte les procédures détaillées ; certaines
actions avancées n’occupent qu’un encadré. D1 et D3 renvoient aux numéros Pxx,
sans recopier le guide complet. Un sommaire cliquable et les mêmes identifiants
dans les versions écran/imprimée suffisent.

La fiche « Premier sondage » est incluse dans D1 p. 2–3, imprimable seule ; pas de
quatrième document redondant. L’installation reste dans D1 et D2 : une fiche
séparée ne sera utile que si un besoin d’usage le justifie, à extraire de la même page.
La page D1 p. 4 peut être transmise seule à toute personne ayant le rôle Participant.

## Parcours à documenter

| Parcours réel | Chemin / état à expliquer | Point pédagogique essentiel |
| --- | --- | --- |
| A — Premier accès | Accueil → Espaces & groupes → Mes Espaces / import / création | Ouvrir le site ne crée ni Espace ni compte ; le bouton global de création concerne le Mode libre |
| B — Espace et rôles | Ouvrir → Aperçu ; Sondages, Membres, Groupes, Invitations, Accès ; Réglages | Une section à la fois ; certaines ne sont pas disponibles au Créateur |
| C — Membres | Membres → Ajouter un membre / Voir → nom, illustration, groupes → Enregistrer | La création émet aussi une Carte ; une modification de fiche attend Enregistrer |
| D — Groupes | Groupes → Nouveau groupe / Voir ; affiliations depuis la fiche membre | Un membre peut être dans plusieurs groupes ; les groupes ciblent les prochains sondages |
| E — Cartes | Création/régénération → aperçu ; Membres → session ou Gérer les cartes → PDF | Accès personnel au vote, différent de l’accès de gestion ; réimprimer et remplacer ont des effets différents |
| F — Sondages | Sondages → Nouveau sondage → Guidée / Express / Réglages avancés → brouillon → publication | Rester dans l’Espace ; créer un brouillon ne rend pas le vote disponible |
| G — Participation | Carte d’abord, ou QR sondage puis carte → reconnaissance → choix → confirmation → succès | Scanner ne vote pas ; pas de session participante persistante ; Terminer neutralise le parcours |
| H — Résultats | Gestion et action Résultats, ou résultat participant après carte | Minimum, condition de publication et public autorisé sont trois notions distinctes |
| I — PWA | Menu navigateur → installation → icône → accueil ; rechargement lors d’une mise à jour | Même Web/relais, Internet nécessaire pour les Espaces ; l’installation ne sauvegarde pas les cartes |
| J — Dépannage | Message visible → D3 → procédure ciblée / administrateur | Aider à identifier le contexte avant de recréer, révoquer ou supprimer |

### Fil rouge proposé pour D1

**Exemple fictif utilisé dans le guide : La Cabane Voti.** Ce fil rouge n’est
rattaché à aucun contexte particulier. La fixture locale comprend deux groupes
Soleil/Lune et cinq membres Soleil A/B/C et Lune A/B.
Question « Quelle activité vendredi ? », réponses Parc,
Cinéma, Jeux. Groupe Soleil : N = 3, minimum recommandé = 2, vote simple anonyme.
Express est le raccourci du démarrage ; Guidée est présentée comme parcours
d’accompagnement de référence dans D2, avec ses six étapes.

Préciser la règle choisie : Express utilise le minimum (`threshold`) ; ne pas lui
attribuer l’attente « tout le monde ou fermeture ». Le cas 2/3 avec attente est
une variante Guidée du guide. L’exemple montre les deux cas dans des sondages
distincts, comme les deux recettes humaines acquises.

Un Créateur reçoit son accès, son groupe et les Cartes préparés par l’administrateur.
Il commence au sondage ; il ne suit pas les actions d’administration de D1 p. 2.
Les exemples d’usage variés sont regroupés dans l’introduction, sans décliner
chaque procédure par contexte. Le fil rouge utilise des choix quotidiens non
sensibles ; pas de vraies identités ou situations personnelles dans les exemples.

## Procédures

**36 procédures** existantes, regroupées dans D2. A = Administrateur,
C = Créateur dans son périmètre, P = Participant. Ces lettres désignent uniquement
des permissions fonctionnelles, sans présumer âge, métier ou organisation.
Les nombres sont des estimations de gestes pédagogiques, pas des clics déjà
rédigés. Les captures Cxx sont définies
plus bas ; une même capture peut illustrer plusieurs procédures. Les opérations
avancées restent hors du premier démarrage.

| ID / nom | Public | Précondition | Objectif | Écrans / étapes env. | Captures | Difficulté |
| --- | --- | --- | --- | --- | --- | --- |
| P01 — Ouvrir et se repérer | Tous | Navigateur et Internet pour Espace | Distinguer accueil, Mode libre et Espace | Accueil → Espaces ; 2–3 | C01, C02, C04 | Facile |
| P02 — Installer et lancer Voti | Tous | Navigateur compatible, installation autorisée | Obtenir l’icône et la fenêtre dédiée | Menu navigateur → lanceur → accueil ; 4–5 | C39, C40 | Facile |
| P03 — Créer un Espace | A | Aucun Espace encore créé, réseau et vérification humaine disponibles | Préparer son Espace, puis conserver l’accès avec P05 | Espaces → Créer un Espace → Aperçu ; 3–5 | C02, C04 | Facile |
| P04 — Importer / retrouver son Espace | A/C | Fichier d’accès valide reçu par un canal sûr | Retrouver les droits sur cet appareil | Espaces → import → Ouvrir ; 3–4 | C02, C04 | Facile |
| P05 — Exporter son accès de gestion | A/C | Espace accessible avec ses droits | Conserver le fichier secret séparément des Cartes | Réglages → Exporter mon accès SECRET ; 3–4 | C03 | Facile |
| P06 — Créer un accès de gestion | A | Groupes prêts si périmètre limité | Déléguer Administrateur ou Créateur explicitement | Accès → Créer → rôle/périmètre → fichier ; 5–6 | C04, C03 ; schéma S3 | Intermédiaire |
| P07 — Révoquer un accès de gestion | A | Autre accès concerné ; dernier Admin protégé | Retirer les droits de gestion de cet accès | Accès → détail → confirmation ; 3–4 | C04 ; encadré textuel | Avancée |
| P08 — Retirer l’accès de cet appareil | A/C | Fichier conservé ailleurs | Oublier la copie locale sans supprimer l’Espace | Mes Espaces → Plus d’actions → confirmation ; 3 | C02, C03 | Intermédiaire |
| P09 — Créer un groupe | A | Espace actif | Préparer une audience réutilisable | Groupes → Nouveau groupe → créer ; 3–4 | C05 | Facile |
| P10 — Modifier un groupe | A | Groupe actif | Changer nom/illustration et enregistrer | Groupes → Voir → modifier → Enregistrer ; 4–5 | C10, C12 | Facile |
| P11 — Archiver un groupe | A | Groupe sans sondage actif bloquant | Le retirer des usages actifs sans effacer l’historique | Fiche groupe → Archiver → confirmation ; 3–4 | C10 ; encadré textuel | Avancée |
| P12 — Créer un membre et sa Carte | A | Espace actif ; groupes préparés | Ajouter un pseudonyme, ses affiliations et émettre sa Carte | Membres → Ajouter → Créer le membre et sa carte ; 4–6 | C06, C14 | Facile |
| P13 — Modifier un membre / ses groupes | A | Membre actif | Ajouter/enlever ses affiliations et sauvegarder | Membres → Voir → groupes/nom → Enregistrer ; 4–5 | C07, C12, C13 | Facile |
| P14 — Choisir une illustration | A | Fiche membre/groupe modifiable | Sélectionner un visuel prédéfini ou Aucune illustration | Choisir/Changer → galerie → Choisir → Enregistrer ; 4–5 | C08, C10 | Facile |
| P15 — Passer Liste / Vignettes | A ; C pour groupes visibles | Section accessible | Reconnaître les personnes/lieux dans la présentation choisie | Membres ou Groupes → bascule ; 1–2 | C09, C11 | Facile |
| P16 — Télécharger / imprimer une Carte | A | Carte émise encore en mémoire | Choisir thème/fond, télécharger le PDF et distribuer discrètement | Aperçu → options → PDF → impression ; 4–5 | C14 | Facile |
| P17 — Retrouver / effacer le lot de session | A | Au moins une Carte exportable en mémoire | Retélécharger sans réémettre ; effacer uniquement la mémoire si souhaité | Membres → Cartes disponibles dans cette session ; 2–4 | C15, C19 | Intermédiaire |
| P18 — Créer/remplacer plusieurs Cartes | A | Membres actifs sélectionnables | Émettre uniquement la sélection et télécharger le nouveau lot | Gérer les cartes → cases → confirmation → PDF ; 5–7 | C16, C17, C18, C19 | Intermédiaire |
| P19 — Remplacer ou révoquer une Carte | A | Membre actif et décision explicite | Invalider la Carte perdue ; remplacement et retrait sont deux branches | Fiche membre → action → confirmation ; 3–5 | C07, C14 ; avertissement | Intermédiaire |
| P20 — Révoquer un membre | A | Membre concerné clairement identifié | Retirer son accès futur en conservant historique/snapshots | Fiche membre → action → confirmation ; 3–4 | C07 ; encadré textuel | Avancée |
| P21 — Créer/fermer une invitation | A | Groupes, durée et maximum choisis | Inviter avec des limites ; savoir fermer une invitation | Invitations → Nouvelle → récapitulatif/confirmation ; 5–7 ; fermeture 2–3 | C20 | Intermédiaire |
| P22 — Rejoindre par invitation | P | Invitation valide reçue en privé ; aide possible si nécessaire | Créer le membre invité et sa Carte, la conserver immédiatement | Invitation → pseudonyme → Créer ma Carte Voti ; 3–4 | C14 ; texte spécifique | Intermédiaire |
| P23 — Créer un brouillon Express | A/C | Espace et audience accessibles | Saisir question, 2–6 réponses, audience et créer vite | Sondages → Nouveau → Express → brouillon ; 5–6 | C21, C22, C29 | Facile |
| P24 — Créer un brouillon Guidé | A/C | Audience prête ; accompagnement possible | Comprendre question, réponses, qui/comment, résultats, vérification | Choix puis six étapes → Créer le brouillon ; 8–12 | C21, C23–C29 | Facile |
| P25 — Utiliser Réglages avancés | A/C | Besoin explicite de réglages fins | Voir les mêmes options réunies sans changer de moteur | Nouveau → Réglages avancés → brouillon ; 5–8 | C21, C26, C27 | Intermédiaire |
| P26 — Modifier / enregistrer un sondage non verrouillé | A/C | Brouillon ou sondage ouvert sans vote | Ajuster les champs autorisés, enregistrer ou annuler | Gestion → Modifier le sondage → barre de sauvegarde ; 4–6 | C29, C30 | Facile |
| P27 — Publier le sondage | A/C | Brouillon vérifié, membres/groupes corrects | Figer l’audience et ouvrir le vote | Gestion/résumé → Publier pour les membres ; 2–3 | C29, C31 | Intermédiaire |
| P28 — Partager le sondage | A/C | Sondage publié | Diffuser le bon QR/lien ; afficher si utile | Gestion → QR & partager le sondage ; 3–5 | C38 | Facile |
| P29 — Participer et terminer | P | Carte active, sondage ouvert, membre dans le snapshot | Reconnaître le bon pseudo, choisir, confirmer une fois et sortir | Carte ou QR sondage → reconnaissance → confirmation → Merci ; 4–6 | C34–C37 | Facile |
| P30 — Lire les résultats | A/C ; P autorisé | Minimum, règle et audience satisfaits | Comprendre disponibilité, attente ou réservation à la gestion | Gestion/résultats ou parcours Carte ; 2–4 | C31, C33 | Facile |
| P31 — Suivre les participations | A/C | Sondage publié | Lire X/Y sans inventer une liste nominative en anonyme | Haut de gestion ; 1–2 | C31 | Facile |
| P32 — Fermer un sondage | A/C | Sondage ouvert accessible | Arrêter le vote sans contourner le minimum | Gestion → Fermer → confirmation ; 3 | C31, C32, C33 | Intermédiaire |
| P33 — Identifié / commentaires / modération | A/C | Options choisies avant verrouillage | Comprendre le suivi privé et, si commentaires présents, leur visibilité/modération | Gestion → Suivi/Participations et commentaires ; 4–7 selon action | C26, C31 ; sous-section textuelle | Avancée |
| P34 — Modifier l’apparence / exporter les résultats | A/C | Gestion autorisée ; résultats disponibles pour export | Utiliser les options existantes sans réécrire les réponses | Apparence ou Résultats → PDF ; 3–5 | C33, C38 ; renvoi aux sources PDF/Studio | Intermédiaire |
| P35 — Abandonner / supprimer un sondage | A/C | Droit de gestion ; état connu | Abandonner le brouillon ou supprimer en ligne/partout selon état | Gestion → action dédiée → confirmation ; 3–4 | C29, C31 ; encadré textuel | Avancée |
| P36 — Renommer / archiver un Espace | A | Accès Admin ; décision de clôture pour archivage | Corriger le nom ou mettre fin aux usages actifs | Réglages → action → confirmation pour archivage ; 3–4 | C03, C04 | Avancée pour archivage |

**Précisions à intégrer :** l’affiliation se modifie dans la fiche membre (P13),
pas via un bouton fictif « ajouter au groupe ». P12 crée déjà la Carte ; il n’existe
pas d’étape obligatoire supplémentaire d’activation. P18 remplace les anciennes
Cartes de la sélection après confirmation ; les autres membres ne changent pas.
P07/P08/P19/P20/P35/P36 ne doivent pas être présentées comme des suppressions
équivalentes. L’archivage d’Espace n’a pas de réactivation proposée.
Après publication, l’audience de vote est figée ; question et autres réglages
autorisés restent modifiables avant le premier vote tant que le sondage n’est pas
fermé. Le premier vote verrouille le fond ; l’apparence reste distincte. Le guide
ne doit pas confondre le gel de l’audience à publication et ce second verrouillage.

## Captures d’écran nécessaires

### Existant réutilisable et limites

Inventaire : **224 PNG dans les dix dossiers de revue ci-dessous**, pas 224
captures à publier. Ils sont ignorés par Git. Seules quelques candidates ont été
inspectées pour ce plan ; aucune certification globale de leur contenu sensible.

| Dossier existant sous `.browser-tests/` | PNG | Décision documentaire |
| --- | --- | --- |
| `v062-review/` | 20 | Ancienne présentation ; référence historique, pas la banque de publication |
| `v062-final-review/` | 24 | Étapes guidées/choix des parcours candidates ; anciens défauts de minimum à vérifier |
| `v062-postcommit-review/` | 46 | Entrée Espaces, import et fiches candidates ; écarter galeries de faux assets et anciennes Cartes |
| `voti-visual-assets-review/` | 38 | Galeries/fiches membres candidates ; groupes antérieurs à la banque HD V2 à actualiser |
| `voti-card-ux-polish/` | 25 | `dirty-name.png`, `members-tiles-1440.png`, `sticky-mobile.png` utiles ; Cartes antérieures au fond final à remplacer |
| `voti-card-background-batch/` | 37 | `selected-list.png`, `selected-tiles.png`, `confirmation.png`, `new-and-session.png` : structure batch/session ; contrôler les QR |
| `voti-groups-hd-v2/` | 24 | `group-detail-v2.png`, `groups-tiles-v2.png`, cartes HD candidates ; QR carte/PDF à masquer |
| `poll-ux/` | 6 | `management-*`, `editing-*`, `express-*` à 1440×900 / 390×844 : UX actuelle et minimum proportionnel |
| `pwa/` | 2 | `spaces-1440.png`, `spaces-390.png` : entrée locale sans accès privé |
| `pwa-production/` | 2 | `home-1440.png`, `home-390.png` : accueil public actuel ; préférer une reprise locale pour un jeu homogène |

Les exemples `poll-ux/editing-1440.png`, `voti-card-ux-polish/dirty-name.png` et
`voti-card-background-batch/selected-list.png` ont été vus : sauvegarde distincte,
nom individuel et sélection batch correspondent aux actions à expliquer. Les
captures ne constituent pas des guides prêtes à diffuser. Vérifier à nouveau le
libellé/cadrage retenu face au HEAD de rédaction ; aucune reprise automatique
d’une capture comportant le vieux minimum 5 ou une recommandation fixe 2.

### Règles de production des images

Prévoir **40 captures maîtres**, pas systématiquement une paire desktop/mobile.
Desktop source 1440×900 pour l’administration ; mobile 390×844 pour participer,
Express et la barre basse. Produire ultérieurement uniquement les états manquants
avec des fixtures locales fictives et un profil isolé, jamais avec l’Espace test
de production ou un fichier d’accès de `byluuma/`. Les scénarios locaux cités plus
haut fournissent une base ; ils créent leurs données, pas un Espace prêt à importer
depuis la production. La fixture du kit doit rendre toutes les étapes cohérentes.
Les pseudonymes, groupes et données restent fictifs et neutres ; aucun marqueur
visuel ne rattache les captures à une famille, une école ou un établissement précis.

Avant diffusion, **masquer intégralement les QR de Carte et d’invitation, fragments
de lien secret, fichiers d’accès et identifiants d’accès**, même fictifs ; aucun
credential lisible dans une barre d’adresse ou un nom de téléchargement. Capturer
les confirmations avant mutation quand elles suffisent. Les images de Carte/PDF
montrent des exemples inutilisables pour accéder à un service ; le QR peut porter
un cache opaque « Exemple — QR masqué ». Un petit flou n’est pas une protection.
Conserver l’original privé, diffuser uniquement une copie contrôlée. Ne pas
redessiner l’interface ; les repères 1/2/3 seront ajoutés après cadrage, séparément.

Banque de travail ultérieure proposée : `.browser-tests/guide-kit/`, ignorée.
Un inventaire privé enregistrera HEAD, fixture, dimensions, source et masquages.
Le choix d’un dossier de captures publiques ne sera fait qu’après nettoyage.
Aucune capture nouvelle ni retouche n’est produite dans cette mission.

Dans le tableau, le nom proposé est préfixé par l’ID pour faciliter les renvois.
« Zone » signifie recadrage de la vraie capture, en conservant titre, repère de
contexte et action ; jamais une page entière réduite en timbre-poste.

| ID / fichier proposé | Écran et état exact | Action expliquée | Documents | Format / recadrage conseillé |
| --- | --- | --- | --- | --- |
| C01 `01-accueil.png` | Accueil neutre, aucun membre reconnu | Choisir Espace, repérer Mode libre et Carte | D1, D2 | Desktop ; zone centrale et navigation |
| C02 `02-mes-espaces.png` | Espace fictif enregistré ; import et Plus d’actions identifiables | Ouvrir/importer ; comprendre le retrait local | D1, D2, D3 | Desktop ; liste et entrée d’import, sans fichier secret |
| C03 `03-reglages-acces.png` | Réglages, bouton Exporter mon accès SECRET visible | Conserver son accès ; situer les actions de réglage | D2, D3 | Desktop ; boutons/contexte, aucun contenu de fichier |
| C04 `04-apercu-espace.png` | Aperçu, rôle Admin, groupes/membres et navigation | Comprendre l’Espace et ses sections | D1, D2 | Desktop ; header et aperçu, footer exclu |
| C05 `05-nouveau-groupe.png` | Formulaire d’un groupe fictif, avant création | Nommer un groupe, illustration facultative | D1, D2 | Desktop ; formulaire court |
| C06 `06-nouveau-membre.png` | Pseudo fictif, cases de groupes, bouton Créer le membre et sa carte | Ajouter un membre et ses affiliations | D1, D2 | Desktop ; formulaire utile |
| C07 `07-membre-groupes.png` | Fiche membre actif, groupes et actions de Carte repérables | Modifier affiliations, situer régénération/révocation | D2, D3 | Desktop ; fiche cadrée, aucune Carte/QR affichée |
| C08 `08-choix-illustration.png` | Dialogue membre, filtres et aperçu d’un choix provisoire | Choisir puis valider, puis enregistrer la fiche | D2 | Desktop ; dialogue uniquement |
| C09 `09-membres-vignettes.png` | Vignettes, noms fictifs, Liste/Vignettes visibles | Reconnaître et ouvrir une fiche | D2 | Desktop ; 4–6 objets et bascule |
| C10 `10-fiche-groupe.png` | Groupe HD V2, nom, Changer l’illustration et enregistrement | Modifier un groupe ; distinguer la liste des affiliations | D2 | Desktop ; illustration et actions, sans grande page |
| C11 `11-groupes-vignettes.png` | Lieux HD V2 et compte de membres | Lire les groupes et leur vue | D2 | Desktop ; première rangée et bascule |
| C12 `12-modification-non-enregistree.png` | Fiche modifiée, Annuler/Enregistrer et texte dirty visibles | Sauvegarder ou restaurer | D2, D3 | Desktop ; champ modifié + barre sticky |
| C13 `13-sauvegarde-mobile.png` | Même principe sur téléphone, barre basse visible | Trouver Enregistrer sans aller en fin de page | D2, D3 | Mobile ; champ + barre, pas seulement les boutons |
| C14 `14-carte-exemple.png` | Ma carte individuelle, pseudo fictif, groupes, thème/fond et PDF | Prévisualiser, télécharger, distribuer | D1, D2 | Desktop ; carte et options ; QR entièrement masqué |
| C15 `15-cartes-session.png` | Cartes disponibles dans cette session ouvert, plusieurs cartes prêtes | Retélécharger sans régénérer ; durée de vie | D2, D3 | Desktop ; panneau et actions, aperçus QR exclus |
| C16 `16-gerer-cartes-liste.png` | Gérer les cartes actif, deux membres cochés | Sélectionner uniquement les destinataires voulus | D2 | Desktop ; contrôles + 3 lignes |
| C17 `17-gerer-cartes-mobile.png` | Sélection en Vignettes, compteur visible | Comprendre la sélection mobile | D2 | Mobile ; commandes et premières vignettes |
| C18 `18-confirmer-remplacement.png` | Confirmation avant créer/remplacer deux Cartes | Lire l’invalidation des anciennes Cartes | D2, D3 | Desktop ; dialogue et titre de contexte |
| C19 `19-pdf-nouveau-lot-session.png` | Nouveau lot et lot session de tailles différentes | Choisir le bon PDF, comprendre un éventuel bilan partiel | D2, D3 | Desktop ; deux blocs utiles, aucun QR |
| C20 `20-invitation-limitee.png` | Groupes, maximum, durée et récapitulatif avant confirmation | Inviter de façon bornée | D2 | Desktop ; récapitulatif, avant apparition du lien secret |
| C21 `21-parcours-creation.png` | Choix Guidée/Express, Avancé secondaire | Choisir le bon accompagnement | D1, D2 | Desktop ; choix et nom d’Espace |
| C22 `22-express.png` | Question/réponses/audience, note d’ajustement ; N=3, recommandation 2 | Créer un premier brouillon simple | D1, D2 | Mobile ; cadrage naturel, pas de réduction d’une longue page |
| C23 `23-guidee-question.png` | Étape 1 sur 6, question fictive | Formuler la question | D2 | Desktop ; tâche, progression et Continuer |
| C24 `24-guidee-reponses.png` | Étape 2 sur 6, trois réponses | Ajouter, retirer et ordonner | D2 | Desktop ; réponses et actions |
| C25 `25-guidee-participants.png` | Étape 3 sur 6, Groupe Soleil choisi | Définir qui pourra voter | D2 | Desktop ; audience et groupes |
| C26 `26-guidee-participation.png` | Étape 4 sur 6, Anonyme et Vote simple | Comprendre identité et commentaires | D2 | Desktop ; choix et explications courtes |
| C27 `27-guidee-resultats.png` | Étape 5 sur 6, tous ou fermeture, N=3/minimum 2 | Séparer règle, minimum et audience de résultats | D2, D3 | Desktop ; règles pertinentes et minimum |
| C28 `28-guidee-verifier.png` | Étape 6 sur 6, résumé et Créer le brouillon | Vérifier/revenir avant enregistrement | D2 | Desktop ; résumé et action, sans page entière réduite |
| C29 `29-brouillon-gestion.png` | Brouillon enregistré, résumé, publier/abandonner, édition fermée | Comprendre qu’il n’est pas encore ouvert | D1, D2, D3 | Desktop ; zone d’état/actions et entrée d’édition |
| C30 `30-editer-sondage.png` | Édition ouverte, essentiel/réglages et modification non enregistrée | Ajuster puis Enregistrer les règles | D2, D3 | Desktop ; partie utile et barre, reprise de `editing-*` si conforme |
| C31 `31-suivi-attente-resultats.png` | Ouvert, 2/3, minimum 2 atteint mais attente tous ou fermeture | Lire X/Y et raison liée à Résultats | D2, D3 | Desktop ; état + action de fermeture + motif |
| C32 `32-fermer-sondage.png` | Dialogue de fermeture, avant confirmation | Arrêter les nouveaux votes, garder le minimum | D2, D3 | Desktop ; dialogue uniquement avec titre |
| C33 `33-resultats-disponibles.png` | Résultats fictifs Parc 1, Cinéma 1, Jeux 0, sans nom | Lire total et répartition | D1, D2 | Desktop ; agrégats et règle, pas de données identifiées |
| C34 `34-presenter-carte.png` | Écran Présente ta Carte Voti, caméra/photo disponibles | Entrer dans un sondage depuis son QR | D1 p. 4, D2, D3 | Mobile ; consigne/actions, aucune carte réelle devant caméra |
| C35 `35-carte-reconnue-choix.png` | Carte reconnue Soleil A, trois choix | Vérifier le bon pseudo puis choisir | D1 p. 4, D2 | Mobile ; message et choix |
| C36 `36-confirmer-vote.png` | Réponse présélectionnée, Autre choix / Oui, je confirme | Confirmer consciemment | D1 p. 4, D2 | Mobile ; question/réponse et boutons |
| C37 `37-vote-termine.png` | Succès, aucune identité résiduelle, actions finales | Savoir que c’est enregistré puis terminer | D1 p. 4, D2 | Mobile ; message et actions |
| C38 `38-partager-sondage.png` | QR & partager d’un sondage fictif publié | Distinguer lien/QR de sondage des Cartes et accès de gestion | D2 | Desktop ; onglet de partage ; code exemple neutralisé pour diffusion |
| C39 `39-installer-chrome-android.png` | Menu Chrome Android proposant installation sur une page neutre | Installer depuis le navigateur | D1, D2, D3 | Mobile réel/émulé compatible ; menu natif et nom du site, autres onglets exclus |
| C40 `40-voti-fenetre-dediee.png` | PWA lancée depuis son icône sur Chromebook/desktop compatible | Reconnaître l’ouverture autonome et l’accueil | D2 | Fenêtre native ; bord utile visible, aucun bureau personnel |

C39/C40 ne sont pas fournis par les captures Chromium headless existantes : le
test technique d’installabilité ne produit ni menu natif ni preuve d’installation
dans un lanceur. Ils demanderont une capture dédiée lors de la rédaction, pas
une nouvelle recette métier. Les états participant et les confirmations manquants
seront capturés localement ; ne pas remplacer un écran manquant par une maquette.

## Schémas simplifiés

**Quatre schémas**, décrits ici sans les dessiner ni produire de maquette finale.

| ID / sujet | Objectif | Contenu minimal exact | Emplacement |
| --- | --- | --- | --- |
| S1 — Organisation | Comprendre l’Espace et les liens | Un Espace contient Membres et Groupes ; des membres appartiennent à des groupes ; une Carte est attachée à un membre ; un sondage cible une audience | D1 p. 1, ouverture de D2 |
| S2 — Du sondage au vote | Répartir les actions selon les rôles | Créateur publie → Participant présente sa Carte Voti → choisit → confirme → vote enregistré → résultats selon les règles ; l’Administrateur peut aussi créer et publier | D1 p. 2–4, début participation D2 |
| S3 — Trois rôles | Savoir quelles permissions sont nécessaires | Administrateur : prépare et gère ; Créateur : crée et suit les sondages autorisés ; Participant : répond et consulte ce qui lui est accessible ; fichier de gestion distinct de la Carte | D1 p. 1, accès de D2 |
| S4 — Pourquoi attendre ? | Expliquer les conditions cumulatives | Minimum atteint + condition choisie satisfaite + public autorisé → résultats ; petit exemple 2/3 pour tous-ou-fermeture | D2 résultats et D3 |

S1 représente des relations, pas une chaîne hiérarchique où un membre serait
enfermé dans un seul groupe. S4 s’accompagne d’un tableau de quatre lignes :
minimum seul ; tous + minimum ; fermé + minimum ; tous ou fermé + minimum.
La confidentialité anonyme/identifiée se décrit par le tableau de données
ci-dessous, sans suggérer un anonymat absolu ni une liaison nom/bulletin en anonyme.

## Charte documentaire

- A4 portrait, une colonne principale, fond blanc, espace régulier, marges 15–18 mm.
  Texte 11,5–12 pt minimum ; page Participant plus grande et moins dense, pour
  faciliter le repérage quel que soit l’âge ou l’aisance de lecture.
- Titres courts orientés action : « Créer un groupe », « Retrouver ses cartes ».
  Chaque procédure suit rôle → précondition → étapes numérotées → résultat visible
  → renvoi FAQ. Une étape peut regrouper des champs du même écran.
- Accent Voti violet `#684397`, texte sombre `#25334b`, gris et fond pastel très
  léger. La couleur renforce un libellé ; elle ne porte jamais seule une distinction.
- Captures cadrées à taille lisible, filet discret, légende courte, deux au maximum
  par page si lisibilité conservée. Renvois stables Cxx/Pxx. Repères numérotés limités
  aux actions réellement citées ; masquage des secrets avant toute annotation.
- Encadré « À savoir » discret pour cartes temporaires, snapshot ou minimum.
  « Attention » uniquement avant remplacement/révocation/suppression, partage
  d’accès ou perte possible d’un fichier. Pas d’alarme rouge permanente.
- Schémas : 4–6 éléments, rectangles simples, une couleur d’accent et du gris,
  flèches nettes et libellées si besoin. Vérifier A4 en niveaux de gris et lecture
  écran. Pas d’illustration décorative, de fond chargé ou de double colonne complexe.
  S2 peut conserver ses six étapes explicites. Les rôles sont indiqués par leur
  nom, sans silhouette ni pictogramme associant un âge à une permission.
- PDF futurs : texte sélectionnable, liens descriptifs, sommaire, ordre de lecture,
  légendes/alternatives des captures ; version/date/HEAD de référence visibles.
  Éviter les sigles techniques et les noms d’enums dans les pages participant.

## Données / confidentialité à expliquer

Informations produit à transmettre, **pas une analyse juridique**. Séparer ce que
Voti fait techniquement, les précautions d’usage et ce que les personnes responsables
de l’Espace doivent décider selon leur usage. L’Administrateur organise les accès,
les Cartes et les mesures qui relèvent de son rôle ; aucun cadre juridique
particulier n’est présumé par le guide.

| Sujet | Explication certaine au HEAD | Consigne à porter dans le futur guide |
| --- | --- | --- |
| Pseudonymes et groupes | Noms/pseudos et affiliations dans le relais ; pseudo non vérifié, doublons possibles, pas de compte Participant avec e-mail/mot de passe | Choisir des pseudos utiles et sobres ; ne pas saisir une identité complète si elle n’est pas nécessaire |
| Illustrations | Seul un ID de visuel prédéfini est enregistré ; assets publics embarqués | Choix facultatif, aucune photo personnelle ni upload membre/groupe |
| Carte / QR / PDF | Carte donnant des droits de participant ; digest côté serveur, secret brut temporaire à émission ; PDF téléchargés restent des fichiers secrets | Distribuer individuellement, conserver/disposer des copies avec précaution ; remplacer une carte compromise |
| Accès de gestion | Fichier secret distinct, conservé/importable sur appareil ; pas de connexion e-mail/mot de passe | Exporter dès la préparation, limiter les copies ; utiliser un profil sans accès de gestion pour la participation sur un appareil partagé |
| Anonyme | Une participation par membre ; la gestion voit X/Y mais pas une liste nominative des votants ni de lien direct vers leur réponse | Ne pas chercher à identifier un bulletin ; petits groupes/commentaires reconnaissables et infrastructure restent des limites |
| Identifié | Nom de la Carte relié à la participation pour la gestion autorisée ; les résultats de l’audience ne publient pas ces identités | Annoncer ce choix avant de faire participer ; distinguer les vues privées de gestion |
| Commentaires | Facultatifs selon configuration ; privés ou publiables avec résultats après approbation ; gestion autorisée possible avant minimum | Expliquer qui lit, qui modère et ce qui est effectivement publié ; éviter les informations personnelles |
| PDF des résultats | Les options d’export sont distinctes des Cartes ; les identités ne sont exportables qu’en gestion identifiée avec choix explicite, désactivé par défaut | Vérifier le contenu et les destinataires avant diffusion ; ne pas confondre un rapport de gestion avec une synthèse partageable |
| Résultats | Minimum + règle + audience ; réserve administration possible ; fermeture n’annule pas le minimum | Afficher une explication précise, pas « fermer pour débloquer tous les résultats » |
| Audience et snapshot | Membres actifs éligibles distincts figés à publication ; affiliations ultérieures ne réécrivent pas ce groupe de vote | Vérifier avant publication ; ne pas déplacer un membre pour lui ouvrir rétroactivement un sondage |
| Minimum recommandé | `max(2, ceil(0.25 × N))`, modifiable avant publication ; manuel conservé ; pas de recalcul rétroactif | N=3 → 2, N=9 → 3 ; audience de 1 incapable d’atteindre la recommandation 2 ; distinguer recommandation et condition réellement enregistrée |
| Fermeture et conservation | Sondages publiés/fermés sans expiration automatique ; brouillons distants préparés limités à 24 h selon mécanisme de préparation | Décider quand supprimer ; ne pas promettre qu’un brouillon est conservé indéfiniment ou qu’un sondage fermé est effacé |
| Révocation / archivage | Carte révoquée : accès coupé ; membre révoqué : historique conservé ; Espace archivé : pas de suppression totale ni réactivation UI | Donner les conséquences avant confirmation ; snapshots et bulletins antérieurs restent |
| Suppression du sondage | Supprime en ligne poll, bulletins et relations associées ; « partout » inclut le design local ; PDF déjà distribués restent chez leurs détenteurs | Avertir sur l’irréversibilité ; ne pas promettre une suppression instantanée de toutes les copies opérateur/sauvegardes |
| Sauvegarde et récupération | Export JSON général du Mode libre n’inclut pas Espaces, Cartes, accès ni historique distant ; lot de Cartes mémoire perdu au reload | Exporter les accès séparément ; télécharger les Cartes avant rechargement ; expliquer les limites de récupération |
| PWA | Même origine/site et relais, aucune nouvelle base ou synchronisation ; pas de nouveau cache API | Installer n’est ni un compte, ni un transfert d’accès entre appareils, ni une sauvegarde ; réseau nécessaire |
| Permissions et responsabilités | Administrateur prépare membres/groupes/accès/cartes ; Créateur agit dans son périmètre ; Participant ne gère pas l’Espace | Identifier les personnes responsables de l’Espace, organiser les délégations et la garde des accès |

L’anonymat applicatif ne garantit ni anonymat réseau absolu ni protection contre
un détenteur ayant copié une Carte. Les sessions participantes sont temporaires
(cinq minutes maximum, oubli au succès/Terminer/sortie selon parcours), sans
persistance participante. La validité de la Carte imprimée ne se limite pas à
cinq minutes. La mémoire du lot administrateur et la session du participant sont
deux choses différentes.

## Dépannage à couvrir

D3 : une ligne « symptôme », une cause probable vérifiable, une action sûre, puis
le rôle à contacter. Commencer par demander quel écran/quel rôle, sans demander
de fichier secret ou de photo de Carte par un canal public.

| Symptôme | Réponse à préparer / renvoi |
| --- | --- |
| Mes Espaces est vide sur un nouvel appareil | Importer son fichier d’accès, P04 ; l’installation PWA ne le transfère pas |
| Accès refusé / Espace inaccessible | Réseau, bon site, fichier du bon Espace, accès révoqué/archivé ; demander à l’Admin, sans recréer silencieusement l’Espace |
| Fichier d’accès perdu | Si accès encore présent : P05 ; sinon solliciter un autre Admin autorisé. Aucun rétablissement automatique par e-mail documenté |
| Caméra indisponible / pas de carte imprimée | Permissions navigateur, photo QR traitée localement ou scanner système selon parcours ; ne pas diffuser les captures de carte |
| Mauvaise carte / pseudo inattendu | Terminer et présenter la bonne Carte ; ne pas confirmer pour une autre personne |
| Mauvais groupe / sondage invisible | Vérifier affiliation actuelle et snapshot publié ; P13 ne modifie pas rétroactivement P27 |
| Sondage encore brouillon | P27 ; créer/enregistrer n’est pas publier |
| Déjà participé / sondage fermé | Aucun second vote ni vote après fermeture ; nouvelle Carte du même membre ne réinitialise pas sa participation |
| Résultats indisponibles | Lire le motif ; minimum, règle et audience séparés, P30/S4 ; fermeture sous minimum ne suffit pas |
| Modification non enregistrée / erreur réseau à Enregistrer | Barre sticky, confirmation de succès, conserver la saisie et réessayer après vérification ; P26/P13 ; Annuler restaure les valeurs |
| Bouton d’édition absent | Premier vote/verrouillage ou fermeture ; ne pas présenter cela comme une panne |
| PDF des anciennes Cartes introuvable après reload | Perte volontaire de la mémoire d’émission ; pas de récupération du secret serveur. P19 remplace la Carte, avec invalidation de l’ancienne |
| Nouveau lot et lot de session différents | P17/P18 : nouvelle sélection d’un côté, union des Cartes exportables de l’autre ; régénération remplace l’entrée d’un membre |
| Lot partiellement réussi | Lire créées/échec/non traitées ; conserver le PDF des réussites ; vérifier les cartes non confirmées avant toute reprise ; pas de promesse d’atomicité globale |
| Invitation expirée / usages épuisés | Admin vérifie puis crée si nécessaire une autre invitation ; le lien secret ancien ne se récupère pas depuis le serveur |
| Installation PWA absente / ancien écran | Navigateur compatible, HTTPS, politiques appareil ; utiliser le Web si installation indisponible. Recharger hors tâche en cours pour la mise à jour, après téléchargement des Cartes mémoire |
| Besoin d’effacer un membre ou tout l’Espace | Expliquer révocation/archivage versus effacement ; pas de bouton de suppression totale d’Espace. Renvoi à la personne responsable de l’Espace pour une demande non couverte par l’interface |

## Lacunes documentaires

Le plan est exploitable ; les points ci-dessous bornent les affirmations des guides.
Ils n’imposent ni nouvelle fonction ni nouvelle recette métier.

### Informations à clarifier avant diffusion externe finale

1. **Aide et contact :** personne responsable de l’Espace, canal privé de contact,
   cadre d’aide et procédure à suivre si une personne est bloquée ; rien dans le
   HEAD ne définit un contact général ou un support Voti garanti. Ne pas inventer
   une adresse ni des engagements de réponse.
2. **Récupération exceptionnelle :** procédure lorsque tous les accès de gestion
   sont perdus, tous les administrateurs indisponibles ou l’Espace archivé par
   erreur. L’UI ne propose ni reset par e-mail, ni réactivation, ni restauration
   d’un secret de Carte. Distinguer procédures réellement possibles et intervention
   opérateur éventuelle à définir ; ne pas demander de manipulations D1 au lecteur.
3. **Conservation décidée par les personnes responsables de l’Espace :** durées/cadence d’effacement, qui
   décide, gestion des PDF/accès sur appareils partagés et copies imprimées.
   L’absence d’expiration des sondages est connue ; la durée de conservation
   appropriée à un usage ne se déduit pas du code.
4. **Information aux personnes et cadre de service :** informations à communiquer,
   responsabilités concrètes, hébergement/sous-traitance, sauvegardes opérateur,
   durée effective des journaux et traitement des demandes de suppression/récupération.
   Les limites techniques sont décrites ; ces engagements précis ne sont pas
   établis par ce plan. Aucune garantie juridique ne doit être inventée.
5. **Installation sur appareils réels :** C39/C40 manquent, les menus variant
   selon OS/version et parc géré. Installabilité Chromium vérifiée ; installation
   physique Android/Chromebook non attestée par le test headless existant.
6. **Banque d’images homogène au HEAD :** certaines captures sont historiques,
   contiennent d’anciens visuels/défauts ou des QR fictifs ; reprise, cadrage et
   masquage devront être vérifiés image par image avant diffusion.

### Test de la personne découvrant Voti

| Question de la personne | Où le futur kit répond | Trou restant à fermer |
| --- | --- | --- |
| 1. À quoi sert Voti ? | D1 p. 1, S1/S3 | Aucune promesse d’un autre mode de scrutin que le choix unique actuel |
| 2. Comment entrer ? | D1, P01/P03/P04/P05 | Distinguer création d’Espace, accès de gestion transmis par un Administrateur et Carte de Participant ; consigne d’export explicite |
| 3. Retrouver/créer les membres ? | D2 P12–P15 | Rappeler que le Créateur passe par l’Admin |
| 4. Organiser les groupes ? | D2 P09–P13 | Mettre en évidence affiliation depuis fiche membre et snapshot |
| 5. Distribuer les Cartes ? | D1 p. 2, D2 P16–P19 | Copies privées/QR neutralisés dans les supports ; différence lot mémoire/serveur |
| 6. Premier sondage ? | D1 p. 2–3, D2 P23/P24/P27 | Même fixture du début aux résultats ; deux règles différentes non mélangées |
| 7. Faire voter ? | D1 p. 4, D2 P29 et S2 | Profil participant séparé d’un profil gardant un accès de gestion |
| 8. Pourquoi pas de résultats ? | D2 P30, D3 et S4 | Textes adaptés aux quatre règles et à la réserve administration |
| 9. Corriger une erreur simple ? | D3 → Pxx, P26 | Prévenir qu’un sondage verrouillé et une audience figée ne se réécrivent pas |
| 10. Retrouver de l’aide ? | Index de D2 et D3 | Contact/support et procédure d’escalade à désigner avant diffusion |

Le futur kit peut couvrir les dix besoins sans connaissance préalable du projet, à condition
de renseigner les responsabilités/contact et d’expliciter les limites de
récupération. Ce constat est une revue éditoriale, pas un test d’usage réalisé.
Les variantes identifiées/commentaires/modération ont une couverture technique ;
elles ne sont pas annoncées comme nouvellement validées par les deux recettes.

### Relecture de neutralité — scénarios mentaux

Contrôle éditorial du plan révisé, sans nouvelle recette de l’application.
Les contextes ci-dessous servent uniquement à tester la portée du texte ; ils
ne créent pas des versions différentes des guides.

| Cas de relecture | Vérification | Conclusion |
| --- | --- | --- |
| Famille | Choisir une activité avec les rôles attribués dans Voti ; les procédures ne supposent ni métier ni parenté | Le même plan s’applique sans réécriture |
| École / classe | Choisir une sortie ; préparer membres/groupes et participer selon ses permissions, indépendamment du statut scolaire | Le même plan s’applique sans réécriture |
| Association / collectif | Recueillir des avis ; déléguer un accès de gestion et répartir les membres en groupes selon l’usage | Le même plan s’applique sans réécriture |
| Structure jeunesse | Organiser un choix ; les autorisations restent celles d’Administrateur, Créateur ou Participant | Le même plan s’applique sans réécriture |
| Adulte Participant | Utiliser sa Carte, choisir, confirmer et consulter ce qui est autorisé ; participation autonome possible | Aucun texte ne le traite comme un enfant ni ne lui attribue un rôle de gestion |
| Enfant Participant | Suivre les mêmes actions et permissions, avec une aide facultative selon les besoins | Les phrases simples et les repères explicites restent cohérents, sans rôle d’âge imposé |

Le vocabulaire, les préconditions et les visuels prévus restent communs aux six
cas. Une relecture d’usage ultérieure vérifiera la compréhension réelle, sans
redéfinir un contexte de référence unique.

## Ordre de production

1. **Fixer les données de transmission manquantes** : personne responsable de l’Espace, contact privé,
   garde/récupération des accès, conservation et limites de support. Conserver les
   inconnues comme telles jusqu’à décision ; pas de modification applicative.
2. **Préparer la fixture et le script de prises de vues**, en local au HEAD de
   rédaction : Espace/roles/pseudos fil rouge, brouillon puis états des deux règles.
   Réutiliser les scénarios locaux, sans rejouer une recette humaine complète.
3. **Trier les candidates et produire seulement les captures manquantes C01–C40** ;
   obtenir les deux vues natives PWA sur appareils adaptés. Vérifier masquages,
   cohérence, lisibilité A4 et origine fictive avant mise en commun.
4. **Rédiger le noyau D2** à partir des Pxx et captures : préparation/accès,
   groupes/membres/cartes, puis création/vote/résultats ; finir données et actions
   avancées. Réutiliser PWA.md plutôt que recréer une documentation technique.
5. **Extraire D1 et la page participant**, avec la fiche Premier sondage p. 2–3 ;
   supprimer les détails de référence, garder les étapes et résultats visibles.
6. **Rédiger D3** depuis la table des symptômes, avec renvois Pxx et aide désignée ;
   ne pas ajouter une bibliothèque de fiches redondantes.
7. **Dessiner les quatre schémas sobres puis monter les documents**, contrôler
   repères, données, secrets, accessibilité et versions. Exporter les PDF seulement
   à cette phase future, avec leurs sources éditables et une date de référence.
8. **Faire relire le kit par une personne découvrant Voti**, pour compréhension et
   repérage documentaire ; cela ne redemande pas la recette complète déjà acquise.

Livrable de cette mission : **ce seul plan**. Aucun guide final, capture nouvelle,
PDF, code, commit, push ou déploiement n’est réalisé.
