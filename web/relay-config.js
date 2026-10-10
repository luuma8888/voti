/** Configuration publique unique. null = application entièrement locale.
 * Pour un build connecté : VOTI_RELAY_ID et VOTI_RELAY_URL au build.
 * Aucune capacité administrateur ou clé d'infrastructure ici.
 */
import { assetReferences } from '../shared/assets.js';
import { relayEnsure } from '../shared/relay.js';

export const RELAY_CONFIG = null;

export const REMOTE_IMAGES_MESSAGE = 'Ce relais gratuit accepte uniquement les sondages sans images. Les images restent disponibles en mode local.';
export function remoteImagesAllowed(config) { return config?.remoteAssetsEnabled !== false; }
export function assertRemoteImagePolicy(config, definition) {
  relayEnsure(remoteImagesAllowed(config) || assetReferences({ polls: [{ definition }] }).size === 0,
    'REMOTE_ASSETS_DISABLED', REMOTE_IMAGES_MESSAGE);
}
