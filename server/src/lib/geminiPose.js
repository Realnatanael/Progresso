import sharp from 'sharp';
import { cutAvatarBackground } from './cutAvatarBackground.js';

const DEFAULT_MODEL = 'gemini-2.5-flash-image';

export const POSE_NAMES = ['attack', 'cast', 'guard', 'hurt', 'win'];

const POSE_PROMPT = {
  attack: 'a dynamic ATTACK pose: lunging forward toward the right side of the frame with a powerful punch or kick, body leaning into the strike, fierce determined expression',
  cast: 'a JUTSU pose: both hands in front of the chest forming a ninja hand seal, intense focused expression, a subtle glow of chakra around the hands, stable wide stance',
  guard: 'a DEFENSIVE GUARD pose: crouching slightly, forearms crossed in front of the face and chest, braced for impact, gritted teeth',
  hurt: 'a HURT pose: recoiling backward, staggering off balance, one arm flung out, pained gritted-teeth expression, clothes slightly ruffled',
  win: 'a VICTORY pose: one fist raised confidently, proud smile, relaxed upright stance',
};

function buildPrompt(pose) {
  return [
    'Edit the attached character image: draw the EXACT SAME character in a different pose.',
    'CRITICAL: keep the identical face, hair, skin tone, outfit, colors, forehead protector, accessories and art style. Do not redesign anything.',
    `New pose: ${POSE_PROMPT[pose]}.`,
    'Composition: FULL BODY from head to feet fully visible, centered, facing toward the right side of the image when possible.',
    'Background MUST be flat solid chroma-key green (#00FF00), evenly lit, no gradients, no floor, no scenery, no shadow on the background.',
    'Single character only. No text, no watermark, no effects other than the ones described.',
  ].join('\n');
}

/**
 * Gera uma pose nova do mesmo personagem a partir do avatar já pronto.
 * @returns {{ mime: string, buffer: Buffer }}
 */
export async function generatePoseImage({ avatarBuffer, pose }) {
  if (!POSE_PROMPT[pose]) throw new Error(`Pose desconhecida: ${pose}`);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY não configurada no servidor.');
    err.status = 503;
    throw err;
  }

  // O avatar tem fundo transparente; manda sobre verde pra IA manter o mesmo fundo.
  const reference = await sharp(avatarBuffer)
    .flatten({ background: '#00ff00' })
    .png()
    .toBuffer();

  const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildPrompt(pose) },
            { inlineData: { mimeType: 'image/png', data: reference.toString('base64') } },
          ],
        },
      ],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });

  const raw = await response.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('Resposta inválida do Gemini (pose).');
  }
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini HTTP ${response.status}`);
  }

  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error(parts.find((part) => part.text)?.text || 'Gemini não devolveu imagem (pose).');
  }

  const rawBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
  const cut = await cutAvatarBackground(rawBuffer);
  // Sem trim: mantém a mesma moldura/escala do avatar base pra troca de pose não "pular".
  const out = await sharp(cut)
    .resize({ height: 900, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 92 })
    .toBuffer();
  return { mime: 'image/webp', buffer: out };
}
