/**
 * Elementos, efeitos visuais (fx) e helpers de jutsu do Modo História.
 * O ciclo é o clássico: Fogo > Vento > Raio > Terra > Água > Fogo.
 */
import { catalogById } from '../data/ninjaCatalog.js';

export const BASIC_ELEMENTS = ['fire', 'water', 'wind', 'earth', 'lightning'];

export const ELEMENT_INFO = {
  fire: { label: 'Fogo', release: 'Katon' },
  water: { label: 'Água', release: 'Suiton' },
  wind: { label: 'Vento', release: 'Fuuton' },
  earth: { label: 'Terra', release: 'Doton' },
  lightning: { label: 'Raio', release: 'Raiton' },
};

/** A chave vence o valor. */
const BEATS = {
  fire: 'wind',
  wind: 'lightning',
  lightning: 'earth',
  earth: 'water',
  water: 'fire',
};

const NATURE_TO_ELEMENT = {
  fire: 'fire',
  water: 'water',
  wind: 'wind',
  earth: 'earth',
  lightning: 'lightning',
  typhoon: 'wind',
  speed: 'wind',
  crystal: 'earth',
  steel: 'earth',
  darkness: 'lightning',
};

const RELEASE_RE = /^(katon|suiton|fuuton|doton|raiton)\b/i;
const RELEASE_TO_ELEMENT = {
  katon: 'fire',
  suiton: 'water',
  fuuton: 'wind',
  doton: 'earth',
  raiton: 'lightning',
};

export const FX_LABEL = {
  fire: 'Fogo',
  water: 'Água',
  wind: 'Vento',
  earth: 'Terra',
  lightning: 'Raio',
  genjutsu: 'Genjutsu',
  taijutsu: 'Taijutsu',
  dojutsu: 'Dōjutsu',
  heal: 'Cura',
  seal: 'Selo',
  sage: 'Sennin',
  beast: 'Bijuu',
  blade: 'Lâmina',
  sense: 'Sensor',
  spirit: 'Espírito',
  neutral: 'Chakra',
};

/** Frase curta que acompanha o efeito do jutsu na cena. */
export const FX_FLAIR = {
  fire: 'As chamas lambem o ar à sua frente.',
  water: 'A água obedece ao seu chakra.',
  wind: 'O vento corta tudo ao redor.',
  earth: 'O chão treme e obedece.',
  lightning: 'O raio estala e ilumina tudo.',
  genjutsu: 'O mundo ao redor distorce.',
  taijutsu: 'Seu corpo se move antes do pensamento.',
  dojutsu: 'Seus olhos leem cada movimento.',
  heal: 'Um calor suave fecha as feridas.',
  seal: 'Os selos brilham e prendem o alvo.',
  sage: 'A energia da natureza flui por você.',
  beast: 'Um chakra selvagem ruge em volta.',
  blade: 'A lâmina risca o ar sem ruído.',
  sense: 'Você sente cada presença ao redor.',
  spirit: 'Seu chakra vibra em silêncio.',
  neutral: 'Seu chakra responde, firme.',
};

const TIER_RANK = { S: 6, A: 5, B: 4, C: 3, D: 2, E: 1 };

export function elementLabel(el) {
  return ELEMENT_INFO[el]?.label || '';
}

export function elementFromNature(natureId) {
  return NATURE_TO_ELEMENT[natureId] || null;
}

export function weaknessOf(el) {
  if (!el) return null;
  return Object.keys(BEATS).find((key) => BEATS[key] === el) || null;
}

/** Multiplicador do ataque `attackEl` contra um alvo de elemento `defendEl`. */
export function matchup(attackEl, defendEl) {
  if (!attackEl || !defendEl) return { mult: 1, tag: null };
  if (BEATS[attackEl] === defendEl) return { mult: 1.5, tag: 'advantage' };
  if (BEATS[defendEl] === attackEl) return { mult: 0.65, tag: 'resist' };
  if (attackEl === defendEl) return { mult: 0.85, tag: 'resist' };
  return { mult: 1, tag: null };
}

export function elementOfJutsu(jutsu) {
  if (!jutsu) return null;
  for (const natureId of jutsu.requiresNatures || []) {
    const el = NATURE_TO_ELEMENT[natureId];
    if (el) return el;
  }
  const match = RELEASE_RE.exec(String(jutsu.name || '').trim());
  return match ? RELEASE_TO_ELEMENT[match[1].toLowerCase()] : null;
}

export function fxOfJutsu(jutsu) {
  const el = elementOfJutsu(jutsu);
  if (el) return el;
  switch (jutsu?.category) {
    case 'genjutsu': return 'genjutsu';
    case 'taijutsu': return 'taijutsu';
    case 'dojutsu': return 'dojutsu';
    case 'iryo': return 'heal';
    case 'fuuinjutsu': return 'seal';
    case 'senjutsu': return 'sage';
    case 'bijuu': return 'beast';
    case 'bukijutsu': return 'blade';
    case 'sensor': return 'sense';
    case 'kekkei': return 'spirit';
    default: return 'neutral';
  }
}

export function jutsuView(jutsu) {
  const element = elementOfJutsu(jutsu);
  return {
    id: jutsu.id,
    name: jutsu.name,
    tier: jutsu.tier,
    category: jutsu.category,
    element,
    elementLabel: elementLabel(element),
    fx: fxOfJutsu(jutsu),
  };
}

/** Jutsus aprendidos (catálogo `kind: jutsu`), do mais forte ao mais fraco. */
export function learnedJutsus(n) {
  const list = [];
  for (const id of n.learnedJutsuIds || []) {
    const entry = catalogById(id);
    if (entry && entry.kind === 'jutsu') list.push(entry);
  }
  return list.sort((a, b) => (
    (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0)
    || String(a.name).localeCompare(String(b.name), 'pt-BR')
  ));
}

const EYE_RE = /sharingan|byakugan|rinnegan|mangekyou/;
const EYE_LABEL = {
  sharingan: 'Sharingan',
  byakugan: 'Byakugan',
  rinnegan: 'Rinnegan',
  mangekyou: 'Mangekyō',
};

/** Dōjutsu desbloqueado (prefere o mais avançado). */
export function ownedEye(n, allowed = null) {
  const ids = (n.unlockedKekkeiIds || []).map(String);
  const order = ['rinnegan', 'mangekyou', 'sharingan', 'byakugan'];
  for (const key of order) {
    if (allowed && !allowed.includes(key)) continue;
    if (ids.some((id) => id.includes(key))) return { key, label: EYE_LABEL[key] };
  }
  if (!allowed && ids.some((id) => EYE_RE.test(id))) return { key: 'sharingan', label: EYE_LABEL.sharingan };
  return null;
}

export function statValue(n, stat) {
  return Math.max(0, Number(n?.[stat]) || 0);
}

export const STAT_LABEL = {
  ninjutsu: 'Ninjutsu',
  genjutsu: 'Genjutsu',
  taijutsu: 'Taijutsu',
};
