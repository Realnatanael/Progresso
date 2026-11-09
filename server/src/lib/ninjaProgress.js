import {
  AFFINITY_ROLL_COST,
  AFFINITY_ROLL_TABLE,
  CHAKRA_MAX,
  NATURES,
  NINJA_CATALOG,
  PERFECT_DAY_POINTS,
  POINTS_TO_CHAKRA_COST,
  POINTS_TO_CHAKRA_GAIN,
  RANK_ORDER,
  RANK_UP,
  STAT_MAX,
  catalogById,
  defaultNinjaState,
  surnameFromFullName,
} from '../data/ninjaCatalog.js';
import {
  BIJUU_POOL,
  JINCHUURIKI_COST,
  SENNIN_PATHS,
} from '../data/pathsCatalog.js';
import { buildStoryProgress } from '../data/storyRoadmap.js';
import { resolveActiveEye } from './ninjaAvatarLook.js';
import { publicDailyMission } from './dailyMission.js';

export function ensureNinja(user) {
  if (!user.ninja || typeof user.ninja !== 'object') {
    user.ninja = defaultNinjaState();
  }
  const n = user.ninja;
  if (!Array.isArray(n.learnedJutsuIds)) n.learnedJutsuIds = [];
  if (!Array.isArray(n.unlockedKekkeiIds)) n.unlockedKekkeiIds = [];
  if (!Array.isArray(n.unlockedBijuuIds)) n.unlockedBijuuIds = [];
  if (!Array.isArray(n.natures)) n.natures = [];
  if (!Array.isArray(n.waterDates)) n.waterDates = [];
  if (!Array.isArray(n.perfectDates)) n.perfectDates = [];
  if (!n.workoutPicks || typeof n.workoutPicks !== 'object') n.workoutPicks = {};
  if (n.jinchuuriki === undefined) n.jinchuuriki = null;
  if (n.senninPath === undefined) n.senninPath = null;
  if (!n.story || typeof n.story !== 'object') {
    n.story = {
      completedChapterIds: [],
      activeBeat: null,
      cachedBeat: null,
      retryAfter: null,
      lastOutcome: null,
      choiceHistory: [],
    };
  }
  if (!Array.isArray(n.story.completedChapterIds)) n.story.completedChapterIds = [];
  if (!Array.isArray(n.story.choiceHistory)) n.story.choiceHistory = [];
  if (n.story.cachedBeat === undefined) n.story.cachedBeat = null;
  if (n.story.retryAfter === undefined) n.story.retryAfter = null;
  if (n.dailyMission === undefined) n.dailyMission = null;

  // Clã = sobrenome da pessoa
  const surname = surnameFromFullName(user.name);
  if (surname && (!n.clanName || n.clanNameSyncedFromName !== false)) {
    n.clanName = surname;
    n.clanNameSyncedFromName = true;
  }

  n.needsFirstNature = (n.natures || []).length === 0;
  return n;
}

