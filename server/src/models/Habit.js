import mongoose from 'mongoose';

const habitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    kind: { type: String, enum: ['check', 'water', 'exercise'], default: 'check' },
    goalMl: { type: Number, default: null },
    activeDays: { type: [Number], default: [] },
    exercises: {
      type: [{
        weekday: { type: Number, required: true, min: 0, max: 6 },
        name: { type: String, required: true, trim: true, maxlength: 80 },
        position: { type: Number, default: 0 },
      }],
      default: [],
    },
  },
  { timestamps: true },
);

export const Habit = mongoose.model('Habit', habitSchema);
