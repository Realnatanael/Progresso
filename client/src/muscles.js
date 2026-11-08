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

export function guessMusclesFromName(name) {
  const text = String(name || '');
  if (!text.trim()) return [];
  if (FULL_BODY_RE.test(text)) return NAME_HINTS.map((hint) => hint.id);
  return NAME_HINTS.filter((hint) => hint.re.test(text)).map((hint) => hint.id);
}
