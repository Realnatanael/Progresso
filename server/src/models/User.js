import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    heightCm: { type: Number, default: null },
    age: { type: Number, default: null },
    gender: { type: String, enum: ['male', 'female', 'other'], default: null },
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
  return {
    heightCm: this.heightCm ?? null,
    age: this.age ?? null,
    gender: this.gender ?? null,
  };
};

export const User = mongoose.model('User', userSchema);
