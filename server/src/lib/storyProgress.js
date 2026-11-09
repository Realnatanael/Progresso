/** Visão pública do Modo História (enviada ao cliente dentro de `ninja.story`). */
import { STORY_CHAPTERS } from '../data/storyRoadmap.js';
import { chapterScript } from '../data/storyScript.js';
import { todayISO } from './dates.js';
import { playerContext, publicBeat } from './storyPersonalize.js';
import { ensureStoryState, lockStatus } from './storyState.js';

function publicOutcome(raw) {
  if (!raw) return null;
  if (raw.say || raw.result) return raw;
  // Formato antigo (IA): { blurb, advances }
  return {
    result: raw.advances ? 'ok' : 'fail',
    say: raw.blurb || '',
    hint: null,
    rewards: raw.rewards || { unlockPoints: 0, chakra: 0 },
  };
}

export function buildStoryProgress(n, catalogById, { displayName = '', today = todayISO() } = {}) {
  const state = ensureStoryState(n);
  const completed = new Set(state.completedChapterIds || []);

  const chapters = STORY_CHAPTERS.map((chapter) => {
    const goals = chapter.goals.map((goal) => ({
      id: goal.id,
      label: goal.label,
      done: Boolean(goal.check(n, catalogById)),
    }));
    return {
      id: chapter.id,
      title: chapter.title,
      blurb: chapter.blurb,
      rank: chapter.rank,
      goals,
      goalsComplete: goals.every((goal) => goal.done),
      complete: completed.has(chapter.id),
      successNeedsJutsu: Boolean(chapter.successNeedsJutsu),
      advanceRequiresJutsus: chapter.advanceRequiresJutsus || 0,
      beatCount: chapterScript(chapter.id).length,
    };
  });

  let currentIndex = chapters.findIndex((chapter) => !chapter.complete);
  if (currentIndex < 0) currentIndex = Math.max(0, chapters.length - 1);
  const current = chapters[currentIndex];
  const finished = completed.size >= chapters.length;

  const progress = current && state.progress?.chapterId === current.id ? state.progress : null;
  const beatIndex = progress?.beatIndex || 0;
  const fresh = beatIndex === 0;
  const jutsuCount = (n.learnedJutsuIds || []).length;
  const hardJutsuGate = fresh
    && (current?.advanceRequiresJutsus || 0) > jutsuCount
    && !current?.successNeedsJutsu;

  const lock = lockStatus(n, today);
  const hasActive = Boolean(state.activeBeat);
  const canAdvance = Boolean(
    current
    && !current.complete
    && current.beatCount > 0
    && (fresh ? current.goalsComplete : true)
    && !hardJutsuGate
    && !hasActive
    && !lock.locked,
  );

  const ctx = playerContext(n, displayName);

  return {
    chapters,
    currentId: current?.id || chapters[0]?.id,
    currentIndex,
    percent: Math.round((completed.size / Math.max(1, chapters.length)) * 100),
    canAdvance,
    canResume: Boolean(progress && beatIndex > 0 && !hasActive),
    lockedUntilTomorrow: Boolean(lock.locked && !hasActive),
    retryAfter: lock.locked ? lock.retryAfter : null,
    progress: progress && current
      ? { chapterId: current.id, beatIndex, beatTotal: current.beatCount }
      : null,
    activeBeat: hasActive ? publicBeat(n, state.activeBeat, ctx) : null,
    lastOutcome: publicOutcome(state.lastOutcome),
    finished,
    testMode: Boolean(state.testMode),
  };
}