export function publicNinja(user) {
  const n = ensureNinja(user);
  const sennin = n.senninPath
    ? SENNIN_PATHS.find((p) => p.id === n.senninPath) || null
    : null;
  return {
    clanName: n.clanName || '',
    displayName: user.name || '',
    rank: n.rank || 'academy',
    rankLabel: rankLabelOf(n.rank),
    chakra: n.chakra || 0,
    chakraMax: CHAKRA_MAX,
    ninjutsu: n.ninjutsu || 0,
    genjutsu: n.genjutsu || 0,
    taijutsu: n.taijutsu || 0,
    statMax: STAT_MAX,
    unlockPoints: n.unlockPoints || 0,
    pointsToChakraCost: POINTS_TO_CHAKRA_COST,
    pointsToChakraGain: POINTS_TO_CHAKRA_GAIN,
    canConvertPointsToChakra: (n.unlockPoints || 0) >= POINTS_TO_CHAKRA_COST
      && (n.chakra || 0) < CHAKRA_MAX,
    natures: [...(n.natures || [])],
    natureLabels: (n.natures || []).map((id) => formatNatureLabel(id)),
    needsFirstNature: (n.natures || []).length === 0,
    learnedJutsuIds: [...(n.learnedJutsuIds || [])],
    unlockedKekkeiIds: [...(n.unlockedKekkeiIds || [])],
    unlockedBijuuIds: [...(n.unlockedBijuuIds || [])],
    kekkeiLabels: (n.unlockedKekkeiIds || [])
      .map((id) => catalogById(id)?.name)
      .filter(Boolean),
    jinchuuriki: n.jinchuuriki || null,
    senninPath: n.senninPath || null,
    sennin: sennin
      ? { id: sennin.id, name: sennin.name, buff: sennin.buff, limit: sennin.limit }
      : null,
    pendingStatPick: n.pendingStatPick || null,
    story: buildStoryProgress(n, catalogById),
    dailyMission: decorateDailyMission(n),
    nextRank: nextRankInfo(n),
    avatarReady: Boolean(n.avatarReady),
    avatarUrl: n.avatarReady ? '/api/ninja/avatar' : null,
    avatarUpdatedAt: n.avatarUpdatedAt || null,
    activeEye: resolveActiveEye(n),
    affinityRollCost: AFFINITY_ROLL_COST,
    canAffinityRoll: (n.natures || []).length === 0
      && (n.unlockPoints || 0) >= AFFINITY_ROLL_COST,
    jinchuurikiCost: JINCHUURIKI_COST,
    canJinchuurikiRoll: canRollJinchuuriki(n).ok === true,
  };
}

function formatNatureLabel(id) {
  const nat = NATURES.find((x) => x.id === id);
  if (!nat) return id;
  return `${nat.label} (${nat.release})`;
}

function decorateDailyMission(n) {
  const mission = publicDailyMission(n.dailyMission);
  if (!mission) return null;
  const hasJutsus = (n.learnedJutsuIds || []).length > 0;
  return {
    ...mission,
    choices: (mission.choices || []).map((choice) => ({
      ...choice,
      locked: Boolean(choice.requiresJutsu && !hasJutsus),
    })),
  };
}

function rankLabelOf(rank) {
  if (rank === 'genin') return 'Genin';
  if (rank === 'chuunin') return 'Chuunin';
  if (rank === 'jounin') return 'Jounin';
  return 'Academia';
}

function nextRankInfo(n) {
  const map = {
    academy: RANK_UP.academy_to_genin,
    genin: RANK_UP.genin_to_chuunin,
    chuunin: RANK_UP.chuunin_to_jounin,
  };
  const rule = map[n.rank];
  if (!rule) return null;
  return {
    id: rule.to,
    label: rankLabelOf(rule.to),
    requires: rule.requires,
    ready: meetsRankUp(n, rule.requires),
  };
}

function meetsRankUp(n, req) {
  const statsSum = (n.ninjutsu || 0) + (n.genjutsu || 0) + (n.taijutsu || 0);
  const learned = (n.learnedJutsuIds || []).length;
  const natures = (n.natures || []).length;
  return (n.chakra || 0) >= (req.chakra || 0)
    && learned >= (req.learnedJutsus || 0)
    && statsSum >= (req.statsSum || 0)
    && natures >= (req.natures || 0);
}

/** Promoções de patente exigem capítulo de história concluído + requisitos. */
const RANK_STORY_GATE = {
  academy_to_genin: 'genin_graduation',
  genin_to_chuunin: 'chuunin_finals',
  chuunin_to_jounin: 'jounin_promotion',
};

export function applyRankUps(n) {
  const promoted = [];
  const completed = new Set(n.story?.completedChapterIds || []);
  const chain = [
    { key: 'academy_to_genin', rule: RANK_UP.academy_to_genin },
    { key: 'genin_to_chuunin', rule: RANK_UP.genin_to_chuunin },
    { key: 'chuunin_to_jounin', rule: RANK_UP.chuunin_to_jounin },
  ];
  for (const { key, rule } of chain) {
    if (!rule) continue;
    const storyChapter = RANK_STORY_GATE[key];
    if (n.rank === rule.from
      && meetsRankUp(n, rule.requires)
      && (!storyChapter || completed.has(storyChapter))) {
      n.rank = rule.to;
      promoted.push(rule.to);
    }
  }
  return promoted;
}

