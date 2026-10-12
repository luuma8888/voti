/** Exécuté synchroniquement avant tout accès au stockage et tout appel distant.
 * Ne décode pas ici : même un fragment invalide doit disparaître de l'historique.
 * Le payload ne survit qu'en mémoire ; un refresh de l'écran nettoyé l'oublie.
 */
export function consumeAdminFragment(location, history) {
  if (!/^#\/?admin\/import\//.test(location.hash) && !/^#\/?admin\/import$/.test(location.hash)) return null;
  const payload = location.hash.replace(/^#\/?admin\/import\/?/, '');
  history.replaceState(null, '', location.pathname + location.search + '#admin-transfer');
  return payload;
}
