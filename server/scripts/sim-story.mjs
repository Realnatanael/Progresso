/**
 * Valida o roteiro do Modo História e simula partidas completas (sem banco).
 * Uso: node scripts/sim-story.mjs [--balance] [--trials=40]
 */
import { STORY_CHAPTERS } from '../src/data/storyRoadmap.js';
import { STORY_SCRIPT, chapterScript } from '../src/data/storyScript.js';
import { ENEMIES } from '../src/data/storyEnemies.js';
import { NINJA_CATALOG, RANK_ORDER, defaultNinjaState } from '../src/data/ninjaCatalog.js';
import { actStoryBattle, chooseStoryOption, startStoryBeat } from '../src/lib/storyEngine.js';
import { buildStoryProgress } from '../src/lib/storyProgress.js';
import { createBattle, publicBattle, resolveRound } from '../src/lib/storyBattle.js';
import {
  beatOf,
  choiceStateFor,
  eligibleJutsus,
  isChoiceVisible,
  templateChoices,
} from '../src/lib/storyPersonalize.js';
import { catalogById } from '../src/data/ninjaCatalog.js';
import { ensureStoryState } from '../src/lib/storyState.js';

const args = process.argv.slice(2);
const BALANCE = args.includes('--balance');
const TRIALS = Number((args.find((a) => a.startsWith('--trials=')) || '--trials=40').split('=')[1]);

const BG_KEYS = new Set([
  'gates', 'classroom', 'yard', 'hokage', 'village', 'road', 'mist-bridge',
  'exam-hall', 'forest', 'arena', 'mountains', 'battlefield',
]);
const VARS = new Set(['name', 'clan', 'nature', 'release', 'rank', 'jutsu', 'eye', 'flair']);
const SPRITES = new Set(['rival', 'bandit', 'swordsman', 'serpent', 'jounin', 'shadow', 'kunoichi', 'sand', 'hero']);

let errors = 0;
function bad(message) {
  errors += 1;
  console.error('  ✗', message);
}

/* ───────────── 1 · validação estática ───────────── */
function validate() {
  console.log('Validando roteiro…');
  let beats = 0;
  let battles = 0;
  for (const chapter of STORY_CHAPTERS) {
    const script = chapterScript(chapter.id);
    if (script.length < 2) bad(`${chapter.id}: precisa de pelo menos 2 cenas`);
    const ids = new Set();
    script.forEach((beat) => {
      beats += 1;
      const where = `${chapter.id}/${beat.id}`;
      if (ids.has(beat.id)) bad(`${where}: id repetido`);
      ids.add(beat.id);
      if (!BG_KEYS.has(beat.bg)) bad(`${where}: bg inválido (${beat.bg})`);
      if (!beat.text || beat.text.length > 260) bad(`${where}: texto ausente ou longo (${beat.text?.length})`);
      if (beat.lore && beat.lore.length > 240) bad(`${where}: lore longo (${beat.lore.length})`);
      if (beat.who?.sprite && !SPRITES.has(beat.who.sprite)) bad(`${where}: sprite inválido`);
      const texts = [beat.text, beat.lore, ...(beat.extra || []).map((x) => x.text)];

      if (beat.type === 'battle') {
        battles += 1;
        if (!ENEMIES[beat.enemy]) bad(`${where}: inimigo inexistente`);
        for (const key of ['win', 'lose', 'hint']) if (!beat[key]) bad(`${where}: falta ${key}`);
        texts.push(beat.win, beat.lose, beat.hint);
      } else {
        const choices = templateChoices(beat);
        if (choices.length < 2 || choices.length > 4) bad(`${where}: use 2 a 4 escolhas`);
        const guaranteed = choices.filter((c) => (
          c.result === 'ok' && !c.kind && !c.needs && !c.whenFlag
        ));
        const chapterNeedsJutsu = Boolean(chapter.successNeedsJutsu || chapter.advanceRequiresJutsus);
        const jutsuGate = chapterNeedsJutsu
          && choices.some((c) => c.kind === 'jutsu' && c.result === 'ok')
          && choices.every((c) => c.result !== 'ok' || c.kind);
        if (!guaranteed.length && !jutsuGate && !choices.some((c) => c.kind === 'nature')) {
          bad(`${where}: sem escolha 'ok' garantida`);
        }
        for (const c of choices) {
          if (c.label.length > 80) bad(`${where}/${c.id}: label longo (${c.label.length})`);
          if (c.say && c.say.length > 220) bad(`${where}/${c.id}: say longo (${c.say.length})`);
          if (c.result === 'fail' && !c.hint && c.kind !== 'jutsu') bad(`${where}/${c.id}: fail sem dica`);
          texts.push(c.label, c.say, c.hint, c.failSay, c.weakSay, c.failHint);
        }
      }
      for (const text of texts.filter(Boolean)) {
        for (const match of String(text).matchAll(/\{(\w+)\}/g)) {
          if (!VARS.has(match[1])) bad(`${where}: placeholder desconhecido {${match[1]}}`);
        }
      }
    });
  }
  const orphan = Object.keys(STORY_SCRIPT).filter((id) => !STORY_CHAPTERS.some((c) => c.id === id));
  if (orphan.length) bad(`roteiro sem capítulo: ${orphan.join(', ')}`);
  console.log(`  ${STORY_CHAPTERS.length} capítulos · ${beats} cenas · ${battles} batalhas`);
}

