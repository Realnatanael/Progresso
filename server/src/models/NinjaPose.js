import mongoose from 'mongoose';

/** Poses de batalha do personagem geradas por IA (uma linha por pose; `stamp` = versão do avatar de origem). */
const ninjaPoseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    mime: { type: String, default: 'image/png' },
    data: { type: Buffer, required: true },
    stamp: { type: String, required: true },
  },
  { timestamps: true },
);

ninjaPoseSchema.index({ userId: 1, name: 1 }, { unique: true });

export const NinjaPose = mongoose.model('NinjaPose', ninjaPoseSchema);
