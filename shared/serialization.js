import { MAX_JSON_LENGTH } from './model.js';
import { ensure, validateState } from './validation.js';

export async function parseExport(raw) {
  ensure(typeof raw === 'string' && raw.length <= MAX_JSON_LENGTH, 'Fichier trop volumineux : limite de 2 millions de caractères.');
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('Le fichier n’est pas un JSON valide.'); }
  return validateState(data);
}

export async function serialize(state) {
  const raw = JSON.stringify(await validateState(state), null, 2);
  ensure(raw.length <= MAX_JSON_LENGTH, 'Sauvegarde trop volumineuse pour ce prototype.');
  return raw;
}

/** Une importation initialise seulement un espace vide ; pas de fusion/remplacement. */
export async function importIntoEmpty(current, raw) {
  const incoming = await parseExport(raw);
  ensure(current.polls.length === 0 && current.ballots.length === 0,
    'Import refusé : ce navigateur contient déjà des sondages. Utilisez un profil de navigateur vide ; aucun remplacement ni fusion n’est effectué.');
  return incoming;
}
