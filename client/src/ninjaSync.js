import { api } from './api.js';

/** Atualiza prêmios ninja a partir dos hábitos do dia (falha silenciosa). */
export function syncNinja(date) {
  return api('/api/ninja/sync', { method: 'POST', body: { date } }).catch(() => null);
}
