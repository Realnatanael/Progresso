/**
 * Pipeline único dos assets do Modo História:
 *  - fundos (16:9) → client/public/images/story/bg-<nome>.jpg
 *  - sprites (fundo branco) → recorte + trim → client/public/images/story/sprites/<nome>.webp
 *
 * Uso: node scripts/process-story-art.mjs <pasta-com-as-imagens-geradas>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { cutAvatarBackground } from '../src/lib/cutAvatarBackground.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = process.argv[2];
if (!source) {
  console.error('Informe a pasta de origem das imagens geradas.');
  process.exit(1);
}

const outRoot = path.resolve(__dirname, '../../client/public/images/story');
const spritesDir = path.join(outRoot, 'sprites');
fs.mkdirSync(spritesDir, { recursive: true });

const BACKGROUNDS = {
  classroom: 'story-bg-classroom',
  yard: 'story-bg-yard',
  hokage: 'story-bg-hokage',
  village: 'story-bg-village',
  road: 'story-bg-road',
  'mist-bridge': 'story-bg-mist-bridge',
  'exam-hall': 'story-bg-exam-hall',
  forest: 'story-bg-forest',
  arena: 'story-bg-arena',
  mountains: 'story-bg-mountains',
  battlefield: 'story-bg-battlefield',
};

const SPRITES = {
  hero: 'sprite-hero',
  rival: 'sprite-rival',
  bandit: 'sprite-bandit',
  swordsman: 'sprite-swordsman',
  serpent: 'sprite-serpent',
  jounin: 'sprite-jounin',
  shadow: 'sprite-shadow',
  kunoichi: 'sprite-kunoichi',
  sand: 'sprite-sand',
};

function findSource(base) {
  for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
    const file = path.join(source, `${base}${ext}`);
    if (fs.existsSync(file)) return file;
  }
  throw new Error(`Arquivo não encontrado: ${base}`);
}

for (const [name, base] of Object.entries(BACKGROUNDS)) {
  const file = findSource(base);
  const out = path.join(outRoot, `bg-${name}.jpg`);
  await sharp(file)
    .resize({ width: 1280, withoutEnlargement: false })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(out);
  console.log('bg', name, `${Math.round(fs.statSync(out).size / 1024)}KB`);
}

/** Sprites escuros com sombra no chão: limpa cinza/branco claro na parte de baixo. */
async function cleanGroundShadow(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixels = Buffer.from(data);
  const fromY = Math.floor(height * 0.72);
  for (let y = fromY; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * channels;
      const r = pixels[o];
      const g = pixels[o + 1];
      const b = pixels[o + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (min >= 150 && max - min <= 26) pixels[o + 3] = 0;
    }
  }
  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
}

const NEEDS_GROUND_CLEAN = new Set(['shadow']);

for (const [name, base] of Object.entries(SPRITES)) {
  const file = findSource(base);
  const raw = fs.readFileSync(file);
  let cut = await cutAvatarBackground(raw);
  if (NEEDS_GROUND_CLEAN.has(name)) cut = await cleanGroundShadow(cut);
  const out = path.join(spritesDir, `${name}.webp`);
  await sharp(cut)
    .trim({ threshold: 6 })
    .resize({ height: 860, fit: 'inside' })
    .webp({ quality: 88, alphaQuality: 92 })
    .toFile(out);
  const meta = await sharp(out).metadata();
  console.log('sprite', name, `${meta.width}x${meta.height}`, `${Math.round(fs.statSync(out).size / 1024)}KB`);
}