/* ───────────── jogadores ───────────── */
const jutsuCatalog = NINJA_CATALOG.filter((e) => e.kind === 'jutsu');

function basePlayer(extra = {}) {
  return {
    ...defaultNinjaState(),
    clanName: 'Teste',
    rank: 'academy',
    story: { testMode: true },
    ...extra,
  };
}

function strongPlayer() {
  const sRank = jutsuCatalog.filter((j) => j.tier === 'S');
  return basePlayer({
    unlockPoints: 500,
    chakra: 280,
    ninjutsu: 55,
    genjutsu: 50,
    taijutsu: 50,
    natures: ['fire', 'water', 'wind', 'earth', 'lightning'],
    learnedJutsuIds: [...new Set([
      ...jutsuCatalog.slice(0, 28).map((j) => j.id),
      ...sRank.slice(0, 3).map((j) => j.id),
    ])],
    unlockedKekkeiIds: ['kekkei-sharingan-1', 'kekkei-sharingan-2', 'kekkei-sharingan-3'],
  });
}

const MIN_GOALS = {
  academy_day_one: [0, 0, 0],
  academy_basics: [8, 1, 4],
  academy_rival: [8, 2, 8],
  genin_graduation: [30, 2, 15],
  team_assignment: [30, 2, 15],
  d_missions: [45, 3, 15],
  c_missions: [60, 5, 40],
  bridge_country: [80, 6, 40],
  chuunin_written: [100, 8, 70],
  chuunin_forest: [110, 9, 70],
  chuunin_prelims: [120, 10, 85],
  chuunin_finals: [140, 12, 100],
  chuunin_leader: [140, 14, 100],
  search_allies: [160, 16, 100],
  jounin_promotion: [180, 16, 120],
  leaf_legend: [250, 25, 120],
};

/** Jogador que acabou de bater as metas do capítulo, com jutsus baratos de fogo. */
function minimalPlayer(chapterId) {
  const [chakra, jutsus, stats] = MIN_GOALS[chapterId];
  const chapter = STORY_CHAPTERS.find((c) => c.id === chapterId);
  const rank = chapter.rank;
  const nin = Math.round(stats * 0.4);
  const gen = Math.round(stats * 0.3);
  const tai = stats - nin - gen;
  const eligible = jutsuCatalog
    .filter((j) => (RANK_ORDER[j.rankMin] ?? 0) <= (RANK_ORDER[rank] ?? 0))
    .filter((j) => !j.requiresJinchuuriki && !j.requiresSennin && !(j.requiresIds || []).length)
    .filter((j) => (j.requiresNatures || []).every((id) => id === 'fire'))
    .filter((j) => (j.requires?.chakra || 0) <= chakra)
    .filter((j) => (j.requires?.ninjutsu || 0) <= nin)
    .filter((j) => (j.requires?.genjutsu || 0) <= gen)
    .filter((j) => (j.requires?.taijutsu || 0) <= tai)
    .sort((a, b) => (a.costUnlockPoints || 0) - (b.costUnlockPoints || 0));
  return basePlayer({
    rank,
    chakra,
    ninjutsu: nin,
    genjutsu: gen,
    taijutsu: tai,
    natures: ['fire'],
    learnedJutsuIds: eligible.slice(0, jutsus).map((j) => j.id),
  });
}

