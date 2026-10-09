# Voti — UX / identité visuelle v0.2B.1

**Statut :** spécification de lot  
**Objectif :** faire évoluer Voti vers une identité visuelle plus jeunesse, colorée et structurée, sans modifier le moteur métier ni encore introduire les images.

---

# 1. Intentions

La v0.2A a amélioré fortement la navigation et la densité d’information.

La v0.2B.1 doit maintenant améliorer la perception visuelle de l’application :

- plus chaleureuse ;
- plus jeunesse ;
- plus colorée ;
- plus vivante ;
- plus structurée ;
- plus identifiable comme Voti ;
- sans devenir enfantine ou chaotique ;
- sans sacrifier lisibilité, accessibilité ou compacité.

---

# 2. Retours humains à intégrer

## 2.1 Encadrement rouge du titre

Un encadrement rouge apparaît temporairement autour du titre / élément ciblé, puis disparaît.

Le rouge ne correspond pas à la palette actuelle.

Il faut identifier exactement sa provenance :
- focus programmatique ;
- outline ;
- style :focus / :focus-visible ;
- état temporaire de navigation ;
- autre.

Correction attendue :
- ne jamais supprimer arbitrairement les repères de focus ;
- remplacer le rouge par une couleur cohérente avec le thème ;
- conserver une visibilité WCAG suffisante ;
- utiliser `:focus-visible` lorsque pertinent afin de ne pas montrer un anneau inutile après navigation souris/touch.

Le focus doit rester clairement visible au clavier.

---

# 3. Structure visuelle des pages

Le fond uniforme actuel donne une impression de toile infinie.

L’utilisateur doit mieux distinguer :
- le header ;
- la zone principale ;
- les outils secondaires ;
- le pied de page / informations locales.

## 3.1 Header

Créer une zone clairement identifiable mais compacte.

Possibilités :
- surface légèrement teintée ;
- bordure basse subtile ;
- ombre très légère ;
- contraste de fond ;
- aucun gros hero.

Le header doit rester compact :
- environ 56–72 px desktop ;
- environ 52–64 px mobile.

## 3.2 Contenu principal

La zone principale doit être visuellement distincte du fond général.

Éviter un énorme panneau encadré.

Approche recommandée :
- fond de page légèrement coloré ;
- contenu principal sur une surface plus claire / différente ;
- sections ou cartes ponctuelles ;
- espacements cohérents.

Exemple conceptuel :

```text
┌──────────────── HEADER ───────────────┐
│ Voti     Accueil  Nouveau  Sauvegarde │
└───────────────────────────────────────┘

     fond général légèrement coloré

     ┌──── zone principale ─────────┐
     │ Mes sondages                 │
     │ recherche / filtres          │
     │ listes                       │
     └──────────────────────────────┘

     zone secondaire / informations
```

Ne pas enfermer tout l’écran dans une grande carte.

---

# 4. Palette générale

La palette doit évoquer :
- jeunesse ;
- diversité ;
- choix ;
- énergie ;
- convivialité ;
- créativité.

Mais elle doit rester harmonieuse.

## 4.1 Principe

Ne pas utiliser une seule couleur d’accent partout.

Créer une palette harmonisée de 4 à 6 couleurs fonctionnelles.

Exemple de direction, à ajuster après contraste :

- violet / prune doux ;
- turquoise / bleu lagon ;
- jaune chaud / ambre ;
- corail / pêche ;
- vert tendre ;
- bleu nuit pour texte / structure.

IMPORTANT :
les valeurs précises doivent être testées pour le contraste.

## 4.2 Couleurs par fonction

Les couleurs ne doivent jamais être le seul indicateur.

Exemples :

```text
Brouillon     → ambre / jaune
Ouvert        → turquoise / vert
Fermé         → violet / bleu
Résultats     → corail / violet
Action créer  → accent principal
```

Les badges conservent leur texte.

## 4.3 Éviter

- rouge agressif non sémantique ;
- couleurs néon ;
- arc-en-ciel désordonné ;
- trop de gradients ;
- palette « école maternelle » ;
- saturation excessive.

---

# 5. Thèmes v0.2B.1

Créer un petit moteur de thèmes réellement cohérent.

Thèmes initiaux proposés :

1. **Voti Pop**
   - thème par défaut ;
   - jeunesse, vif, harmonieux ;
   - plusieurs accents colorés ;
   - surfaces claires.

