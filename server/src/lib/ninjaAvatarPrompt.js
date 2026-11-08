/** Prompt único pra todos: estudante da academia estilo Naruto NPC. */
export function buildNinjaAvatarPrompt({
  age,
  heightCm,
  weightKg,
  gender,
  clanName,
  displayName,
}) {
  const genderLine = genderLabel(gender);
  const stats = [
    age != null ? `age about ${age}` : null,
    heightCm != null ? `height about ${heightCm} cm` : null,
    weightKg != null ? `weight about ${weightKg} kg` : null,
    genderLine,
  ].filter(Boolean).join(', ');

  return [
    'Create ONE full-body anime character based on the attached selfie photo.',
    'Preserve the person\'s face, hairstyle, skin tone, and recognizable features from the photo.',
    'Art style: classic Naruto anime character sheet, clean lines, cel shading.',
    '',
    'ROLE: Hidden Leaf Village ACADEMY STUDENT NPC (not a graduated genin).',
    '',
    'CLOTHING (mandatory — traditional shinobi academy look, NOT modern fashion):',
    '- Wear a classic Naruto Academy student outfit: dark indigo/blue high-collar jacket, simple matching pants, mesh shirt visible at collar optional.',
    '- Shinobi sandals (waraji-style), NOT sneakers, NOT boots, NOT modern shoes.',
    '- NO hoodie, NO jeans, NO cargo pants, NO t-shirt logo, NO streetwear, NO contemporary clothes.',
    '- NO forehead protector, NO bandana, NO headband of any kind.',
    '- NO weapons, kunai, shuriken, scrolls, or written clan logos.',
    '',
    'COMPOSITION:',
    '- Standing, facing camera, FULL BODY from head to sandals.',
    '- Background MUST be flat solid chroma-key green (#00FF00), evenly lit, no gradients, no floor, no scenery, no shadows on the background.',
    '- Do NOT use white/gray/village backgrounds. Pure green screen only for cutout.',
    '- Single character only. No text, no watermark, no UI.',
    '',
    stats ? `Physical cues to reflect subtly: ${stats}.` : '',
    displayName ? `Character first-name vibe: ${String(displayName).split(/\s+/)[0]}.` : '',
    clanName ? `Subtle family surname vibe only (no written text): ${clanName}.` : '',
  ].filter(Boolean).join('\n');
}

function genderLabel(gender) {
  if (gender === 'male') return 'masculine presentation';
  if (gender === 'female') return 'feminine presentation';
  if (gender === 'other') return 'androgynous or neutral presentation';
  return null;
}
