/** Catálogo curado — jutsus, naturezas, kekkei e bijuu com pré-requisitos. */
import { JUTSU_LIBRARY } from './jutsuLibrary.js';

export const RANKS = [
  { id: 'academy', label: 'Academia', order: 0 },
  { id: 'genin', label: 'Genin', order: 1 },
  { id: 'chuunin', label: 'Chuunin', order: 2 },
  { id: 'jounin', label: 'Jounin', order: 3 },
];

export const RANK_ORDER = Object.fromEntries(RANKS.map((r) => [r.id, r.order]));

export const RANK_UP = {
  academy_to_genin: {
    from: 'academy',
    to: 'genin',
    requires: { chakra: 30, learnedJutsus: 2, statsSum: 15, natures: 1 },
  },
};

export const PERFECT_DAY_POINTS = 3;
export const CHAKRA_MAX = 365;
export const STAT_MAX = 100;
/** Custo pra rolar afinidade rara no lugar do 1º elemento básico. */
export const AFFINITY_ROLL_COST = 8;

export const NATURES = [
  // Básicos
  { id: 'fire', label: 'Fogo', release: 'Katon', group: 'basic' },
  { id: 'water', label: 'Água', release: 'Suiton', group: 'basic' },
  { id: 'wind', label: 'Vento', release: 'Fuuton', group: 'basic' },
  { id: 'earth', label: 'Terra', release: 'Doton', group: 'basic' },
  { id: 'lightning', label: 'Raio', release: 'Raiton', group: 'basic' },
  // Espirituais
  { id: 'yin', label: 'Yin', release: 'Inton', group: 'spirit' },
  { id: 'yang', label: 'Yang', release: 'Yōton', group: 'spirit' },
  { id: 'yin_yang', label: 'Yin-Yang', release: 'Onmyōton', group: 'spirit' },
  // Especiais
  { id: 'crystal', label: 'Cristal', release: 'Shōton', group: 'special' },
  { id: 'typhoon', label: 'Tufão', release: 'Taiton', group: 'special' },
  { id: 'steel', label: 'Aço', release: 'Kōton', group: 'special' },
  { id: 'darkness', label: 'Trevas', release: 'Meiton', group: 'special' },
  { id: 'speed', label: 'Velocidade', release: 'Jinton', group: 'special' },
];

export const BASIC_NATURES = NATURES.filter((n) => n.group === 'basic');

/** Tabela de sorte da 1ª afinidade rara (pesos relativos). */
export const AFFINITY_ROLL_TABLE = [
  { kind: 'nature', natureId: 'yin', weight: 14 },
  { kind: 'nature', natureId: 'yang', weight: 14 },
  { kind: 'nature', natureId: 'yin_yang', weight: 4 },
  { kind: 'nature', natureId: 'crystal', weight: 6 },
  { kind: 'nature', natureId: 'typhoon', weight: 6 },
  { kind: 'nature', natureId: 'steel', weight: 5 },
  { kind: 'nature', natureId: 'darkness', weight: 5 },
  { kind: 'nature', natureId: 'speed', weight: 5 },
  { kind: 'kekkei', id: 'kekkei-hyoton', weight: 6 },
  { kind: 'kekkei', id: 'kekkei-mokuton', weight: 5 },
  { kind: 'kekkei', id: 'kekkei-yoton-lava', weight: 5 },
  { kind: 'kekkei', id: 'kekkei-futton', weight: 5 },
  { kind: 'kekkei', id: 'kekkei-ranton', weight: 5 },
  { kind: 'kekkei', id: 'kekkei-jiton', weight: 5 },
  { kind: 'kekkei', id: 'kekkei-shakuton', weight: 5 },
  { kind: 'kekkei', id: 'kekkei-bakuton', weight: 5 },
  { kind: 'kekkei', id: 'kekkei-deiton', weight: 4 },
  { kind: 'kekkei', id: 'kekkei-jinton-dust', weight: 2 },
];


function basicNatureEntry(nat) {
  return {
    id: `nature-${nat.id}`,
    kind: 'nature',
    natureId: nat.id,
    natureGroup: 'basic',
    name: `Estilo ${nat.label} (${nat.release})`,
    tier: 'E',
    rankMin: 'academy',
    costUnlockPoints: 0,
    firstNatureOnly: true,
    requires: {},
    requiresIds: [],
    blurb: `Afinidade básica ${nat.release}. Grátis na primeira escolha.`,
  };
}

