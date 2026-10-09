import { semanticHash } from './model.js';
import { ensure, validateState } from './validation.js';

/** Migration déterministe : vérifie l'ancienne empreinte AVANT toute transformation. */
export async function migrateState(input) {
  ensure(input && [1, 2].includes(input.schemaVersion), 'Version de schéma inconnue : import refusé.');
  if (input.schemaVersion === 2) return validateState(input);
  const state = await validateState(input, 1);
  state.schemaVersion = 2;
  for (const poll of state.polls) {
    poll.schemaVersion = 2;
    poll.definition.pollImageAssetId = null;
    if (poll.lockedAt !== null) poll.definitionHash = await semanticHash(poll);
  }
  return validateState(state);
}
