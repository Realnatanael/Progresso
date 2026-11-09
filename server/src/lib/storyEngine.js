import { CHAKRA_MAX, catalogById } from '../data/ninjaCatalog.js';
import {
  STORY_CHAPTERS,
  chapterById,
  ensureStoryState,
} from '../data/storyRoadmap.js';
import { shiftDate, todayISO } from './dates.js';
import { generateStoryBeatJson } from './geminiStory.js';
import { applyRankUps } from './ninjaProgress.js';

const CHOICE_IDS = ['a', 'b', 'c'];

export function storyContext(n) {
  ensureStoryState(n);
  const completed = new Set(n.story.completedChapterIds || []);
  const chapter = STORY_CHAPTERS.find((c) => !completed.has(c.id)) || null;
  const jutsuNames = (n.learnedJutsuIds || [])
    .map((id) => catalogById(id)?.name)
    .filter(Boolean)
    .slice(0, 12);
  return {
    chapter,
    jutsuCount: (n.learnedJutsuIds || []).length,
    jutsuNames,
    natures: [...(n.natures || [])],
    rank: n.rank || 'academy',
    clanName: n.clanName || '',
  };
}

export function canStartStoryBeat(n, today = todayISO()) {
  const { chapter, jutsuCount } = storyContext(n);
  if (!chapter) return { ok: false, error: 'Você já concluiu toda a jornada.' };
  if (n.story.activeBeat) return { ok: true, reuse: true };

  const goalsOk = (chapter.goals || []).every((goal) => Boolean(goal.check(n, catalogById)));
  if (!goalsOk) return { ok: false, error: 'Ainda faltam requisitos deste capítulo.' };

  const need = chapter.advanceRequiresJutsus || 0;
  // Provas que pedem jutsu podem ser tentadas sem técnica — a cena trava o avanço.
  if (jutsuCount < need && !chapter.successNeedsJutsu) {
    return { ok: false, error: `Aprenda pelo menos ${need} jutsu(s) antes de avançar.` };
  }

  if (n.story.retryAfter && n.story.retryAfter > today) {
    return {
      ok: false,
      error: 'Você já tentou esta cena hoje. Volte amanhã pra tentar de novo.',
      retryAfter: n.story.retryAfter,
    };
  }

  return { ok: true, reuse: false };
}

export async function startStoryBeat(n, { displayName, today = todayISO() } = {}) {
  const gate = canStartStoryBeat(n, today);
  if (!gate.ok) return gate;
  if (gate.reuse && n.story.activeBeat) {
    return { ok: true, beat: n.story.activeBeat, reused: true };
  }

  const ctx = storyContext(n);
  const chapter = ctx.chapter;
  const hasJutsus = ctx.jutsuCount > 0;
  const successNeedsJutsu = Boolean(chapter.successNeedsJutsu);

  // Reusa a mesma cena (sem IA) se for a mesma tentativa do capítulo e o arsenal não mudou.
  const cached = n.story.cachedBeat;
  if (
    cached
    && cached.chapterId === chapter.id
    && Number(cached.jutsuCount || 0) === ctx.jutsuCount
  ) {
    const beat = {
      ...cached,
      createdAt: cached.createdAt || new Date().toISOString(),
    };
    n.story.activeBeat = beat;
    n.story.retryAfter = null;
    return { ok: true, beat, reused: true, fromCache: true };
  }

  let beat = await generateStoryBeatFromAi({
    chapter,
    ctx,
    displayName,
    hasJutsus,
    successNeedsJutsu,
  });

  if (!beat) {
    beat = fallbackStoryBeat({ chapter, ctx, hasJutsus, successNeedsJutsu });
  }

  beat = normalizeBeat(beat, {
    chapter,
    hasJutsus,
    successNeedsJutsu,
    jutsuNames: ctx.jutsuNames,
  });
  beat.jutsuCount = ctx.jutsuCount;

  n.story.activeBeat = beat;
  n.story.cachedBeat = beat;
  n.story.retryAfter = null;
  return { ok: true, beat, reused: false };
}

