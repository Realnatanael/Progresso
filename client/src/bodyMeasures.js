/**
 * Baseline do usuário (ectomorfo ≈ modelo atual / estágio 1)
 * + tetos estéticos naturais (estágio 3) para o morph local.
 *
 * Pipeline atual: Shot Generator + morphs locais leves em BodyAvatar.
 * Os cm/estágios guiam progresso e tetos; o bulge local NÃO reproduz o
 * silhouette dos 4 desenhos (empurrar forte vira deformação). Para visual
 * fiel: um GLB com shape keys (MakeHuman bake / asset morphável) — não
 * 4 corpos Meshy separados.
 *
 * Referências: Adonis Index (ombro ≈ cintura×1.618), Reeves/Bony to Beastly
 * (braço ≈ 2.5×pulso, antebraço ≈ 0.8×braço), peito/panturrilha estéticos
 * em ~174 cm, BF ~10–12%. O estágio 4 da arte é visual de pico e fica
 * como meta aspiracional — o teto do slider local é o estágio 3.
 */

/** Teto visual do morph local (= estágio atlético natural). */
export const LOCAL_MORPH_CEILING_STAGE = 3;
export const USER_BASELINE = {
  heightCm: 174,
  weightKg: 54,
  chestCm: 90,
  forearmCm: 24,
  armCm: 31,
  /** Estimativa até medir. */
  shoulderCm: 105,
  hipsCm: 85,
  /** Coxa (meio da coxa, relaxada). */
  thighCm: 48,
  calfCm: 32,
  /** Estimativa de estrutura óssea (ectomorfo fino). */
  wristCm: 15.5,
  waistCm: 72,
};

/** Panturrilha do mannequin SG teen (~28 cm visual). */
export const MODEL_CALF_CM = 28;

/**
 * Quatro estágios da referência (frente).
 * 1 = hoje · 2 = iniciante · 3 = teto natural “bonito” · 4 = pico da arte (aspiracional)
 */
export const PHYSIQUE_STAGES = {
  1: {
    label: 'Ectomorfo',
    armCm: 31,
    forearmCm: 24,
    chestCm: 90,
    shoulderCm: 105,
    thighCm: 48,
    calfCm: 32,
    hipsCm: 85,
  },
  2: {
    label: 'Iniciante',
    armCm: 34,
    forearmCm: 26,
    chestCm: 96,
    shoulderCm: 112,
    thighCm: 51,
    calfCm: 34,
    hipsCm: 88,
  },
  3: {
    label: 'Atlético natural',
    armCm: 38,
    forearmCm: 30,
    chestCm: 104,
    shoulderCm: 120,
    thighCm: 55,
    calfCm: 38,
    hipsCm: 93,
  },
  4: {
    label: 'Pico (arte)',
    armCm: 41,
    forearmCm: 32,
    chestCm: 109,
    shoulderCm: 126,
    thighCm: 58,
    calfCm: 40,
    hipsCm: 96,
  },
};

/**
 * now = parece o modelo hoje
 * lean = magro extremo (slider)
 * goal = teto do volume local = estágio 3 (natural bonito)
 */
export const PART_RANGES = {
  arms: { now: PHYSIQUE_STAGES[1].armCm, lean: 28, goal: PHYSIQUE_STAGES[3].armCm },
  shoulders: {
    now: PHYSIQUE_STAGES[1].shoulderCm,
    lean: 100,
    goal: PHYSIQUE_STAGES[3].shoulderCm,
  },
  forearms: {
    now: PHYSIQUE_STAGES[1].forearmCm,
    lean: 22,
    goal: PHYSIQUE_STAGES[3].forearmCm,
  },
  chest: {
    now: PHYSIQUE_STAGES[1].chestCm,
    lean: 86,
    goal: PHYSIQUE_STAGES[3].chestCm,
  },
  hips: {
    now: PHYSIQUE_STAGES[1].hipsCm,
    lean: 82,
    goal: PHYSIQUE_STAGES[3].hipsCm,
  },
  thighs: {
    now: PHYSIQUE_STAGES[1].thighCm,
    lean: 45,
    goal: PHYSIQUE_STAGES[3].thighCm,
  },
  calves: {
    now: PHYSIQUE_STAGES[1].calfCm,
    lean: MODEL_CALF_CM,
    goal: PHYSIQUE_STAGES[3].calfCm,
  },
};

function clamp01(n) {
  return Math.min(1, Math.max(0, Number(n) || 0));
}

/** Progresso 0..1 de `now` até `goal`. */
export function growthFromNow(cm, { now, goal }, ease = 1.15) {
  if (goal <= now) return 0;
  const t = clamp01((Number(cm) - now) / (goal - now));
  return t ** ease;
}

/** Panturrilha: modelo mais fino → preenche de lean até goal. */
export function calfFillProgress(cm, ease = 1.1) {
  const { lean, goal } = PART_RANGES.calves;
  if (goal <= lean) return 0;
  return clamp01((Number(cm) - lean) / (goal - lean)) ** ease;
}

/**
 * Estágio aproximado 1..4 a partir do progresso médio das partes (0..1 no teto natural).
 * ≥1.0 no estágio 3; o 4 só com morphs/assets futuros.
 */
export function stageFromPartsProgress(progress01) {
  const t = clamp01(progress01);
  if (t < 0.28) return 1;
  if (t < 0.62) return 2;
  if (t < 0.98) return 3;
  return 3;
}

export function partsFromMeasures({
  armCm = USER_BASELINE.armCm,
  shoulderCm = USER_BASELINE.shoulderCm,
  forearmCm = USER_BASELINE.forearmCm,
  chestCm = USER_BASELINE.chestCm,
  thighCm = USER_BASELINE.thighCm,
  calfCm = USER_BASELINE.calfCm,
  hipsCm = USER_BASELINE.hipsCm,
} = {}) {
  return {
    arms: growthFromNow(armCm, PART_RANGES.arms),
    shoulders: growthFromNow(shoulderCm, PART_RANGES.shoulders),
    forearms: growthFromNow(forearmCm, PART_RANGES.forearms),
    chest: growthFromNow(chestCm, PART_RANGES.chest),
    thighs: growthFromNow(thighCm, PART_RANGES.thighs),
    calves: calfFillProgress(calfCm),
    /** Glúteo / quadril — usa circunferência de quadril. */
    glutes: growthFromNow(hipsCm, PART_RANGES.hips),
  };
}