const TIER_RANK = { E: 1, D: 2, C: 3, B: 4, A: 5, S: 6 };
const RANK_TIER_CAP = { academy: 2, genin: 3, chuunin: 4, jounin: 5 };
const elementKey = (j) => {
  for (const id of j.requiresNatures || []) {
    if (['fire', 'water', 'wind', 'earth', 'lightning'].includes(id)) return id;
  }
  return null;
};
const WEAK_OF = { wind: 'fire', lightning: 'wind', earth: 'lightning', water: 'earth', fire: 'water' };

/** Jogador "sensato": passou um pouco das metas e seguiu a dica de elemento da cena. */
function okPlayer(chapterId, enemyKey, { hinted = true, capDelta = 0 } = {}) {
  const [chakra0, jutsus0, stats0] = MIN_GOALS[chapterId];
  const chapter = STORY_CHAPTERS.find((c) => c.id === chapterId);
  const rank = chapter.rank;
  const chakra = Math.round(chakra0 * 1.15);
  const stats = Math.round(stats0 * 1.3);
  const nin = Math.round(stats * 0.45);
  const gen = Math.round(stats * 0.25);
  const tai = stats - nin - gen;
  const enemyEl = ENEMIES[enemyKey]?.element || null;
  const weak = hinted && enemyEl ? WEAK_OF[enemyEl] : null;
  const natures = [...new Set(['fire', weak].filter(Boolean))];
  const cap = (RANK_TIER_CAP[rank] ?? 2) + capDelta;

  const eligible = jutsuCatalog
    .filter((j) => (RANK_ORDER[j.rankMin] ?? 0) <= (RANK_ORDER[rank] ?? 0))
    .filter((j) => (TIER_RANK[j.tier] || 9) <= cap)
    .filter((j) => !j.requiresJinchuuriki && !j.requiresSennin && !(j.requiresIds || []).length)
    .filter((j) => (j.requiresNatures || []).every((id) => natures.includes(id)))
    .filter((j) => (j.requires?.chakra || 0) <= chakra)
    .filter((j) => (j.requires?.ninjutsu || 0) <= nin)
    .filter((j) => (j.requires?.genjutsu || 0) <= gen)
    .filter((j) => (j.requires?.taijutsu || 0) <= tai);
  const byTier = (a, b) => (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0);
  const weakOnes = weak ? eligible.filter((j) => elementKey(j) === weak).sort(byTier).slice(0, 2) : [];
  const rest = eligible
    .filter((j) => !weakOnes.includes(j))
    .sort(byTier)
    .slice(0, Math.max(0, jutsus0 + 2 - weakOnes.length));
  return basePlayer({
    rank,
    chakra,
    ninjutsu: nin,
    genjutsu: gen,
    taijutsu: tai,
    natures,
    learnedJutsuIds: [...weakOnes, ...rest].map((j) => j.id),
  });
}

/* ───────────── política de batalha ───────────── */
function pickBattleAction(pb) {
  const { player, enemy, actions, mode } = pb;
  const hpPct = player.hp / player.hpMax;
  const jutsus = actions.jutsus;
  const heal = jutsus.find((j) => j.effect === 'heal' && j.usable);
  if (hpPct < 0.4 && heal) return { action: 'jutsu', jutsuId: heal.id };
  if (enemy.intent.level === 'forte' && hpPct < 0.8) return { action: 'guard' };
  if (mode === 'survive' && hpPct < 0.55) return { action: 'guard' };
  const dmg = jutsus
    .filter((j) => j.usable && ['damage', 'crit', 'aegis'].includes(j.effect))
    .sort((a, b) => b.expected - a.expected)[0];
  if (dmg) return { action: 'jutsu', jutsuId: dmg.id };
  if (player.chakra < 4) return { action: 'guard' };
  return { action: 'strike' };
}

