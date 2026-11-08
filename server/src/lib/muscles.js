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

const NAME_HINTS = [
  { id: 'shoulders', re: /ombro|delto|eleva[cç][aã]o|desenvolv/i },
  { id: 'biceps', re: /b[ií]ceps|rosca|chin\s*up|barra\s*fixa/i },
  { id: 'triceps', re: /tr[ií]ceps|paralela|fundo|skull|coice/i },
  { id: 'forearms', re: /antebra[cç]o|punho|grip|farmer/i },
  { id: 'chest', re: /peito|peitoral|supino|crucifixo|\bfly\b|flex[aã]o/i },
  { id: 'back', re: /costa|puxada|remada|pulldown|barra\s*fixa|levantamento\s*terra|deadlift/i },
  { id: 'glutes', re: /gl[uú]teo|hip\s*thrust|agachamento|stiff|afundo|passada/i },
  { id: 'quads', re: /quadr[ií]ceps|agachamento|leg\s*press|extensora|afundo|passada|hack/i },
  { id: 'hamstrings', re: /posterior|stiff|mesa\s*flexora|flexora|nordic/i },
  { id: 'calves', re: /panturrilha|g[eé]meo|calf|s[oó]leo/i },
];

const FULL_BODY_RE = /full\s*body|corpo\s*todo|fullbody|treino\s*completo|whole\s*body/i;

/** Infere músculos pelo nome do exercício (ex.: "peito e triceps"). */
export function guessMusclesFromName(name) {
  const text = String(name || '');
  if (!text.trim()) return [];
  if (FULL_BODY_RE.test(text)) return NAME_HINTS.map((hint) => hint.id);
  return NAME_HINTS.filter((hint) => hint.re.test(text)).map((hint) => hint.id);
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
    const weekday = weekdayFromIso(checkin.date);
    // Prefere tags atuais do plano (editar depois do check-in atualiza o glow).
    let muscles = [];
    if (habit) {
      const dayExercises = (habit.exercises || []).filter((item) => item.weekday === weekday);
      muscles = normalizeMuscles(dayExercises.flatMap((item) => item.muscles || []));
      if (muscles.length === 0) {
        muscles = normalizeMuscles(dayExercises.flatMap((item) => guessMusclesFromName(item.name)));
      }
    }
    if (muscles.length === 0) muscles = normalizeMuscles(checkin.muscles);
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
