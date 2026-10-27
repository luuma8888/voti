# Release documentaire pilote Voti

- Date : **27 octobre 2026**.
- Version : **Voti Pilot Documentation — 2026-10-27**.
- HEAD applicatif documenté et publié : `601aeb04c171fae6b4f4928d694f9ce8c4ddf190`.
- Branche : `main`, remote `origin` (`git@github.com:luuma8888/voti.git`).
- Statut documentaire : **PILOT DOCUMENTATION FROZEN**.
- État de diffusion : **PILOT DISTRIBUTION READY**.

## Distribuables

Le dossier `dist/pilot/VOTI_PILOT/` contient uniquement trois PDF et un README public.
L’archive `dist/pilot/VOTI_PILOT_DOCUMENTATION_2026-10-27.zip` contient exactement ces quatre fichiers sous
le dossier `VOTI_PILOT/`, sans rapport, source, capture, fixture ou fichier personnel.
CRC et identité des octets vérifiés après lecture complète du ZIP.

| PDF | Pages | SHA-256 |
|---|---:|---|
| `VOTI_DEMARRAGE_RAPIDE.pdf` | 4 | `0ea1eb6392cb44b0e6e84278b0ec2b1511c56a89e95143f5ca7918c6d0e9c329` |
| `VOTI_GUIDE.pdf` | 21 | `cb84094c3f9278e1a212529a46f0a23a61c3264a639d2c87be33caa2285b9f9f` |
| `VOTI_AIDE_DEPANNAGE.pdf` | 5 | `c1008e00397c34e20c5ed2588a89f69f211ac4939c386ca30aaac095d7393315` |

ZIP : **1150538 octets**, SHA-256 `888bb74837e6f8aed591b6e0a14a3bc47f5661880c3bdac13dc5af6495c6a1f5`.

Les PDF validés sont copiés sans réexport ni retouche. Leurs dates d’édition et
références désignent l’application documentée ; la date de ce pack est distincte.
Titres, ouverture, texte sélectionnable et liens essentiels sont contrôlés.
Les renvois entre PDF restent relatifs ; conserver les trois fichiers ensemble.
Aucune donnée réelle, credential ou QR exploitable n’est inclus ; les images
nettoyées sont celles déjà validées, avec leurs masques opaques inchangés.

## Sources conservées

- `docs/VOTI_DEMARRAGE_RAPIDE.md`, `docs/VOTI_GUIDE.md`, `docs/VOTI_AIDE_DEPANNAGE.md`.
- Plan de référence : `docs/VOTI_GUIDE_KIT_PLAN.md`.
- Génération, HTML, CSS, schémas, recadrages et manifeste : `docs/guides/`.
- Captures nettoyées utilisées par les sources : `docs/guide-assets/`.

Ces ressources internes ne figurent pas dans le ZIP public. Les rendus de travail,
profils et fixtures restent ignorés dans `.browser-tests/` ; `byluuma/` reste
ignoré. Les rapports historiques modifiés et les archives préexistantes ne sont
pas inclus dans le commit de ce pack.

## Application et baseline préservées

L’URL publique est <https://luuma8888.github.io/voti/>. Vérification du 27 octobre :
HTTP 200, HTML identique au `index.html` local, **1 884 069 octets**, SHA-256
`d63c916714451196fd927d72ce02687c29411b6e6dabbe6c88a82cdc27b9dfa7`.
Le manifeste PWA public répond HTTP 200 : Voti, `standalone`, `./#home`, scope `./`.

Le tag applicatif `pilot-2026-10-25` n’est pas modifié : objet annoté
`7517c83f6840020e4c9c5cc96cdbe57610d09e75`, commit cible
`7cd51b852a308cd44e87fd448e7821e0e5d24e3e`. Le pack documentaire est une release
ultérieure distincte. Aucun changement de code, Worker, D1 ou secret ; aucun
redéploiement manuel. La publication GitHub Pages habituelle peut publier le
commit documentaire sans changer les octets applicatifs.

## Portée du statut

Application et PWA disponibles, documentation validée, pack transmissible à une
personne découvrant Voti : les premiers usages réels peuvent commencer.
Ce statut ne garantit ni l’absence de bugs, ni un produit institutionnel final,
ni un support contractuel, ni une validation juridique universelle.

## Prochaine phase : USAGE RÉEL + RETOURS

Classer les retours en **BUG**, **FRICTION UX**, **INCOMPRÉHENSION DOCUMENTAIRE**
ou **BESOIN / IDÉE NOUVELLE**. Une demande ne déclenche pas automatiquement un
développement. Aucun nouveau chantier n’est commencé par cette release.
