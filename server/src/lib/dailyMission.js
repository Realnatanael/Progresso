import { CHAKRA_MAX, catalogById } from '../data/ninjaCatalog.js';
import { generateStoryBeatJson } from './geminiStory.js';

const RANK_FLAVOR = {
  academy: 'missão de academia / treino supervisionado (tom Rank D leve)',
  genin: 'missão Rank D ou C para genin de Konoha',
  chuunin: 'missão Rank B / liderança de time',
  jounin: 'missão Rank A / elite da Folha',
};

export function ensureDailyMissionState(n) {
  if (!n.dailyMission || typeof n.dailyMission !== 'object') {
    n.dailyMission = null;
  }
  return n.dailyMission;
}

export async function ensureDailyMission(n, date, { displayName } = {}) {
  if (!date) return null;
  const existing = n.dailyMission;
  if (existing?.date === date && existing?.narrative && Array.isArray(existing.choices)) {
    return publicDailyMission(existing);
  }

  const jutsuNames = (n.learnedJutsuIds || [])
    .map((id) => catalogById(id)?.name)
    .filter(Boolean)
    .slice(0, 8);
  const hasJutsus = jutsuNames.length > 0;
  const rank = n.rank || 'academy';

  let raw = await generateDailyFromAi({
    rank,
    displayName,
    jutsuNames,
    hasJutsus,
    clanName: n.clanName || '',
  });

  if (!raw) {
    raw = fallbackDaily({ rank, jutsuNames, hasJutsus });
  }

  const mission = normalizeDaily(raw, { date, hasJutsus, jutsuNames, rank });
  n.dailyMission = mission;
  return publicDailyMission(mission);
}

export function chooseDailyMission(n, choiceId) {
  const mission = n.dailyMission;
  if (!mission || mission.status !== 'pending') {
    return { error: 'Não há missão do dia pendente.' };
  }

  const choice = (mission.choices || []).find((c) => c.id === choiceId);
  if (!choice) return { error: 'Escolha inválida.' };

  if (choice.requiresJutsu && (n.learnedJutsuIds || []).length === 0) {
    return { error: 'Você precisa de um jutsu para essa opção.' };
  }

  const rewards = {
    unlockPoints: Number(choice.reward?.unlockPoints) || 0,
    chakra: Number(choice.reward?.chakra) || 0,
  };
  const success = choice.outcome === 'success';

  if (success) {
    if (rewards.unlockPoints) n.unlockPoints = (n.unlockPoints || 0) + rewards.unlockPoints;
    if (rewards.chakra) n.chakra = Math.min(CHAKRA_MAX, (n.chakra || 0) + rewards.chakra);
  }

  mission.status = 'completed';
  mission.chosenId = choice.id;
  mission.outcomeBlurb = choice.resultBlurb
    || (success ? 'Missão cumprida.' : 'A missão falhou desta vez.');
  mission.reward = success ? rewards : { unlockPoints: 0, chakra: 0 };

  if (!n.story || typeof n.story !== 'object') {
    n.story = { completedChapterIds: [], activeBeat: null, lastOutcome: null, choiceHistory: [] };
  }
  if (!Array.isArray(n.story.choiceHistory)) n.story.choiceHistory = [];
  n.story.choiceHistory.push({
    at: new Date(),
    kind: 'daily',
    chapterId: mission.date,
    choiceId: choice.id,
    choiceLabel: choice.label,
    summary: mission.outcomeBlurb,
    advances: success,
  });
  n.story.choiceHistory = n.story.choiceHistory.slice(-40);

  return {
    ok: true,
    mission: publicDailyMission(mission),
    success,
    rewards: mission.reward,
  };
}

export function publicDailyMission(mission) {
  if (!mission) return null;
  return {
    date: mission.date,
    status: mission.status,
    title: mission.title || 'Missão do dia',
    narrative: mission.narrative,
    choices: (mission.choices || []).map((c) => ({
      id: c.id,
      label: c.label,
      requiresJutsu: Boolean(c.requiresJutsu),
      locked: Boolean(c.requiresJutsu && c._locked),
    })),
    chosenId: mission.chosenId || null,
    outcomeBlurb: mission.outcomeBlurb || null,
    reward: mission.reward || null,
  };
}

async function generateDailyFromAi({ rank, displayName, jutsuNames, hasJutsus, clanName }) {
  const systemPrompt = [
    'Você cria uma missão diária curta no universo Naruto (Konoha), em português do Brasil.',
    'Responda SOMENTE JSON:',
    '{"title":"...","narrative":"2-3 frases","choices":[{"id":"a","label":"...","outcome":"success|fail","requiresJutsu":false,"reward":{"unlockPoints":1,"chakra":0},"resultBlurb":"..."}]}',
    'Regras:',
    '- Exatamente 3 choices (ids a,b,c).',
    '- Exatamente UMA com outcome success; as outras fail.',
    '- Se hasJutsus=true, a opção success DEVE usar um jutsu da lista (requiresJutsu true).',
    '- Se hasJutsus=false, NENHUMA opção success pode exigir jutsu; a success deve ser atitude/esperteza sem técnica.',
    '- Recompensa success: unlockPoints 1-2 OU chakra 1 (não os dois altos).',
    '- Tom adequado ao rank. Sem markdown.',
  ].join('\n');

  const userPrompt = [
    `Rank: ${rank} (${RANK_FLAVOR[rank] || RANK_FLAVOR.academy})`,
    `Nome: ${displayName || 'ninja'}`,
    `Clã: ${clanName || 'nenhum'}`,
    `Jutsus: ${jutsuNames.join(' · ') || 'NENHUM'}`,
    `hasJutsus: ${hasJutsus}`,
  ].join('\n');

  try {
    return await generateStoryBeatJson({ systemPrompt, userPrompt });
  } catch (error) {
    console.error('Falha missão diária IA:', error?.message || error);
    return null;
  }
}

