import { generateClanCrestImage, fallbackCrest, clanCrestKey } from './geminiClanCrest.js';
import { ensureNinja } from './ninjaProgress.js';

/**
 * Garante brasão do clã em cache. Regenera se o sobrenome/clã mudou.
 * Usa SVG imediato; se houver Gemini, tenta upgrade em background.
 */
export async function ensureClanCrest(user) {
  const n = ensureNinja(user);
  const clan = String(n.clanName || '').trim();
  if (!clan) {
    return { ensured: false, reason: 'no-clan' };
  }

  const key = clanCrestKey(clan);
  let hasData = Boolean(user.ninjaCrestData?.length);

  if (!hasData && n.crestClanKey === key) {
    const { User } = await import('../models/User.js');
    const withCrest = await User.findById(user._id).select('+ninjaCrestData +ninjaCrestMime');
    if (withCrest?.ninjaCrestData?.length) {
      user.ninjaCrestData = withCrest.ninjaCrestData;
      user.ninjaCrestMime = withCrest.ninjaCrestMime;
      hasData = true;
    }
  }

  if (n.crestClanKey === key && hasData) {
    return { ensured: true, cached: true };
  }

  const generated = fallbackCrest(clan);
  applyCrest(user, n, key, generated);

  if (process.env.GEMINI_API_KEY) {
    scheduleCrestUpgrade(user._id.toString(), clan, key);
  }

  return { ensured: true, cached: false };
}

function applyCrest(user, n, key, generated) {
  const now = new Date();
  user.ninjaCrestData = generated.buffer;
  user.ninjaCrestMime = generated.mime;
  user.ninjaCrestUpdatedAt = now;
  n.crestClanKey = key;
  n.crestUpdatedAt = now;
  user.markModified('ninja');
}

const upgrading = new Set();

function scheduleCrestUpgrade(userId, clanName, key) {
  const jobKey = `${userId}:${key}`;
  if (upgrading.has(jobKey)) return;
  upgrading.add(jobKey);

  setImmediate(() => {
    upgradeClanCrest(userId, clanName, key)
      .catch((error) => {
        console.error('Upgrade brasão IA:', error?.message || error);
      })
      .finally(() => {
        upgrading.delete(jobKey);
      });
  });
}

async function upgradeClanCrest(userId, clanName, key) {
  const generated = await generateClanCrestImage({ clanName });
  // Se caiu no fallback de novo, não sobrescreve
  if (generated.mime === 'image/svg+xml') return;

  const { User } = await import('../models/User.js');
  const user = await User.findById(userId).select('+ninjaCrestData +ninjaCrestMime');
  if (!user) return;
  const n = ensureNinja(user);
  if (n.crestClanKey !== key) return;

  applyCrest(user, n, key, generated);
  await user.save();
}