export function syncDayAwards(n, date, dayFlags) {
  const changes = [];
  ensureAwardCollections(n);

  const hasWater = n.waterDates.includes(date);
  if (dayFlags.waterDone && !hasWater) {
    if ((n.chakra || 0) < CHAKRA_MAX) {
      n.chakra = Math.min(CHAKRA_MAX, (n.chakra || 0) + 1);
      n.waterDates.push(date);
      changes.push({ type: 'chakra', delta: +1, date });
    }
  } else if (!dayFlags.waterDone && hasWater) {
    n.chakra = Math.max(0, (n.chakra || 0) - 1);
    n.waterDates = n.waterDates.filter((d) => d !== date);
    changes.push({ type: 'chakra', delta: -1, date });
  }

  const pick = n.workoutPicks[date];
  if (dayFlags.workoutDone && !pick) {
    n.workoutPicks[date] = 'pending';
    n.pendingStatPick = { date };
    changes.push({ type: 'pendingStat', date });
  } else if (!dayFlags.workoutDone && pick) {
    if (pick !== 'pending' && ['ninjutsu', 'genjutsu', 'taijutsu'].includes(pick)) {
      n[pick] = Math.max(0, (n[pick] || 0) - 1);
      changes.push({ type: 'stat', stat: pick, delta: -1, date });
    }
    delete n.workoutPicks[date];
    if (n.pendingStatPick?.date === date) n.pendingStatPick = null;
    changes.push({ type: 'workoutCleared', date });
  } else if (dayFlags.workoutDone && pick === 'pending') {
    n.pendingStatPick = { date };
  }

  const hasPerfect = n.perfectDates.includes(date);
  if (dayFlags.perfectDone && !hasPerfect) {
    n.unlockPoints = (n.unlockPoints || 0) + PERFECT_DAY_POINTS;
    n.perfectDates.push(date);
    changes.push({ type: 'unlockPoints', delta: +PERFECT_DAY_POINTS, date });
  } else if (!dayFlags.perfectDone && hasPerfect) {
    n.unlockPoints = Math.max(0, (n.unlockPoints || 0) - PERFECT_DAY_POINTS);
    n.perfectDates = n.perfectDates.filter((d) => d !== date);
    changes.push({ type: 'unlockPoints', delta: -PERFECT_DAY_POINTS, date });
  }

  const promoted = applyRankUps(n);
  for (const rank of promoted) changes.push({ type: 'rankUp', rank });
  n.waterDates = trimDates(n.waterDates, 400);
  n.perfectDates = trimDates(n.perfectDates, 400);
  n.needsFirstNature = (n.natures || []).length === 0;
  return changes;
}

function ensureAwardCollections(n) {
  if (!Array.isArray(n.waterDates)) n.waterDates = [];
  if (!Array.isArray(n.perfectDates)) n.perfectDates = [];
  if (!n.workoutPicks || typeof n.workoutPicks !== 'object') n.workoutPicks = {};
}

function trimDates(list, max) {
  if (list.length <= max) return list;
  return [...list].sort().slice(-max);
}

export function pickStat(n, date, stat) {
  if (!['ninjutsu', 'genjutsu', 'taijutsu'].includes(stat)) {
    return { error: 'Escolha ninjutsu, genjutsu ou taijutsu.' };
  }
  ensureAwardCollections(n);
  if (n.workoutPicks[date] !== 'pending') {
    return { error: 'Não há ponto de treino pendente neste dia.' };
  }
  if ((n[stat] || 0) >= STAT_MAX) {
    return { error: 'Esse atributo já está no máximo.' };
  }
  n[stat] = (n[stat] || 0) + 1;
  n.workoutPicks[date] = stat;
  if (n.pendingStatPick?.date === date) n.pendingStatPick = null;
  applyRankUps(n);
  return { ok: true };
}

