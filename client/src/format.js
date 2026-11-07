const liters = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export const GENDERS = [
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Feminino' },
  { value: 'other', label: 'Outro' },
];

export function formatLiters(ml) {
  return `${liters.format(ml / 1000)} L`;
}

export function litersToInput(ml) {
  if (!ml) return '';
  return liters.format(ml / 1000);
}

export function formatNumber(value) {
  return number.format(value);
}

export function formatKg(kg) {
  return `${formatNumber(kg)} kg`;
}

export function formatWeightDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(
    new Date(year, month - 1, day),
  );
}

export function genderLabel(value) {
  return GENDERS.find((item) => item.value === value)?.label || '—';
}

export function genderSymbol(value) {
  if (value === 'female') return '♀';
  if (value === 'male') return '♂';
  return '·';
}
