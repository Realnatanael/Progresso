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
/** Bump when prompts/schema change — força regenerar cachedBeat antigo. */
const BEAT_PROMPT_VERSION = 3;
const TONE_LABELS = {
  coragem: 'Coragem',
  cautela: 'Cautela',
  astucia: 'Astúcia',
  jutsu: 'Jutsu',
  empatia: 'Empatia',
  provocacao: 'Provocação',
};

export function storyContext(n) {
  ensureStoryState(n);
  const completed = new Set(n.story.completedChapterIds || []);
  const chapter = STORY_CHAPTERS.find((c) => !completed.has(c.id)) || null;
  const jutsuNames = (n.learnedJutsuIds || [])
    .map((id) => catalogById(id)?.name)
    .filter(Boolean)
    .slice(0, 12);
  const recentChoices = (n.story.choiceHistory || [])
    .filter((entry) => entry?.kind === 'story')
    .slice(-3)
    .map((entry) => `${entry.choiceLabel || entry.choiceId}: ${entry.summary || ''}`.slice(0, 120));
  return {
    chapter,
    jutsuCount: (n.learnedJutsuIds || []).length,
    jutsuNames,
    natures: [...(n.natures || [])],
    rank: n.rank || 'academy',
    clanName: n.clanName || '',
    recentChoices,
  };
}

function isUsableCachedBeat(cached, chapter, jutsuCount) {
  if (!cached || cached.chapterId !== chapter.id) return false;
  if (Number(cached.jutsuCount || 0) !== jutsuCount) return false;
  if (Number(cached.promptVersion) !== BEAT_PROMPT_VERSION) return false;
  const narrative = String(cached.narrative || '');
  if (/Três caminhos se abrem/i.test(narrative)) return false;
  if (/A cena se desenrola\./i.test(narrative)) return false;
  const labels = (cached.choices || []).map((c) => String(c.label || '')).join(' | ');
  if (/Agir com coragem e foco/i.test(labels)) return false;
  return Boolean(narrative.trim()) && Array.isArray(cached.choices) && cached.choices.length >= 3;
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
  if (isUsableCachedBeat(cached, chapter, ctx.jutsuCount)) {
    const beat = {
      ...cached,
      createdAt: cached.createdAt || new Date().toISOString(),
    };
    n.story.activeBeat = beat;
    n.story.retryAfter = null;
    return { ok: true, beat, reused: true, fromCache: true };
  }
  // Cache velho / genérico: joga fora pra gerar cena nova.
  if (cached) n.story.cachedBeat = null;

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
  const rewardOnlyRepeat = choice.outcome === 'reward_only'
    && n.story.rewardOnlyChapterId === beat.chapterId;

  if (!rewardOnlyRepeat) {
    if (choice.reward?.unlockPoints) rewards.unlockPoints += Number(choice.reward.unlockPoints) || 0;
    if (choice.reward?.chakra) rewards.chakra += Number(choice.reward.chakra) || 0;
  }

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
    n.story.rewardOnlyChapterId = null;
    // Rank sobe só quando o capítulo de promoção foi concluído + requisitos
    applyRankUps(n);
  } else if (choice.outcome === 'reward_only') {
    // Pode tentar de novo hoje na mesma cena (sem farm: só 1 reward_only por capítulo).
    n.story.retryAfter = null;
    n.story.rewardOnlyChapterId = beat.chapterId;
    if (n.story.cachedBeat) {
      n.story.cachedBeat = { ...n.story.cachedBeat, jutsuCount: beat.jutsuCount ?? (n.learnedJutsuIds || []).length };
    }
    outcome.blurb = `${outcome.blurb} A cena continua aberta — escolha outro caminho quando quiser.`;
    n.story.lastOutcome = outcome;
  } else {
    // stuck: trava nova geração de IA até amanhã; a mesma cena pode repetir depois.
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
    'Você é o narrador interativo do Progresso — mini-cenas estilo Naruto clássico (Konoha), em português do Brasil.',
    'Escreva como visual novel: tensão, diálogo curto entre aspas, cheiro/som do lugar, e escolha com peso emocional.',
    'Responda SOMENTE JSON válido:',
    '{"location":"lugar curto","mood":"1-2 palavras","stakes":"o que está em jogo em 1 frase","narrative":"3-5 frases","choices":[{"id":"a","label":"ação em 2ª pessoa","tone":"coragem|cautela|astucia|jutsu|empatia|provocacao","outcome":"advance|stuck|reward_only","requiresJutsu":false,"requiresJutsuId":null,"reward":{"unlockPoints":0,"chakra":0},"resultBlurb":"2 frases do que acontece depois"}]}',
    'Regras de cena:',
    '- location + mood + stakes obrigatórios e específicos do capítulo (não genéricos).',
    '- narrative: 3-5 frases; inclua pelo menos UMA fala entre aspas; cite o nome do ninja; sem meta ("você escolhe").',
    '- Exatamente 3 choices ids a,b,c com tons DIFERENTES entre si.',
    '- Labels de escolha = verbo de ação concreto (não "Opção A").',
    '- resultBlurb = consequência cinematográfica (não "você avançou").',
    '- Se successNeedsJutsu=true e hasJutsus=false: TODAS stuck.',
    '- Se successNeedsJutsu=true e hasJutsus=true: exatamente UMA advance usando jutsu da lista; tone dessa = jutsu; requiresJutsu=true.',
    '- Se successNeedsJutsu=false: exatamente uma advance.',
    '- Recompensas pequenas nas choices: unlockPoints 0-2, chakra 0-1.',
    '- Sem markdown, sem texto fora do JSON, sem spoilers pós-clássico.',
  ].join('\n');

  const userPrompt = [
    `Capítulo: ${chapter.title} (${chapter.id})`,
    `Cena-guia: ${chapter.sceneHint}`,
    `Blurb: ${chapter.blurb}`,
    `Nome do ninja: ${displayName || 'o genin'}`,
    `Rank atual: ${ctx.rank}`,
    `Clã / sobrenome: ${ctx.clanName || 'nenhum'}`,
    `Naturezas: ${ctx.natures.join(', ') || 'nenhuma'}`,
    `Jutsus conhecidos (${ctx.jutsuCount}): ${ctx.jutsuNames.join(' · ') || 'NENHUM'}`,
    `successNeedsJutsu: ${successNeedsJutsu}`,
    `hasJutsus: ${hasJutsus}`,
    `promotesTo: ${chapter.promotesTo || 'nenhum'}`,
    `Decisões recentes (continuidade leve): ${ctx.recentChoices?.join(' | ') || 'nenhuma'}`,
  ].join('\n');

  try {
    return await generateStoryBeatJson({ systemPrompt, userPrompt });
  } catch (error) {
    console.error('Falha Gemini story:', error?.message || error);
    return null;
  }
}