export function chooseStoryOption(n, choiceId, { today = todayISO() } = {}) {
  ensureStoryState(n);
  const beat = n.story.activeBeat;
  if (!beat) return { error: 'Não há cena aberta. Toque em Avançar primeiro.' };

  const choice = (beat.choices || []).find((c) => c.id === choiceId);
  if (!choice) return { error: 'Escolha inválida.' };

  if (choice.requiresJutsu && (n.learnedJutsuIds || []).length === 0) {
    return { error: 'Você ainda não sabe nenhum jutsu para essa ação.' };
  }
  if (choice.requiresJutsuId && !(n.learnedJutsuIds || []).includes(choice.requiresJutsuId)) {
    return { error: 'Você não domina o jutsu exigido nessa opção.' };
  }

  const chapter = chapterById(beat.chapterId);
  const rewards = { unlockPoints: 0, chakra: 0 };
  const advances = choice.outcome === 'advance';

  if (choice.reward?.unlockPoints) rewards.unlockPoints += Number(choice.reward.unlockPoints) || 0;
  if (choice.reward?.chakra) rewards.chakra += Number(choice.reward.chakra) || 0;

  if (advances && chapter?.rewardOnAdvance) {
    rewards.unlockPoints += Number(chapter.rewardOnAdvance.unlockPoints) || 0;
    rewards.chakra += Number(chapter.rewardOnAdvance.chakra) || 0;
  }

  if (rewards.unlockPoints) {
    n.unlockPoints = (n.unlockPoints || 0) + rewards.unlockPoints;
  }
  if (rewards.chakra) {
    n.chakra = Math.min(CHAKRA_MAX, (n.chakra || 0) + rewards.chakra);
  }

  const outcome = {
    blurb: choice.resultBlurb || (advances ? 'Você avançou na jornada.' : 'A cena termina sem progresso.'),
    advances,
    rewards,
    chapterId: beat.chapterId,
    choiceId: choice.id,
    choiceLabel: choice.label,
    retryAfter: null,
  };

  n.story.lastOutcome = outcome;
  n.story.choiceHistory = [
    ...(n.story.choiceHistory || []),
    {
      at: new Date(),
      kind: 'story',
      chapterId: beat.chapterId,
      choiceId: choice.id,
      choiceLabel: choice.label,
      summary: outcome.blurb,
      advances,
    },
  ].slice(-40);

  n.story.activeBeat = null;

  if (advances && chapter) {
    if (!n.story.completedChapterIds.includes(chapter.id)) {
      n.story.completedChapterIds.push(chapter.id);
    }
    n.story.retryAfter = null;
    n.story.cachedBeat = null;
    // Rank sobe só quando o capítulo de promoção foi concluído + requisitos
    applyRankUps(n);
  } else {
    // Falhou: trava nova geração de IA até amanhã; a mesma cena pode repetir depois.
    const retryAfter = shiftDate(today, 1);
    n.story.retryAfter = retryAfter;
    outcome.retryAfter = retryAfter;
    outcome.blurb = `${outcome.blurb} Tente de novo amanhã.`;
    n.story.lastOutcome = outcome;
    if (n.story.cachedBeat) {
      n.story.cachedBeat = { ...n.story.cachedBeat, jutsuCount: beat.jutsuCount ?? (n.learnedJutsuIds || []).length };
    }
  }

  return { ok: true, outcome };
}

