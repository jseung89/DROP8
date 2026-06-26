export { Drop8AudioManager } from './AudioManager';
export { SOUND_REGISTRY, soundDefinition, soundIdForWeapon } from './SoundRegistry';
export type { AudioEventMessage, LoopSoundOptions, SoundId, WorldSoundOptions } from './audioTypes';

import { Drop8AudioManager } from './AudioManager';
export const audio = new Drop8AudioManager();