/** Troca pts de desbloqueio por chakra (padrão 3 → +1). */
export function convertPointsToChakra(n) {
  const cost = POINTS_TO_CHAKRA_COST;
  const gain = POINTS_TO_CHAKRA_GAIN;
  if ((n.unlockPoints || 0) < cost) {
    return { error: `Precisa de ${cost} pts para converter em chakra.` };
  }
  if ((n.chakra || 0) >= CHAKRA_MAX) {
    return { error: 'Chakra já está no máximo.' };
  }
  n.unlockPoints = (n.unlockPoints || 0) - cost;
  n.chakra = Math.min(CHAKRA_MAX, (n.chakra || 0) + gain);
  applyRankUps(n);
  return {
    ok: true,
    spent: cost,
    gained: gain,
    unlockPoints: n.unlockPoints,
    chakra: n.chakra,
  };
}

function ownedIds(n) {
  const ids = [
    ...(n.learnedJutsuIds || []),
    ...(n.unlockedKekkeiIds || []),
    ...(n.unlockedBijuuIds || []),
    ...(n.natures || []).map((nat) => `nature-${nat}`),
    ...(n.natures || []).map((nat) => `nature2-${nat}`),
  ];
  if (n.senninPath) ids.push(n.senninPath);
  if (n.jinchuuriki?.bijuuId) ids.push(`bijuu-${n.jinchuuriki.bijuuId}`);
  return new Set(ids);
}

function canRollJinchuuriki(n) {
  if (n.jinchuuriki?.bijuuId) return { ok: false, error: 'Você já é jinchūriki.' };
  if (n.senninPath) return { ok: false, error: 'Quem já é sennin não sela bijū.' };
  if ((RANK_ORDER[n.rank] ?? 0) < (RANK_ORDER.jounin ?? 3)) {
    return { ok: false, error: 'Só Jounin pode selar uma bijū.' };
  }
  if ((n.chakra || 0) < 160) return { ok: false, error: 'Precisa de chakra 160.' };
  if ((n.unlockPoints || 0) < JINCHUURIKI_COST) {
    return { ok: false, error: `Precisa de ${JINCHUURIKI_COST} pts.` };
  }
  return { ok: true };
}

/** Sela uma bijū aleatória — buffs e limitações vêm junto. */
export function rollJinchuuriki(n) {
  const gate = canRollJinchuuriki(n);
  if (!gate.ok) return { error: gate.error };

  const bijuu = BIJUU_POOL[Math.floor(Math.random() * BIJUU_POOL.length)];
  n.unlockPoints = (n.unlockPoints || 0) - JINCHUURIKI_COST;
  n.jinchuuriki = {
    bijuuId: bijuu.id,
    name: bijuu.name,
    tails: bijuu.tails,
    buff: bijuu.buff,
    limit: bijuu.limit,
    sealedAt: new Date().toISOString(),
  };
  if (!n.unlockedBijuuIds) n.unlockedBijuuIds = [];
  const ecoId = `bijuu-${bijuu.id}`;
  if (!n.unlockedBijuuIds.includes(ecoId)) n.unlockedBijuuIds.push(ecoId);
  applyRankUps(n);
  return { ok: true, jinchuuriki: n.jinchuuriki };
}

