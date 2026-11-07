/**
 * Baseline do usuário (ectomorfo ≈ modelo atual) + teto suave do volume local.
 */
export const USER_BASELINE = {
  heightCm: 174,
  weightKg: 54,
  chestCm: 90,
  forearmCm: 24,
  armCm: 31,
  /** Estimativa até medir. */
  shoulderCm: 105,
  hipsCm: 85,
  calfCm: 32,
};

/** Panturrilha do mannequin SG teen (~28 cm visual). */
export const MODEL_CALF_CM = 28;

/**
 * now = parece o modelo hoje
 * lean = magro extremo (slider)
 * goal = teto do volume local (sem trocar de skin)
 */
export const PART_RANGES = {
  arms: { now: 31, lean: 28, goal: 36 },
  shoulders: { now: 105, lean: 100, goal: 112 },
  forearms: { now: 24, lean: 22, goal: 28 },
  chest: { now: 90, lean: 86, goal: 98 },
  hips: { now: 85, lean: 82, goal: 90 },
  calves: { now: 32, lean: MODEL_CALF_CM, goal: 35 },
};

function clamp01(n) {
  return Math.min(1, Math.max(0, Number(n) || 0));
}

/** Progresso 0..1 de `now` até `goal`. */
export function growthFromNow(cm, { now, goal }, ease = 1.2) {
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

export function partsFromMeasures({
  armCm = USER_BASELINE.armCm,
  shoulderCm = USER_BASELINE.shoulderCm,
  forearmCm = USER_BASELINE.forearmCm,
  chestCm = USER_BASELINE.chestCm,
  calfCm = USER_BASELINE.calfCm,
} = {}) {
  return {
    arms: growthFromNow(armCm, PART_RANGES.arms),
    shoulders: growthFromNow(shoulderCm, PART_RANGES.shoulders),
    forearms: growthFromNow(forearmCm, PART_RANGES.forearms),
    chest: growthFromNow(chestCm, PART_RANGES.chest),
    calves: calfFillProgress(calfCm),
  };
}
