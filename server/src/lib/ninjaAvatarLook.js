import { DOJUTSU_PATHS } from '../data/pathsCatalog.js';

const EYE_PRIORITY = {
  rinnegan: 40,
  sharingan: 20,
  byakugan: 10,
};

/** Melhor dōjutsu desbloqueado (rinnegan > mangekyō/sharingan > byakugan). */
export function resolveActiveEye(n) {
  const owned = new Set(n?.unlockedKekkeiIds || []);
  const eyes = DOJUTSU_PATHS.filter((item) => owned.has(item.id));
  if (!eyes.length) return null;

  eyes.sort((a, b) => {
    const scoreA = (EYE_PRIORITY[a.eye] || 0) + (a.stage || 0);
    const scoreB = (EYE_PRIORITY[b.eye] || 0) + (b.stage || 0);
    return scoreB - scoreA;
  });

  const top = eyes[0];
  return {
    eye: top.eye,
    stage: top.stage || 1,
    id: top.id,
    name: top.name,
  };
}

export function avatarLookFromNinja(n) {
  return {
    rank: n?.rank || 'academy',
    eye: resolveActiveEye(n),
  };
}

export function avatarLookKey(look) {
  const rank = look?.rank || 'academy';
  const eye = look?.eye;
  if (!eye?.eye) return `${rank}|none`;
  return `${rank}|${eye.eye}:${eye.stage || 1}`;
}

export function avatarLookKeyFromNinja(n) {
  return avatarLookKey(avatarLookFromNinja(n));
}
