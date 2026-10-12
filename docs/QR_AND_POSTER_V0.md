# QR et affiches Voti — contrat v0.4A, parcours étendu v0.4B

## Routes et portée

Base publique centralisée : `https://luuma8888.github.io/voti/`.
Le backend technique n'apparaît dans aucun QR. Les identifiants du sondage
public et des choix sont validés ; aucun secret dans une URL publique.

- Vote : `#/p/<pollId>`.
- Résultats : `#/p/<pollId>/results`.
- Choix : `#/p/<pollId>/choice/<choiceId>`.
- Transfert secret : `#/admin/import/<payload-base64url>`.

Depuis v0.4B, la route choix ouvre directement « Tu choisis » avec le choix
du QR et « Oui, je confirme ». Aucun vote au chargement, scan, refresh ou retour.
« Autre choix » abandonne le QR et remplace la route par `#/p/<pollId>` ;
une navigation/rerender ne réapplique pas le choix proposé par le QR abandonné. Le parcours classique
conserve Continuer puis confirmation explicite. Seul « Oui, je confirme »
appelle castVote. Le parcours radio présélectionné puis Continuer décrit v0.4A historique.
Consigne actuelle dans le partage et les nouveaux PDF : « Ce QR ouvre directement
la confirmation de ce choix. Le vote n’est envoyé qu’après validation. »
L’écran affiche « Choix proposé par le QR : <choix>. Confirme-le ou choisis une autre réponse. »
Un choiceId absent/invalide n'en sélectionne aucun autre. Les segments publics
superflus sont refusés. Fermeture : URLs inchangées, aucun vote possible,
résultats soumis aux règles habituelles. Suppression : les trois routes
publiques sont introuvables ; verifyAdmin refuse aussi la clé de transfert.

Pas de QR ni d'affiche pour un sondage local ou une préparation non publiée.
La vue Partager vérifie un vrai rattachement et relit le sondage via le relais.
Les builders acceptent une base locale explicite pour les tests, mais l'UI
utilise toujours la base canonique du site, jamais location.href/query courante.

Compatibilité du champ historique `accessRules.allowDirectChoiceQr` : la
fondation le force à false pour compatibilité du schéma historique. Ce champ
reste réservé, sans politique d'autorisation opérationnelle. Il
n'était consulté ni par l'UI de vote ni par le relais pour choisir une réponse.
La spécification v0.4A, autorité plus récente, demande explicitement la route
de présélection tout en interdisant de changer modèle/protocole/règles métier.
Le champ, les validateurs et les empreintes restent donc strictement inchangés.
La présélection UI ne donne aucun droit supplémentaire : le même choix pourrait
déjà être sélectionné manuellement. Ce champ ne doit pas être présenté comme
un réglage d'interdiction opérationnel ; clarifier sa future évolution avant
d'introduire une vraie politique d'autorisation des QR par choix.

## Génération entièrement locale

`shared/qr-links.js` : destinations publiques et payload secret versionné.
`web/qr.js` : encodeur mature qrcode-generator, niveau M, marge blanche de
4 modules, SVG noir/blanc, Canvas sur pixels entiers, PNG et téléchargements.
Les SVG ne contiennent que des coordonnées, pas de texte interprété ou de logo.
Le même encodeur et le même dessin sont réutilisés par les affiches.
Pas de scanner runtime, CDN, serveur PDF ou appel réseau de génération.

`vendor/qr.js` et `vendor/pdf.js` sont bundlés par esbuild au build puis
intégrés aux data URLs de l'import map existante. Le HTML demeure autonome,
y compris file:// sans connexion. PNG originaux de branding toujours exclus.
Les licences complètes des bibliothèques embarquées figurent dans
`THIRD_PARTY_LICENSES.md` et sont incluses en texte non exécuté dans le HTML.

