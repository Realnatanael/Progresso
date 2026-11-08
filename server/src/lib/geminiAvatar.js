import { buildNinjaAvatarPrompt } from './ninjaAvatarPrompt.js';
import { cutAvatarBackground } from './cutAvatarBackground.js';

const DEFAULT_MODEL = 'gemini-2.5-flash-image';

/**
 * Gera PNG/JPEG do personagem via Gemini (imagem a partir de selfie + prompt fixo).
 * @returns {{ mime: string, buffer: Buffer }}
 */
export async function generateNinjaAvatarImage({
  photoBase64,
  photoMime,
  age,
  heightCm,
  weightKg,
  gender,
  clanName,
  displayName,
  rank = 'academy',
  eye = null,
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY não configurada no servidor.');
    err.status = 503;
    err.publicMessage = 'Geração de avatar ainda não está configurada.';
    throw err;
  }

  const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;
  const prompt = buildNinjaAvatarPrompt({
    age,
    heightCm,
    weightKg,
    gender,
    clanName,
    displayName,
    rank,
    eye,
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: photoMime || 'image/jpeg',
                data: photoBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }),
  });

  const raw = await response.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    const err = new Error('Resposta inválida do Gemini.');
    err.status = 502;
    err.publicMessage = 'Não foi possível gerar o personagem agora.';
    throw err;
  }

  if (!response.ok) {
    const message = payload?.error?.message || `Gemini HTTP ${response.status}`;
    const err = new Error(message);
    err.status = response.status >= 400 && response.status < 600 ? response.status : 502;
    err.publicMessage = friendlyGeminiError(message, response.status);
    throw err;
  }

  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    const refusal = parts.find((part) => part.text)?.text;
    const err = new Error(refusal || 'Gemini não devolveu imagem.');
    err.status = 422;
    err.publicMessage = refusal
      ? 'A IA não pôde usar essa foto. Tente outra, com o rosto bem visível.'
      : 'A IA não devolveu imagem. Tente de novo.';
    throw err;
  }

  const rawBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
  try {
    const cut = await cutAvatarBackground(rawBuffer);
    return { mime: 'image/png', buffer: cut };
  } catch (error) {
    console.error('Falha ao recortar fundo do avatar:', error);
    return {
      mime: imagePart.inlineData.mimeType || 'image/png',
      buffer: rawBuffer,
    };
  }
}

function friendlyGeminiError(message, status) {
  const lower = String(message || '').toLowerCase();
  if (status === 429 || lower.includes('quota') || lower.includes('rate')) {
    return 'Limite da API Gemini atingido. Tente em alguns minutos.';
  }
  if (status === 401 || status === 403 || lower.includes('api key')) {
    return 'Chave Gemini inválida ou sem permissão no Render.';
  }
  if (lower.includes('billing') || lower.includes('payment')) {
    return 'Faturamento Gemini ainda não liberado para geração de imagem.';
  }
  return 'Não foi possível gerar o personagem agora.';
}
