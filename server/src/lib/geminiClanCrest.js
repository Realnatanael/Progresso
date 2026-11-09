/**
 * Brasão decorativo do clã (não é heráldica oficial — sobrenome BR não garante armas).
 * Com Gemini: gera emblema estilo brasão/clã shinobi. Sem chave: SVG determinístico.
 */

const DEFAULT_MODEL = 'gemini-2.5-flash-image';

export async function generateClanCrestImage({ clanName }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fallbackCrest(clanName);
  }

  const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;
  const prompt = [
    'Create ONE square family crest / coat of arms emblem for a Brazilian shinobi clan.',
    `Clan surname: "${clanName}".`,
    'Style: decorative heraldic shield (Portuguese-Brazilian flavor) mixed with subtle Naruto/Konoha clan emblem aesthetics.',
    'Include a shield, a symbolic animal or plant fitting the surname sound/meaning if possible, and elegant gold/crimson/indigo colors.',
    'NO real-world copyrighted logos. NO readable long text (a monogram initial is ok).',
    'Flat solid background #1a1410 or deep brown-black. Centered emblem. Square composition.',
    'Clean illustration, high contrast, suitable as a small UI badge.',
  ].join('\n');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    });
    const raw = await response.text();
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return fallbackCrest(clanName);
    }
    if (!response.ok) {
      console.error('Gemini crest HTTP', response.status, payload?.error?.message);
      return fallbackCrest(clanName);
    }
    const parts = payload?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part) => part.inlineData?.data);
    if (!imagePart?.inlineData?.data) return fallbackCrest(clanName);
    return {
      mime: imagePart.inlineData.mimeType || 'image/png',
      buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
    };
  } catch (error) {
    console.error('Gemini crest falhou:', error?.message || error);
    return fallbackCrest(clanName);
  }
}

export function fallbackCrest(clanName) {
  const name = String(clanName || 'Clã').trim() || 'Clã';
  const initial = name[0]?.toUpperCase() || 'C';
  const hue = hashHue(name);
  const c1 = `hsl(${hue}, 55%, 42%)`;
  const c2 = `hsl(${(hue + 40) % 360}, 45%, 28%)`;
  const gold = '#e2a23a';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <rect width="256" height="256" fill="#14110e"/>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <path d="M128 28 L208 58 L208 130 C208 178 168 214 128 232 C88 214 48 178 48 130 L48 58 Z"
    fill="url(#g)" stroke="${gold}" stroke-width="6"/>
  <circle cx="128" cy="118" r="36" fill="none" stroke="${gold}" stroke-width="4"/>
  <text x="128" y="132" text-anchor="middle" font-family="Georgia, serif" font-size="42"
    font-weight="700" fill="${gold}">${escapeXml(initial)}</text>
  <text x="128" y="198" text-anchor="middle" font-family="Georgia, serif" font-size="16"
    fill="#f3e6c4" letter-spacing="2">${escapeXml(name.slice(0, 14).toUpperCase())}</text>
</svg>`;
  return { mime: 'image/svg+xml', buffer: Buffer.from(svg, 'utf8') };
}

function hashHue(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function clanCrestKey(clanName) {
  return String(clanName || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
