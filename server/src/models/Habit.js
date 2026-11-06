import mongoose from 'mongoose';

const habitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    kind: { type: String, enum: ['check', 'water'], default: 'check' },
    goalMl: { type: Number, default: null },
  },
  { timestamps: true },
);

export const Habit = mongoose.model('Habit', habitSchema);