2. **Nature**
   - verts, turquoise, terre douce ;
   - calme et organique.

3. **Douceur**
   - pastel harmonisé ;
   - rose poudré, lavande, bleu tendre, pêche ;
   - très lisible.

4. **Nuit**
   - fond sombre ;
   - accents colorés doux ;
   - contraste élevé.

5. **Minimal**
   - plus neutre ;
   - peu de couleurs ;
   - priorité à la lisibilité.

Les thèmes ne doivent pas seulement changer une couleur d’accent.
Ils peuvent définir :
- fond général ;
- surface header ;
- surface principale ;
- accent principal ;
- accents secondaires ;
- badges ;
- bordures ;
- ombres ;
- focus ;
- fonds de boutons ;
- variantes d’état.

Aucune police distante.

---

# 6. Choix du thème

Le réglage d’apparence existant doit évoluer vers un sélecteur plus clair.

Présenter chaque thème avec :
- nom ;
- petite prévisualisation de palette ;
- éventuellement 3 à 5 pastilles de couleur ;
- état sélectionné clair.

Ne pas construire un éditeur de thème complet dans ce lot.

---

# 7. Cartes / lignes de sondages

Conserver la compacité de v0.2A.

Améliorer légèrement :
- hiérarchie ;
- couleurs des statuts ;
- séparation visuelle ;
- hover/focus desktop ;
- lecture tactile mobile.

Ne pas revenir à de grosses cartes.

La couleur peut être utilisée par touches :
- bordure gauche ;
- petit accent ;
- badge ;
- icône / pastille ;
- action principale.

---

# 8. Boutons

Créer une hiérarchie cohérente :

## Action principale
Exemple :
- Nouveau sondage ;
- Confirmer le vote ;
- Résultats lorsqu’ils sont disponibles.

## Action secondaire
Exemple :
- Gérer ;
- Modifier ;
- Retour.

## Action discrète
Exemple :
- Options avancées ;
- actions techniques.

Éviter que tous les boutons aient le même poids visuel.

---

# 9. État focus

Le focus clavier doit :
- être visible ;
- être harmonisé avec le thème ;
- avoir un contraste suffisant ;
- ne pas utiliser le rouge par défaut sauf état d’erreur.

Utiliser préférentiellement :
```css
:focus-visible
```

Ne pas désactiver globalement `outline` sans remplacement accessible.

---

# 10. Erreurs / danger

Le rouge reste réservé aux vrais états :
- erreur ;
- suppression ;
- action destructive ;
- validation impossible.

Le rouge ne doit pas être utilisé pour :
- focus normal ;
- titre ;
- navigation courante ;
- statut neutre.

---

# 11. Responsive

À vérifier au minimum :
- 360 px ;
- 480 px ;
- 768 px ;
- Chromebook / desktop.

Le nouveau style ne doit pas :
- augmenter inutilement les hauteurs ;
- réintroduire un hero ;
- casser la liste compacte ;
- créer des barres horizontales.

---

# 12. Accessibilité

Tester :
- contrastes texte/fond ;
- focus ;
- jour/nuit ;
- navigation clavier ;
- zoom texte ;
- couleur non seule indicatrice ;
- tailles tactiles.

Les thèmes doivent respecter les mêmes critères.

---

# 13. Tests

Ajouter / adapter des tests pour :
- thème actif ;
- persistence de préférence de thème ;
- focus non rouge ;
- focus visible ;
- header et surface principale visuellement distincts ;
- palette sans ressource externe ;
- 360 px sans débordement ;
- contraste de texte principal ;
- états des badges ;
- aucun changement métier.

---

# 14. Périmètre strict

NE PAS développer dans ce lot :
- images ;
- AssetAdapter ;
- IndexedDB ;
- compression ;
- redimensionnement ;
- QR ;
- PDF ;
- relais ;
- Cloudflare ;
- comptes ;
- Android ;
- Capacitor.

---

# 15. Lot suivant v0.2B.2

Après validation humaine de la nouvelle identité visuelle :

- `AssetAdapter` ;
- IndexedDB ;
- image du sondage ;
- image facultative de chaque choix ;
- texte toujours obligatoire ;
- redimensionnement ;
- compression ;
- limites ;
- export/import des assets ;
- préparation du stockage distant et Android.