async function generateStoryBeatFromAi({
  chapter,
  ctx,
  displayName,
  hasJutsus,
  successNeedsJutsu,
}) {
  const systemPrompt = [
    'Você escreve mini-cenas no universo Naruto (Konoha), em português do Brasil.',
    'Responda SOMENTE JSON válido com este formato:',
    '{"narrative":"2-4 frases","choices":[{"id":"a","label":"...","outcome":"advance|stuck|reward_only","requiresJutsu":false,"requiresJutsuId":null,"reward":{"unlockPoints":0,"chakra":0},"resultBlurb":"..."}]}',
    'Regras:',
    '- Exatamente 3 choices com ids a, b, c.',
    '- narrative curta, viva, sem spoilers modernos fora do tom clássico.',
    '- Se successNeedsJutsu=true e o ninja NÃO tem jutsus: TODAS as choices devem ter outcome "stuck" (ninguém gradua/avança).',
    '- Se successNeedsJutsu=true e o ninja TEM jutsus: exatamente UMA choice deve ter outcome "advance" e mencionar/usar um jutsu da lista; as outras stuck ou reward_only.',
    '- Se successNeedsJutsu=false: exatamente uma choice advance; as outras stuck/reward_only.',
    '- requiresJutsu=true só na opção que usa jutsu; requiresJutsuId só se citar um id conhecido.',
    '- Recompensas pequenas: unlockPoints 0-2, chakra 0-1 nas choices (o capítulo já dá bônus no advance).',
    '- Sem markdown, sem texto fora do JSON.',
  ].join('\n');

  const userPrompt = [
    `Capítulo: ${chapter.title} (${chapter.id})`,
    `Cena: ${chapter.sceneHint}`,
    `Blurb: ${chapter.blurb}`,
    `Nome: ${displayName || 'o genin'}`,
    `Rank atual: ${ctx.rank}`,
    `Clã: ${ctx.clanName || 'nenhum'}`,
    `Naturezas: ${ctx.natures.join(', ') || 'nenhuma'}`,
    `Jutsus conhecidos (${ctx.jutsuCount}): ${ctx.jutsuNames.join(' · ') || 'NENHUM'}`,
    `successNeedsJutsu: ${successNeedsJutsu}`,
    `hasJutsus: ${hasJutsus}`,
    `promotesTo: ${chapter.promotesTo || 'nenhum'}`,
  ].join('\n');

  try {
    return await generateStoryBeatJson({ systemPrompt, userPrompt });
  } catch (error) {
    console.error('Falha Gemini story:', error?.message || error);
    return null;
  }
}

function fallbackStoryBeat({ chapter, ctx, hasJutsus, successNeedsJutsu }) {
  const jutsu = ctx.jutsuNames[0] || 'seu jutsu';
  const base = chapter.sceneHint || chapter.blurb;

  if (successNeedsJutsu && !hasJutsus) {
    return {
      narrative: `${base} O examinador espera uma técnica. Você trava — sem jutsu, não há como impressionar.`,
      choices: [
        {
          id: 'a',
          label: 'Tentar improvisar sem selos',
          outcome: 'stuck',
          requiresJutsu: false,
          reward: {},
          resultBlurb: 'O golpe sai fraco. Reprovado por agora — volte quando souber um jutsu.',
        },
        {
          id: 'b',
          label: 'Pedir mais um dia de treino',
          outcome: 'stuck',
          requiresJutsu: false,
          reward: { unlockPoints: 0 },
          resultBlurb: 'O sensei aceita adiar. Sem técnica, a história não avança.',
        },
        {
          id: 'c',
          label: 'Fugir da prova',
          outcome: 'stuck',
          requiresJutsu: false,
          reward: {},
          resultBlurb: 'Você sai da sala. A jornada fica no mesmo capítulo.',
        },
      ],
    };
  }

  if (successNeedsJutsu && hasJutsus) {
    return {
      narrative: `${base} Chegou a hora: mostre um jutsu de verdade.`,
      choices: [
        {
          id: 'a',
          label: `Usar ${jutsu}`,
          outcome: 'advance',
          requiresJutsu: true,
          reward: { unlockPoints: 1 },
          resultBlurb: `Você executa ${jutsu} com firmeza. O examinador acena — capítulo concluído.`,
        },
        {
          id: 'b',
          label: 'Confiar só em taijutsu bruto',
          outcome: 'stuck',
          requiresJutsu: false,
          reward: {},
          resultBlurb: 'Força ajuda, mas pediram jutsu. Ainda não passa.',
        },
        {
          id: 'c',
          label: 'Tentar blefar com selos errados',
          outcome: 'reward_only',
          requiresJutsu: false,
          reward: { chakra: 0 },
          resultBlurb: 'O blefe não cola. Você ganha experiência, mas não avança o capítulo.',
        },
      ],
    };
  }

  return {
    narrative: `${base} Três caminhos se abrem — escolha com cuidado.`,
    choices: [
      {
        id: 'a',
        label: 'Agir com coragem e foco',
        outcome: 'advance',
        requiresJutsu: false,
        reward: { unlockPoints: 1 },
        resultBlurb: 'Sua escolha firme abre o próximo capítulo.',
      },
      {
        id: 'b',
        label: 'Hesitar e observar demais',
        outcome: 'stuck',
        requiresJutsu: false,
        reward: {},
        resultBlurb: 'A oportunidade passa. Continue treinado e tente de novo.',
      },
      {
        id: 'c',
        label: 'Ajudar um aliado em silêncio',
        outcome: 'reward_only',
        requiresJutsu: false,
        reward: { unlockPoints: 1 },
        resultBlurb: 'Bom coração, mas o arco principal ainda não fecha.',
      },
    ],
  };
}

