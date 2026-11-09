/**
 * Personalização das cenas: resolve placeholders, escolhas com os jutsus/olhos/natureza do jogador
 * e monta a versão pública (sem revelar qual escolha dá certo).
 */
import { NATURES } from '../data/ninjaCatalog.js';
import { chapterScript } from '../data/storyScript.js';
import { chapterById } from '../data/storyRoadmap.js';
import { publicBattle } from './storyBattle.js';
import {
  FX_FLAIR,
  STAT_LABEL,
  elementFromNature,
  jutsuView,
  learnedJutsus,
  ownedEye,
  statValue,
} from './storyElements.js';
import { STORY_VERSION } from './storyState.js';

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];
const RANK_LABEL = { academy: 'Estudante', genin: 'Genin', chuunin: 'Chuunin', jounin: 'Jounin' };

export const TONE_LABELS = {
  coragem: 'Coragem',
  cautela: 'Cautela',
  astucia: 'Astúcia',
  jutsu: 'Jutsu',
  empatia: 'Empatia',
  provocacao: 'Provocação',
};

export function playerContext(n, displayName = '') {
  const first = String(displayName || '').trim().split(/\s+/)[0] || 'ninja';
  const nature = NATURES.find((item) => item.id === (n.natures || [])[0]);
  const eye = ownedEye(n);
  const signature = learnedJutsus(n)[0];
  return {
    vars: {
      name: first,
      clan: n.clanName || 'sem clã',
      nature: nature ? nature.label : 'ainda desconhecida',
      release: nature ? nature.release : '',
      rank: RANK_LABEL[n.rank] || 'Estudante',
      jutsu: signature ? signature.name : 'seu jutsu',
      eye: eye ? eye.label : '',
      flair: '',
    },
  };
}

export function fill(text, ctx, extra = {}) {
  const vars = { ...(ctx?.vars || {}), ...extra };
  return String(text || '').replace(/\{(\w+)\}/g, (match, key) => (
    vars[key] !== undefined && vars[key] !== null ? vars[key] : match
  ));
}

export function beatOf(active) {
  if (!active) return null;
  const script = chapterScript(active.chapterId);
  const byIndex = script[active.beatIndex];
  if (byIndex && byIndex.id === active.beatId) return byIndex;
  return script.find((beat) => beat.id === active.beatId) || null;
}

export function templateChoices(beat) {
  return (beat.choices || []).map((choice, index) => ({ ...choice, id: LETTERS[index] }));
}

function flagsOf(n) {
  return n.story?.progress?.flags || {};
}

export function isChoiceVisible(n, choice) {
  const flags = flagsOf(n);
  if (choice.whenFlag && !flags[choice.whenFlag]) return false;
  if (choice.unlessFlag && flags[choice.unlessFlag]) return false;
  if (choice.kind === 'eye' && !ownedEye(n, choice.eyes || null)) return false;
  return true;
}

export function eligibleJutsus(n, filter = null) {
  let list = learnedJutsus(n).map(jutsuView);
  if (filter?.category?.length) list = list.filter((item) => filter.category.includes(item.category));
  if (filter?.element?.length) list = list.filter((item) => filter.element.includes(item.element));
  return list;
}

export function natureElementFx(n) {
  const first = (n.natures || [])[0];
  return elementFromNature(first) || 'spirit';
}

function choiceState(n, choice) {
  if (choice.kind === 'jutsu') {
    const options = eligibleJutsus(n, choice.filter);
    return {
      locked: options.length === 0,
      lockReason: choice.lockReason || 'Precisa de um jutsu',
      options,
    };
  }
  if (choice.kind === 'nature') {
    const locked = (n.natures || []).length === 0;
    return { locked, lockReason: 'Escolha sua natureza em Ninja' };
  }
  if (choice.needs) {
    const value = statValue(n, choice.needs.stat);
    if (value < choice.needs.min) {
      const label = STAT_LABEL[choice.needs.stat] || choice.needs.stat;
      return { locked: true, lockReason: `${label} ${choice.needs.min}+ (você tem ${value})` };
    }
  }
  return { locked: false };
}

export function choiceStateFor(n, choice) {
  return choiceState(n, choice);
}

function publicChoice(n, choice, active, ctx) {
  const state = choiceState(n, choice);
  const spent = (active.spent || []).includes(choice.id);
  const jutsuLabelVars = { jutsu: 'um jutsu', flair: '' };
  return {
    id: choice.id,
    kind: choice.kind || 'plain',
    tone: choice.tone,
    toneLabel: TONE_LABELS[choice.tone] || choice.tone,
    label: fill(choice.label, ctx, jutsuLabelVars),
    locked: state.locked || false,
    lockReason: state.locked ? state.lockReason : null,
    done: spent,
    options: state.options || null,
  };
}

export function publicBeat(n, active, ctx) {
  const beat = beatOf(active);
  if (!beat) return null;
  const chapter = chapterById(active.chapterId);
  const flags = flagsOf(n);
  let text = fill(beat.text, ctx);
  for (const extra of beat.extra || []) {
    if (flags[extra.flag]) text += ` ${fill(extra.text, ctx)}`;
  }

  const view = {
    v: STORY_VERSION,
    kind: beat.type,
    chapterId: active.chapterId,
    chapterTitle: chapter?.title || '',
    beatId: beat.id,
    index: active.beatIndex,
    total: chapterScript(active.chapterId).length,
    bg: beat.bg,
    place: beat.place,
    mood: beat.mood,
    who: beat.who ? { name: beat.who.name, role: beat.who.role, sprite: beat.who.sprite || null } : null,
    text,
    lore: beat.lore ? fill(beat.lore, ctx) : null,
    startedAt: active.startedAt,
  };

  if (beat.type === 'battle') {
    view.battle = publicBattle(active.battle, n);
    view.battleMeta = {
      mode: beat.mode || 'ko',
      rounds: beat.rounds || 6,
      winAtEnemyPct: beat.winAtEnemyPct || 0,
      mustUseJutsu: Boolean(beat.mustUseJutsu),
    };
  } else {
    view.choices = templateChoices(beat)
      .filter((choice) => isChoiceVisible(n, choice))
      .map((choice) => publicChoice(n, choice, active, ctx));
  }
  return view;
}

export { FX_FLAIR };
