import { WeightEntry } from '../models/WeightEntry.js';
import { generateNinjaAvatarImage } from './geminiAvatar.js';
import {
  avatarLookFromNinja,
  avatarLookKey,
  avatarLookKeyFromNinja,
} from './ninjaAvatarLook.js';
import { ensureNinja } from './ninjaProgress.js';

/**
 * Regenera o avatar se rank/olhos mudaram e ainda temos a selfie salva.
 * Falhas de IA não devem barrar o progresso do ninja.
 */
export async function maybeRefreshNinjaAvatar(user, { force = false } = {}) {
  const n = ensureNinja(user);
  if (!n.avatarReady) {
    return { refreshed: false, reason: 'not-ready' };
  }

  const look = avatarLookFromNinja(n);
  const key = avatarLookKey(look);
  if (!force && n.avatarLookKey === key) {
    return { refreshed: false, reason: 'unchanged' };
  }

  let selfieData = user.ninjaSelfieData;
  let selfieMime = user.ninjaSelfieMime;
  if (!selfieData?.length) {
    const { User } = await import('../models/User.js');
    const withSelfie = await User.findById(user._id).select('+ninjaSelfieData +ninjaSelfieMime');
    selfieData = withSelfie?.ninjaSelfieData;
    selfieMime = withSelfie?.ninjaSelfieMime;
    if (selfieData?.length) {
      user.ninjaSelfieData = selfieData;
      user.ninjaSelfieMime = selfieMime;
    }
  }

  if (!selfieData?.length) {
    return { refreshed: false, reason: 'no-selfie' };
  }

  const latestWeight = await WeightEntry.findOne({ userId: user._id })
    .sort({ date: -1, createdAt: -1 })
    .lean();

  const generated = await generateNinjaAvatarImage({
    photoBase64: Buffer.isBuffer(selfieData)
      ? selfieData.toString('base64')
      : String(selfieData),
    photoMime: selfieMime || 'image/jpeg',
    age: user.age,
    heightCm: user.heightCm,
    weightKg: latestWeight?.kg ?? null,
    gender: user.gender,
    clanName: n.clanName || '',
    displayName: user.name || '',
    rank: look.rank,
    eye: look.eye,
  });

  user.ninjaAvatarData = generated.buffer;
  user.ninjaAvatarMime = generated.mime;
  n.avatarUpdatedAt = new Date();
  n.avatarLookKey = key;
  user.markModified('ninja');
  return { refreshed: true, lookKey: key };
}

export function currentAvatarLookKey(user) {
  return avatarLookKeyFromNinja(ensureNinja(user));
}
