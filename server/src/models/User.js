import mongoose from 'mongoose';

const measuresSchema = new mongoose.Schema(
  {
    armCm: { type: Number, default: null },
    shoulderCm: { type: Number, default: null },
    forearmCm: { type: Number, default: null },
    chestCm: { type: Number, default: null },
    thighCm: { type: Number, default: null },
    calfCm: { type: Number, default: null },
    hipsCm: { type: Number, default: null },
  },
  { _id: false },
);

const ninjaSchema = new mongoose.Schema(
  {
    clanName: { type: String, default: '', trim: true, maxlength: 40 },
    clanNameSyncedFromName: { type: Boolean, default: true },
    rank: {
      type: String,
      enum: ['academy', 'genin', 'chuunin', 'jounin'],
      default: 'academy',
    },
    chakra: { type: Number, default: 0, min: 0, max: 365 },
    ninjutsu: { type: Number, default: 0, min: 0, max: 100 },
    genjutsu: { type: Number, default: 0, min: 0, max: 100 },
    taijutsu: { type: Number, default: 0, min: 0, max: 100 },
    unlockPoints: { type: Number, default: 0, min: 0 },
    natures: { type: [String], default: [] },
    learnedJutsuIds: { type: [String], default: [] },
    unlockedKekkeiIds: { type: [String], default: [] },
    unlockedBijuuIds: { type: [String], default: [] },
    /** { bijuuId, name, tails, buff, limit, sealedAt } */
    jinchuuriki: { type: mongoose.Schema.Types.Mixed, default: null },
    /** id do caminho sennin escolhido */
    senninPath: { type: String, default: null },
    pendingStatPick: { type: mongoose.Schema.Types.Mixed, default: null },
    waterDates: { type: [String], default: [] },
    perfectDates: { type: [String], default: [] },
    workoutPicks: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    /** true depois da 1ª geração com Gemini */
    avatarReady: { type: Boolean, default: false },
    avatarUpdatedAt: { type: Date, default: null },
    /** rank|eye:stage — último visual gerado (pra regenerar só quando muda) */
    avatarLookKey: { type: String, default: null },
    /** Modo História: capítulos concluídos, cena ativa, histórico */
    story: { type: mongoose.Schema.Types.Mixed, default: null },
    /** Missão diária (1 por dia) */
    dailyMission: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    heightCm: { type: Number, default: null },
    age: { type: Number, default: null },
    gender: { type: String, enum: ['male', 'female', 'other'], default: null },
    measures: { type: measuresSchema, default: () => ({}) },
    ninja: { type: ninjaSchema, default: () => ({}) },
    /** PNG/JPEG gerado; select:false pra não ir em todo GET */
    ninjaAvatarData: { type: Buffer, default: null, select: false },
    ninjaAvatarMime: { type: String, default: null, select: false },
    /** Selfie original pra regenerar o visual quando rank/olhos mudam */
    ninjaSelfieData: { type: Buffer, default: null, select: false },
    ninjaSelfieMime: { type: String, default: null, select: false },
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
  };
};

userSchema.methods.toBodyProfile = function toBodyProfile() {
  const m = this.measures || {};
  return {
    heightCm: this.heightCm ?? null,
    age: this.age ?? null,
    gender: this.gender ?? null,
    measures: {
      armCm: m.armCm ?? null,
      shoulderCm: m.shoulderCm ?? null,
      forearmCm: m.forearmCm ?? null,
      chestCm: m.chestCm ?? null,
      thighCm: m.thighCm ?? null,
      calfCm: m.calfCm ?? null,
      hipsCm: m.hipsCm ?? null,
    },
  };
};

export const User = mongoose.model('User', userSchema);