/** Cenas escritas à mão quando a Gemini falha — evita o mesmo texto genérico em todo capítulo. */
const CHAPTER_FALLBACKS = {
  academy_day_one: {
    location: 'Portões Aun',
    mood: 'nervosismo',
    stakes: 'Marcar presença no primeiro dia.',
    narrative:
      'Os Portões Aun se abrem ao sol da manhã. Iruka passa lista; um colega ri do seu sobrenome. “Ei, clã famoso… aguenta a pressão?” O pátio cheira a madeira nova e nervosismo.',
    choices: [
      {
        id: 'a',
        label: 'Responder firme e se apresentar',
        tone: 'coragem',
        outcome: 'advance',
        reward: { unlockPoints: 1 },
        resultBlurb: 'Iruka sorri de canto. “Bom. Assim se entra na Academia.” Você entra de cabeça erguida.',
      },
      {
        id: 'b',
        label: 'Ficar em silêncio no fundo',
        tone: 'cautela',
        outcome: 'stuck',
        reward: {},
        resultBlurb: 'Ninguém te nota. O primeiro dia acaba sem você existir na lista da sala.',
      },
      {
        id: 'c',
        label: 'Ajudar um aluno perdido a achar a sala',
        tone: 'empatia',
        outcome: 'reward_only',
        reward: { unlockPoints: 1 },
        resultBlurb: 'Você faz um amigo. A chamada oficial, porém, ainda te espera amanhã.',
      },
    ],
  },
  academy_basics: {
    location: 'Sala 3 · Academia',
    mood: 'concentração',
    stakes: 'Provar que o jutsu básico sai de verdade.',
    narrative:
      'Iruka bate o giz no quadro: bunshin, henge, kawarimi. “Quem não tentar, não forma.” Selos ecoam; um clone de um colega explode em fumaça e a turma ri.',
    choices: [
      {
        id: 'a',
        label: 'Demonstrar o clone com calma',
        tone: 'coragem',
        outcome: 'advance',
        reward: { unlockPoints: 1 },
        resultBlurb: 'O clone treme, mas segura. Iruka anota: progresso.',
      },
      {
        id: 'b',
        label: 'Errar o selo e travar',
        tone: 'cautela',
        outcome: 'stuck',
        reward: {},
        resultBlurb: 'Fumaça demais, técnica de menos. “Treine e volte”, diz Iruka.',
      },
      {
        id: 'c',
        label: 'Treinar kawarimi no corredor depois',
        tone: 'astucia',
        outcome: 'reward_only',
        reward: { unlockPoints: 1 },
        resultBlurb: 'Você melhora sozinho, mas a aula oficial ainda não fecha.',
      },
    ],
  },
  academy_rival: {
    location: 'Pátio de treino',
    mood: 'provocação',
    stakes: 'Não deixar a provocação virar humilhação.',
    narrative:
      'No pátio, um rival te empurra o ombro: “Academia não é brincadeira de clã.” Folhas voam. O sensei observa de longe, sem interferir… ainda.',
    choices: [
      {
        id: 'a',
        label: 'Aceitar o sparring e manter a guarda',
        tone: 'coragem',
        outcome: 'advance',
        reward: { chakra: 1 },
        resultBlurb: 'Você aguenta a pressão. O rival recua; o sensei anui em silêncio.',
      },
      {
        id: 'b',
        label: 'Ignorar e ir embora',
        tone: 'cautela',
        outcome: 'stuck',
        reward: {},
        resultBlurb: 'A provocação fica no ar. Sem confronto, o capítulo não anda.',
      },
      {
        id: 'c',
        label: 'Provocar de volta sem lutar',
        tone: 'provocacao',
        outcome: 'reward_only',
        reward: { unlockPoints: 1 },
        resultBlurb: 'Ganha respeito verbal, mas o pátio ainda espera um sparring de verdade.',
      },
    ],
  },
  genin_graduation: {
    location: 'Sala de exames',
    mood: 'tensão',
    stakes: 'Graduar — ou repetir o ano.',
    narrative:
      'O examinador cruza os braços. “Mostre um jutsu. Sem técnica, não há bandana.” O silêncio da sala pesa como chumbo; colegas prendem a respiração.',
    choices: [
      {
        id: 'a',
        label: 'Executar seu jutsu na hora',
        tone: 'jutsu',
        outcome: 'advance',
        requiresJutsu: true,
        reward: { unlockPoints: 1 },
        resultBlurb: 'Selos firmes. A técnica sai. “Genin.” A bandana brilha na sua mão.',
      },
      {
        id: 'b',
        label: 'Pedir mais tempo pra respirar',
        tone: 'cautela',
        outcome: 'stuck',
        reward: {},
        resultBlurb: 'O examinador balança a cabeça. Sem demonstração, não há graduação hoje.',
      },
      {
        id: 'c',
        label: 'Blefar com postura de elite',
        tone: 'astucia',
        outcome: 'reward_only',
        reward: {},
        resultBlurb: 'A pose impressiona um pouco — o jutsu, não. Volte quando dominar a técnica.',
      },
    ],
  },
  team_assignment: {
    location: 'Sala do Hokage',
    mood: 'expectativa',
    stakes: 'Aceitar o time e o sensei.',
    narrative:
      'Na sala do Hokage, os nomes são lidos. Seu time se forma; um Jounin de máscara cruzada aparece no telhado e só diz: “Sigam-me.”',
    choices: [
      {
        id: 'a',
        label: 'Seguir o sensei sem hesitar',
        tone: 'coragem',
        outcome: 'advance',
        reward: { unlockPoints: 1 },
        resultBlurb: 'Você sobe no telhado. O time começa de verdade.',
      },
      {
        id: 'b',
        label: 'Questionar a escolha dos colegas',
        tone: 'provocacao',
        outcome: 'stuck',
        reward: {},
        resultBlurb: 'O sensei some. Sem confiança no time, a missão não sai.',
      },
      {
        id: 'c',
        label: 'Cumprimentar cada um antes de sair',
        tone: 'empatia',
        outcome: 'reward_only',
        reward: { unlockPoints: 1 },
        resultBlurb: 'Clima melhor, mas o Jounin já foi embora — remarque o encontro.',
      },
    ],
  },
  d_missions: {
    location: 'Centro de missões',
    mood: 'ironia',
    stakes: 'Engolir o orgulho e cumprir Rank D.',
    narrative:
      'Quadro Rank D: gato perdido, cerca torta, compras da vovó. Seu sensei ri. “Todo Hokage começou assim.” Um aldeão já aponta pra você.',
    choices: [
      {
        id: 'a',
        label: 'Pegar a missão do gato e cumprir direito',
        tone: 'empatia',
        outcome: 'advance',
        reward: { unlockPoints: 2 },
        resultBlurb: 'Gato resgatado, aldeão feliz. Carimbo no relatório.',
      },
      {
        id: 'b',
        label: 'Recusar e exigir missão “de verdade”',
        tone: 'provocacao',
        outcome: 'stuck',
        reward: {},
        resultBlurb: 'Sensei encolhe os ombros. Sem Rank D, não há Rank C.',
      },
      {
        id: 'c',
        label: 'Dividir as tarefas com o time',
        tone: 'astucia',
        outcome: 'reward_only',
        reward: { unlockPoints: 1 },
        resultBlurb: 'Bom espírito de equipe — ainda falta fechar o relatório oficial.',
      },
    ],
  },
  c_missions: {
    location: 'Estrada fora de Konoha',
    mood: 'alerta',
    stakes: 'Proteger o cliente na primeira escolta real.',
    narrative:
      'O comerciante engole seco. “Tem… bandidos nessa estrada?” Seu sensei só responde: “Então mostrem o que aprenderam.” O mato se mexe sem vento.',
    choices: [
      {
        id: 'a',
        label: 'Abrir caminho com um jutsu',
        tone: 'jutsu',
        outcome: 'advance',
        requiresJutsu: true,
        reward: { unlockPoints: 1 },
        resultBlurb: 'A técnica corta a emboscada. O cliente chega intacto. Missão Rank C carimbada.',
      },
      {
        id: 'b',
        label: 'Esconder o cliente e esperar',
        tone: 'cautela',
        outcome: 'stuck',
        reward: {},
        resultBlurb: 'A emboscada passa… e volta. Sem ação, a escolta falha.',
      },
      {
        id: 'c',
        label: 'Negociar passagem com os bandidos',
        tone: 'astucia',
        outcome: 'reward_only',
        reward: { unlockPoints: 1 },
        resultBlurb: 'Compram tempo — não a vitória. A missão ainda não fecha.',
      },
    ],
  },
};

