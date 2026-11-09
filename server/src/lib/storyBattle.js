/**
 * Batalha por turnos do Modo História.
 * O servidor resolve cada rodada (RNG com seed), então o resultado não depende do cliente.
 */
import crypto from 'crypto';
import { ENEMIES } from '../data/storyEnemies.js';
import {
  elementLabel,
  elementOfJutsu,
  jutsuView,
  learnedJutsus,
  matchup,
  ownedEye,
  statValue,
  weaknessOf,
} from './storyElements.js';

const TIER_POWER = { E: 8, D: 11, C: 15, B: 20, A: 28, S: 40 };
const TIER_COST = { E: 3, D: 4, C: 6, B: 8, A: 12, S: 18 };
const RANK_HP = { academy: 0, genin: 12, chuunin: 30, jounin: 55 };
const EYE_COST = 6;
const REGEN = 3;
const GUARD_REGEN = 6;
const STRIKE_REGEN = 2;
const GUARD_CUT = 0.4;
const AEGIS_CUT = 0.65;
const WEAKEN_CUT = 0.65;

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

function rngFor(seed, salt) {
  let a = (Number(seed) ^ Math.imul(salt + 1, 2654435761)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function playerLimits(n) {
  const total = statValue(n, 'ninjutsu') + statValue(n, 'genjutsu') + statValue(n, 'taijutsu');
  return {
    hpMax: 60 + Math.round(total * 0.6) + (RANK_HP[n.rank] || 0),
    chakraMax: clamp(10 + Math.floor((n.chakra || 0) / 5), 10, 80),
  };
}

function categoryStat(n, category) {
  const nin = statValue(n, 'ninjutsu');
  const gen = statValue(n, 'genjutsu');
  const tai = statValue(n, 'taijutsu');
  switch (category) {
    case 'genjutsu':
    case 'sensor':
      return gen;
    case 'taijutsu':
    case 'bukijutsu':
      return tai;
    case 'dojutsu':
      return Math.round((nin + gen) / 2);
    case 'senjutsu':
    case 'bijuu':
    case 'kekkei':
      return Math.max(nin, gen, tai);
    default:
      return nin;
  }
}

function effectOf(category) {
  switch (category) {
    case 'taijutsu': return 'crit';
    case 'genjutsu': return 'stun';
    case 'iryo': return 'heal';
    case 'fuuinjutsu': return 'seal';
    case 'sensor': return 'sense';
    case 'dojutsu': return 'aegis';
    default: return 'damage';
  }
}

const EFFECT_DAMAGE_MULT = { damage: 1, crit: 1, stun: 0.55, heal: 0, seal: 0.4, sense: 0.25, aegis: 1.05 };
const EFFECT_LABEL = {
  damage: 'Dano',
  crit: 'Dano · crítico',
  stun: 'Atordoa',
  heal: 'Cura',
  seal: 'Enfraquece',
  sense: 'Esquiva',
  aegis: 'Dano · defesa',
};

function costOf(jutsu) {
  const base = TIER_COST[jutsu.tier] || 6;
  if (jutsu.category === 'taijutsu') return Math.max(2, Math.ceil(base * 0.6));
  if (jutsu.category === 'genjutsu') return Math.max(2, Math.ceil(base * 0.8));
  return base;
}

function baseDamage(n, jutsu) {
  const power = TIER_POWER[jutsu.tier] || 15;
  return power * (1 + categoryStat(n, jutsu.category) / 80);
}

function strikeDamage(n) {
  return 5 + statValue(n, 'taijutsu') * 0.18;
}

function intentFor(battle, def) {
  return def.moves[(battle.round - 1) % def.moves.length];
}

export function createBattle(beat, n, flags = {}) {
  const def = ENEMIES[beat.enemy];
  if (!def) throw new Error(`Inimigo desconhecido: ${beat.enemy}`);

  const mods = { enemyAtk: 1, enemyHp: 1, playerHp: 1, playerChakra: 1, playerBoost: 1 };
  for (const [flag, buff] of Object.entries(beat.flagBuffs || {})) {
    if (!flags[flag]) continue;
    for (const key of Object.keys(mods)) {
      if (buff[key]) mods[key] *= buff[key];
    }
  }

  const limits = playerLimits(n);
  const hpMax = Math.round(limits.hpMax * Math.max(1, mods.playerHp));
  const chakraMax = Math.round(limits.chakraMax * Math.max(1, mods.playerChakra));
  const enemyHp = Math.round(def.hp * mods.enemyHp);

  return {
    v: 1,
    enemyKey: beat.enemy,
    seed: crypto.randomInt(1, 2 ** 31 - 1),
    round: 1,
    maxRounds: beat.rounds || 6,
    mode: beat.mode || 'ko',
    winAtEnemyPct: beat.winAtEnemyPct || 0,
    mustUseJutsu: Boolean(beat.mustUseJutsu),
    player: {
      hp: Math.min(hpMax, Math.round(limits.hpMax * mods.playerHp)),
      hpMax,
      chakra: Math.min(chakraMax, Math.round(limits.chakraMax * mods.playerChakra)),
      chakraMax,
      guard: false,
      dodge: false,
      aegis: false,
      boost: mods.playerBoost,
      next: 1,
    },
    enemy: {
      hp: enemyHp,
      hpMax: enemyHp,
      stun: 0,
      weaken: 0,
      atk: (def.atk || 1) * mods.enemyAtk,
    },
    usedJutsu: false,
    stats: { jutsus: 0, guards: 0, strikes: 0 },
    log: [],
    over: null,
  };
}

function setOver(battle, result, reason) {
  let verdict = { result, reason };
  if (result === 'win' && battle.mustUseJutsu && !battle.usedJutsu) {
    verdict = { result: 'lose', reason: 'nojutsu' };
  }
  battle.over = verdict;
}

function pushLog(battle, lines) {
  battle.log = [...(battle.log || []), ...lines].slice(-6);
}

function describePlayer(p) {
  if (p.action === 'guard') return 'Você se protege e recupera o fôlego.';
  if (p.action === 'eye') return `${p.name}: você lê os movimentos do oponente.`;
  if (p.action === 'strike') return `Você golpeia: ${p.damage} de dano${p.crit ? ' (crítico!)' : ''}.`;
  const parts = [];
  if (p.heal) parts.push(`recupera ${p.heal} de vida`);
  if (p.damage) parts.push(`${p.damage} de dano`);
  if (p.stunned) parts.push('oponente atordoado');
  if (p.weakened) parts.push('oponente enfraquecido');
  if (p.dodge) parts.push('próximo golpe esquivado');
  if (!parts.length) parts.push('sem efeito direto');
  let line = `${p.name}: ${parts.join(', ')}.`;
  if (p.tag === 'advantage') line += ' Vantagem elemental!';
  if (p.tag === 'resist') line += ' Resistido.';
  if (p.crit) line += ' Crítico!';
  return line;
}

function describeEnemy(e, defName) {
  if (e.action === 'stunned') return `${defName} está atordoado e perde o turno.`;
  if (e.dodged) return `${defName} usou ${e.name}, mas você esquivou.`;
  const note = e.blocked ? ' Guarda segurou parte.' : '';
  return `${defName} usou ${e.name}: ${e.damage} de dano.${note}`;
}

export function resolveRound(battle, n, { action, jutsuId } = {}) {
  if (battle.over) return { error: 'A batalha já terminou.' };
  const def = ENEMIES[battle.enemyKey];
  const p = battle.player;
  const e = battle.enemy;
  const rng = rngFor(battle.seed, battle.round);
  const variance = () => 0.9 + rng() * 0.2;
  const ev = { n: battle.round, player: {}, enemy: { action: 'none' } };

  // ───── Ação do jogador ─────
  if (action === 'strike') {
    const crit = rng() < 0.12 ? 1.5 : 1;
    const dmg = Math.round(strikeDamage(n) * p.boost * crit * variance());
    p.chakra = Math.min(p.chakraMax, p.chakra + STRIKE_REGEN);
    e.hp = Math.max(0, e.hp - dmg);
    battle.stats.strikes += 1;
    ev.player = { action: 'strike', name: 'Golpe', fx: 'taijutsu', damage: dmg, crit: crit > 1 };
  } else if (action === 'guard') {
    p.guard = true;
    p.chakra = Math.min(p.chakraMax, p.chakra + GUARD_REGEN);
    battle.stats.guards += 1;
    ev.player = { action: 'guard', name: 'Guarda', fx: null, damage: 0 };
  } else if (action === 'eye') {
    const eye = ownedEye(n);
    if (!eye) return { error: 'Você ainda não despertou um dōjutsu.' };
    if (p.chakra < EYE_COST) return { error: 'Chakra insuficiente.' };
    p.chakra -= EYE_COST;
    p.aegis = true;
    p.next = Math.max(p.next, 1.3);
    ev.player = { action: 'eye', name: eye.label, fx: 'dojutsu', damage: 0 };
  } else if (action === 'jutsu') {
    const jutsu = learnedJutsus(n).find((item) => item.id === jutsuId);
    if (!jutsu) return { error: 'Você não domina esse jutsu.' };
    const cost = costOf(jutsu);
    if (p.chakra < cost) return { error: 'Chakra insuficiente.' };

    p.chakra -= cost;
    const view = jutsuView(jutsu);
    const effect = effectOf(jutsu.category);
    const stat = categoryStat(n, jutsu.category);
    const base = baseDamage(n, jutsu);
    const mu = matchup(view.element, def.element);
    const boost = p.boost * p.next;
    p.next = 1;
    const critChance = effect === 'crit' ? 0.2 : 0.1;
    const crit = rng() < critChance ? 1.5 : 1;

    const out = {
      action: 'jutsu',
      name: jutsu.name,
      fx: view.fx,
      element: view.element,
      tag: mu.tag,
      damage: 0,
      heal: 0,
      crit: false,
    };

    if (effect === 'heal') {
      const heal = Math.round(base * 1.3 * variance());
      const healed = Math.min(p.hpMax - p.hp, heal);
      p.hp += healed;
      out.heal = healed;
    } else {
      const dmg = Math.round(base * EFFECT_DAMAGE_MULT[effect] * mu.mult * boost * crit * variance());
      e.hp = Math.max(0, e.hp - dmg);
      out.damage = dmg;
      out.crit = crit > 1 && effect !== 'stun';
    }
    if (effect === 'stun') {
      const chance = clamp(0.35 + stat / 200, 0.2, 0.8) * (1 - (def.stunResist || 0));
      if (rng() < chance) {
        e.stun = 1;
        out.stunned = true;
      }
    }
    if (effect === 'seal') {
      e.weaken = 2;
      out.weakened = true;
    }
    if (effect === 'sense') {
      p.dodge = true;
      out.dodge = true;
    }
    if (effect === 'aegis') p.aegis = true;

    battle.usedJutsu = true;
    battle.stats.jutsus += 1;
    ev.player = out;
  } else {
    return { error: 'Ação inválida.' };
  }

  const logLines = [describePlayer(ev.player)];

  // ───── Vitória imediata ─────
  const enemyPct = (e.hp / e.hpMax) * 100;
  if (e.hp <= 0) {
    setOver(battle, 'win', 'ko');
  } else if (battle.winAtEnemyPct && enemyPct <= battle.winAtEnemyPct) {
    setOver(battle, 'win', 'yield');
  }

  // ───── Ação do inimigo ─────
  if (!battle.over) {
    if (e.stun > 0) {
      e.stun -= 1;
      ev.enemy = { action: 'stunned' };
    } else {
      const move = intentFor(battle, def);
      const enraged = Boolean(def.enrage) && e.hp / e.hpMax <= 0.4;
      let dmg = Math.round(
        move.power * e.atk * (e.weaken > 0 ? WEAKEN_CUT : 1) * (enraged ? 1.2 : 1) * variance(),
      );
      const out = {
        action: 'attack',
        name: move.name,
        fx: move.element || move.fx || 'taijutsu',
        element: move.element || null,
        damage: 0,
        enraged,
      };
      if (p.dodge) {
        out.dodged = true;
        dmg = 0;
      } else {
        if (p.guard) {
          dmg = Math.round(dmg * GUARD_CUT);
          out.blocked = true;
        }
        if (p.aegis) dmg = Math.round(dmg * AEGIS_CUT);
      }
      p.hp = Math.max(0, p.hp - dmg);
      out.damage = dmg;
      if (e.weaken > 0) e.weaken -= 1;
      ev.enemy = out;
    }
    logLines.push(describeEnemy(ev.enemy, def.name));

    if (p.hp <= 0) setOver(battle, 'lose', 'ko');
  }

  // ───── Fim da rodada ─────
  ev.playerHpAfter = p.hp;
  ev.playerChakraAfter = p.chakra;
  ev.enemyHpAfter = e.hp;

  if (!battle.over) {
    p.guard = false;
    p.dodge = false;
    p.aegis = false;
    p.chakra = Math.min(p.chakraMax, p.chakra + REGEN);
    battle.round += 1;

    if (battle.round > battle.maxRounds) {
      if (battle.mode === 'survive') {
        setOver(battle, 'win', 'time');
      } else {
        const playerPct = p.hp / p.hpMax;
        const enemyRatio = e.hp / e.hpMax;
        setOver(battle, playerPct > enemyRatio ? 'win' : 'lose', 'time');
      }
    }
  }

  pushLog(battle, logLines);
  ev.over = battle.over;
  return { round: ev };
}

function levelOf(ratio) {
  if (ratio < 0.07) return 'leve';
  if (ratio < 0.13) return 'médio';
  return 'forte';
}

/** Estado enviado ao cliente (sem seed). */
export function publicBattle(battle, n) {
  const def = ENEMIES[battle.enemyKey];
  const p = battle.player;
  const e = battle.enemy;
  const move = intentFor(battle, def);
  const weak = weaknessOf(def.element);
  const estimate = move.power * e.atk * (e.weaken > 0 ? WEAKEN_CUT : 1);

  const jutsus = learnedJutsus(n).map((jutsu) => {
    const view = jutsuView(jutsu);
    const effect = effectOf(jutsu.category);
    const mu = matchup(view.element, def.element);
    const cost = costOf(jutsu);
    const base = baseDamage(n, jutsu);
    let expected = 0;
    let preview = EFFECT_LABEL[effect];
    if (effect === 'heal') {
      expected = Math.round(base * 1.3);
      preview = `Cura ~${expected}`;
    } else {
      expected = Math.round(base * EFFECT_DAMAGE_MULT[effect] * mu.mult * p.boost);
      preview = effect === 'damage' || effect === 'crit' || effect === 'aegis'
        ? `~${expected} dano`
        : `${EFFECT_LABEL[effect]} · ~${expected}`;
    }
    return {
      ...view,
      cost,
      effect,
      tag: mu.tag,
      expected,
      preview,
      usable: !battle.over && p.chakra >= cost,
    };
  }).sort((a, b) => (
    Number(b.usable) - Number(a.usable)
    || Number(b.tag === 'advantage') - Number(a.tag === 'advantage')
    || Number(a.tag === 'resist') - Number(b.tag === 'resist')
    || b.expected - a.expected
    || a.name.localeCompare(b.name, 'pt-BR')
  )).slice(0, 60);

  const eye = ownedEye(n);

  return {
    round: battle.round,
    maxRounds: battle.maxRounds,
    mode: battle.mode,
    winAtEnemyPct: battle.winAtEnemyPct,
    mustUseJutsu: battle.mustUseJutsu,
    usedJutsu: battle.usedJutsu,
    player: {
      hp: p.hp,
      hpMax: p.hpMax,
      chakra: p.chakra,
      chakraMax: p.chakraMax,
    },
    enemy: {
      key: battle.enemyKey,
      name: def.name,
      title: def.title,
      sprite: def.sprite,
      element: def.element,
      elementLabel: elementLabel(def.element),
      weak,
      weakLabel: elementLabel(weak),
      hp: e.hp,
      hpMax: e.hpMax,
      stunned: e.stun > 0,
      weakened: e.weaken > 0,
      intent: {
        name: move.name,
        element: move.element || null,
        elementLabel: elementLabel(move.element),
        fx: move.element || move.fx || 'taijutsu',
        level: levelOf(estimate / p.hpMax),
      },
    },
    log: battle.log || [],
    actions: {
      strike: { dmg: Math.round(strikeDamage(n) * p.boost) },
      guard: { regen: GUARD_REGEN },
      eye: eye
        ? { label: eye.label, cost: EYE_COST, usable: !battle.over && p.chakra >= EYE_COST }
        : null,
      jutsus,
    },
    over: battle.over || null,
  };
}

/** Dica personalizada depois de uma derrota. */
export function battleHint(battle, n, staticHint = '') {
  const def = ENEMIES[battle.enemyKey];
  const tips = [];
  if (battle.over?.reason === 'nojutsu') {
    tips.push('Esta prova exige pelo menos um jutsu: use um antes de acabar.');
  }
  const weak = weaknessOf(def.element);
  // Em lutas de sobrevivência o elemento importa pouco: a dica certa é guarda e esquiva.
  if (weak && battle.mode !== 'survive') {
    const hasWeak = learnedJutsus(n).some((jutsu) => elementOfJutsu(jutsu) === weak);
    tips.push(hasWeak
      ? `${def.name} é fraco contra ${elementLabel(weak)}: use seus jutsus desse elemento.`
      : `Aprenda um jutsu de ${elementLabel(weak)}: é a fraqueza de ${def.name}.`);
  }
  if (!battle.stats?.guards && battle.over?.result === 'lose') {
    tips.push('Use Guarda antes dos golpes fortes: corta 60% do dano e devolve chakra.');
  }
  const combined = [tips[0], staticHint].filter(Boolean).join(' ');
  return combined || tips.join(' ');
}
