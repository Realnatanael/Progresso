import sharp from 'sharp';

/**
 * Remove o fundo (chroma verde / branco / cor das bordas) e devolve PNG com alpha.
 */
export async function cutAvatarBackground(inputBuffer) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixels = Buffer.from(data);
  const samples = sampleEdgeColors(pixels, width, height, channels);
  const remove = floodRemoveBackdrop(pixels, width, height, channels, samples);

  for (let i = 0; i < width * height; i += 1) {
    const o = i * channels;
    if (remove[i]) {
      pixels[o + 3] = 0;
      continue;
    }
    // Suaviza franja verde residual no contorno
    if (isLooseGreen(pixels[o], pixels[o + 1], pixels[o + 2]) && touchesRemoved(remove, width, height, i)) {
      pixels[o + 3] = Math.min(pixels[o + 3], 40);
    }
  }

  return sharp(pixels, {
    raw: { width, height, channels },
  })
    .png()
    .toBuffer();
}

function sampleEdgeColors(pixels, width, height, channels) {
  const points = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
  ];
  return points.map(([x, y]) => {
    const o = (y * width + x) * channels;
    return [pixels[o], pixels[o + 1], pixels[o + 2]];
  });
}

function floodRemoveBackdrop(pixels, width, height, channels, samples) {
  const remove = new Uint8Array(width * height);
  const stack = [];

  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (remove[i]) return;
    const o = i * channels;
    const r = pixels[o];
    const g = pixels[o + 1];
    const b = pixels[o + 2];
    if (!isRemovableBackdrop(r, g, b, samples)) return;
    remove[i] = 1;
    stack.push(i);
  };

  for (let x = 0; x < width; x += 1) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (stack.length) {
    const i = stack.pop();
    const x = i % width;
    const y = (i / width) | 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  return remove;
}

function isRemovableBackdrop(r, g, b, samples) {
  if (isLooseGreen(r, g, b)) return true;
  if (isNearWhite(r, g, b)) return true;
  for (const [sr, sg, sb] of samples) {
    if (colorDist(r, g, b, sr, sg, sb) <= 78) return true;
  }
  return false;
}

function isLooseGreen(r, g, b) {
  // Pega verde puro e verde claro/pastel do chroma
  if (g >= 90 && g >= r + 18 && g >= b + 18) return true;
  if (g >= 150 && g > r && g > b && (g - Math.min(r, b)) >= 12) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return g === max && g - min >= 20 && g >= 110;
}

function isNearWhite(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return min >= 228 && max - min <= 22;
}

function colorDist(r1, g1, b1, r2, g2, b2) {
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

function touchesRemoved(remove, width, height, index) {
  const x = index % width;
  const y = (index / width) | 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (remove[ny * width + nx]) return true;
    }
  }
  return false;
}
