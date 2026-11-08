/** Prompt do personagem: sempre parece com a selfie; vestimenta/olhos acompanham a evolução. */
export function buildNinjaAvatarPrompt({
  age,
  heightCm,
  weightKg,
  gender,
  clanName,
  displayName,
  rank = 'academy',
  eye = null,
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
    'CRITICAL LIKENESS: Preserve the person\'s face shape, eyes spacing, nose, mouth, hairstyle, hair color, skin tone, and recognizable features from the photo.',
    'Only change clothing, accessories, and (if requested) eye pattern — never replace the face with a generic anime face.',
    'Art style: classic Naruto anime character sheet, clean lines, cel shading.',
    '',
    roleLine(rank),
    '',
    'CLOTHING (mandatory — traditional shinobi look, NOT modern fashion):',
    ...outfitLines(rank),
    '- Shinobi sandals (waraji-style), NOT sneakers, NOT boots, NOT modern shoes.',
    '- NO hoodie, NO jeans, NO cargo pants, NO t-shirt logo, NO streetwear, NO contemporary clothes.',
    '- NO weapons, kunai, shuriken, scrolls, or written clan logos.',
    '',
    ...eyeLines(eye),
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

function roleLine(rank) {
  switch (rank) {
    case 'genin':
      return 'ROLE: Hidden Leaf Village GENIN shinobi (graduated from the academy).';
    case 'chuunin':
      return 'ROLE: Hidden Leaf Village CHUUNIN shinobi (experienced mid-rank ninja).';
    case 'jounin':
      return 'ROLE: Hidden Leaf Village JOUNIN shinobi (elite leaf ninja).';
    default:
      return 'ROLE: Hidden Leaf Village ACADEMY STUDENT NPC (not a graduated genin).';
  }
}

function outfitLines(rank) {
  switch (rank) {
    case 'genin':
      return [
        '- Wear a classic Naruto Genin outfit: practical shinobi jacket/shirt and pants in leaf-village colors (indigo, teal, or olive).',
        '- MUST wear a Konoha forehead protector (metal plate with leaf village symbol on a cloth bandana) on the forehead.',
        '- Look like a fresh graduate — neat, ready for missions, not an academy kid.',
      ];
    case 'chuunin':
      return [
        '- Wear a more advanced Chuunin shinobi outfit: tailored high-collar jacket or flak-style vest over mesh armor, coordinated pants.',
        '- MUST wear a Konoha forehead protector (metal leaf plate on cloth bandana).',
        '- Clothing should look more experienced and mission-ready than a genin — sharper, higher quality fabrics.',
      ];
    case 'jounin':
      return [
        '- Wear the classic Konoha Jounin uniform: green flak jacket with pouch pockets over a dark shirt, matching dark pants.',
        '- MUST wear a Konoha forehead protector (metal leaf plate on cloth bandana).',
        '- Look like elite Leaf Jounin gear — authoritative, clean, recognizable Konoha flak jacket.',
      ];
    default:
      return [
        '- Wear a classic Naruto Academy student outfit: dark indigo/blue high-collar jacket, simple matching pants, mesh shirt visible at collar optional.',
        '- NO forehead protector, NO bandana, NO headband of any kind.',
      ];
  }
}

function eyeLines(eye) {
  if (!eye?.eye) {
    return [
      'EYES:',
      '- Keep the person\'s natural eye color and pupils from the selfie. NO dōjutsu patterns.',
    ];
  }

  if (eye.eye === 'sharingan') {
    if (eye.stage >= 4) {
      return [
        'EYES (mandatory dōjutsu):',
        '- Both eyes show Mangekyō Sharingan: deep red iris with a distinctive pinwheel/flower tomoe pattern (not plain three-tomoe).',
        '- Keep facial likeness; only the iris pattern changes.',
      ];
    }
    const tomoe = Math.min(3, Math.max(1, eye.stage || 1));
    return [
      'EYES (mandatory dōjutsu):',
      `- Both eyes show Sharingan: deep red iris with exactly ${tomoe} black tomoe comma(s) around the pupil.`,
      '- Keep facial likeness; only the iris pattern changes.',
    ];
  }

  if (eye.eye === 'byakugan') {
    return [
      'EYES (mandatory dōjutsu):',
      '- Both eyes show Byakugan: pale lavender-white iris, almost pupil-less glowing white look, veins subtly near the temples optional.',
      '- Keep facial likeness; only the eyes change to Byakugan.',
    ];
  }

  if (eye.eye === 'rinnegan') {
    return [
      'EYES (mandatory dōjutsu):',
      '- Both eyes show Rinnegan: light purple iris with concentric ripple rings around the pupil.',
      '- Keep facial likeness; only the iris pattern changes.',
    ];
  }

  return [
    'EYES:',
    '- Keep the person\'s natural eye color from the selfie.',
  ];
}

function genderLabel(gender) {
  if (gender === 'male') return 'masculine presentation';
  if (gender === 'female') return 'feminine presentation';
  if (gender === 'other') return 'androgynous or neutral presentation';
  return null;
}
