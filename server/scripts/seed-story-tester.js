/**
 * Cria/atualiza um usuário com recursos pra jogar o Modo História do início ao fim.
 *
 * Login:
 *   email: historia.teste@progresso.app
 *   senha: historia123
 *
 * Pular direto para um capítulo (marca os anteriores como concluídos e ajusta a patente):
 *   node scripts/seed-story-tester.js --chapter=bridge_country
 *   node scripts/seed-story-tester.js --list     (mostra os ids dos capítulos)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { NINJA_CATALOG, defaultNinjaState } from '../src/data/ninjaCatalog.js';
import { STORY_CHAPTERS } from '../src/data/storyRoadmap.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)?.[1]?.trim();
if (!uri) {
  console.error('MONGODB_URI ausente');
  process.exit(1);
}

const EMAIL = 'historia.teste@progresso.app';
const PASSWORD = 'historia123';
const NAME = 'Tester História';

// Personagem de teste: usa o sprite do herói (recortado) como avatar.
const heroSprite = path.join(__dirname, '../../client/public/images/story/sprites/hero.webp');
const png = fs.existsSync(heroSprite)
  ? await sharp(heroSprite).png().toBuffer()
  : Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

const catalogJutsus = NINJA_CATALOG.filter((entry) => entry.kind === 'jutsu');
const sRank = catalogJutsus.filter((entry) => entry.tier === 'S');
const learnedJutsuIds = [
  ...new Set([
    ...catalogJutsus.slice(0, 28).map((entry) => entry.id),
    ...sRank.slice(0, 3).map((entry) => entry.id),
  ]),
];

const args = process.argv.slice(2);
if (args.includes('--list')) {
  STORY_CHAPTERS.forEach((chapter, index) => console.log(`${String(index + 1).padStart(2)} ${chapter.id}  (${chapter.rank})`));
  process.exit(0);
}
const chapterArg = args.find((arg) => arg.startsWith('--chapter='))?.split('=')[1];
const startIndex = chapterArg ? STORY_CHAPTERS.findIndex((chapter) => chapter.id === chapterArg) : 0;
if (startIndex < 0) {
  console.error(`Capítulo desconhecido: ${chapterArg}. Use --list.`);
  process.exit(1);
}
const startChapter = STORY_CHAPTERS[startIndex];

await mongoose.connect(uri);
const col = mongoose.connection.collection('users');
const passwordHash = await bcrypt.hash(PASSWORD, 12);

const ninja = {
  ...defaultNinjaState(),
  clanName: 'História',
  clanNameSyncedFromName: false,
  rank: startChapter.rank,
  avatarReady: true,
  avatarUpdatedAt: new Date(),
  unlockPoints: 500,
  chakra: 280,
  ninjutsu: 55,
  genjutsu: 50,
  taijutsu: 50,
  natures: ['fire', 'water', 'wind', 'earth', 'lightning'],
  learnedJutsuIds,
  unlockedKekkeiIds: ['kekkei-sharingan-1', 'kekkei-sharingan-2', 'kekkei-sharingan-3'],
  unlockedBijuuIds: [],
  jinchuuriki: null,
  senninPath: null,
  story: {
    completedChapterIds: STORY_CHAPTERS.slice(0, startIndex).map((chapter) => chapter.id),
    activeBeat: null,
    progress: null,
    lastOutcome: null,
    choiceHistory: [],
    retryAfter: null,
    failSnapshot: null,
    // Conta de teste: falhas não travam a história até o dia seguinte.
    testMode: true,
  },
  dailyMission: null,
};

const existing = await col.findOne({ email: EMAIL });
if (existing) {
  await col.updateOne(
    { _id: existing._id },
    {
      $set: {
        name: NAME,
        passwordHash,
        heightCm: 175,
        age: 24,
        gender: 'male',
        ninja,
        ninjaAvatarData: png,
        ninjaAvatarMime: 'image/png',
        ninjaSelfieData: png,
        ninjaSelfieMime: 'image/png',
      },
    },
  );
  console.log('atualizado', EMAIL);
} else {
  await col.insertOne({
    name: NAME,
    email: EMAIL,
    passwordHash,
    heightCm: 175,
    age: 24,
    gender: 'male',
    measures: {},
    ninja,
    ninjaAvatarData: png,
    ninjaAvatarMime: 'image/png',
    ninjaSelfieData: png,
    ninjaSelfieMime: 'image/png',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log('criado', EMAIL);
}

console.log({
  email: EMAIL,
  password: PASSWORD,
  unlockPoints: ninja.unlockPoints,
  chakra: ninja.chakra,
  stats: ninja.ninjutsu + ninja.genjutsu + ninja.taijutsu,
  jutsus: ninja.learnedJutsuIds.length,
  sRank: ninja.learnedJutsuIds.filter((id) => sRank.some((entry) => entry.id === id)).length,
  path: ninja.unlockedKekkeiIds,
  rank: ninja.rank,
  storyChaptersDone: startIndex,
  startChapter: startChapter.id,
});

await mongoose.disconnect();
