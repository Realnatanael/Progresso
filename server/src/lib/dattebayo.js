const BASE = 'https://dattebayo-api.onrender.com';
const cache = new Map();
const TTL_MS = 1000 * 60 * 60 * 6; // 6h

const ALLOWED = new Set([
  'characters',
  'clans',
  'villages',
  'kekkei-genkai',
  'tailed-beasts',
  'teams',
  'akatsuki',
  'kara',
]);

export async function fetchDattebayo(collection, idOrQuery = '') {
  if (!ALLOWED.has(collection)) {
    const err = new Error('Coleção inválida.');
    err.status = 400;
    throw err;
  }

  const path = idOrQuery
    ? `/${collection}/${encodeURIComponent(String(idOrQuery))}`
    : `/${collection}?limit=5`;
  const key = path;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: controller.signal });
    if (!res.ok) {
      const err = new Error('Lore da API indisponível agora.');
      err.status = 502;
      throw err;
    }
    const data = await res.json();
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      const err = new Error('A API de lore demorou demais.');
      err.status = 504;
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