function normalizeBeat(raw, { chapter, hasJutsus, successNeedsJutsu, jutsuNames }) {
  const narrative = String(raw?.narrative || chapter.blurb).trim().slice(0, 900);
  let choices = Array.isArray(raw?.choices) ? raw.choices.slice(0, 3) : [];

  while (choices.length < 3) {
    choices.push({
      id: CHOICE_IDS[choices.length],
      label: 'Esperar e observar',
      outcome: 'stuck',
      requiresJutsu: false,
      reward: {},
      resultBlurb: 'Nada muda nesta cena.',
    });
  }

  choices = choices.map((choice, index) => {
    const id = CHOICE_IDS[index];
    let outcome = ['advance', 'stuck', 'reward_only'].includes(choice.outcome)
      ? choice.outcome
      : 'stuck';
    let requiresJutsu = Boolean(choice.requiresJutsu);
    const requiresJutsuId = choice.requiresJutsuId && jutsuNames.length
      ? null
      : null;

    return {
      id,
      label: String(choice.label || `Opção ${id.toUpperCase()}`).trim().slice(0, 90),
      outcome,
      requiresJutsu,
      requiresJutsuId,
      reward: {
        unlockPoints: Math.max(0, Math.min(2, Number(choice.reward?.unlockPoints) || 0)),
        chakra: Math.max(0, Math.min(1, Number(choice.reward?.chakra) || 0)),
      },
      resultBlurb: String(choice.resultBlurb || '').trim().slice(0, 280),
    };
  });

  // Enforce gating rules even if AI drifts
  if (successNeedsJutsu && !hasJutsus) {
    choices = choices.map((c) => ({ ...c, outcome: 'stuck', requiresJutsu: false }));
  } else {
    const advanceCount = choices.filter((c) => c.outcome === 'advance').length;
    if (advanceCount === 0) {
      choices[0] = {
        ...choices[0],
        outcome: 'advance',
        requiresJutsu: Boolean(successNeedsJutsu && hasJutsus),
        label: successNeedsJutsu && hasJutsus
          ? `Usar ${jutsuNames[0]}`
          : choices[0].label,
        resultBlurb: choices[0].resultBlurb || 'Você avança na jornada.',
      };
    } else if (advanceCount > 1) {
      let seen = false;
      choices = choices.map((c) => {
        if (c.outcome !== 'advance') return c;
        if (!seen) {
          seen = true;
          return c;
        }
        return { ...c, outcome: 'stuck' };
      });
    }
  }

  return {
    kind: 'story',
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    narrative,
    choices,
    createdAt: new Date().toISOString(),
  };
}