function fallbackStoryBeat({ chapter, ctx, hasJutsus, successNeedsJutsu }) {
  const jutsu = ctx.jutsuNames[0] || 'seu jutsu';
  const base = chapter.sceneHint || chapter.blurb;
  const nameHint = ctx.clanName ? ` do clã ${ctx.clanName}` : '';

  if (successNeedsJutsu && !hasJutsus) {
    return {
      location: chapter.title,
      mood: 'pressão',
      stakes: 'Sem jutsu, a prova trava.',
      narrative: `${base} Um examinador crava o olhar em você${nameHint}. “Cadê a técnica?” Você trava — sem jutsu, não há como impressionar.`,
      choices: [
        {
          id: 'a',
          label: 'Tentar improvisar sem selos',
          tone: 'coragem',
          outcome: 'stuck',
          requiresJutsu: false,
          reward: {},
          resultBlurb: 'O golpe sai fraco. “Volte quando souber um jutsu.”',
        },
        {
          id: 'b',
          label: 'Pedir mais um dia de treino',
          tone: 'cautela',
          outcome: 'stuck',
          requiresJutsu: false,
          reward: {},
          resultBlurb: 'O sensei aceita adiar. Sem técnica, a história não avança.',
        },
        {
          id: 'c',
          label: 'Sair da sala com o orgulho ferido',
          tone: 'provocacao',
          outcome: 'stuck',
          requiresJutsu: false,
          reward: {},
          resultBlurb: 'Você sai. A jornada fica no mesmo capítulo.',
        },
      ],
    };
  }

  if (successNeedsJutsu && hasJutsus) {
    return {
      location: chapter.title,
      mood: 'decisão',
      stakes: 'Usar o jutsu agora — ou falhar a prova.',
      narrative: `${base} “Mostre o que tem”, ordena a voz à sua frente. Seu chakra lateja: ${jutsu} está pronto.`,
      choices: [
        {
          id: 'a',
          label: `Usar ${jutsu}`,
          tone: 'jutsu',
          outcome: 'advance',
          requiresJutsu: true,
          reward: { unlockPoints: 1 },
          resultBlurb: `Você executa ${jutsu} com firmeza. O examinador acena — capítulo concluído.`,
        },
        {
          id: 'b',
          label: 'Confiar só em taijutsu bruto',
          tone: 'coragem',
          outcome: 'stuck',
          requiresJutsu: false,
          reward: {},
          resultBlurb: 'Força ajuda, mas pediram jutsu. Ainda não passa.',
        },
        {
          id: 'c',
          label: 'Blefar com selos errados',
          tone: 'astucia',
          outcome: 'reward_only',
          requiresJutsu: false,
          reward: {},
          resultBlurb: 'O blefe não cola. Você ganha experiência, mas não avança o capítulo.',
        },
      ],
    };
  }

  const scripted = CHAPTER_FALLBACKS[chapter.id];
  if (scripted) {
    return {
      location: scripted.location || chapter.title,
      mood: scripted.mood || 'missão',
      stakes: scripted.stakes || chapter.blurb,
      narrative: scripted.narrative,
      choices: scripted.choices.map((choice) => ({
        ...choice,
        reward: choice.reward || {},
      })),
    };
  }

  return {
    location: chapter.title,
    mood: 'missão',
    stakes: chapter.blurb,
    narrative: `${chapter.blurb} ${base} Alguém à sua frente pergunta: “E agora… o que você faz?”`,
    choices: [
      {
        id: 'a',
        label: 'Avançar de frente, sem hesitar',
        tone: 'coragem',
        outcome: 'advance',
        requiresJutsu: false,
        reward: { unlockPoints: 1 },
        resultBlurb: 'Sua escolha firme abre o próximo capítulo.',
      },
      {
        id: 'b',
        label: 'Observar demais e perder o timing',
        tone: 'cautela',
        outcome: 'stuck',
        requiresJutsu: false,
        reward: {},
        resultBlurb: 'A oportunidade passa. Continue treinando e tente de novo.',
      },
      {
        id: 'c',
        label: 'Ajudar um aliado em silêncio',
        tone: 'empatia',
        outcome: 'reward_only',
        requiresJutsu: false,
        reward: { unlockPoints: 1 },
        resultBlurb: 'Bom coração, mas o arco principal ainda não fecha.',
      },
    ],
  };
}

