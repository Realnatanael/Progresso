/**
 * Poses de batalha do personagem (attack, cast, guard, hurt, win), geradas em segundo plano.
 * Sem chave Gemini ou com falha, o cliente continua com o avatar base animado por CSS.
 */
import { User } from '../models/User.js';
import { NinjaPose } from '../models/NinjaPose.js';
import { POSE_NAMES, generatePoseImage } from './geminiPose.js';

const running = new Set();
/** Evita martelar a API depois de uma falha (por usuário). */
const lastFailure = new Map();
const RETRY_AFTER_MS = 10 * 60 * 1000;

export function poseStampOf(user) {
  const at = user?.ninja?.avatarUpdatedAt;
  return at ? new Date(at).toISOString() : null;
}

export function posesCanGenerate() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function isGeneratingPoses(userId) {
  return running.has(String(userId));
}

export async function poseStatus(user) {
  const stamp = poseStampOf(user);
  const rows = stamp
    ? await NinjaPose.find({ userId: user._id, stamp }).select('name').lean()
    : [];
  return {
    ready: POSE_NAMES.filter((name) => rows.some((row) => row.name === name)),
    total: POSE_NAMES.length,
    stamp,
    pending: isGeneratingPoses(user._id),
    canGenerate: posesCanGenerate(),
  };
}

/** Dispara a geração das poses que faltam (não bloqueia a resposta HTTP). */
export async function ensurePosesInBackground(user) {
  if (!posesCanGenerate()) return { started: false, reason: 'no-key' };
  if (!user?.ninja?.avatarReady) return { started: false, reason: 'no-avatar' };

  const id = String(user._id);
  if (running.has(id)) return { started: false, reason: 'running' };
  const failedAt = lastFailure.get(id);
  if (failedAt && Date.now() - failedAt < RETRY_AFTER_MS) return { started: false, reason: 'cooldown' };

  const stamp = poseStampOf(user);
  if (!stamp) return { started: false, reason: 'no-avatar' };
  const have = await NinjaPose.find({ userId: user._id, stamp }).select('name').lean();
  const missing = POSE_NAMES.filter((name) => !have.some((row) => row.name === name));
  if (!missing.length) return { started: false, reason: 'ready' };

  running.add(id);
  (async () => {
    try {
      const holder = await User.findById(user._id).select('+ninjaAvatarData');
      const avatar = holder?.ninjaAvatarData;
      if (!avatar?.length) return;
      for (const name of missing) {
        try {
          const image = await generatePoseImage({ avatarBuffer: avatar, pose: name });
          await NinjaPose.findOneAndUpdate(
            { userId: user._id, name },
            { $set: { mime: image.mime, data: image.buffer, stamp } },
            { upsert: true, returnDocument: 'after' },
          );
        } catch (error) {
          lastFailure.set(id, Date.now());
          console.error(`Pose ${name} falhou:`, error?.message || error);
          break;
        }
      }
    } catch (error) {
      console.error('Poses:', error?.message || error);
    } finally {
      running.delete(id);
    }
  })();

  return { started: true, missing };
}
