/** Grupos musculares + tempo de recuperação (horas). Ajuste fino depois. */
export const MUSCLE_GROUPS = [
  { id: 'shoulders', label: 'Ombro', recoveryHours: 48 },
  { id: 'biceps', label: 'Bíceps', recoveryHours: 48 },
  { id: 'triceps', label: 'Tríceps', recoveryHours: 48 },
  { id: 'forearms', label: 'Antebraço', recoveryHours: 36 },
  { id: 'chest', label: 'Peitoral', recoveryHours: 48 },
  { id: 'back', label: 'Costas', recoveryHours: 72 },
  { id: 'glutes', label: 'Glúteos', recoveryHours: 48 },
  { id: 'quads', label: 'Quadríceps', recoveryHours: 72 },
  { id: 'hamstrings', label: 'Posterior', recoveryHours: 72 },
  { id: 'calves', label: 'Panturrilhas', recoveryHours: 36 },
];

export const MUSCLE_IDS = new Set(MUSCLE_GROUPS.map((item) => item.id));

export const RECOVERY_LEVELS = [
  { id: 'red', label: 'Recém treinado', color: '#e84a3c' },
  { id: 'yellow', label: 'Em recuperação', color: '#e2a23a' },
  { id: 'green', label: 'Quase pronto', color: '#4caf6a' },
  { id: 'blue', label: 'Quase liberado', color: '#4a8fe8' },
];

export function normalizeMuscles(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter((id) => MUSCLE_IDS.has(id)))];
}

export function muscleMeta(id) {
  return MUSCLE_GROUPS.find((item) => item.id === id) || null;
}

/** Progresso 0→1 na janela de recuperação → nível (null = pronto / sem glow). */
export function recoveryLevel(hoursElapsed, recoveryHours) {
  if (!Number.isFinite(hoursElapsed) || hoursElapsed < 0) return null;
  if (!recoveryHours || hoursElapsed >= recoveryHours) return null;
  const t = hoursElapsed / recoveryHours;
  if (t < 0.25) return 'red';
  if (t < 0.5) return 'yellow';
  if (t < 0.75) return 'green';
  return 'blue';
}

export function hoursLeft(hoursElapsed, recoveryHours) {
  if (!recoveryHours) return 0;
  return Math.max(0, Math.round((recoveryHours - hoursElapsed) * 10) / 10);
}

/**
 * Monta estado de recuperação a partir dos check-ins (com snapshot de músculos)
 * e fallback para o plano atual do dia do check-in.
 */
export function buildMuscleRecovery({ checkins, habit, now = new Date() }) {
  const lastAt = new Map();

  const sorted = [...checkins].sort((a, b) => {
    const da = String(a.date || '');
    const db = String(b.date || '');
    if (da !== db) return db.localeCompare(da);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  for (const checkin of sorted) {
    let muscles = normalizeMuscles(checkin.muscles);
    if (muscles.length === 0 && habit) {
      const weekday = weekdayFromIso(checkin.date);
      muscles = normalizeMuscles(
        (habit.exercises || [])
          .filter((item) => item.weekday === weekday)
          .flatMap((item) => item.muscles || []),
      );
    }
    const trainedAt = checkin.createdAt ? new Date(checkin.createdAt) : isoToLocalNoon(checkin.date);
    for (const id of muscles) {
      if (!lastAt.has(id)) lastAt.set(id, trainedAt);
    }
  }

  return MUSCLE_GROUPS.map((group) => {
    const trainedAt = lastAt.get(group.id) || null;
    if (!trainedAt) {
      return {
        id: group.id,
        label: group.label,
        recoveryHours: group.recoveryHours,
        level: null,
        hoursLeft: 0,
        lastTrainedAt: null,
      };
    }
    const elapsed = (now.getTime() - trainedAt.getTime()) / 36e5;
    return {
      id: group.id,
      label: group.label,
      recoveryHours: group.recoveryHours,
      level: recoveryLevel(elapsed, group.recoveryHours),
      hoursLeft: hoursLeft(elapsed, group.recoveryHours),
      lastTrainedAt: trainedAt.toISOString(),
    };
  });
}

function weekdayFromIso(iso) {
  const [year, month, day] = String(iso).split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

function isoToLocalNoon(iso) {
  const [year, month, day] = String(iso).split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}
