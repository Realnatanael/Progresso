import {
  CHAKRA_MAX,
  NATURES,
  NINJA_CATALOG,
  PERFECT_DAY_POINTS,
  RANK_ORDER,
  RANK_UP,
  STAT_MAX,
  catalogById,
  defaultNinjaState,
  surnameFromFullName,
} from '../data/ninjaCatalog.js';

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
    natures: [...(n.natures || [])],
    natureLabels: (n.natures || []).map((id) => NATURES.find((x) => x.id === id)?.label || id),
    needsFirstNature: (n.natures || []).length === 0,
    learnedJutsuIds: [...(n.learnedJutsuIds || [])],
    unlockedKekkeiIds: [...(n.unlockedKekkeiIds || [])],
    unlockedBijuuIds: [...(n.unlockedBijuuIds || [])],
    pendingStatPick: n.pendingStatPick || null,
    nextRank: nextRankInfo(n),
    avatarReady: Boolean(n.avatarReady),
    avatarUrl: n.avatarReady ? '/api/ninja/avatar' : null,
    avatarUpdatedAt: n.avatarUpdatedAt || null,
  };
}

function rankLabelOf(rank) {
  if (rank === 'genin') return 'Genin';
  if (rank === 'chuunin') return 'Chuunin';
  if (rank === 'jounin') return 'Jounin';
  return 'Academia';
}

function nextRankInfo(n) {
  if (n.rank === 'academy') {
    const rule = RANK_UP.academy_to_genin;
    return {
      id: 'genin',
      label: 'Genin',
      requires: rule.requires,
      ready: meetsRankUp(n, rule.requires),
    };
  }
  return null;
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

export function applyRankUps(n) {
  const rule = RANK_UP.academy_to_genin;
  if (n.rank === rule.from && meetsRankUp(n, rule.requires)) {
    n.rank = rule.to;
    return true;
  }
  return false;
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

  if (applyRankUps(n)) changes.push({ type: 'rankUp', rank: n.rank });
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

function ownedIds(n) {
  return new Set([
    ...(n.learnedJutsuIds || []),
    ...(n.unlockedKekkeiIds || []),
    ...(n.unlockedBijuuIds || []),
    ...(n.natures || []).map((nat) => `nature-${nat}`),
    ...(n.natures || []).map((nat) => `nature2-${nat}`),
  ]);
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
  }

  applyRankUps(n);
  return { ok: true, item };
}

export function catalogForUser(n) {
  const hasNature = (n.natures || []).length > 0;
  return NINJA_CATALOG.map((item) => {
    const isOwned = item.kind === 'nature'
      ? (n.natures || []).includes(item.natureId)
      : item.kind === 'jutsu'
        ? (n.learnedJutsuIds || []).includes(item.id)
        : item.kind === 'kekkei'
          ? (n.unlockedKekkeiIds || []).includes(item.id)
          : (n.unlockedBijuuIds || []).includes(item.id);

    // Oculta 1ª natureza após escolha; oculta 2ª natureza se já tem o elemento
    const hidden = Boolean(
      (item.firstNatureOnly && hasNature)
      || (item.kind === 'nature' && !item.firstNatureOnly && (n.natures || []).includes(item.natureId)),
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
