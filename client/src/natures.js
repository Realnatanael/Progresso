/** Emblemas e rótulos curtos dos elementos na UI. */
export const NATURE_SEALS = {
  fire: {
    icon: '/images/natures/fire.jpg',
    label: 'Fogo',
    release: 'Katon',
  },
  water: {
    icon: '/images/natures/water.jpg',
    label: 'Água',
    release: 'Suiton',
  },
  wind: {
    icon: '/images/natures/wind.jpg',
    label: 'Vento',
    release: 'Fuuton',
  },
  earth: {
    icon: '/images/natures/earth.jpg',
    label: 'Terra',
    release: 'Doton',
  },
  lightning: {
    icon: '/images/natures/lightning.jpg',
    label: 'Raio',
    release: 'Raiton',
  },
};

export const DESTINY_SEAL = {
  icon: '/images/natures/destiny.jpg',
  label: 'Destino',
  release: 'Sorte',
};

/** Glyphs for natures without seal art (spirit / special). */
export const NATURE_EMOJI = {
  fire: '🔥',
  water: '💧',
  wind: '🌪️',
  earth: '🪨',
  lightning: '⚡',
  yin: '🌑',
  yang: '☀️',
  yin_yang: '☯️',
  crystal: '💎',
  typhoon: '🌀',
  steel: '⚙️',
  darkness: '🖤',
  speed: '💨',
};

export const CATEGORY_EMOJI = {
  ninjutsu: '🌀',
  genjutsu: '👁️',
  taijutsu: '👊',
  bukijutsu: '🗡️',
  fuuinjutsu: '🔏',
  iryo: '💚',
  sensor: '📡',
  senjutsu: '🍃',
  dojutsu: '👀',
};

export function sealForNature(natureId) {
  return NATURE_SEALS[natureId] || null;
}

export function emojiForNature(natureId) {
  return NATURE_EMOJI[natureId] || '✦';
}

export function emojiForCategory(category) {
  return CATEGORY_EMOJI[category] || '✦';
}

/** Visual for a jutsu tile: nature seal, nature emoji, or category emoji. */
export function visualForJutsu(item) {
  const natureId = item?.requiresNatures?.[0];
  if (natureId) {
    const seal = sealForNature(natureId);
    if (seal) {
      return { type: 'seal', src: seal.icon, label: seal.release };
    }
    return { type: 'emoji', emoji: emojiForNature(natureId), label: natureId };
  }
  return {
    type: 'emoji',
    emoji: emojiForCategory(item?.category),
    label: item?.category || 'jutsu',
  };
}
