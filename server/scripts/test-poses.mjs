/**
 * Testa o pipeline de poses com o Gemini simulado (não gasta API).
 * Uso: node scripts/test-poses.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)?.[1]?.trim();
if (!uri) throw new Error('MONGODB_URI ausente');

process.env.GEMINI_API_KEY = 'chave-de-teste';

// "Gemini": devolve o herói sobre fundo verde, como a IA faria.
const hero = fs.readFileSync(path.join(__dirname, '../../client/public/images/story/sprites/hero.webp'));
const green = await sharp(hero).flatten({ background: '#00ff00' }).png().toBuffer();
let calls = 0;
globalThis.fetch = async (_url, init) => {
  calls += 1;
  const body = JSON.parse(init.body);
  const prompt = body.contents[0].parts[0].text;
  if (!/EXACT SAME character/.test(prompt)) throw new Error('prompt inesperado');
  return {
    ok: true,
    text: async () => JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: green.toString('base64') } }] } }],
    }),
  };
};

await mongoose.connect(uri);
const { User } = await import('../src/models/User.js');
const { NinjaPose } = await import('../src/models/NinjaPose.js');
const { ensurePosesInBackground, poseStatus } = await import('../src/lib/ninjaPoses.js');

const user = await User.findOne({ email: 'historia.teste@progresso.app' });
if (!user) throw new Error('rode seed-story-tester.js primeiro');
await NinjaPose.deleteMany({ userId: user._id });

console.log('início:', await ensurePosesInBackground(user));
console.log('segunda chamada (deve ignorar):', await ensurePosesInBackground(user));

let status;
for (let i = 0; i < 60; i += 1) {
  status = await poseStatus(user);
  if (status.ready.length === status.total) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
console.log('status:', status);

const row = await NinjaPose.findOne({ userId: user._id, name: 'attack' });
const meta = await sharp(row.data).metadata();
console.log('pose attack:', { alpha: meta.hasAlpha, size: `${meta.width}x${meta.height}`, bytes: row.data.length });

const again = await ensurePosesInBackground(user);
console.log('depois de pronto:', again, '· chamadas ao Gemini:', calls);

await NinjaPose.deleteMany({ userId: user._id });
await mongoose.disconnect();

const ok = status.ready.length === 5 && meta.hasAlpha && calls === 5 && again.reason === 'ready';
console.log(ok ? 'OK' : 'FALHOU');
process.exit(ok ? 0 : 1);
