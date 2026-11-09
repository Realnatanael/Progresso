/**
 * Roteiro do Modo História (escrito à mão).
 *
 * Cada capítulo tem várias cenas (`scene`) e batalhas (`battle`). Textos curtos de propósito.
 * Placeholders: {name} {clan} {nature} {release} {rank} {jutsu} {eye} {flair}
 *
 * Resultado de uma escolha:
 *   ok     → avança para a próxima cena
 *   detour → desvio: ganha algo uma vez e a cena continua (a opção fica usada)
 *   fail   → tentativa fracassada, com dica. `lock: true` trava até amanhã (ou até evoluir)
 *
 * Escolhas personalizadas: `useJutsu` abre a lista de jutsus aprendidos; `useEye` usa dōjutsu;
 * `useNature` usa a natureza de chakra; `needs` exige um atributo mínimo.
 */

const ok = (tone, label, say, o = {}) => ({ tone, label, say, result: 'ok', ...o });
const fail = (tone, label, say, hint, o = {}) => ({ tone, label, say, hint, result: 'fail', ...o });
const detour = (tone, label, say, o = {}) => ({ tone, label, say, result: 'detour', ...o });
const useJutsu = (label, say, o = {}) => ({ tone: 'jutsu', kind: 'jutsu', label, say, result: 'ok', ...o });
const useEye = (label, say, o = {}) => ({ tone: 'jutsu', kind: 'eye', label, say, result: 'ok', ...o });
const useNature = (label, say, o = {}) => ({ tone: 'jutsu', kind: 'nature', label, say, result: 'ok', ...o });

const scene = (id, o) => ({ type: 'scene', id, ...o });
const battle = (id, o) => ({ type: 'battle', id, ...o });

const IRUKA = { name: 'Iruka', role: 'Sensei da Academia' };
const HOKAGE = { name: 'Hokage', role: 'Líder de Konoha' };
const KAKASHI = { name: 'Kakashi', role: 'Sensei Jounin', sprite: 'jounin' };