function missingForItem(n, item) {
  const missing = [];
  const userRank = RANK_ORDER[n.rank] ?? 0;
  const needRank = RANK_ORDER[item.rankMin] ?? 0;
  const req = item.requires || {};
  const owned = ownedIds(n);
  const natures = new Set(n.natures || []);

  if (item.firstNatureOnly && (n.natures || []).length > 0) {
    missing.push('já tem natureza');
  }
  if (item.kind === 'nature' && !item.firstNatureOnly && natures.has(item.natureId)) {
    missing.push('já possui');
  }
  if (userRank < needRank) missing.push(`rank ${item.rankMin}`);
  if ((n.chakra || 0) < (req.chakra || 0)) missing.push(`chakra ${req.chakra}`);
  if ((n.ninjutsu || 0) < (req.ninjutsu || 0)) missing.push(`ninjutsu ${req.ninjutsu}`);
  if ((n.genjutsu || 0) < (req.genjutsu || 0)) missing.push(`genjutsu ${req.genjutsu}`);
  if ((n.taijutsu || 0) < (req.taijutsu || 0)) missing.push(`taijutsu ${req.taijutsu}`);
  if ((n.unlockPoints || 0) < (item.costUnlockPoints || 0)) {
    missing.push(`${item.costUnlockPoints} pts`);
  }
  for (const need of item.requiresNatures || []) {
    if (!natures.has(need)) {
      const label = NATURES.find((x) => x.id === need)?.label || need;
      missing.push(`natureza ${label}`);
    }
  }
  for (const needId of item.requiresIds || []) {
    if (!owned.has(needId) && !(n.learnedJutsuIds || []).includes(needId)
      && !(n.unlockedKekkeiIds || []).includes(needId)
      && !(n.unlockedBijuuIds || []).includes(needId)) {
      const dep = catalogById(needId);
      missing.push(dep ? dep.name : needId);
    }
  }
  if (item.requiresJinchuuriki) {
    const sealed = n.jinchuuriki?.bijuuId || null;
    if (!sealed) {
      missing.push('ser jinchūriki');
    } else if (item.requiresJinchuuriki !== true && item.requiresJinchuuriki !== sealed) {
      missing.push(`bijū ${item.requiresJinchuuriki}`);
    }
  }
  if (item.requiresSennin) {
    if (!n.senninPath) {
      missing.push('caminho sennin');
    } else if (item.requiresSennin !== true && item.requiresSennin !== n.senninPath) {
      missing.push(`sennin ${item.requiresSennin}`);
    }
  }
  return missing;
}

export function tryUnlock(n, catalogId) {
  const item = catalogById(catalogId);
  if (!item) return { error: 'Item não encontrado.' };

  if (item.kind === 'nature' && item.firstNatureOnly && (n.natures || []).length > 0) {
    return { error: 'Você já escolheu sua primeira natureza.' };
  }
  if (item.kind === 'nature' && (n.natures || []).includes(item.natureId)) {
    return { error: 'Você já tem essa natureza.' };
  }
  if (item.kind === 'jutsu' && (n.learnedJutsuIds || []).includes(item.id)) {
    return { error: 'Você já aprendeu esse jutsu.' };
  }
  if (item.kind === 'kekkei' && (n.unlockedKekkeiIds || []).includes(item.id)) {
    return { error: 'Você já desbloqueou isso.' };
  }
  if (item.kind === 'bijuu' && (n.unlockedBijuuIds || []).includes(item.id)) {
    return { error: 'Você já desbloqueou isso.' };
  }
  if (item.kind === 'sennin') {
    if (n.senninPath) return { error: 'Você já escolheu um caminho sennin.' };
    if (n.jinchuuriki?.bijuuId) return { error: 'Jinchūriki não pode estudar senjutsu.' };
  }

  const missing = missingForItem(n, item);
  // "já tem" / "já possui" are hard locks; pts/chakra etc. also block
  if (missing.length) {
    return { error: `Falta: ${missing.join(' · ')}` };
  }

  n.unlockPoints = (n.unlockPoints || 0) - (item.costUnlockPoints || 0);

  if (item.kind === 'nature') {
    if (!n.natures) n.natures = [];
    if (!n.natures.includes(item.natureId)) n.natures.push(item.natureId);
    n.needsFirstNature = false;
  } else if (item.kind === 'jutsu') {
    n.learnedJutsuIds.push(item.id);
  } else if (item.kind === 'kekkei') {
    n.unlockedKekkeiIds.push(item.id);
  } else if (item.kind === 'bijuu') {
    n.unlockedBijuuIds.push(item.id);
  } else if (item.kind === 'sennin') {
    n.senninPath = item.id;
  }

  applyRankUps(n);
  return { ok: true, item };
}

