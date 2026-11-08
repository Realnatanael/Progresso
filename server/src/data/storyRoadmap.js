/** Roadmap narrativo do Modo História (substitui o card “Próximo: Genin”). */

export const STORY_CHAPTERS = [
  {
    id: 'academy',
    title: 'Academia Ninja',
    rank: 'academy',
    blurb: 'Aprenda o básico, escolha sua natureza e feche dias de treino.',
    goals: [
      { id: 'nature', label: 'Escolher 1ª natureza', check: (n) => (n.natures || []).length >= 1 },
      { id: 'jutsus2', label: 'Aprender 2 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 2 },
      { id: 'chakra15', label: 'Chegar a 15 de chakra', check: (n) => (n.chakra || 0) >= 15 },
    ],
  },
  {
    id: 'genin_exam',
    title: 'Prova de Genin',
    rank: 'academy',
    blurb: 'A graduação: chakra, técnicas e corpo alinhados.',
    goals: [
      { id: 'chakra30', label: 'Chakra 30', check: (n) => (n.chakra || 0) >= 30 },
      { id: 'jutsus2b', label: '2 jutsus aprendidos', check: (n) => (n.learnedJutsuIds || []).length >= 2 },
      { id: 'stats15', label: 'Soma Nin+Gen+Tai ≥ 15', check: (n) => ((n.ninjutsu || 0) + (n.genjutsu || 0) + (n.taijutsu || 0)) >= 15 },
    ],
  },
  {
    id: 'genin',
    title: 'Genin · Time e Missões',
    rank: 'genin',
    blurb: 'Missões D/C, fortalecer o corpo e expandir o arsenal.',
    goals: [
      { id: 'chakra60', label: 'Chakra 60', check: (n) => (n.chakra || 0) >= 60 },
      { id: 'jutsus5', label: '5 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 5 },
      { id: 'stats40', label: 'Soma stats ≥ 40', check: (n) => ((n.ninjutsu || 0) + (n.genjutsu || 0) + (n.taijutsu || 0)) >= 40 },
    ],
  },
  {
    id: 'chuunin_exams',
    title: 'Exames Chuunin',
    rank: 'genin',
    blurb: 'Provas escritas, floresta e combate — mostre domínio.',
    goals: [
      { id: 'chakra100', label: 'Chakra 100', check: (n) => (n.chakra || 0) >= 100 },
      { id: 'jutsus8', label: '8 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 8 },
      { id: 'stats70', label: 'Soma stats ≥ 70', check: (n) => ((n.ninjutsu || 0) + (n.genjutsu || 0) + (n.taijutsu || 0)) >= 70 },
    ],
  },
  {
    id: 'chuunin',
    title: 'Chuunin',
    rank: 'chuunin',
    blurb: 'Liderança de time e técnicas de nível intermediário.',
    goals: [
      { id: 'chakra140', label: 'Chakra 140', check: (n) => (n.chakra || 0) >= 140 },
      { id: 'jutsus12', label: '12 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 12 },
      { id: 'stats100', label: 'Soma stats ≥ 100', check: (n) => ((n.ninjutsu || 0) + (n.genjutsu || 0) + (n.taijutsu || 0)) >= 100 },
    ],
  },
  {
    id: 'jounin',
    title: 'Jounin',
    rank: 'jounin',
    blurb: 'Elite da vila — secundário, dōjutsu e caminhos raros.',
    goals: [
      { id: 'chakra180', label: 'Chakra 180', check: (n) => (n.chakra || 0) >= 180 },
      { id: 'jutsus16', label: '16 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 16 },
      { id: 'path', label: 'Ter dōjutsu, jinchūriki ou sennin', check: (n) => Boolean(n.jinchuuriki?.bijuuId || n.senninPath || (n.unlockedKekkeiIds || []).some((id) => String(id).includes('sharingan') || String(id).includes('byakugan') || String(id).includes('rinnegan'))) },
    ],
  },
  {
    id: 'legend',
    title: 'Lenda da Folha',
    rank: 'jounin',
    blurb: 'Poder que marca a história da vila.',
    goals: [
      { id: 'chakra250', label: 'Chakra 250', check: (n) => (n.chakra || 0) >= 250 },
      { id: 'jutsus25', label: '25 jutsus', check: (n) => (n.learnedJutsuIds || []).length >= 25 },
      { id: 's_rank', label: '1 técnica S-rank', check: (n, catalogById) => (n.learnedJutsuIds || []).some((id) => catalogById?.(id)?.tier === 'S') },
    ],
  },
];

export function buildStoryProgress(n, catalogById) {
  const chapters = STORY_CHAPTERS.map((chapter) => {
    const goals = chapter.goals.map((goal) => {
      const done = Boolean(goal.check(n, catalogById));
      return { id: goal.id, label: goal.label, done };
    });
    const complete = goals.every((g) => g.done);
    return {
      id: chapter.id,
      title: chapter.title,
      blurb: chapter.blurb,
      rank: chapter.rank,
      goals,
      complete,
    };
  });

  let currentIndex = 0;
  for (let i = 0; i < chapters.length; i += 1) {
    currentIndex = i;
    if (!chapters[i].complete) break;
  }

  return {
    chapters,
    currentId: chapters[currentIndex]?.id || chapters[0].id,
    currentIndex,
    percent: Math.round((chapters.filter((c) => c.complete).length / chapters.length) * 100),
  };
}
