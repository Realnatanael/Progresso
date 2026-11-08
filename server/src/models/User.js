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

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    heightCm: { type: Number, default: null },
    age: { type: Number, default: null },
    gender: { type: String, enum: ['male', 'female', 'other'], default: null },
    measures: { type: measuresSchema, default: () => ({}) },
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
