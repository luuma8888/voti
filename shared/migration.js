import { semanticHash } from './model.js';
import { ensure, validateState } from './validation.js';

/** Migration déterministe : vérifie l'ancienne empreinte AVANT toute transformation. */
export async function migrateState(input) {
  ensure(input && [1, 2, 3].includes(input.schemaVersion), 'Version de schéma inconnue : import refusé.');
  if (input.schemaVersion === 3) return validateState(input);
  const state = await validateState(input);
  if (input.schemaVersion === 1) {
    for (const poll of state.polls) {
      poll.schemaVersion = 2;
      poll.definition.pollImageAssetId = null;
      if (poll.lockedAt !== null) poll.definitionHash = await semanticHash(poll);
    }
  }
  // v2 → v3 ne touche ni les définitions, ni les empreintes, ni les bulletins historiques.
  state.schemaVersion = 3; state.comments = []; state.participations = [];
  return validateState(state);
}