/** Sorteia afinidade rara no lugar do 1º elemento básico. */
export function rollFirstAffinity(n) {
  if ((n.natures || []).length > 0) {
    return { error: 'Você já escolheu sua afinidade.' };
  }
  if ((n.unlockPoints || 0) < AFFINITY_ROLL_COST) {
    return { error: `Precisa de ${AFFINITY_ROLL_COST} pts para invocar afinidade rara.` };
  }

  const pick = weightedPick(AFFINITY_ROLL_TABLE);
  if (!pick) return { error: 'Tabela de sorte vazia.' };

  n.unlockPoints = (n.unlockPoints || 0) - AFFINITY_ROLL_COST;

  if (pick.kind === 'nature') {
    if (!n.natures) n.natures = [];
    if (!n.natures.includes(pick.natureId)) n.natures.push(pick.natureId);
    n.needsFirstNature = false;
    applyRankUps(n);
    return {
      ok: true,
      result: {
        kind: 'nature',
        natureId: pick.natureId,
        label: formatNatureLabel(pick.natureId),
      },
    };
  }

  const item = catalogById(pick.id);
  if (!item) return { error: 'Fusão sorteada inválida.' };

  if (!n.natures) n.natures = [];
  const grantedNatures = [];
  for (const nat of item.requiresNatures || []) {
    if (!n.natures.includes(nat)) {
      n.natures.push(nat);
      grantedNatures.push(nat);
    }
  }
  if (!n.unlockedKekkeiIds) n.unlockedKekkeiIds = [];
  if (!n.unlockedKekkeiIds.includes(item.id)) n.unlockedKekkeiIds.push(item.id);
  n.needsFirstNature = false;
  applyRankUps(n);

  return {
    ok: true,
    result: {
      kind: 'kekkei',
      id: item.id,
      name: item.name,
      grantedNatures: grantedNatures.map(formatNatureLabel),
    },
  };
}

function weightedPick(table) {
  const total = table.reduce((sum, row) => sum + (row.weight || 0), 0);
  if (total <= 0) return null;
  let ticket = Math.random() * total;
  for (const row of table) {
    ticket -= row.weight || 0;
    if (ticket <= 0) return row;
  }
  return table[table.length - 1];
}

export function catalogForUser(n) {
  const hasNature = (n.natures || []).length > 0;
  return NINJA_CATALOG.map((item) => {
    let isOwned = false;
    if (item.kind === 'nature') {
      isOwned = (n.natures || []).includes(item.natureId);
    } else if (item.kind === 'jutsu') {
      isOwned = (n.learnedJutsuIds || []).includes(item.id);
    } else if (item.kind === 'kekkei') {
      isOwned = (n.unlockedKekkeiIds || []).includes(item.id);
    } else if (item.kind === 'bijuu') {
      isOwned = (n.unlockedBijuuIds || []).includes(item.id);
    } else if (item.kind === 'sennin') {
      isOwned = n.senninPath === item.id;
    }

    // Oculta 1ª natureza após escolha; oculta 2ª natureza se já tem o elemento
    // Oculta outros caminhos sennin se já escolheu um
    const hidden = Boolean(
      (item.firstNatureOnly && hasNature)
      || (item.kind === 'nature' && !item.firstNatureOnly && (n.natures || []).includes(item.natureId))
      || (item.kind === 'sennin' && n.senninPath && n.senninPath !== item.id)
      || (item.kind === 'sennin' && n.jinchuuriki?.bijuuId),
    );

    const missing = isOwned || hidden ? [] : missingForItem(n, item);
    return {
      ...item,
      owned: isOwned,
      hidden,
      locked: !isOwned && !hidden && missing.length > 0,
      canUnlock: !isOwned && !hidden && missing.length === 0,
      missing,
    };
  }).filter((item) => !item.hidden);
}
