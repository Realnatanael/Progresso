/** Estado persistido do Modo História (`user.ninja.story`) e regras de trava de tentativa. */
import { STORY_CHAPTERS } from '../data/storyRoadmap.js';
import { chapterScript } from '../data/storyScript.js';

export const STORY_VERSION = 4;

export function ensureStoryState(n) {
  if (!n.story || typeof n.story !== 'object') n.story = {};
  const s = n.story;
  if (!Array.isArray(s.completedChapterIds)) s.completedChapterIds = [];
  if (!Array.isArray(s.choiceHistory)) s.choiceHistory = [];
  // Cena do formato antigo (IA, 3 escolhas fixas) não existe mais no novo motor.
  if (s.activeBeat && s.activeBeat.v !== STORY_VERSION) s.activeBeat = null;
  // Cena salva que não existe mais no roteiro (roteiro editado): descarta pra não travar o jogador.
  if (s.activeBeat && !chapterScript(s.activeBeat.chapterId).some((beat) => beat.id === s.activeBeat.beatId)) {
    s.activeBeat = null;
  }
  if (s.activeBeat === undefined) s.activeBeat = null;
  if (s.retryAfter === undefined) s.retryAfter = null;
  if (s.lastOutcome === undefined) s.lastOutcome = null;
  if (s.progress === undefined) s.progress = null;
  if (s.failSnapshot === undefined) s.failSnapshot = null;
  if (s.cachedBeat !== undefined) delete s.cachedBeat;
  if (s.rewardOnlyChapterId !== undefined) delete s.rewardOnlyChapterId;
  return s;
}

export function currentChapter(n) {
  const state = ensureStoryState(n);
  const done = new Set(state.completedChapterIds);
  return STORY_CHAPTERS.find((chapter) => !done.has(chapter.id)) || null;
}

/** Progresso do capítulo em andamento (cena atual, flags de decisões, recompensas já pagas). */
export function progressFor(state, chapterId) {
  if (!state.progress || state.progress.chapterId !== chapterId) {
    state.progress = { chapterId, beatIndex: 0, flags: {}, rewarded: [], failed: {} };
  }
  const p = state.progress;
  if (!p.flags || typeof p.flags !== 'object') p.flags = {};
  if (!Array.isArray(p.rewarded)) p.rewarded = [];
  if (!p.failed || typeof p.failed !== 'object') p.failed = {};
  if (!Number.isInteger(p.beatIndex) || p.beatIndex < 0) p.beatIndex = 0;
  return p;
}

function snapshotOf(n) {
  return {
    jutsus: (n.learnedJutsuIds || []).length,
    stats: (n.ninjutsu || 0) + (n.genjutsu || 0) + (n.taijutsu || 0),
    kekkei: (n.unlockedKekkeiIds || []).length,
  };
}

export function recordFailSnapshot(n) {
  ensureStoryState(n).failSnapshot = snapshotOf(n);
}

/**
 * Depois de uma falha "pesada" a história trava até amanhã.
 * Evoluir (novo jutsu, atributo ou dōjutsu) libera na hora. `testMode` nunca trava.
 */
export function lockStatus(n, today) {
  const state = ensureStoryState(n);
  if (state.testMode) return { locked: false };
  if (!state.retryAfter || state.retryAfter <= today) return { locked: false };
  const snap = state.failSnapshot;
  if (snap) {
    const now = snapshotOf(n);
    if (now.jutsus > snap.jutsus || now.stats > snap.stats || now.kekkei > snap.kekkei) {
      return { locked: false, improved: true };
    }
  }
  return { locked: true, retryAfter: state.retryAfter };
}
