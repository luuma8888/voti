# Bibliothèques embarquées pour Voti v0.4A

Versions exactes verrouillées dans package-lock.json. Aucun chargement distant.
Les avis ci-dessous sont également intégrés en texte non exécuté dans index.html.

## Licence MIT — composants suivants

- qrcode-generator 2.0.4 : Copyright (c) 2009 Kazuhiko Arase.
- pdf-lib 1.17.1 : Copyright (c) 2019 Andrew Dillon.
- @pdf-lib/standard-fonts 1.0.0 : Copyright (c) 2018 Andrew Dillon.
- @pdf-lib/upng 1.0.1 : Copyright (c) 2017 Photopea.
- pako 1.0.11 : Copyright (C) 2014-2017 by Vitaly Puzrin and Andrei Tuputcyn.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## tslib 1.14.1 — licence Zero-Clause BSD

Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.

## Outils de développement uniquement

esbuild 0.28.2 (MIT), jsqr 1.4.0 (Apache-2.0) et Poppler (outil système de
recette PDF) ne sont pas embarqués dans l'application. Le décodeur jsqr n'est
pas un scanner ajouté à Voti. Les licences complètes des outils npm restent
dans leurs paquets installés, exclus du bundle d'audit comme node_modules.

Sources : https://github.com/kazuhikoarase/qrcode-generator ;
https://github.com/Hopding/pdf-lib ; https://github.com/Hopding/upng ;
https://github.com/Hopding/standard-fonts ; https://github.com/nodeca/pako ;
https://github.com/microsoft/tslib ; https://github.com/cozmo/jsQR.
