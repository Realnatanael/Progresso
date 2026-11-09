/** Arte e metadados visuais do Modo História. */

export const BG_URL = {
  gates: '/images/konoha-aun-gates.jpg',
  classroom: '/images/story/bg-classroom.jpg',
  yard: '/images/story/bg-yard.jpg',
  hokage: '/images/story/bg-hokage.jpg',
  village: '/images/story/bg-village.jpg',
  road: '/images/story/bg-road.jpg',
  'mist-bridge': '/images/story/bg-mist-bridge.jpg',
  'exam-hall': '/images/story/bg-exam-hall.jpg',
  forest: '/images/story/bg-forest.jpg',
  arena: '/images/story/bg-arena.jpg',
  mountains: '/images/story/bg-mountains.jpg',
  battlefield: '/images/story/bg-battlefield.jpg',
};

export const bgUrl = (key) => BG_URL[key] || BG_URL.gates;
export const spriteUrl = (key) => `/images/story/sprites/${key}.webp`;
export const HERO_FALLBACK = spriteUrl('hero');

/** Cor e símbolo de cada efeito/elemento. */
export const FX_META = {
  fire: { label: 'Fogo', color: '#ff7a1a', glyph: '火' },
  water: { label: 'Água', color: '#3fa4e8', glyph: '水' },
  wind: { label: 'Vento', color: '#7fe0b0', glyph: '風' },
  earth: { label: 'Terra', color: '#b98a4e', glyph: '土' },
  lightning: { label: 'Raio', color: '#8fb6ff', glyph: '雷' },
  genjutsu: { label: 'Genjutsu', color: '#a56cff', glyph: '幻' },
  taijutsu: { label: 'Taijutsu', color: '#f2f2f2', glyph: '拳' },
  dojutsu: { label: 'Dōjutsu', color: '#e0213a', glyph: '眼' },
  heal: { label: 'Cura', color: '#78ffa0', glyph: '癒' },
  seal: { label: 'Selo', color: '#ffd266', glyph: '封' },
  sage: { label: 'Sennin', color: '#d9c24a', glyph: '仙' },
  beast: { label: 'Bijuu', color: '#ff5a3a', glyph: '尾' },
  blade: { label: 'Lâmina', color: '#dfe8f2', glyph: '刃' },
  sense: { label: 'Sensor', color: '#9bd6ff', glyph: '感' },
  spirit: { label: 'Espírito', color: '#d8c8ff', glyph: '霊' },
  neutral: { label: 'Chakra', color: '#ffe9b0', glyph: '気' },
};

export const fxMeta = (fx) => FX_META[fx] || FX_META.neutral;

/** Quanto cada animação de tela cheia dura (ms). */
export const FX_DURATION = {
  fire: 1500,
  water: 1500,
  wind: 1250,
  earth: 1400,
  lightning: 1100,
  genjutsu: 1500,
  taijutsu: 800,
  dojutsu: 1400,
  heal: 1300,
  seal: 1300,
  sage: 1300,
  beast: 1400,
  blade: 900,
  sense: 1100,
  spirit: 1100,
  neutral: 1000,
};

/** Efeitos que também chacoalham a tela. */
export const FX_SHAKE = new Set(['earth', 'taijutsu', 'beast', 'lightning', 'fire']);

export const TONE_COLOR = {
  coragem: '#e2a23a',
  cautela: '#7ec8de',
  astucia: '#b393e6',
  empatia: '#9bb67e',
  provocacao: '#e0775a',
  jutsu: '#f08a3c',
};
