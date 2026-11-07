import mongoose from 'mongoose';

const weightEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true },
    kg: { type: Number, required: true },
  },
  { timestamps: true },
);

weightEntrySchema.index({ userId: 1, date: 1 }, { unique: true });

export const WeightEntry = mongoose.model('WeightEntry', weightEntrySchema);
