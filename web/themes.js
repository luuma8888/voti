/** Apparence de l'application, distincte du style sémantiquement neutre des sondages. */
export const THEME_OPTIONS = Object.freeze([
  { id: 'pop', name: 'Voti Pop', description: 'Prune, lagon et ambre : choisir en couleurs.' },
  { id: 'nature', name: 'Nature', description: 'Verts et turquoise, un esprit calme et organique.' },
  { id: 'douceur', name: 'Douceur', description: 'Lavande, pêche et bleu tendre, tout en légèreté.' },
  { id: 'dark', name: 'Nuit', description: 'Surfaces sombres et accents lumineux, sans éblouir.' },
  { id: 'minimal', name: 'Minimal', description: 'Des tons neutres pour aller à l’essentiel.' },
]);

export const THEME_KEY = 'voti.theme';
export function normalizeTheme(value) {
  // L'ancien mode jour devient Pop ; l'ancien mode nuit conserve sa préférence.
  return THEME_OPTIONS.some(theme => theme.id === value) ? value : 'pop';
}