function playBattle(n, beat, flags = {}) {
  const battle = createBattle(beat, n, flags);
  let guard = 0;
  while (!battle.over && guard < 50) {
    guard += 1;
    const step = pickBattleAction(publicBattle(battle, n));
    const res = resolveRound(battle, n, step);
    if (res.error) {
      // sem chakra etc.: cai para golpe
      const fallback = resolveRound(battle, n, { action: 'strike' });
      if (fallback.error) throw new Error(fallback.error);
    }
  }
  return battle;
}

/* ───────────── 2 · partida completa ───────────── */
function playThrough(label, makePlayer, chooser) {
  const n = makePlayer();
  n.story = { testMode: true };
  ensureStoryState(n);
  const today = '2026-11-09';
  const display = 'Tester Historia';
  let safety = 0;
  const trail = [];

  for (const chapter of STORY_CHAPTERS) {
    // Garante metas do capítulo (simula tempo de jogo).
    const strong = strongPlayer();
    Object.assign(n, {
      unlockPoints: strong.unlockPoints,
      chakra: Math.max(n.chakra, strong.chakra),
      ninjutsu: strong.ninjutsu,
      genjutsu: strong.genjutsu,
      taijutsu: strong.taijutsu,
      natures: strong.natures,
      learnedJutsuIds: strong.learnedJutsuIds,
      unlockedKekkeiIds: strong.unlockedKekkeiIds,
    });

    while (!n.story.completedChapterIds.includes(chapter.id)) {
      safety += 1;
      if (safety > 400) throw new Error(`${label}: loop infinito em ${chapter.id}`);
      if (!n.story.activeBeat) {
        const start = startStoryBeat(n, { today });
        if (!start.ok) throw new Error(`${label}: ${chapter.id} não abriu: ${start.error}`);
      }
      const active = n.story.activeBeat;
      const beat = beatOf(active);
      if (!beat) throw new Error(`${label}: beat inexistente ${active.beatId}`);

      if (beat.type === 'battle') {
        let result;
        let rounds = 0;
        while (!result?.outcome && rounds < 60) {
          rounds += 1;
          const pb = publicBattle(n.story.activeBeat.battle, n);
          const step = pickBattleAction(pb);
          result = actStoryBattle(n, { ...step, round: pb.round, beatId: beat.id }, { displayName: display, today });
          if (result.error) {
            result = actStoryBattle(n, { action: 'strike', round: pb.round, beatId: beat.id }, { displayName: display, today });
            if (result.error) throw new Error(`${label}: ${result.error}`);
          }
        }
        trail.push(`${chapter.id}/${beat.id}: batalha ${result.outcome.result}`);
      } else {
        const picked = chooser(n, beat);
        const res = chooseStoryOption(n, picked, { displayName: display, today });
        if (res.error) throw new Error(`${label}: ${chapter.id}/${beat.id}: ${res.error}`);
        trail.push(`${chapter.id}/${beat.id}: ${picked.choiceId} → ${res.outcome.result}`);
      }
    }
  }

  const progress = buildStoryProgress(n, catalogById, { displayName: display, today });
  if (!progress.finished) bad(`${label}: história não terminou`);
  if (n.rank !== 'jounin') bad(`${label}: rank final ${n.rank} (esperado jounin)`);
  console.log(`  ${label}: ${n.story.completedChapterIds.length}/${STORY_CHAPTERS.length} capítulos · rank ${n.rank} · pts ${n.unlockPoints} · chakra ${n.chakra} · ${trail.length} decisões`);
}

