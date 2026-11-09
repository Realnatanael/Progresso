/** Roadmap narrativo do Modo História — capítulos estilo Konoha. */

export const STORY_CHAPTERS = [
  {
    id: 'academy_day_one',
    title: 'Primeiro Dia na Academia',
    rank: 'academy',
    blurb: 'Você chega aos Portões Aun. Uniforme novo, nervos à flor da pele.',
    sceneHint: 'Pátio da Academia de Konoha ao amanhecer; Iruka chama a turma; colegas zombam e apoiam.',
    goals: [
      { id: 'nature', label: 'Escolher 1ª natureza', check: (n) => (n.natures || []).length >= 1 },
    ],
    rewardOnAdvance: { unlockPoints: 1 },
  },
  {
    id: 'academy_basics',
    title: 'Aula de Clones e Substituição',
    rank: 'academy',
    blurb: 'Treino básico: clone, transformação e kawarimi. Sem técnica, não há graduação.',
    sceneHint: 'Sala de aula da Academia; Iruka pede demonstração de bunshin/henge; quadro com selos de mão.',
    goals: [
      { id: 'jutsus1', label: 'Aprender 1 jutsu', check: (n) => (n.learnedJutsuIds || []).length >= 1 },
      { id: 'chakra8', label: 'Chakra 8', check: (n) => (n.chakra || 0) >= 8 },
    ],
    advanceRequiresJutsus: 1,
    rewardOnAdvance: { unlockPoints: 1 },
  },
  {
    id: 'academy_rival',
    title: 'Rival no Pátio',
    rank: 'academy',
    blurb: 'Um colega te provoca. Mostre que não é só teoria.',
    sceneHint: 'Pátio de treino; sparring leve entre alunos; sensei observa de longe.',
    goals: [
      { id: 'jutsus2', label: '2 jutsus aprendidos', check: (n) => (n.learnedJutsuIds || []).length >= 2 },
      { id: 'stats8', label: 'Soma Nin+Gen+Tai ≥ 8', check: (n) => ((n.ninjutsu || 0) + (n.genjutsu || 0) + (n.taijutsu || 0)) >= 8 },
    ],
    advanceRequiresJutsus: 1,
    rewardOnAdvance: { chakra: 1 },
  },
  {
    id: 'genin_graduation',
    title: 'Prova de Genin',
    rank: 'academy',
    blurb: 'A graduação: use um jutsu de verdade na frente do examinador. Sem técnica, não passa.',
    sceneHint: 'Sala de exames da Academia; Iruka (ou examinador) pede um jutsu prático para graduação; tensão de formatura.',
    goals: [
      { id: 'chakra30', label: 'Chakra 30', check: (n) => (n.chakra || 0) >= 30 },
      { id: 'stats15', label: 'Soma Nin+Gen+Tai ≥ 15', check: (n) => ((n.ninjutsu || 0) + (n.genjutsu || 0) + (n.taijutsu || 0)) >= 15 },
      { id: 'nature', label: 'Ter natureza', check: (n) => (n.natures || []).length >= 1 },
    ],
    // O jutsu é exigido nas opções da cena — sem técnica, nenhuma escolha gradua.
    successNeedsJutsu: true,
    promotesTo: 'genin',
    rewardOnAdvance: { unlockPoints: 3, chakra: 2 },
  },
  {
    id: 'team_assignment',
    title: 'Formação do Time',
    rank: 'genin',
    blurb: 'Genin! O Hokage monta os times. Seu sensei Jounin aparece.',
    sceneHint: 'Sala do Hokage; anúncio de times genin; encontro com sensei jounin no telhado ou portão.',
    goals: [
      { id: 'rank_genin', label: 'Ser Genin', check: (n) => n.rank !== 'academy' },
    ],
    rewardOnAdvance: { unlockPoints: 1 },
  },
  {
    id: 'd_missions',
    title: 'Missões Rank D',
    rank: 'genin',
    blurb: 'Catálogo de missões: catar gato, pintar cerca, carregar compras. O início de todo shinobi.',
    sceneHint: 'Centro de missões de Konoha; quadro Rank D; aldeões pedindo ajuda; sensei ri das reclamações.',
    goals: [
      { id: 'chakra45', label: 'Chakra 45', check: (n) => (n.chakra || 0) >= 45 },
      { id: 'jutsus3', label: '3 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 3 },
    ],
    rewardOnAdvance: { unlockPoints: 2 },
  },
  {
    id: 'c_missions',
    title: 'Primeira Missão Rank C',
    rank: 'genin',
    blurb: 'Escolta fora da vila. Pela primeira vez, o perigo é real.',
    sceneHint: 'Estrada rural fora de Konoha; escolta de comerciante; mato onde pode haver bandidos.',
    goals: [
      { id: 'chakra60', label: 'Chakra 60', check: (n) => (n.chakra || 0) >= 60 },
      { id: 'jutsus5', label: '5 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 5 },
      { id: 'stats40', label: 'Soma stats ≥ 40', check: (n) => ((n.ninjutsu || 0) + (n.genjutsu || 0) + (n.taijutsu || 0)) >= 40 },
    ],
    advanceRequiresJutsus: 1,
    successNeedsJutsu: true,
    rewardOnAdvance: { unlockPoints: 2, chakra: 1 },
  },
  {
    id: 'bridge_country',
    title: 'País das Ondas',
    rank: 'genin',
    blurb: 'Uma ponte, um construtor ousado e inimigos fortes demais para Rank C.',
    sceneHint: 'Vila costeira enevoada; ponte em construção; confrontos com ninjas renegados na névoa.',
    goals: [
      { id: 'chakra80', label: 'Chakra 80', check: (n) => (n.chakra || 0) >= 80 },
      { id: 'jutsus6', label: '6 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 6 },
    ],
    advanceRequiresJutsus: 1,
    successNeedsJutsu: true,
    rewardOnAdvance: { unlockPoints: 3 },
  },
  {
    id: 'chuunin_written',
    title: 'Exames Chuunin · Prova Escrita',
    rank: 'genin',
    blurb: 'Sala cheia de genin de várias vilas. A prova é também um teste de espionagem.',
    sceneHint: 'Sala de provas dos Exames Chuunin; genin de outras vilas; tensão e trapacear sem ser pego.',
    goals: [
      { id: 'chakra100', label: 'Chakra 100', check: (n) => (n.chakra || 0) >= 100 },
      { id: 'jutsus8', label: '8 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 8 },
      { id: 'stats70', label: 'Soma stats ≥ 70', check: (n) => ((n.ninjutsu || 0) + (n.genjutsu || 0) + (n.taijutsu || 0)) >= 70 },
    ],
    rewardOnAdvance: { unlockPoints: 2 },
  },
  {
    id: 'chuunin_forest',
    title: 'Floresta da Morte',
    rank: 'genin',
    blurb: 'Segundo estágio: sobreviver, pegar o pergaminho e chegar à torre.',
    sceneHint: 'Floresta da Morte; pergaminhos do céu/terra; emboscadas de outras equipes; torre ao longe.',
    goals: [
      { id: 'chakra110', label: 'Chakra 110', check: (n) => (n.chakra || 0) >= 110 },
      { id: 'jutsus9', label: '9 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 9 },
    ],
    advanceRequiresJutsus: 1,
    successNeedsJutsu: true,
    rewardOnAdvance: { unlockPoints: 3, chakra: 1 },
  },
  {
    id: 'chuunin_prelims',
    title: 'Preliminares no Arena',
    rank: 'genin',
    blurb: 'Combates individuais sob o olhar das vilas. Um erro e você cai.',
    sceneHint: 'Arena subterrânea dos Exames Chuunin; duelos 1x1; plateia de jounin e Kage.',
    goals: [
      { id: 'chakra120', label: 'Chakra 120', check: (n) => (n.chakra || 0) >= 120 },
      { id: 'jutsus10', label: '10 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 10 },
      { id: 'stats85', label: 'Soma stats ≥ 85', check: (n) => ((n.ninjutsu || 0) + (n.genjutsu || 0) + (n.taijutsu || 0)) >= 85 },
    ],
    advanceRequiresJutsus: 1,
    successNeedsJutsu: true,
    rewardOnAdvance: { unlockPoints: 3 },
  },
  {
    id: 'chuunin_finals',
    title: 'Finais · Promoção a Chuunin',
    rank: 'genin',
    blurb: 'O combate decisivo. Liderança e poder decidem quem sobe de patente.',
    sceneHint: 'Arena aberta dos finais Chuunin; plateia lotada; Hokage observa; luta de promoção.',
    goals: [
      { id: 'chakra140', label: 'Chakra 140', check: (n) => (n.chakra || 0) >= 140 },
      { id: 'jutsus12', label: '12 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 12 },
      { id: 'stats100', label: 'Soma stats ≥ 100', check: (n) => ((n.ninjutsu || 0) + (n.genjutsu || 0) + (n.taijutsu || 0)) >= 100 },
    ],
    advanceRequiresJutsus: 1,
    successNeedsJutsu: true,
    promotesTo: 'chuunin',
    rewardOnAdvance: { unlockPoints: 4, chakra: 2 },
  },
  {
    id: 'chuunin_leader',
    title: 'Chuunin · Liderança',
    rank: 'chuunin',
    blurb: 'Agora você comanda times em missões. Decisões pesam vidas.',
    sceneHint: 'Briefing de missão Rank B; você lidera genin; escolha tática sob pressão.',
    goals: [
      { id: 'rank_chuunin', label: 'Ser Chuunin', check: (n) => ['chuunin', 'jounin'].includes(n.rank) },
      { id: 'jutsus14', label: '14 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 14 },
    ],
    rewardOnAdvance: { unlockPoints: 2 },
  },
  {
    id: 'search_allies',
    title: 'Busca por Aliados',
    rank: 'chuunin',
    blurb: 'A vila precisa de força. Contratos, clãs e caminhos raros entram em jogo.',
    sceneHint: 'Viagem entre vilas; contato com sábios / clãs; decisões sobre poder e preço.',
    goals: [
      { id: 'chakra160', label: 'Chakra 160', check: (n) => (n.chakra || 0) >= 160 },
      { id: 'jutsus16', label: '16 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 16 },
    ],
    rewardOnAdvance: { unlockPoints: 3 },
  },
  {
    id: 'jounin_promotion',
    title: 'Recomendação a Jounin',
    rank: 'chuunin',
    blurb: 'Elite da Folha. Sua farda verde espera — se você provar o nível.',
    sceneHint: 'Conselho do Hokage; avaliação jounin; demonstração de poder e julgamento.',
    goals: [
      { id: 'chakra180', label: 'Chakra 180', check: (n) => (n.chakra || 0) >= 180 },
      { id: 'jutsus16b', label: '16 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 16 },
      { id: 'stats120', label: 'Soma stats ≥ 120', check: (n) => ((n.ninjutsu || 0) + (n.genjutsu || 0) + (n.taijutsu || 0)) >= 120 },
      { id: 'path', label: 'Dōjutsu, jinchūriki ou sennin', check: (n) => Boolean(n.jinchuuriki?.bijuuId || n.senninPath || (n.unlockedKekkeiIds || []).some((id) => /sharingan|byakugan|rinnegan|mangekyou/.test(String(id)))) },
    ],
    advanceRequiresJutsus: 1,
    successNeedsJutsu: true,
    promotesTo: 'jounin',
    rewardOnAdvance: { unlockPoints: 5, chakra: 3 },
  },
  {
    id: 'leaf_legend',
    title: 'Lenda da Folha',
    rank: 'jounin',
    blurb: 'Missões que mudam o mapa das Nações Shinobi. Seu nome ecoa em Konoha.',
    sceneHint: 'Campo de batalha entre nações; escolha que define legado; céu partido por chakra.',
    goals: [
      { id: 'rank_jounin', label: 'Ser Jounin', check: (n) => n.rank === 'jounin' },
      { id: 'chakra250', label: 'Chakra 250', check: (n) => (n.chakra || 0) >= 250 },
      { id: 'jutsus25', label: '25 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 25 },
      { id: 's_rank', label: '1 técnica S-rank', check: (n, catalogById) => (n.learnedJutsuIds || []).some((id) => catalogById?.(id)?.tier === 'S') },
    ],
    advanceRequiresJutsus: 1,
    successNeedsJutsu: true,
    rewardOnAdvance: { unlockPoints: 6, chakra: 3 },
  },
];

export function chapterById(id) {
  return STORY_CHAPTERS.find((c) => c.id === id) || null;
}

export function buildStoryProgress(n, catalogById) {
  ensureStoryState(n);
  const completed = new Set(n.story.completedChapterIds || []);

  const chapters = STORY_CHAPTERS.map((chapter) => {
    const goals = chapter.goals.map((goal) => {
      const done = Boolean(goal.check(n, catalogById));
      return { id: goal.id, label: goal.label, done };
    });
    const goalsComplete = goals.every((g) => g.done);
    const isDone = completed.has(chapter.id);
    return {
      id: chapter.id,
      title: chapter.title,
      blurb: chapter.blurb,
      rank: chapter.rank,
      goals,
      goalsComplete,
      complete: isDone,
      successNeedsJutsu: Boolean(chapter.successNeedsJutsu),
      advanceRequiresJutsus: chapter.advanceRequiresJutsus || 0,
    };
  });

  let currentIndex = chapters.findIndex((c) => !c.complete);
  if (currentIndex < 0) currentIndex = Math.max(0, chapters.length - 1);
  const current = chapters[currentIndex];
  const jutsuCount = (n.learnedJutsuIds || []).length;
  // Capítulos de prova (successNeedsJutsu) abrem mesmo sem jutsu — as opções é que travam.
  const hardJutsuGate = (current?.advanceRequiresJutsus || 0) > jutsuCount
    && !current?.successNeedsJutsu;
  const canAdvance = Boolean(
    current
    && !current.complete
    && current.goalsComplete
    && !hardJutsuGate
    && !n.story?.activeBeat,
  );

  const activeBeat = n.story?.activeBeat
    ? {
      ...n.story.activeBeat,
      choices: (n.story.activeBeat.choices || []).map((choice) => ({
        ...choice,
        locked: Boolean(choice.requiresJutsu && jutsuCount === 0),
      })),
    }
    : null;

  return {
    chapters,
    currentId: current?.id || chapters[0]?.id,
    currentIndex,
    percent: Math.round((completed.size / Math.max(1, chapters.length)) * 100),
    canAdvance,
    activeBeat,
    lastOutcome: n.story?.lastOutcome || null,
    finished: completed.size >= chapters.length,
  };
}

export function ensureStoryState(n) {
  if (!n.story || typeof n.story !== 'object') {
    n.story = {
      completedChapterIds: [],
      activeBeat: null,
      lastOutcome: null,
      choiceHistory: [],
    };
  }
  if (!Array.isArray(n.story.completedChapterIds)) n.story.completedChapterIds = [];
  if (!Array.isArray(n.story.choiceHistory)) n.story.choiceHistory = [];
  if (n.story.activeBeat === undefined) n.story.activeBeat = null;
  if (n.story.lastOutcome === undefined) n.story.lastOutcome = null;
  return n.story;
}
