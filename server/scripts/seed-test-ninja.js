import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)?.[1]?.trim();
if (!uri) {
  console.error('MONGODB_URI ausente');
  process.exit(1);
}

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

await mongoose.connect(uri);
const col = mongoose.connection.collection('users');
const user = await col.findOne({ email: 'teste.ninja+cursor@progresso.app' });
if (!user) {
  console.error('user not found');
  process.exit(1);
}

const prev = user.ninja || {};
const ninja = {
  ...prev,
  avatarReady: true,
  avatarUpdatedAt: new Date(),
  clanName: prev.clanName || 'Uchiha',
  unlockPoints: Math.max(prev.unlockPoints || 0, 12),
  chakra: Math.max(prev.chakra || 0, 35),
  ninjutsu: Math.max(prev.ninjutsu || 0, 8),
  genjutsu: Math.max(prev.genjutsu || 0, 4),
  taijutsu: Math.max(prev.taijutsu || 0, 5),
  natures: prev.natures?.length ? prev.natures : ['fire'],
  learnedJutsuIds: [...new Set([
    ...(prev.learnedJutsuIds || []),
    'jutsu-clone-basico',
    'jutsu-transformacao',
    'jutsu-katon-sopro',
  ])],
  story: {
    completedChapterIds: [],
    activeBeat: null,
    lastOutcome: null,
    choiceHistory: prev.story?.choiceHistory || [],
    retryAfter: null,
  },
};

await col.updateOne(
  { _id: user._id },
  {
    $set: {
      ninja,
      ninjaAvatarData: png,
      ninjaAvatarMime: 'image/png',
      ninjaSelfieData: png,
      ninjaSelfieMime: 'image/png',
    },
  },
);

console.log('ok', {
  name: user.name,
  pts: ninja.unlockPoints,
  chakra: ninja.chakra,
  natures: ninja.natures,
  jutsus: ninja.learnedJutsuIds.length,
});
await mongoose.disconnect();
