import mongoose from 'mongoose';

const checkInSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    habitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true },
    date: { type: String, required: true },
    /** Snapshot dos músculos do treino no momento do check-in. */
    muscles: { type: [String], default: [] },
  },
  { timestamps: true },
);

checkInSchema.index({ habitId: 1, date: 1 }, { unique: true });

export const CheckIn = mongoose.model('CheckIn', checkInSchema);