function normalizeTone(raw) {
  const key = String(raw || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (TONE_LABELS[key]) return key;
  if (key.includes('jutsu')) return 'jutsu';
  if (key.includes('coraj')) return 'coragem';
  if (key.includes('caut') || key.includes('cuidado')) return 'cautela';
  if (key.includes('astuc') || key.includes('esper')) return 'astucia';
  if (key.includes('empat') || key.includes('aliado')) return 'empatia';
  if (key.includes('provoc')) return 'provocacao';
  return 'coragem';
}

function normalizeBeat(raw, { chapter, hasJutsus, successNeedsJutsu, jutsuNames }) {
  const narrative = String(raw?.narrative || chapter.blurb).trim().slice(0, 1100);
  const location = String(raw?.location || chapter.title).trim().slice(0, 60);
  const mood = String(raw?.mood || 'missão').trim().slice(0, 40);
  const stakes = String(raw?.stakes || chapter.blurb).trim().slice(0, 140);
  let choices = Array.isArray(raw?.choices) ? raw.choices.slice(0, 3) : [];

  while (choices.length < 3) {
    choices.push({
      id: CHOICE_IDS[choices.length],
      label: 'Esperar e observar',
      tone: 'cautela',
      outcome: 'stuck',
      requiresJutsu: false,
      reward: {},
      resultBlurb: 'Nada muda nesta cena.',
    });
  }

  choices = choices.map((choice, index) => {
    const id = CHOICE_IDS[index];
    const outcome = ['advance', 'stuck', 'reward_only'].includes(choice.outcome)
      ? choice.outcome
      : 'stuck';
    const requiresJutsu = Boolean(choice.requiresJutsu);
    const tone = normalizeTone(choice.tone || (requiresJutsu ? 'jutsu' : ''));

    return {
      id,
      label: String(choice.label || `Opção ${id.toUpperCase()}`).trim().slice(0, 90),
      tone,
      toneLabel: TONE_LABELS[tone] || tone,
      outcome,
      requiresJutsu,
      requiresJutsuId: null,
      reward: {
        unlockPoints: Math.max(0, Math.min(2, Number(choice.reward?.unlockPoints) || 0)),
        chakra: Math.max(0, Math.min(1, Number(choice.reward?.chakra) || 0)),
      },
      resultBlurb: String(choice.resultBlurb || '').trim().slice(0, 320),
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
        tone: successNeedsJutsu && hasJutsus ? 'jutsu' : choices[0].tone,
        toneLabel: successNeedsJutsu && hasJutsus ? TONE_LABELS.jutsu : choices[0].toneLabel,
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
    promptVersion: BEAT_PROMPT_VERSION,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    location,
    mood,
    stakes,
    narrative,
    choices,
    createdAt: new Date().toISOString(),
  };
}
