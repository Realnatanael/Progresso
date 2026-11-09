/**
 * Motor do Modo História: capítulos com várias cenas, escolhas personalizadas,
 * falha com dica e batalhas por turnos.
 */
import { CHAKRA_MAX, catalogById } from '../data/ninjaCatalog.js';
import { chapterById } from '../data/storyRoadmap.js';
import { chapterScript } from '../data/storyScript.js';
import { shiftDate, todayISO } from './dates.js';
import { applyRankUps } from './ninjaProgress.js';
import { battleHint, createBattle, publicBattle, resolveRound } from './storyBattle.js';
import { FX_FLAIR } from './storyElements.js';
import {
  beatOf,
  choiceStateFor,
  eligibleJutsus,
  fill,
  isChoiceVisible,
  natureElementFx,
  playerContext,
  templateChoices,
} from './storyPersonalize.js';
import {
  STORY_VERSION,
  currentChapter,
  ensureStoryState,
  lockStatus,
  progressFor,
  recordFailSnapshot,
} from './storyState.js';

export function storyContext(n) {
  return { chapter: currentChapter(n), jutsuCount: (n.learnedJutsuIds || []).length };
}

export function canStartStoryBeat(n, today = todayISO()) {
  const state = ensureStoryState(n);
  const { chapter, jutsuCount } = storyContext(n);
  if (!chapter) return { ok: false, error: 'Você já concluiu toda a jornada.' };
  if (state.activeBeat) return { ok: true, reuse: true };
  if (!chapterScript(chapter.id).length) return { ok: false, error: 'Este capítulo ainda não tem roteiro.' };

  const progress = state.progress?.chapterId === chapter.id ? state.progress : null;
  const fresh = !progress || progress.beatIndex === 0;
  if (fresh) {
    const goalsOk = (chapter.goals || []).every((goal) => Boolean(goal.check(n, catalogById)));
    if (!goalsOk) return { ok: false, error: 'Ainda faltam requisitos deste capítulo.' };
    const need = chapter.advanceRequiresJutsus || 0;
    // Provas que pedem jutsu podem ser tentadas sem técnica: a cena é que trava o avanço.
    if (jutsuCount < need && !chapter.successNeedsJutsu) {
      return { ok: false, error: `Aprenda pelo menos ${need} jutsu(s) antes de avançar.` };
    }
  }

  const lock = lockStatus(n, today);
  if (lock.locked) {
    return {
      ok: false,
      error: 'Você já tentou esta cena hoje. Evolua (novo jutsu ou atributo) ou volte amanhã.',
      retryAfter: lock.retryAfter,
    };
  }
  return { ok: true, reuse: false };
}

function makeActiveBeat(n, chapter, progress) {
  const beat = chapterScript(chapter.id)[progress.beatIndex];
  const active = {
    v: STORY_VERSION,
    chapterId: chapter.id,
    beatId: beat.id,
    beatIndex: progress.beatIndex,
    startedAt: new Date().toISOString(),
    spent: [...(progress.failed?.[beat.id] || [])],
  };
  if (beat.type === 'battle') active.battle = createBattle(beat, n, progress.flags);
  return active;
}

export function startStoryBeat(n, { today = todayISO() } = {}) {
  const gate = canStartStoryBeat(n, today);
  if (!gate.ok) return gate;
  const state = ensureStoryState(n);
  if (gate.reuse && state.activeBeat) return { ok: true, reused: true };

  const { chapter } = storyContext(n);
  const progress = progressFor(state, chapter.id);
  state.activeBeat = makeActiveBeat(n, chapter, progress);
  state.retryAfter = null;
  return { ok: true, reused: false };
}

function applyRewards(n, rewards) {
  if (rewards.unlockPoints) n.unlockPoints = (n.unlockPoints || 0) + rewards.unlockPoints;
  if (rewards.chakra) n.chakra = Math.min(CHAKRA_MAX, (n.chakra || 0) + rewards.chakra);
}

/** Paga a recompensa da escolha uma única vez por cena (evita farmar repetindo a tentativa). */
function grantReward(n, progress, key, reward = {}) {
  const rewards = { unlockPoints: 0, chakra: 0 };
  if (!reward || progress.rewarded.includes(key)) return rewards;
  rewards.unlockPoints = Number(reward.pts) || 0;
  rewards.chakra = Number(reward.ck) || 0;
  if (rewards.unlockPoints || rewards.chakra) {
    progress.rewarded.push(key);
    applyRewards(n, rewards);
  }
  return rewards;
}

