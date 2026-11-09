/**
 * Gera mini-histórias ninja (JSON) via Gemini texto.
 * Sem chave / falha → null (caller usa fallback).
 */

const DEFAULT_TEXT_MODEL = 'gemini-3.8-flash';

export async function generateStoryBeatJson({ systemPrompt, userPrompt }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_TEXT_MODEL || DEFAULT_TEXT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.9,
        responseMimeType: 'application/json',
      },
    }),
  });

  const raw = await response.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!response.ok) {
    console.error('Gemini story HTTP', response.status, payload?.error?.message || raw.slice(0, 200));
    return null;
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();
  if (!text) return null;

  try {
    return JSON.parse(stripCodeFence(text));
  } catch (error) {
    console.error('Gemini story JSON inválido:', error?.message);
    return null;
  }
}

function stripCodeFence(text) {
  const trimmed = String(text || '').trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return match ? match[1].trim() : trimmed;
}