function chooserOk(n, beat) {
  const choices = templateChoices(beat).filter((c) => isChoiceVisible(n, c));
  const usable = (c) => !choiceStateFor(n, c).locked;
  const ordered = [
    ...choices.filter((c) => c.result === 'ok' && usable(c)),
    ...choices.filter((c) => c.result === 'detour' && usable(c)),
  ];
  const choice = ordered[0] || choices.find(usable);
  if (!choice) throw new Error(`${beat.id}: nenhuma escolha utilizável`);
  if (choice.kind === 'jutsu') {
    const options = eligibleJutsus(n, choice.filter);
    // Prefere jutsu que "funciona" na cena.
    const best = options.find((o) => choice.works?.includes(o.element))
      || options.find((o) => !choice.weak?.includes(o.element))
      || options[0];
    return { choiceId: choice.id, jutsuId: best.id, beatId: beat.id };
  }
  return { choiceId: choice.id, beatId: beat.id };
}

/** Escolhe aleatoriamente (inclui falhas e desvios) para testar travas e retomadas. */
function chooserChaos(n, beat) {
  const choices = templateChoices(beat)
    .filter((c) => isChoiceVisible(n, c))
    .filter((c) => !(n.story.activeBeat.spent || []).includes(c.id))
    .filter((c) => !choiceStateFor(n, c).locked);
  const choice = choices[Math.floor(Math.random() * choices.length)];
  if (!choice) throw new Error(`${beat.id}: sem escolhas`);
  if (choice.kind === 'jutsu') {
    const options = eligibleJutsus(n, choice.filter);
    const pick = options[Math.floor(Math.random() * options.length)];
    return { choiceId: choice.id, jutsuId: pick.id, beatId: beat.id };
  }
  return { choiceId: choice.id, beatId: beat.id };
}

/* ───────────── 3 · balanceamento ───────────── */
function balance() {
  console.log(`\nBalanceamento (${TRIALS} partidas por batalha) — vitória %: mínimo | tier-1 | sem dica | com dica | forte`);
  for (const chapter of STORY_CHAPTERS) {
    for (const beat of chapterScript(chapter.id)) {
      if (beat.type !== 'battle') continue;
      let lastMargin = '';
      const rate = (maker, track = false) => {
        let wins = 0;
        let hpSum = 0;
        let roundSum = 0;
        for (let i = 0; i < TRIALS; i += 1) {
          const n = maker();
          const battle = playBattle(n, beat, {});
          if (battle.over.result === 'win') wins += 1;
          hpSum += battle.player.hp / battle.player.hpMax;
          roundSum += battle.round;
        }
        if (track) lastMargin = ` [hp médio ${Math.round((hpSum / TRIALS) * 100)}% · rodada ${(roundSum / TRIALS).toFixed(1)}/${beat.rounds || 6}]`;
        return Math.round((wins / TRIALS) * 100);
      };
      const min = rate(() => minimalPlayer(chapter.id));
      const plain = rate(() => okPlayer(chapter.id, beat.enemy, { hinted: false }), true);
      const lite = rate(() => okPlayer(chapter.id, beat.enemy, { hinted: false, capDelta: -1 }));
      const ok = rate(() => okPlayer(chapter.id, beat.enemy));
      const strong = rate(() => {
        const n = strongPlayer();
        n.rank = chapter.rank;
        return n;
      });
      const flag = ok < 60 ? '  ⚠ difícil' : plain > 92 ? '  · fácil' : '';
      console.log(`  ${chapter.id}/${beat.id} (${beat.enemy}): ${String(min).padStart(3)}% | ${String(lite).padStart(3)}% | ${String(plain).padStart(3)}% | ${String(ok).padStart(3)}% | ${String(strong).padStart(3)}%${flag}${lastMargin}`);
    }
  }
}

validate();
console.log('\nPartidas completas:');
playThrough('só caminho certo', strongPlayer, chooserOk);
for (let i = 1; i <= 3; i += 1) playThrough(`aleatório #${i}`, strongPlayer, chooserChaos);
if (BALANCE) balance();

if (errors) {
  console.error(`\n${errors} problema(s).`);
  process.exit(1);
}
console.log('\nTudo certo.');