Sources/API primaires : [encodeur QR](https://github.com/kazuhikoarase/qrcode-generator/blob/master/js/README.md),
[PDFDocument](https://pdf-lib.js.org/docs/api/classes/pdfdocument),
[esbuild](https://esbuild.github.io/api/).

## Partager sans surcharger la gestion

Depuis v0.4C, trois accès visuels principaux ouvrent les QR de choix, les QR
résultats et le Studio PDF. Les sections secondaires et tous les téléchargements
sont conservés. L’avertissement SECRET utilise une icône vectorielle et les
couleurs de danger accessibles ; aucun changement des routes ou du protocole.

Vue `#share/<pollId>` réservée au créateur. Sections repliables : accès,
choix, résultats, affiches, transfert SECRET. Chaque QR public a un libellé,
une destination cliquable textuelle et des actions Copier/PNG/SVG.
Grille fluide, une colonne confortable à 320/360 px ; mêmes thèmes, accents,
focus et cibles tactiles >=44 px. Le fichier admin existant reste disponible.
La section secrète n'est jamais imprimée par le CSS.

## Transfert secret

Payload = objet du fichier admin v1, encodé en JSON UTF-8/base64url canonique :
version, relayId, pollId, adminCapability. Base64url n'est PAS un chiffrement.
Ce QR est aussi sensible que le fichier : son possesseur peut gérer/supprimer.
Afficher volontairement, puis Masquer détruit l'image ; refermer la section
la masque aussi. Aucun bouton de téléchargement du QR secret, lien secret visible,
affiche publique ou backup implicite ne le contient.

`consumeAdminFragment` est appelé synchroniquement avant stockage/rendu/appels
distants, au bootstrap et à la navigation. Même un payload malformé est retiré
avec history.replaceState(null, '', ...'#admin-transfer'). Seule la mémoire
temporaire conserve le payload ; refresh de la route nettoyée l'oublie.
L'écran détecté n'importe/ne vérifie rien sans clic explicite. Annuler oublie
le payload. Décodage/structure/version/relais/capacité validés, verifyAdmin réel
avant stockage, puis mêmes règles CAS/conflit que le fichier admin.
Une navigation ou annulation pendant la vérification refuse l'écriture.

Le fragment n'est pas transmis dans la requête HTTP. Il reste néanmoins secret
au moment du scan : appareil/scanner, presse-papiers ou extension pourraient
l'observer. Voti ne garantit pas l'effacement chez ces tiers ni un anonymat
réseau. Ne pas partager une capture du QR, ni coller une clé dans un rapport.

## Affiches A4

Depuis v0.4B, l’UI ouvre un Studio avec quatre compositions, huit palettes,
typographies locales, aperçu et images affiche-only : voir `POSTER_STUDIO_V0.md`.
Le PDF des résultats autorisés est distinct : voir `RESULTS_PDF_V0.md`.
La section technique suivante décrit les exports initiaux v0.4A, conservés
comme contrat historique/test de compatibilité, pas l’éditeur actuel.

`web/poster.js` produit un plan public borné puis dessine sur une seule surface
2480×3508 pixels (environ 300 dpi, environ 35 Mo RGBA) à la fois. Texte system-ui
local mesuré et enveloppé, accents français préservés, mots longs coupés sans
troncature. PNG sans perte embarqué par pdf-lib, MediaBox A4 595,2756×841,8898 pt.
Pas de police distante. L'accent/surface des cinq thèmes est repris sur papier
clair ; Nuit est adapté pour l'impression, pas un aplat sombre coûteux en encre.
Logo discret, QR noir/blanc sans superposition, pas d'image utilisateur distante.

Accès unique : question/description/choix, grand QR dominant centré et QR
résultats séparé. Choix : grille deux colonnes et QR >= environ 43 mm, avec
phrase explicite de présélection/confirmation. QR résultats >= environ 34 mm.
Liens écrits en complément des QR, y compris les destinations de chaque choix.
Niveau M, marge de quatre modules ; modules alignés sur des pixels entiers,
sans lissage Canvas. Une page pour les textes ordinaires 2/3/6 choix ;
pagination si les textes longs ne tiennent pas. Maximum quatre pages validées,
jamais réduction illisible des QR. Chaque affiche publique exclut les capacités.

Imprimer à 100 %, sans rogner les marges/quiet zones ni compresser les QR.
Le PDF est raster : texte non sélectionnable, pas de PDF balisé pour lecteur
vocal. Les liens textuels/accessibilité restent disponibles dans le site.
Pas de promesse universelle de scan : papier, imprimante, éclairage, écran et
appareil restent à tester humainement après publication autorisée.

## Vérifications

Node : builders, matrice déterministe, limites, formats secrets, quiet zone,
décodage jsQR distinct, plans A4/longs et immutabilité des entrées.
Chromium : PNG réel, partage/thèmes/mobile/offline, vote QR sans mutation avant
confirmation, compteur indépendant D1 local, fermeture/suppression, transfert
secret nettoyé avant fetch, vérification/conflit/annulation.
`npm run test:poster` suit test:browser : Poppler rasterise les vrais PDF à
300 dpi puis jsQR décode chaque QR et compare exactement sa destination.
PDF/profils/captures/clés de test exclus de l'audit ; aucune mutation Cloudflare.
