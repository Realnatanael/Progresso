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

export function sealForNature(natureId) {
  return NATURE_SEALS[natureId] || null;
}