export const STORY_SCRIPT = {
  /* ───────────── 1 · Academia ───────────── */
  academy_day_one: [
    scene('gates', {
      bg: 'gates',
      place: 'Portões Aun',
      mood: 'Nervosismo',
      who: IRUKA,
      text: 'O sol sobe sobre os Portões Aun. Iruka confere a lista: “Primeiro dia, turma. Quem vai se apresentar?”',
      lore: 'Konoha, a Vila Oculta da Folha, forma seus ninjas na Academia. A bandana com o símbolo da folha só vem na formatura.',
      choices: [
        ok('coragem', 'Dar um passo à frente e se apresentar', 'Você diz seu nome e o clã {clan}. Iruka assente: “Bom começo, {name}.”', { reward: { pts: 1 } }),
        fail('cautela', 'Ficar escondido no fundo da fila', 'Ninguém chama seu nome. O sino toca e você não está na lista.', 'Apresente-se: a Academia só conta quem aparece.'),
        detour('empatia', 'Ajudar um aluno perdido a achar a sala', 'Um colega nervoso agradece. Você ganhou um aliado, e Iruka reparou.', { reward: { pts: 1 }, flag: 'friend' }),
      ],
    }),
    scene('nature', {
      bg: 'classroom',
      place: 'Sala 1 · Academia',
      mood: 'Curiosidade',
      who: IRUKA,
      text: '“Todo ninja nasce com uma natureza de chakra”, explica Iruka. “A sua é {nature}. Vamos ver se ela te obedece.”',
      lore: 'Fogo vence Vento, Vento vence Raio, Raio vence Terra, Terra vence Água, Água vence Fogo. Esse ciclo decide muitas lutas.',
      choices: [
        useNature('Canalizar seu chakra de {nature}', 'O chakra responde. {flair} Iruka anota seu nome entre os alunos promissores.', { reward: { pts: 1 } }),
        fail('astucia', 'Dizer que não sentiu nada só para escapar da prova', 'Iruka ergue a sobrancelha: “Sem tentar, não aprende.” A turma ri baixinho.', 'Tente de verdade: toque no seu chakra e canalize a natureza.'),
        detour('empatia', 'Perguntar ao sensei sobre as outras naturezas', 'Iruka desenha o ciclo no quadro. Você anota: isso vai salvar sua pele numa luta.', { reward: { pts: 1 }, flag: 'knows_cycle' }),
      ],
    }),
  ],

  academy_basics: [
    scene('seals', {
      bg: 'classroom',
      place: 'Sala 3 · Academia',
      mood: 'Concentração',
      who: IRUKA,
      text: '“Bunshin, henge e kawarimi: as três bases”, diz Iruka, batendo o giz no quadro. “Quem demonstra primeiro?”',
      lore: 'Selos de mão moldam o chakra. Os doze selos do zodíaco são a base de quase todo jutsu.',
      choices: [
        useJutsu('Demonstrar um jutsu que você aprendeu', 'Você faz os selos com calma e {jutsu} sai firme. {flair} Iruka sorri: “Assim se faz.”', { reward: { pts: 1 }, lockReason: 'Aprenda um jutsu em Ninja → Jutsus' }),
        fail('cautela', 'Tentar sem selos, só na força de vontade', 'A fumaça sobe, o clone não. A turma ri e o giz de Iruka quica na sua testa.', 'Use um jutsu que você já aprendeu (veja a aba Jutsus em Ninja).'),
        detour('astucia', 'Observar um colega e copiar o ritmo dos selos', 'Você capta o ritmo dos selos. Na sua vez, vai ser mais fácil.', { reward: { pts: 1 }, flag: 'watched' }),
      ],
    }),
    scene('kawarimi', {
      bg: 'yard',
      place: 'Pátio de treino',
      mood: 'Agilidade',
      who: IRUKA,
      text: 'No pátio, Iruka lança troncos pesados em você. “Kawarimi: troque de lugar com algo e esquive!”',
      lore: 'A Substituição (Kawarimi) troca você de lugar com um objeto no último instante. É um dos jutsus mais usados por ninjas.',
      choices: [
        ok('astucia', 'Esperar o último segundo e trocar de lugar com o tronco', 'O tronco acerta o ar. Você aparece atrás de Iruka, que sorri: “Bom timing.”', { reward: { pts: 1 } }),
        fail('coragem', 'Segurar o tronco de frente, na força', 'O tronco pesa mais do que parece e te joga no chão. A turma segura o riso.', 'Kawarimi é esquiva, não força: troque de lugar em vez de resistir.'),
        detour('empatia', 'Ajudar um colega que errou o selo', 'Você ensina o selo certo. O colega agora te deve uma.', { reward: { pts: 1 }, flag: 'friend' }),
      ],
    }),
  ],

  academy_rival: [
    scene('provoke', {
      bg: 'yard',
      place: 'Pátio de treino',
      mood: 'Provocação',
      who: { name: 'Daichi', role: 'Rival da turma', sprite: 'rival' },
      text: 'Daichi bloqueia seu caminho com um sorriso torto. “Clã {clan}? Prova que não é só sobrenome.”',
      lore: 'Sparring (luta de treino) é permitido sob supervisão. Vence quem controla o ritmo, não só quem bate mais forte.',
      choices: [
        ok('coragem', 'Aceitar o sparring e erguer a guarda', '“Combinado.” O pátio abre uma roda em volta de vocês.'),
        ok('provocacao', 'Provocar de volta: “Quando quiser, Daichi.”', 'A turma assobia. Daichi fecha o punho: “Agora vai ser sério.”', { flag: 'cocky' }),
        fail('cautela', 'Ignorar e ir embora', 'A zombaria vira cochicho. Iruka balança a cabeça: ignorar também é uma escolha.', 'Aceite o desafio: um sparring é o jeito de provar seu valor.'),
      ],
    }),
    battle('sparring', {
      bg: 'yard',
      place: 'Pátio de treino',
      mood: 'Tensão',
      who: { name: 'Daichi', role: 'Rival da turma', sprite: 'rival' },
      text: 'Daichi ataca primeiro. Golpes, jutsus e guarda: use tudo o que aprendeu.',
      lore: 'Daichi usa Fuuton. Fogo vence Vento: um Katon bem lançado pesa na luta.',
      enemy: 'rival',
      rounds: 6,
      winAtEnemyPct: 30,
      flagBuffs: { cocky: { enemyAtk: 1.1, playerBoost: 1.1 }, knows_cycle: { playerBoost: 1.1 } },
      win: 'Daichi cai sentado, ofegante. “Tá… você é bom.” Iruka levanta a mão: “Basta.”',
      lose: 'Daichi te derruba e sorri. Iruka interrompe: “Treine mais. Elementos e guarda fazem diferença.”',
      hint: 'Daichi usa Vento: Fogo vence Vento. Use Guarda nos golpes fortes e um jutsu quando tiver chakra.',
    }),
    scene('after-spar', {
      bg: 'yard',
      place: 'Pátio de treino',
      mood: 'Respeito',
      who: IRUKA,
      text: 'Iruka se aproxima. “Vencer é uma coisa. O que você faz com a vitória é outra.”',
      choices: [
        ok('empatia', 'Estender a mão para Daichi se levantar', 'Daichi hesita e aperta sua mão. “Na próxima eu ganho.” Um rival com respeito.', { reward: { pts: 1 }, flag: 'respect' }),
        ok('provocacao', 'Dar um sorriso e deixar Daichi no chão', 'Daichi cerra os dentes. “Você vai se arrepender.” Um rival de verdade.', { reward: { ck: 1 }, flag: 'rivalry' }),
      ],
    }),
  ],

  genin_graduation: [
    scene('exam', {
      bg: 'exam-hall',
      place: 'Sala de exames',
      mood: 'Tensão',
      who: { name: 'Iruka', role: 'Examinador' },
      text: 'Iruka cruza os braços. “Prova de Genin: demonstre um jutsu. Sem técnica, não há bandana.” A sala prende a respiração.',
      lore: 'Quem passa recebe a bandana com o símbolo da vila e vira Genin: ninja de verdade, pronto para missões em equipe.',
      choices: [
        useJutsu('Executar um jutsu diante do examinador', '{jutsu}! {flair} Iruka acena: “Aprovado.”', { reward: { pts: 1 }, lockReason: 'Aprenda um jutsu em Ninja → Jutsus' }),
        fail('cautela', 'Pedir mais tempo para respirar', 'Iruka balança a cabeça. “Sem demonstração, não há graduação hoje.”', 'A prova exige um jutsu. Aprenda um em Ninja → Jutsus e volte.', { lock: true }),
        fail('astucia', 'Blefar com selos errados e pose de elite', 'Iruka percebe de longe. “Selos errados não enganam ninguém.”', 'Escolha um jutsu que você realmente sabe usar.', { lock: true }),
      ],
    }),
    scene('temptation', {
      bg: 'village',
      place: 'Ruas de Konoha',
      mood: 'Dilema',
      who: { name: 'Mizuki', role: 'Instrutor' },
      text: 'Ao entardecer, Mizuki sussurra: “Existe um atalho. Roube o pergaminho proibido e sua graduação está garantida.”',
      lore: 'O Pergaminho Selado guarda técnicas proibidas da vila. Tocar nele sem ordem do Hokage é traição.',
      choices: [
        ok('coragem', 'Recusar e correr para avisar Iruka', 'Iruka escuta em silêncio e então te entrega a bandana: “Você escolheu o caminho certo.”', { reward: { pts: 1 }, flag: 'loyal' }),
        detour('astucia', 'Fingir que aceita para descobrir o plano', 'Você ouve mais do que devia: Mizuki está de olho nos selos da vila. Informação valiosa.', { reward: { ck: 1 }, flag: 'spy' }),
        fail('provocacao', 'Aceitar o atalho', 'Era uma armadilha. Iruka te encontra no meio da trilha e a graduação some.', 'Atalhos assim são armadilhas. Recuse e avise Iruka.', { lock: true }),
      ],
    }),
  ],

  /* ───────────── 2 · Genin ───────────── */
  team_assignment: [
    scene('hokage', {
      bg: 'hokage',
      place: 'Sala do Hokage',
      mood: 'Expectativa',
      who: HOKAGE,
      text: 'O Hokage lê os times. “{name}, do clã {clan}: você formará um time de três com um Jounin como líder.”',
      lore: 'Equipes de três genin mais um sensei Jounin são a base da força de Konoha. Os times cumprem missões juntos.',
      choices: [
        ok('coragem', 'Aceitar o time e agradecer ao Hokage', '“Bom espírito”, sorri o Hokage. “Seu sensei já espera.”', { reward: { pts: 1 } }),
        ok('astucia', 'Pedir informações sobre o sensei antes de sair', 'O Hokage ri: “Cauteloso. Ele é… peculiar.” Você sai preparado.', { flag: 'prepared' }),
      ],
    }),
    scene('bells', {
      bg: 'village',
      place: 'Telhados de Konoha',
      mood: 'Desafio',
      who: KAKASHI,
      text: 'Kakashi balança dois sinos. “Peguem até o meio-dia. Quem falhar fica sem almoço.” Você olha seus colegas de time.',
      lore: 'O teste dos sinos não é sobre força: ninguém consegue sozinho. Kakashi quer ver quem entende o que é trabalhar em equipe.',
      choices: [
        ok('empatia', 'Propor um plano em equipe com os colegas', 'Seus colegas aceitam. “Juntos.” Kakashi esconde um sorriso atrás da máscara.', { flag: 'teamwork', reward: { pts: 1 } }),
        ok('coragem', 'Ir sozinho atrás do sino', 'Você avança sem esperar ninguém. Kakashi te manda ao chão num piscar de olhos.', { flag: 'solo' }),
        detour('astucia', 'Observar Kakashi antes de agir', 'Você estuda o padrão dele: Kakashi nunca ataca de frente.', { reward: { pts: 1 }, flag: 'observed' }),
      ],
    }),
    battle('bell-test', {
      bg: 'village',
      place: 'Telhados de Konoha',
      mood: 'Pressão',
      who: KAKASHI,
      text: 'Kakashi some e reaparece atrás de você. Sobreviva até o meio-dia: guarda, esquiva e cabeça fria.',
      lore: 'Você não precisa vencer Kakashi, só aguentar. Guarda reduz o dano; Substituição e dōjutsu ajudam a esquivar.',
      enemy: 'kakashi',
      mode: 'survive',
      rounds: 5,
      flagBuffs: {
        teamwork: { enemyAtk: 0.75 },
        solo: { enemyAtk: 1.15 },
        observed: { enemyAtk: 0.9, playerBoost: 1.1 },
      },
      win: 'O sino do meio-dia toca. Kakashi suspira: “Passaram. Quem sobrevive junto, vence junto.”',
      lose: 'Kakashi te segura pelo colarinho: “Falhou. Sozinho, ninguém passa neste teste.”',
      hint: 'Sobreviva 5 rodadas. Guarda corta 60% do dano e recupera chakra; use jutsus de esquiva se tiver.',
    }),
  ],

  d_missions: [
    scene('board', {
      bg: 'village',
      place: 'Centro de Missões',
      mood: 'Ironia',
      who: KAKASHI,
      text: 'O quadro de missões está cheio: gato perdido, cerca torta, compras da vovó. Kakashi ri: “Todo Hokage começou assim.”',
      lore: 'Missões vão do Rank D (tarefas simples) ao Rank S (quase suicidas). Todo genin começa pelas de Rank D.',
      choices: [
        ok('empatia', 'Pegar a missão do gato perdido e fazer direito', 'Carimbo no pergaminho. O gato Tora tem fama de fugitivo: vai ser divertido.', { reward: { pts: 1 } }),
        detour('astucia', 'Dividir as tarefas com o time', 'O time ri, divide o trabalho e a papelada fica pronta em minutos.', { reward: { pts: 1 }, flag: 'team_ok' }),
        fail('provocacao', 'Exigir uma missão “de verdade”', 'Kakashi encolhe os ombros. “Sem Rank D, nada de Rank C.”', 'Aceite uma missão de Rank D: toda carreira de ninja começa por elas.'),
      ],
    }),
    scene('tora', {
      bg: 'village',
      place: 'Telhados de Konoha',
      mood: 'Caça ao gato',
      who: { name: 'Tora', role: 'Gato do daimyo' },
      text: 'Tora, o gato do daimyo, corre pelos telhados. Um erro e ele foge de novo, e ainda arranha.',
      lore: 'A caçada ao gato Tora é lenda entre os genin: o bicho é esperto e odeia ser pego.',
      choices: [
        useJutsu('Usar um jutsu para cercar o gato', 'Você usa {jutsu} com cuidado. {flair} Tora para, confuso, e você o pega no colo.', {
          works: ['wind', 'earth', 'lightning'],
          weak: ['fire', 'water'],
          weakFails: true,
          softFail: true,
          failSay: '{jutsu} assusta Tora: fogo e água o enfurecem. Ele arranha seu rosto e foge pelo telhado.',
          failHint: 'Gatos odeiam fogo e água. Tente um jutsu de Vento, Terra, Raio ou sem elemento.',
          reward: { pts: 1 },
          lockReason: 'Aprenda um jutsu em Ninja → Jutsus',
        }),
        ok('astucia', 'Montar uma armadilha de peixe seco no beco', 'O cheiro de peixe atrai Tora. Ele cai direto na rede.'),
        fail('coragem', 'Correr atrás dele em linha reta', 'Tora vira num beco e some. Você acaba de cara na parede.', 'Gato não se pega na corrida: monte uma armadilha ou use um jutsu.'),
      ],
    }),
    scene('delivery', {
      bg: 'hokage',
      place: 'Escritório do Hokage',
      mood: 'Alívio',
      who: { name: 'Esposa do Daimyo', role: 'Cliente' },
      text: 'A esposa do daimyo agarra Tora com força. “Meu bebê!” O gato mia como quem pede socorro.',
      choices: [
        ok('empatia', 'Entregar o gato com um sorriso e um relatório caprichado', 'Ela agradece com entusiasmo. Kakashi anota: missão limpa.', { reward: { pts: 1 } }),
        ok('astucia', 'Sugerir que ela deixe o gato respirar', 'Ela ri, constrangida, e afrouxa o abraço. Tora te olha com gratidão.', { reward: { ck: 1 } }),
      ],
    }),
  ],

  c_missions: [
    scene('escort', {
      bg: 'road',
      place: 'Estrada fora de Konoha',
      mood: 'Alerta',
      who: KAKASHI,
      text: 'Primeira escolta fora da vila. O comerciante engole seco: “Tem… bandidos nessa estrada?” Kakashi só responde: “Fiquem atentos.”',
      lore: 'Missões Rank C já envolvem risco real: bandidos, feras e até ninjas desertores.',
      choices: [
        ok('cautela', 'Ir na frente, observando cada sombra', 'Você vê galhos quebrados na beira da estrada: há uma emboscada armada.', { flag: 'scouted', reward: { pts: 1 } }),
        ok('empatia', 'Ficar ao lado do comerciante e acalmá-lo', 'Ele respira melhor. Você terá alguém protegido por perto quando o perigo vier.', { flag: 'protect' }),
        useJutsu('Usar um jutsu sensor ou dōjutsu para varrer a mata', '{jutsu} revela vultos escondidos. {flair}', {
          filter: { category: ['sensor', 'dojutsu', 'genjutsu'] },
          flag: 'scouted',
          lockReason: 'Precisa de um jutsu sensor, dōjutsu ou genjutsu',
        }),
      ],
    }),
    battle('ambush', {
      bg: 'road',
      place: 'Estrada fora de Konoha',
      mood: 'Perigo',
      who: { name: 'Líder dos Bandidos', role: 'Emboscada', sprite: 'bandit' },
      text: 'Os bandidos saltam do mato. Proteja o cliente: a missão exige um jutsu seu.',
      lore: 'Bandidos usam terreno e números. Raio vence Terra, e eles lutam com a força bruta da terra.',
      enemy: 'bandit',
      rounds: 7,
      mustUseJutsu: true,
      flagBuffs: { scouted: { enemyAtk: 0.85 }, protect: { playerHp: 1.1 } },
      win: 'Os bandidos fogem ou caem amarrados. O cliente chega inteiro, e Kakashi carimba o relatório.',
      lose: 'Os bandidos te cercam. Kakashi interrompe a emboscada, sério: “Faltou técnica de verdade.”',
      hint: 'A missão exige que você use pelo menos um jutsu. Raio vence Terra; Guarda reduz o dano dos golpes fortes.',
    }),
    scene('prisoner', {
      bg: 'road',
      place: 'Estrada fora de Konoha',
      mood: 'Suspeita',
      who: { name: 'Líder dos Bandidos', role: 'Capturado', sprite: 'bandit' },
      text: 'O líder, amarrado, cospe no chão. “Fomos pagos… por alguém numa ponte no País das Ondas.”',
      lore: 'Muitos bandidos são contratados por magnatas e ninjas renegados, que evitam sujar as próprias mãos.',
      choices: [
        ok('coragem', 'Levá-lo preso e relatar tudo em Konoha', 'Kakashi concorda: “Boa decisão. Algo se move no País das Ondas.”', { reward: { pts: 1 }, flag: 'report' }),
        ok('empatia', 'Soltar os jovens e manter só o líder', 'Os mais novos fogem agradecidos. Kakashi: “Hm… arriscado, mas humano.”', { flag: 'mercy' }),
      ],
    }),
  ],

  bridge_country: [
    scene('bridge', {
      bg: 'mist-bridge',
      place: 'Ponte de Tazuna · País das Ondas',
      mood: 'Mistério',
      who: { name: 'Tazuna', role: 'Construtor de pontes' },
      text: 'A neblina engole a ponte inacabada. Tazuna sussurra: “Um magnata chamado Gato contratou o Demônio da Névoa para me calar.”',
      lore: 'O País das Ondas é uma ilha pobre dominada por Gato. A ponte de Tazuna é a esperança de liberdade do povo.',
      choices: [
        ok('coragem', 'Prometer proteger Tazuna até o fim da ponte', '“Obrigado”, ele aperta sua mão. O time forma um círculo em volta dele.', { reward: { pts: 1 }, flag: 'protect_tazuna' }),
        ok('cautela', 'Manter Tazuna no centro e vigiar a névoa', 'Qualquer ataque terá que passar pelo time primeiro.', { flag: 'formation' }),
      ],
    }),
    scene('mist', {
      bg: 'mist-bridge',
      place: 'Ponte · Névoa densa',
      mood: 'Perigo',
      who: { name: 'Zabuza', role: 'Demônio da Névoa', sprite: 'swordsman' },
      text: 'A névoa fica cada vez mais espessa. Uma voz grave ecoa: “Entreguem o velho. Quem se meter, morre.”',
      lore: 'Zabuza Momochi é um ninja renegado da Névoa, mestre do Suiton e da arte de matar em silêncio.',
      choices: [
        useJutsu('Dissipar a névoa com um jutsu', 'Você lança {jutsu}. {flair} A névoa se abre e Zabuza fica à vista.', {
          works: ['fire', 'wind'],
          flagWorks: 'mist_cleared',
          weak: ['water'],
          weakSay: '{jutsu} só alimenta a névoa de Zabuza. Ela fica ainda mais densa.',
          flagWeak: 'mist_thick',
          reward: { pts: 1 },
          lockReason: 'Aprenda um jutsu em Ninja → Jutsus',
        }),
        ok('cautela', 'Formar o círculo e esperar o primeiro golpe', 'O time fecha as costas. O golpe vem da névoa, mas vocês estão prontos.', { flag: 'formation' }),
        ok('coragem', 'Avançar contra a voz, às cegas', 'Você corre na direção da voz. Zabuza surge diante de você, sorrindo atrás das ataduras.', { flag: 'rushed' }),
      ],
    }),
    battle('zabuza', {
      bg: 'mist-bridge',
      place: 'Ponte · Névoa densa',
      mood: 'Duelo',
      who: { name: 'Zabuza', role: 'Demônio da Névoa', sprite: 'swordsman' },
      text: 'Zabuza ergue a espada gigante. “Mostre que tem coragem de verdade.”',
      lore: 'Zabuza usa Suiton. Terra vence Água: Doton é o caminho, e Guarda segura a Kubikiribōchō.',
      enemy: 'swordsman',
      rounds: 7,
      mustUseJutsu: true,
      flagBuffs: {
        mist_cleared: { enemyAtk: 0.8, enemyHp: 0.9 },
        mist_thick: { enemyAtk: 1.15 },
        protect_tazuna: { playerBoost: 1.05 },
        formation: { playerHp: 1.1 },
        rushed: { playerBoost: 1.1, enemyAtk: 1.1 },
      },
      win: 'Zabuza recua, ferido, e some na névoa. A ponte continua de pé.',
      lose: 'A Kubikiribōchō te lança contra o chão. Zabuza some: “Volte quando tiver técnica.”',
      hint: 'Zabuza usa Água: Terra vence Água. Guarda reduz muito o corte da espada gigante.',
    }),
    scene('after-bridge', {
      bg: 'mist-bridge',
      place: 'Ponte · Fim da névoa',
      mood: 'Silêncio',
      who: { name: 'Tazuna', role: 'Construtor de pontes' },
      text: 'A névoa se dissipa. Tazuna sorri, trêmulo: “Meu povo vai poder atravessar. Obrigado.”',
      choices: [
        ok('empatia', 'Ajudar a terminar a ponte com o time', 'Vocês trabalham dia e noite. Quando termina, o povo dá à ponte um nome em homenagem ao time.', { reward: { pts: 1 } }),
        ok('coragem', 'Voltar a Konoha ao amanhecer', 'Vocês partem cedo. A ponte fica de pé, e a história também.'),
      ],
    }),
  ],

  /* ───────────── 3 · Exames Chuunin ───────────── */
  chuunin_written: [
    scene('rules', {
      bg: 'exam-hall',
      place: 'Sala da Prova Escrita',
      mood: 'Tensão',
      who: { name: 'Ibiki', role: 'Examinador' },
      text: '“Dez perguntas, uma hora. Quem for pego trapaceando perde pontos. Cinco infrações e o time inteiro é eliminado.”',
      lore: 'A prova escrita é impossível de responder só com estudo. O verdadeiro teste é coletar informação sem ser pego.',
      choices: [
        useEye('Usar o {eye} para ler os movimentos dos colegas', 'Seus olhos captam cada traço de lápis. Ninguém percebe.', { eyes: ['sharingan', 'byakugan', 'mangekyou', 'rinnegan'], reward: { pts: 1 }, flag: 'cheated' }),
        useJutsu('Usar um jutsu sensor ou genjutsu discreto', '{jutsu} age sem alarde. {flair} As respostas vêm a você.', {
          filter: { category: ['sensor', 'genjutsu', 'dojutsu'] },
          flag: 'cheated',
          reward: { pts: 1 },
          lockReason: 'Precisa de um jutsu sensor, genjutsu ou dōjutsu',
        }),
        ok('astucia', 'Resolver o que dá e observar quem sabe mais', 'Você usa a cabeça e a lógica. Funciona até a última questão.', { flag: 'honest' }),
        fail('provocacao', 'Copiar descaradamente do vizinho', 'Um examinador marca seu nome. “Primeira infração.”', 'Seja sutil: copiar às claras é eliminação.'),
      ],
    }),
    scene('tenth', {
      bg: 'exam-hall',
      place: 'Sala da Prova Escrita',
      mood: 'Pressão',
      who: { name: 'Ibiki', role: 'Examinador' },
      text: '“A décima pergunta: quem aceitar e errar nunca mais será Chuunin. Quem desistir sai com o time e tenta no ano que vem.”',
      lore: 'A décima pergunta é um teste de coragem disfarçado. Quem fica prova que aguenta a pressão de um líder.',
      choices: [
        ok('coragem', 'Ficar e arriscar tudo', '“Se arrisco, que seja de pé”, você diz. Ibiki sorri: “Passou. Era a única resposta.”', { reward: { pts: 1 }, flag: 'brave' }),
        fail('cautela', 'Desistir para proteger o time', 'Seu time recua com você. “Ano que vem”, diz Ibiki.', 'A décima pergunta pede coragem: quem fica, passa.', { lock: true }),
      ],
    }),
    scene('rival-cameo', {
      bg: 'exam-hall',
      place: 'Corredor da torre',
      mood: 'Reencontro',
      who: { name: 'Daichi', role: 'Rival', sprite: 'rival' },
      text: 'No corredor, Daichi te encara. “Passou, é? Vamos ver quem chega vivo à Floresta.”',
      extra: [
        { flag: 'respect', text: 'Ele aperta seu ombro com respeito: “Boa sorte, de verdade.”' },
        { flag: 'rivalry', text: 'Ele cerra os dentes: “Ainda tenho contas a acertar com você.”' },
      ],
      choices: [
        ok('coragem', 'Desejar boa sorte e seguir em frente', '“Nos vemos lá”, você diz. Daichi sorri de canto.', { reward: { ck: 1 } }),
        ok('provocacao', 'Dizer que ele vai precisar de mais que sorte', 'Daichi ri, nervoso. A rivalidade segue acesa.'),
      ],
    }),
  ],

  chuunin_forest: [
    scene('gate', {
      bg: 'forest',
      place: 'Floresta da Morte',
      mood: 'Perigo',
      who: { name: 'Anko', role: 'Examinadora' },
      text: '“Cinco dias, dois pergaminhos: Céu e Terra. Cheguem à torre com os dois, ou não cheguem.” O portão range ao abrir.',
      lore: 'A Floresta da Morte abriga feras gigantes e venenos. Equipes lutam entre si pelos pergaminhos.',
      choices: [
        ok('cautela', 'Entrar devagar, marcando o terreno', 'Você marca árvores e rastros. Chegar vivo vale mais que chegar rápido.', { flag: 'careful', reward: { pts: 1 } }),
        ok('coragem', 'Avançar rápido para sair na frente', 'Vocês cortam caminho, mas deixam rastros fáceis de seguir.', { flag: 'fast' }),
      ],
    }),
    scene('killer-intent', {
      bg: 'forest',
      place: 'Clareira · Coração da Floresta',
      mood: 'Pavor',
      who: { name: 'Orochimaru', role: 'Ninja desconhecido', sprite: 'serpent' },
      text: 'O ar congela. Um ninja pálido sorri entre as árvores: “Mostrem do que seu chakra é feito.” A intenção assassina te paralisa.',
      lore: 'Intenção assassina é pura pressão de chakra: quem não resiste, congela. Resistir exige mente forte.',
      choices: [
        ok('coragem', 'Resistir à pressão e encará-lo', 'Você cerra os dentes. Seu chakra empurra o medo para longe.', { needs: { stat: 'genjutsu', min: 12 }, flag: 'resisted', reward: { pts: 1 } }),
        useJutsu('Quebrar o medo com um jutsu', '{jutsu}! {flair} O estrondo sacode a paralisia.', { flag: 'broke_fear', reward: { pts: 1 }, lockReason: 'Aprenda um jutsu em Ninja → Jutsus' }),
        ok('cautela', 'Recuar devagar sem tirar os olhos dele', 'Vocês recuam sem correr. Ele parece não ter pressa nenhuma.', { flag: 'retreat' }),
      ],
    }),
    battle('serpent', {
      bg: 'forest',
      place: 'Clareira · Coração da Floresta',
      mood: 'Sobrevivência',
      who: { name: 'Orochimaru', role: 'Ninja desconhecido', sprite: 'serpent' },
      text: 'Ele é forte demais para vencer. Aguente até o chakra dele cansar: guarda, esquiva e um jutsu bem colocado.',
      lore: 'Orochimaru é um dos Sannin lendários. Aqui o objetivo é sobreviver, não vencer.',
      enemy: 'serpent',
      mode: 'survive',
      rounds: 6,
      mustUseJutsu: true,
      flagBuffs: {
        resisted: { enemyAtk: 0.85 },
        broke_fear: { enemyAtk: 0.9 },
        retreat: { playerHp: 0.9 },
        careful: { playerChakra: 1.1 },
        fast: { playerHp: 0.95 },
      },
      win: 'Ele para, sorri e recua para a floresta: “Interessante. Muito interessante.” Você sobreviveu.',
      lose: 'A mordida te derruba. Ele some entre as árvores, como se nada tivesse acontecido.',
      hint: 'Sobreviva 6 rodadas usando pelo menos um jutsu. Guarda corta 60% do dano e dá chakra; esquivas ajudam muito.',
    }),
    scene('tower', {
      bg: 'forest',
      place: 'Torre · Fim da Floresta',
      mood: 'Alívio',
      who: { name: 'Anko', role: 'Examinadora' },
      text: 'Você chega à torre com os dois pergaminhos. Anko ergue as sobrancelhas: “Sobreviveu a ele? Interessante.”',
      choices: [
        ok('empatia', 'Dividir comida e curativos com o time antes das finais', 'Os três dormem como pedras. Amanhã a arena espera.', { reward: { pts: 1 } }),
        ok('astucia', 'Estudar o que viu e preparar uma tática', 'Você anota padrões e fraquezas. Quem prepara, sobrevive.', { reward: { ck: 1 } }),
      ],
    }),
  ],

  chuunin_prelims: [
    scene('draw', {
      bg: 'arena',
      place: 'Arena das Preliminares',
      mood: 'Expectativa',
      who: { name: 'Temari', role: 'Vila da Areia', sprite: 'kunoichi' },
      text: 'O painel gira com nomes. “{name} contra Temari, da Vila da Areia.” Do outro lado, ela abre um leque gigante.',
      lore: 'Temari domina Fuuton com um leque de guerra. Fogo vence Vento: o fogo se alimenta do vento dela.',
      choices: [
        ok('coragem', 'Subir à arena sem hesitar', 'A plateia vibra. Você pisa na areia com firmeza.'),
        ok('cautela', 'Estudar o estilo do leque antes do combate', 'Ela luta à distância e usa o vento como arma. Você nota o padrão.', { flag: 'studied', reward: { pts: 1 } }),
      ],
    }),
    battle('temari', {
      bg: 'arena',
      place: 'Arena das Preliminares',
      mood: 'Duelo',
      who: { name: 'Temari', role: 'Vila da Areia', sprite: 'kunoichi' },
      text: 'Temari abana o leque e o vento vira lâmina. Aproxime-se, use elemento e proteja-se.',
      lore: 'Fogo vence Vento. Um Katon contra o vento de Temari pode virar uma tempestade de chamas.',
      enemy: 'kunoichi',
      rounds: 7,
      mustUseJutsu: true,
      flagBuffs: { studied: { enemyAtk: 0.9, playerBoost: 1.1 } },
      win: 'Temari fecha o leque, respirando fundo. “Perdi.” O árbitro levanta seu braço.',
      lose: 'O vento te derruba da arena. Temari fecha o leque com um aceno de cabeça.',
      hint: 'Temari usa Vento: Fogo vence Vento. Aproveite o chakra em jutsus e use Guarda nos golpes fortes.',
    }),
    scene('after-prelims', {
      bg: 'arena',
      place: 'Arena das Preliminares',
      mood: 'Vitória',
      who: { name: 'Hayate', role: 'Árbitro' },
      text: '“Vencedor: {name}.” A plateia aplaude. Nos camarotes, jounin anotam seu nome com interesse.',
      choices: [
        ok('empatia', 'Cumprimentar Temari antes de sair', 'Ela assente de leve. Respeito entre guerreiros.', { reward: { pts: 1 } }),
        ok('astucia', 'Sair rápido e esconder suas técnicas dos olheiros', 'Quem não se mostra, não é estudado. Boa jogada.', { reward: { ck: 1 } }),
      ],
    }),
  ],

  chuunin_finals: [
    scene('finals', {
      bg: 'arena',
      place: 'Arena · Finais',
      mood: 'Glória',
      who: { name: 'Gaara', role: 'Finalista da Areia', sprite: 'sand' },
      text: 'A arena está lotada e o Hokage observa do camarote. Um garoto ruivo cruza os braços: “Vou provar minha existência.”',
      lore: 'Os finais atraem Kages, daimyos e olheiros. Quem sobe é reconhecido como líder de equipe.',
      choices: [
        ok('coragem', 'Encarar o olhar dele sem recuar', 'Ele inclina a cabeça, curioso. A areia ao redor dele começa a se mexer.'),
        ok('cautela', 'Estudar a areia que cerca os pés dele', 'Areia viva: manto de defesa e ataque. Raio e Fogo podem rompê-la.', { flag: 'studied_sand', reward: { pts: 1 } }),
      ],
    }),
    battle('gaara', {
      bg: 'arena',
      place: 'Arena · Finais',
      mood: 'Duelo',
      who: { name: 'Gaara', role: 'Finalista da Areia', sprite: 'sand' },
      text: 'A areia se ergue como uma onda. Rompa a defesa e aguente os golpes mais fortes.',
      lore: 'Gaara usa Terra. Raio vence Terra: Raiton rompe a areia. Quando ferido, ele fica mais agressivo.',
      enemy: 'sand',
      rounds: 8,
      mustUseJutsu: true,
      flagBuffs: { studied_sand: { playerBoost: 1.1 } },
      win: 'A areia desaba. Gaara baixa a cabeça: “Você… me superou.” O Hokage se levanta, aplaudindo.',
      lose: 'A areia te prende e aperta. O árbitro interrompe: “Chega.” Você caiu diante de todos.',
      hint: 'Gaara usa Terra: Raio vence Terra. Quando ferido ele enfurece, então Guarda e chakra importam.',
    }),
    scene('promotion', {
      bg: 'arena',
      place: 'Arena · Cerimônia',
      mood: 'Honra',
      who: HOKAGE,
      text: 'O Hokage desce ao centro com o colete verde. “{name}, de hoje em diante você é Chuunin. Lidere com o coração.”',
      lore: 'Chuunin lideram times em missões. O colete verde simboliza a confiança da vila.',
      choices: [
        ok('empatia', 'Aceitar o colete e agradecer ao time', 'Seus colegas erguem os punhos, orgulhosos. Você aperta o colete contra o peito.', { reward: { pts: 1 } }),
        ok('coragem', 'Prometer proteger a vila com a vida', 'A arena fica em silêncio. O Hokage assente devagar.'),
      ],
    }),
  ],

  /* ───────────── 4 · Chuunin ───────────── */
  chuunin_leader: [
    scene('briefing', {
      bg: 'hokage',
      place: 'Sala de Missões',
      mood: 'Responsabilidade',
      who: HOKAGE,
      text: 'Missão Rank B: escoltar remédios por terra hostil. “Você lidera dois genin, {name}. Decida bem.”',
      lore: 'Chuunin comandam missões Rank B e decidem a vida de seus subordinados em segundos.',
      choices: [
        ok('coragem', 'Aceitar a missão e partir ao amanhecer', 'Os dois genin te olham com admiração. Não há tempo a perder.', { reward: { pts: 1 } }),
        ok('cautela', 'Estudar o mapa e a rota antes de partir', 'Você marca três pontos de emboscada. Planejar é proteger.', { flag: 'planned' }),
      ],
    }),
    scene('injured', {
      bg: 'road',
      place: 'Trilha da Montanha',
      mood: 'Dilema',
      who: { name: 'Genin ferido', role: 'Seu subordinado' },
      text: 'Um genin torce o tornozelo numa emboscada. O carregamento não pode esperar e inimigos se aproximam.',
      choices: [
        useJutsu('Tratar o ferimento com um jutsu médico', '{jutsu}. {flair} O genin se levanta, pálido, mas firme.', {
          filter: { category: ['iryo'] },
          reward: { pts: 1 },
          flag: 'healed',
          lockReason: 'Precisa de um jutsu médico (Iryō)',
        }),
        ok('coragem', 'Carregar o genin nas costas e seguir', 'Você aguenta o peso. O time segue unido, mais devagar.', { flag: 'carry', reward: { pts: 1 } }),
        ok('astucia', 'Dividir o time: um guarda o carregamento, você cobre a retaguarda', 'A tática funciona, mas deixa todos expostos por um tempo.'),
      ],
    }),
    scene('report', {
      bg: 'hokage',
      place: 'Escritório do Hokage',
      mood: 'Reflexão',
      who: HOKAGE,
      text: 'O Hokage lê o relatório em silêncio. “Liderar é escolher quem carregar e o que deixar para trás. O que você aprendeu?”',
      choices: [
        ok('empatia', '“Que ninguém fica para trás.”', 'O Hokage sorri. “Essa é a vontade do fogo.”', { reward: { pts: 1 } }),
        ok('astucia', '“Que preparação salva mais vidas que coragem.”', 'Ele assente. “Anote isso. Um dia você ensinará outros.”', { reward: { ck: 1 } }),
      ],
    }),
  ],

  search_allies: [
    scene('journey', {
      bg: 'mountains',
      place: 'Passo da Montanha',
      mood: 'Jornada',
      who: { name: 'Jiraiya', role: 'Sábio Sennin' },
      text: 'No alto da montanha, um eremita de cabelo branco ri: “Quer poder? Poder tem preço. Ouça o que a natureza diz.”',
      lore: 'Os Sannin (Jiraiya, Tsunade e Orochimaru) são lendas vivas. Sábios sennin treinam com o chakra da própria natureza.',
      choices: [
        ok('empatia', 'Pedir conselho com humildade', 'Ele para de rir. “Humildade é raro. Siga-me.”', { reward: { pts: 1 } }),
        ok('astucia', 'Perguntar qual é o custo desse poder', '“O preço é o corpo e a mente”, ele diz. “Todo poder cobra.” Você anota.', { reward: { ck: 1 } }),
      ],
    }),
    scene('stillness', {
      bg: 'mountains',
      place: 'Templo na Montanha',
      mood: 'Silêncio',
      who: { name: 'Jiraiya', role: 'Sábio Sennin' },
      text: 'O sábio manda você sentar imóvel sob uma cachoeira. “Ouça o vento, a água e a pedra. Não force nada.”',
      lore: 'O Modo Sennin mistura chakra próprio com energia natural. Se o equilíbrio falha, o corpo vira pedra.',
      choices: [
        useNature('Canalizar sua natureza de {nature} em silêncio', 'Seu chakra de {nature} se acalma. {flair}', { reward: { pts: 1, ck: 1 } }),
        ok('cautela', 'Respirar fundo e ouvir a montanha', 'Seu chakra desacelera e o mundo ganha um ritmo novo.', { reward: { pts: 1 } }),
        fail('coragem', 'Tentar forçar o chakra da natureza', 'Você força, o chakra explode e você cai na água gelada.', 'Natureza não se força: acalme a respiração e fique imóvel.'),
      ],
    }),
  ],

  jounin_promotion: [
    scene('council', {
      bg: 'hokage',
      place: 'Conselho de Konoha',
      mood: 'Julgamento',
      who: HOKAGE,
      text: 'Os conselheiros te encaram. “Jounin é elite, {name}. Provas, não palavras, decidem.” O Hokage aponta o campo de treino.',
      lore: 'Jounin lideram times, comandam operações e são a espinha dorsal militar de Konoha.',
      choices: [
        ok('coragem', 'Aceitar o desafio sem hesitar', 'O Hokage assente. “Que assim seja. Kakashi será seu avaliador.”', { reward: { pts: 1 } }),
        ok('cautela', 'Pedir um instante para estudar o avaliador', 'Você lembra do estilo de Kakashi: rápido, elétrico e imprevisível.', { flag: 'studied_examiner' }),
      ],
    }),
    battle('examiner', {
      bg: 'arena',
      place: 'Campo de Avaliação',
      mood: 'Prova final',
      who: { name: 'Kakashi', role: 'Avaliador Jounin', sprite: 'jounin' },
      text: 'Kakashi levanta a bandana. “Mostre que merece o colete verde. Não precisa me vencer, só me impressionar.”',
      lore: 'Kakashi usa Raiton. Vento vence Raio. Para passar, reduza a energia dele a 40% ou resista até o fim.',
      enemy: 'kakashi-exam',
      rounds: 8,
      winAtEnemyPct: 40,
      mustUseJutsu: true,
      flagBuffs: { studied_examiner: { playerBoost: 1.1, enemyAtk: 0.95 } },
      win: 'Kakashi ergue a mão: “Basta. Você passou.” O Hokage assente do camarote.',
      lose: 'Kakashi te segura antes do golpe final. “Ainda não. Treine mais e volte.”',
      hint: 'Kakashi usa Raio: Vento vence Raio. Reduza a vida dele a 40% ou aguente as 8 rodadas.',
    }),
    scene('vest', {
      bg: 'hokage',
      place: 'Escritório do Hokage',
      mood: 'Conquista',
      who: KAKASHI,
      text: 'O Hokage assente: “Jounin.” Kakashi coloca a mão no seu ombro: “Não é o fim. É a responsabilidade começando.”',
      choices: [
        ok('coragem', 'Aceitar o colete e a responsabilidade', 'O colete verde pesa menos do que a responsabilidade, mas cabe bem em você.', { reward: { pts: 1 } }),
        ok('empatia', 'Prometer formar a próxima geração', 'Kakashi sorri atrás da máscara. “Boa. É assim que a Folha continua.”', { reward: { ck: 1 } }),
      ],
    }),
  ],

  leaf_legend: [
    scene('war', {
      bg: 'battlefield',
      place: 'Fronteira entre Nações',
      mood: 'Guerra',
      who: HOKAGE,
      text: 'A aliança está por um fio. Um nukenin de rank S carrega uma técnica capaz de rachar um exército ao meio. Só você chega a tempo.',
      lore: 'Nukenin de rank S são ninjas renegados, caçados por todas as nações. A Akatsuki é a mais temida das organizações.',
      choices: [
        ok('coragem', 'Atravessar o campo de batalha sozinho', 'Você corre entre fumaça e cratera, sem olhar para trás.', { flag: 'solo_war' }),
        ok('astucia', 'Convocar a aliança para cobrir sua passagem', 'Ninjas de várias vilas formam um corredor de aço e chakra para você.', { flag: 'alliance' }),
        ok('empatia', 'Evacuar os civis antes de enfrentar o inimigo', 'Você ganha tempo e vidas. O inimigo espera, impaciente.', { flag: 'civilians', reward: { pts: 1 } }),
      ],
    }),
    battle('nukenin', {
      bg: 'battlefield',
      place: 'Campo de Batalha',
      mood: 'Clímax',
      who: { name: 'Nukenin Escarlate', role: 'Renegado de rank S', sprite: 'shadow' },
      text: 'O céu rubro cobre o campo. O renegado abre a mão: “Então você é a lenda da Folha.”',
      lore: 'O Nukenin Escarlate domina Fogo e ilusões oculares. Água vence Fogo: Suiton apaga as Chamas Negras.',
      enemy: 'shadow',
      rounds: 9,
      mustUseJutsu: true,
      flagBuffs: {
        civilians: { playerHp: 1.1 },
        alliance: { enemyAtk: 0.9 },
        solo_war: { playerBoost: 1.1, enemyAtk: 1.05 },
      },
      win: 'As Chamas Negras se apagam. O renegado cai de joelhos. O campo inteiro fica em silêncio.',
      lose: 'As chamas te derrubam. O renegado olha para você, quase decepcionado: “Ainda não.”',
      hint: 'O inimigo usa Fogo: Água vence Fogo. Ele fica mais forte quando ferido, então Guarda e chakra importam.',
    }),
    scene('legend', {
      bg: 'hokage',
      place: 'Konoha · Amanhecer',
      mood: 'Legado',
      who: HOKAGE,
      text: 'O céu se abre. A vila ergue o rosto: o nome {name} {clan} ecoa pelos telhados. A Folha ganhou uma nova lenda.',
      lore: 'Os rostos de pedra do monte Hokage lembram: toda lenda começou como um aluno cheio de dúvidas.',
      choices: [
        ok('coragem', 'Aceitar o título de herói da vila', 'Você ergue a bandana. A vila inteira ergue os punhos de volta.', { reward: { pts: 1 } }),
        ok('empatia', 'Dedicar a vitória a quem caiu', 'O silêncio vale mais que mil aplausos. A vila entende.', { reward: { ck: 1 } }),
        ok('astucia', 'Partir numa nova jornada e deixar o legado falar', 'Você some ao nascer do sol. Konoha continua contando a sua história.'),
      ],
    }),
  ],
};

export function chapterScript(chapterId) {
  return STORY_SCRIPT[chapterId] || [];
}