function toFlags(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/** Resolve o resultado de uma escolha (considerando o jutsu escolhido, quando houver). */
function resolveChoice(n, choice, { jutsuId, ctx }) {
  const out = {
    result: choice.result || 'ok',
    say: choice.say,
    hint: choice.hint || null,
    fx: null,
    flags: [],
    lock: Boolean(choice.lock),
    vars: {},
    plain: true,
  };

  if (choice.kind === 'jutsu') {
    out.plain = false;
    const picked = eligibleJutsus(n, choice.filter).find((item) => item.id === jutsuId);
    if (!picked) return { error: 'Escolha um dos seus jutsus.' };
    out.fx = picked.fx;
    out.vars = { jutsu: picked.name, flair: FX_FLAIR[picked.fx] || '' };
    out.jutsuName = picked.name;

    const hasRules = Boolean(choice.works?.length || choice.weak?.length);
    if (hasRules) {
      if (choice.works?.includes(picked.element)) {
        out.flags.push(...toFlags(choice.flagWorks));
      } else if (choice.weak?.includes(picked.element)) {
        if (choice.weakFails) {
          out.result = 'fail';
          out.say = choice.failSay || choice.say;
          out.hint = choice.failHint || 'Tente outro jutsu.';
          out.lock = !choice.softFail;
        } else {
          out.say = choice.weakSay || choice.say;
          out.flags.push(...toFlags(choice.flagWeak));
        }
      } else if (choice.strict) {
        out.result = 'fail';
        out.say = choice.failSay || choice.say;
        out.hint = choice.failHint || 'Tente outro jutsu.';
        out.lock = !choice.softFail;
      }
    }
  } else if (choice.kind === 'eye') {
    out.plain = false;
    out.fx = 'dojutsu';
    out.vars = { flair: FX_FLAIR.dojutsu };
  } else if (choice.kind === 'nature') {
    out.plain = false;
    out.fx = natureElementFx(n);
    out.vars = { flair: FX_FLAIR[out.fx] || '' };
  }

  if (out.result !== 'fail') out.flags.push(...toFlags(choice.flag));
  out.say = fill(out.say, ctx, out.vars);
  if (out.hint) out.hint = fill(out.hint, ctx, out.vars);
  return out;
}

function pushHistory(state, entry) {
  state.choiceHistory = [...(state.choiceHistory || []), { at: new Date(), kind: 'story', ...entry }].slice(-40);
}

function baseOutcome({ chapter, beat, active, say, hint = null, result, fx = null }) {
  return {
    at: new Date().toISOString(),
    result,
    say,
    hint,
    fx,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    beatId: beat.id,
    beatIndex: active.beatIndex,
    beatTotal: chapterScript(chapter.id).length,
    rewards: { unlockPoints: 0, chakra: 0 },
    chapterDone: false,
    chapterRewards: null,
    promoted: null,
    locked: false,
    retryAfter: null,
    canRetryNow: false,
    nextKind: null,
  };
}

/** Avança a cena (ou fecha o capítulo, aplicando recompensa e promoção de patente). */
function completeBeat({ n, state, chapter, progress, beat, outcome }) {
  delete progress.failed[beat.id];
  progress.beatIndex += 1;
  const script = chapterScript(chapter.id);

  if (progress.beatIndex >= script.length) {
    const reward = chapter.rewardOnAdvance || {};
    const chapterRewards = {
      unlockPoints: Number(reward.unlockPoints) || 0,
      chakra: Number(reward.chakra) || 0,
    };
    applyRewards(n, chapterRewards);
    if (!state.completedChapterIds.includes(chapter.id)) state.completedChapterIds.push(chapter.id);
    state.progress = null;
    state.activeBeat = null;
    state.retryAfter = null;
    state.failSnapshot = null;
    const promoted = applyRankUps(n);
    outcome.chapterDone = true;
    outcome.chapterRewards = chapterRewards;
    outcome.promoted = promoted.length ? promoted[promoted.length - 1] : null;
    return;
  }

  state.activeBeat = makeActiveBeat(n, chapter, progress);
  state.retryAfter = null;
  outcome.nextKind = script[progress.beatIndex].type;
}

/** Falha pesada: fecha a cena e trava até amanhã (ou até evoluir). */
function hardFail({ n, state, today, outcome }) {
  state.activeBeat = null;
  state.retryAfter = shiftDate(today, 1);
  recordFailSnapshot(n);
  outcome.locked = !state.testMode;
  outcome.canRetryNow = Boolean(state.testMode);
  outcome.retryAfter = state.retryAfter;
}

export function chooseStoryOption(
  n,
  { choiceId, jutsuId = null, beatId = null } = {},
  { displayName = '', today = todayISO() } = {},
) {
  const state = ensureStoryState(n);
  const active = state.activeBeat;
  if (!active) return { error: 'Não há cena aberta. Toque em Avançar primeiro.' };
  if (beatId && beatId !== active.beatId) return { error: 'Essa cena já foi resolvida.' };

  const beat = beatOf(active);
  if (!beat) {
    state.activeBeat = null;
    return { error: 'Cena indisponível. Abra a história de novo.' };
  }
  if (beat.type !== 'scene') return { error: 'Esta cena é uma batalha.' };

  const choice = templateChoices(beat).find((item) => item.id === choiceId);
  if (!choice || !isChoiceVisible(n, choice)) return { error: 'Escolha inválida.' };
  if ((active.spent || []).includes(choice.id)) return { error: 'Essa opção já foi usada.' };
  const gate = choiceStateFor(n, choice);
  if (gate.locked) return { error: gate.lockReason || 'Opção bloqueada.' };

  const chapter = chapterById(active.chapterId);
  const ctx = playerContext(n, displayName);
  const progress = progressFor(state, chapter.id);
  const resolved = resolveChoice(n, choice, { jutsuId, ctx });
  if (resolved.error) return { error: resolved.error };

  const outcome = baseOutcome({
    chapter,
    beat,
    active,
    say: resolved.say,
    hint: resolved.hint,
    result: resolved.result,
    fx: resolved.fx,
  });
  outcome.choiceLabel = fill(choice.label, ctx, { jutsu: resolved.jutsuName || 'um jutsu', flair: '' });

  if (resolved.result !== 'fail') {
    outcome.rewards = grantReward(n, progress, `${beat.id}:${choice.id}`, choice.reward);
    for (const flag of resolved.flags) progress.flags[flag] = true;
  }

  if (resolved.result === 'detour') {
    active.spent = [...(active.spent || []), choice.id];
    outcome.nextKind = 'scene';
  } else if (resolved.result === 'ok') {
    completeBeat({ n, state, chapter, progress, beat, outcome });
  } else {
    // fail
    if (resolved.plain) {
      progress.failed[beat.id] = [...new Set([...(progress.failed[beat.id] || []), choice.id])];
      active.spent = [...new Set([...(active.spent || []), choice.id])];
    }
    if (resolved.lock) {
      hardFail({ n, state, today, outcome });
    } else {
      outcome.canRetryNow = true;
      outcome.nextKind = 'scene';
    }
  }

  state.lastOutcome = outcome;
  pushHistory(state, {
    chapterId: chapter.id,
    beatId: beat.id,
    choiceId: choice.id,
    choiceLabel: outcome.choiceLabel,
    summary: outcome.say,
    result: outcome.result,
  });
  return { ok: true, outcome };
}

export function actStoryBattle(
  n,
  { action, jutsuId = null, round = null, beatId = null } = {},
  { displayName = '', today = todayISO() } = {},
) {
  const state = ensureStoryState(n);
  const active = state.activeBeat;
  if (!active) return { error: 'Não há batalha aberta.' };
  if (beatId && beatId !== active.beatId) return { error: 'Essa batalha já terminou.' };

  const beat = beatOf(active);
  if (!beat || beat.type !== 'battle' || !active.battle) return { error: 'Esta cena não é uma batalha.' };
  if (active.battle.over) return { error: 'A batalha já terminou.' };
  if (round && Number(round) !== active.battle.round) return { error: 'Essa rodada já foi resolvida.' };

  const step = resolveRound(active.battle, n, { action, jutsuId });
  if (step.error) return { error: step.error };

  if (!active.battle.over) {
    return { ok: true, round: step.round, battle: publicBattle(active.battle, n), outcome: null };
  }

  // Batalha terminou: monta o desfecho.
  const battle = active.battle;
  const finalBattle = publicBattle(battle, n);
  const chapter = chapterById(active.chapterId);
  const ctx = playerContext(n, displayName);
  const progress = progressFor(state, chapter.id);
  const won = battle.over.result === 'win';

  const outcome = baseOutcome({
    chapter,
    beat,
    active,
    say: fill(won ? beat.win : beat.lose, ctx),
    hint: won ? null : battleHint(battle, n, fill(beat.hint || '', ctx)),
    result: won ? 'ok' : 'fail',
    fx: null,
  });
  outcome.choiceLabel = 'Batalha';
  outcome.battle = { reason: battle.over.reason, round: battle.round };

  if (won) {
    outcome.rewards = grantReward(n, progress, `${beat.id}:battle`, beat.reward || { pts: 1 });
    completeBeat({ n, state, chapter, progress, beat, outcome });
  } else {
    hardFail({ n, state, today, outcome });
  }

  state.lastOutcome = outcome;
  pushHistory(state, {
    chapterId: chapter.id,
    beatId: beat.id,
    choiceId: 'battle',
    choiceLabel: `Batalha: ${finalBattle.enemy.name}`,
    summary: outcome.say,
    result: outcome.result,
  });
  return { ok: true, round: step.round, battle: finalBattle, outcome };
}
