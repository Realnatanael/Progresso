/** Prompt único pra todos: estudante da academia, sem bandana. */
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
    'Art style: clean anime illustration inspired by Naruto-like aesthetics, soft shading, UI-ready.',
    '',
    'ROLE: this character is still an ACADEMY STUDENT (not a graduated ninja).',
    '',
    'CLOTHING (mandatory):',
    '- Wear ordinary casual student clothes only (simple shirt or hoodie, pants or skirt, sneakers or simple shoes).',
    '- NO ninja uniform, NO flak jacket, NO mesh armor, NO combat gear.',
    '- NO forehead protector, NO bandana, NO headband of any kind (on forehead, neck, arm, or waist).',
    '- NO weapons, kunai, shuriken, scrolls, or clan symbols as logos.',
    '',
    'COMPOSITION:',
    '- Standing, facing camera, full body or 3/4 body visible.',
    '- Soft simple background (no busy village collage), suitable to place over a UI scene.',
    '- Single character only. No text, no watermark, no UI chrome.',
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
