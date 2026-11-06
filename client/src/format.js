const liters = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export function formatLiters(ml) {
  return `${liters.format(ml / 1000)} L`;
}

export function litersToInput(ml) {
  if (!ml) return '';
  return liters.format(ml / 1000);
}
