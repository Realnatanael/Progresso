import sharp from 'sharp';

/**
 * Remove fundo chroma-key (verde) ou branco quase puro das bordas,
 * devolvendo PNG com alpha pra o personagem sentar na vila.
 */
export async function cutAvatarBackground(inputBuffer) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixels = Buffer.from(data);
  const alphaMask = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i += 1) {
    const o = i * channels;
    const r = pixels[o];
    const g = pixels[o + 1];
    const b = pixels[o + 2];
    alphaMask[i] = isBackdropPixel(r, g, b) ? 0 : 255;
  }

  // Flood a partir das bordas: só apaga fundo contínuo (protege tênis branco).
  const keep = floodKeepSubject(alphaMask, width, height);
  for (let i = 0; i < width * height; i += 1) {
    if (!keep[i]) {
      const o = i * channels;
      pixels[o + 3] = 0;
    } else if (isFringeGreen(pixels[o], pixels[o + 1], pixels[o + 2])) {
      pixels[o + 3] = Math.min(pixels[o + 3], 90);
    }
  }

  return sharp(pixels, {
    raw: { width, height, channels },
  })
    .png()
    .toBuffer();
}

function isBackdropPixel(r, g, b) {
  // Chroma verde pedido no prompt
  if (g > 140 && g > r + 40 && g > b + 40) return true;
  // Branco / cinza muito claro (fundo clássico do modelo)
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (min >= 235 && max - min <= 18) return true;
  if (min >= 250) return true;
  return false;
}

function isFringeGreen(r, g, b) {
  return g > 120 && g > r + 25 && g > b + 25;
}

function floodKeepSubject(alphaMask, width, height) {
  const backdrop = new Uint8Array(width * height);
  const stack = [];

  const pushIfBackdrop = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (backdrop[i] || alphaMask[i] !== 0) return;
    backdrop[i] = 1;
    stack.push(i);
  };

  for (let x = 0; x < width; x += 1) {
    pushIfBackdrop(x, 0);
    pushIfBackdrop(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    pushIfBackdrop(0, y);
    pushIfBackdrop(width - 1, y);
  }

  while (stack.length) {
    const i = stack.pop();
    const x = i % width;
    const y = (i / width) | 0;
    pushIfBackdrop(x + 1, y);
    pushIfBackdrop(x - 1, y);
    pushIfBackdrop(x, y + 1);
    pushIfBackdrop(x, y - 1);
  }

  const keep = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    keep[i] = backdrop[i] ? 0 : 1;
  }
  return keep;
}