function fallbackDaily({ rank, jutsuNames, hasJutsus }) {
  const jutsu = jutsuNames[0] || 'um jutsu';
  if (rank === 'academy') {
    return {
      title: 'Recado do Iruka',
      narrative: 'Iruka pede que você ajude a limpar o pátio e treine um selo básico antes do sol se pôr.',
      choices: [
        {
          id: 'a',
          label: hasJutsus ? `Treinar selos com ${jutsu}` : 'Limpar o pátio com disciplina',
          outcome: 'success',
          requiresJutsu: hasJutsus,
          reward: { unlockPoints: 1, chakra: 0 },
          resultBlurb: 'Iruka aprova. +1 pt de desbloqueio.',
        },
        {
          id: 'b',
          label: 'Ficar jogando shuriken de madeira',
          outcome: 'fail',
          requiresJutsu: false,
          reward: {},
          resultBlurb: 'Você se diverte, mas a missão fica pela metade.',
        },
        {
          id: 'c',
          label: 'Sumir pra Ichiraku',
          outcome: 'fail',
          requiresJutsu: false,
          reward: {},
          resultBlurb: 'O ramen estava ótimo. A missão, não.',
        },
      ],
    };
  }

  return {
    title: 'Missão do Centro',
    narrative: `O Centro de Missões entrega um contrato ${RANK_FLAVOR[rank] || ''}. Três abordagens — só uma fecha o trabalho.`,
    choices: [
      {
        id: 'a',
        label: hasJutsus ? `Resolver com ${jutsu}` : 'Planejar a rota e agir limpo',
        outcome: 'success',
        requiresJutsu: hasJutsus,
        reward: { unlockPoints: 1, chakra: hasJutsus ? 0 : 1 },
        resultBlurb: 'Missão carimbada. Recompensa liberada.',
      },
      {
        id: 'b',
        label: 'Atacar de frente sem plano',
        outcome: 'fail',
        requiresJutsu: false,
        reward: {},
        resultBlurb: 'Barulho demais. O cliente reclama.',
      },
      {
        id: 'c',
        label: 'Adiar para amanhã',
        outcome: 'fail',
        requiresJutsu: false,
        reward: {},
        resultBlurb: 'A missão expira. Sem recompensa hoje.',
      },
    ],
  };
}

function normalizeDaily(raw, { date, hasJutsus, jutsuNames, rank }) {
  let choices = Array.isArray(raw?.choices) ? raw.choices.slice(0, 3) : [];
  const ids = ['a', 'b', 'c'];
  while (choices.length < 3) {
    choices.push({
      id: ids[choices.length],
      label: 'Observar de longe',
      outcome: 'fail',
      requiresJutsu: false,
      reward: {},
      resultBlurb: 'Nada acontece.',
    });
  }

  choices = choices.map((choice, index) => ({
    id: ids[index],
    label: String(choice.label || `Opção ${ids[index]}`).trim().slice(0, 90),
    outcome: choice.outcome === 'success' ? 'success' : 'fail',
    requiresJutsu: Boolean(choice.requiresJutsu),
    reward: {
      unlockPoints: Math.max(0, Math.min(2, Number(choice.reward?.unlockPoints) || 0)),
      chakra: Math.max(0, Math.min(1, Number(choice.reward?.chakra) || 0)),
    },
    resultBlurb: String(choice.resultBlurb || '').trim().slice(0, 240),
    _locked: false,
  }));

  let successIdx = choices.findIndex((c) => c.outcome === 'success');
  if (successIdx < 0) {
    successIdx = 0;
    choices[0].outcome = 'success';
    choices[0].reward = { unlockPoints: 1, chakra: 0 };
  }
  choices = choices.map((c, i) => (
    i === successIdx ? c : { ...c, outcome: 'fail' }
  ));

  if (hasJutsus) {
    choices[successIdx] = {
      ...choices[successIdx],
      requiresJutsu: true,
      label: choices[successIdx].requiresJutsu
        ? choices[successIdx].label
        : `Usar ${jutsuNames[0]}`,
    };
  } else {
    choices = choices.map((c) => ({ ...c, requiresJutsu: false }));
  }

  // Mark locked for client if requires jutsu but player somehow has none (shouldn't)
  choices = choices.map((c) => ({
    ...c,
    _locked: Boolean(c.requiresJutsu && !hasJutsus),
  }));

  return {
    date,
    status: 'pending',
    title: String(raw?.title || 'Missão do dia').trim().slice(0, 60),
    narrative: String(raw?.narrative || 'Uma missão espera no quadro.').trim().slice(0, 700),
    choices,
    chosenId: null,
    outcomeBlurb: null,
    reward: null,
    rank,
    generatedAt: new Date().toISOString(),
  };
}