export const NINJA_CATALOG = [
  // —— 5 básicos: 1ª escolha grátis ——
  ...BASIC_NATURES.map(basicNatureEntry),

  // —— 2ª natureza básica (só ninja bem experiente) ——
  ...BASIC_NATURES.map((nat) => ({
    id: `nature2-${nat.id}`,
    kind: 'nature',
    natureId: nat.id,
    natureGroup: 'basic',
    name: `Segundo elemento: ${nat.label}`,
    tier: 'A',
    rankMin: 'jounin',
    costUnlockPoints: 28,
    firstNatureOnly: false,
    requires: { chakra: 160, ninjutsu: 45, taijutsu: 25 },
    requiresIds: [],
    blurb: `Desbloqueia ${nat.release} como elemento secundário — caminho longo.`,
  })),

  // —— Espirituais (compra direta; também saem na sorte) ——
  {
    id: 'nature-yin',
    kind: 'nature',
    natureId: 'yin',
    natureGroup: 'spirit',
    name: 'Marcador Yin (Inton)',
    tier: 'B',
    rankMin: 'genin',
    costUnlockPoints: 16,
    firstNatureOnly: false,
    requires: { chakra: 50, genjutsu: 20 },
    requiresIds: [],
    blurb: 'Chakra espiritual — base de genjutsu e criação.',
  },
  {
    id: 'nature-yang',
    kind: 'nature',
    natureId: 'yang',
    natureGroup: 'spirit',
    name: 'Marcador Yang (Yōton)',
    tier: 'B',
    rankMin: 'genin',
    costUnlockPoints: 16,
    firstNatureOnly: false,
    requires: { chakra: 50, taijutsu: 20 },
    requiresIds: [],
    blurb: 'Chakra vital — corpo, cura e força.',
  },
  {
    id: 'nature-yin-yang',
    kind: 'nature',
    natureId: 'yin_yang',
    natureGroup: 'spirit',
    name: 'Marcador Yin-Yang (Onmyōton)',
    tier: 'A',
    rankMin: 'chuunin',
    costUnlockPoints: 28,
    firstNatureOnly: false,
    requires: { chakra: 120, ninjutsu: 30, genjutsu: 30 },
    requiresIds: [],
    requiresNatures: ['yin', 'yang'],
    blurb: 'Equilíbrio Yin e Yang. Exige os dois marcadores.',
  },

  // —— Especiais ——
  {
    id: 'nature-crystal',
    kind: 'nature',
    natureId: 'crystal',
    natureGroup: 'special',
    name: 'Marcador Cristal (Shōton)',
    tier: 'A',
    rankMin: 'chuunin',
    costUnlockPoints: 20,
    firstNatureOnly: false,
    requires: { chakra: 100, ninjutsu: 35 },
    requiresIds: [],
    blurb: 'Cristaliza chakra em prisões e lâminas.',
  },
  {
    id: 'nature-typhoon',
    kind: 'nature',
    natureId: 'typhoon',
    natureGroup: 'special',
    name: 'Marcador Tufão (Taiton)',
    tier: 'A',
    rankMin: 'chuunin',
    costUnlockPoints: 18,
    firstNatureOnly: false,
    requires: { chakra: 90, ninjutsu: 30 },
    requiresIds: [],
    requiresNatures: ['wind'],
    blurb: 'Vento elevado a furacão concentrado.',
  },
  {
    id: 'nature-steel',
    kind: 'nature',
    natureId: 'steel',
    natureGroup: 'special',
    name: 'Marcador Aço (Kōton)',
    tier: 'A',
    rankMin: 'chuunin',
    costUnlockPoints: 18,
    firstNatureOnly: false,
    requires: { chakra: 95, taijutsu: 28 },
    requiresIds: [],
    blurb: 'Endurece o corpo como aço vivo.',
  },
  {
    id: 'nature-darkness',
    kind: 'nature',
    natureId: 'darkness',
    natureGroup: 'special',
    name: 'Marcador Trevas (Meiton)',
    tier: 'A',
    rankMin: 'chuunin',
    costUnlockPoints: 22,
    firstNatureOnly: false,
    requires: { chakra: 110, genjutsu: 32 },
    requiresIds: [],
    blurb: 'Absorve e anula chakra alheio.',
  },
  {
    id: 'nature-speed',
    kind: 'nature',
    natureId: 'speed',
    natureGroup: 'special',
    name: 'Marcador Velocidade (Jinton)',
    tier: 'A',
    rankMin: 'chuunin',
    costUnlockPoints: 18,
    firstNatureOnly: false,
    requires: { chakra: 90, taijutsu: 35 },
    requiresIds: [],
    blurb: 'Explosões de velocidade quase invisíveis.',
  },

  // —— Jutsus (biblioteca E–S, gate por natureza) ——
  ...JUTSU_LIBRARY,

  // —— Kekkei (chuunin+) e jutsus dependentes ——
  {
    id: 'kekkei-sharingan',
    kind: 'kekkei',
    name: 'Sharingan',
    tier: 'B',
    rankMin: 'chuunin',
    costUnlockPoints: 20,
    requires: { chakra: 120, ninjutsu: 35, genjutsu: 40, taijutsu: 20 },
    requiresIds: [],
    requiresNatures: [],
    blurb: 'Olho que copia e prevê movimentos.',
  },
  {
    id: 'bijuu-eco-kurama',
    kind: 'bijuu',
    name: 'Eco da Raposa de Nove Caudas',
    tier: 'S',
    rankMin: 'jounin',
    costUnlockPoints: 50,
    requires: { chakra: 250, ninjutsu: 70, genjutsu: 30, taijutsu: 40 },
    requiresIds: [],
    requiresNatures: [],
    blurb: 'Fragmento de poder — ainda longe.',
  },
  {
    id: 'bijuu-eco-shukaku',
    kind: 'bijuu',
    name: 'Eco do Shukaku',
    tier: 'S',
    rankMin: 'jounin',
    costUnlockPoints: 45,
    requires: { chakra: 230, ninjutsu: 55, genjutsu: 40 },
    requiresIds: [],
    requiresNatures: ['wind'],
    blurb: 'Areia e vento do tanuki de uma cauda.',
  },
];

export function catalogById(id) {
  return NINJA_CATALOG.find((item) => item.id === id) || null;
}

export function surnameFromFullName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return parts[parts.length - 1];
}

export function defaultNinjaState() {
  return {
    clanName: '',
    clanNameSyncedFromName: true,
    rank: 'academy',
    chakra: 0,
    ninjutsu: 0,
    genjutsu: 0,
    taijutsu: 0,
    unlockPoints: 0,
    natures: [],
    learnedJutsuIds: [],
    unlockedKekkeiIds: [],
    unlockedBijuuIds: [],
    pendingStatPick: null,
    needsFirstNature: true,
    waterDates: [],
    perfectDates: [],
    workoutPicks: {},
    avatarReady: false,
    avatarUpdatedAt: null,
  };
}
