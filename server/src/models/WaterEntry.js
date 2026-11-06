import mongoose from 'mongoose';

const waterEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    habitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true, index: true },
    date: { type: String, required: true },
    ml: { type: Number, required: true },
  },
  { timestamps: true },
);

export const WaterEntry = mongoose.model('WaterEntry', waterEntrySchema);
