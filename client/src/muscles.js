/** Espelho do servidor — tempos padrão; você pode pedir ajuste fino depois. */
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

export const RECOVERY_LEVELS = [
  { id: 'red', label: 'Recém treinado', color: '#e84a3c' },
  { id: 'yellow', label: 'Em recuperação', color: '#e2a23a' },
  { id: 'green', label: 'Quase pronto', color: '#4caf6a' },
  { id: 'blue', label: 'Quase liberado', color: '#4a8fe8' },
];

export const RECOVERY_COLORS = Object.fromEntries(
  RECOVERY_LEVELS.map((item) => [item.id, item.color]),
);
