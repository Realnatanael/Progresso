import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { WeightEntry } from '../models/WeightEntry.js';
import { isIsoDate, todayISO } from '../lib/dates.js';
import { dayFlagsForUser } from '../lib/ninjaDayFlags.js';
import {
  catalogForUser,
  convertPointsToChakra,
  ensureNinja,
  pickStat,
  publicNinja,
  rollFirstAffinity,
  rollJinchuuriki,
  syncDayAwards,
  tryUnlock,
} from '../lib/ninjaProgress.js';
import { fetchDattebayo } from '../lib/dattebayo.js';
import { generateNinjaAvatarImage } from '../lib/geminiAvatar.js';
import {
  avatarLookFromNinja,
  avatarLookKey,
  avatarLookKeyFromNinja,
} from '../lib/ninjaAvatarLook.js';
import { maybeRefreshNinjaAvatar } from '../lib/ninjaAvatarRefresh.js';
import { ensureClanCrest } from '../lib/ninjaClanCrest.js';
import { chooseDailyMission, ensureDailyMission } from '../lib/dailyMission.js';
import { chooseStoryOption, startStoryBeat } from '../lib/storyEngine.js';

const router = Router();
router.use(requireAuth);

const MAX_PHOTO_BYTES = 2.5 * 1024 * 1024;
const ALLOWED_PHOTO_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

router.get('/', async (req, res, next) => {
  try {
    const date = req.query.date;
    if (date && !isIsoDate(date)) {
      return res.status(400).json({ error: 'Informe a data de hoje.' });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' });

    const n = ensureNinja(user);
    let changes = [];
    if (date) {
      const flags = await dayFlagsForUser(user._id, date);
      const lookBefore = avatarLookKeyFromNinja(n);
      changes = syncDayAwards(n, date, flags);
      try {
        await ensureDailyMission(n, date, { displayName: user.name });
      } catch (error) {
        console.error('Missão diária:', error?.message || error);
      }
      user.markModified('ninja');
      await saveNinjaWithAvatarRefresh(user, lookBefore, changes);
    } else {
      await saveNinjaWithCrest(user);
    }

    res.json(buildPayload(user, changes));
  } catch (error) {
    next(error);
  }
});

router.post('/sync', async (req, res, next) => {
  try {
    const date = req.body?.date || req.query.date;
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Data inválida.' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' });

    const n = ensureNinja(user);
    const flags = await dayFlagsForUser(user._id, date);
    const lookBefore = avatarLookKeyFromNinja(n);
    const changes = syncDayAwards(n, date, flags);
    try {
      await ensureDailyMission(n, date, { displayName: user.name });
    } catch (error) {
      console.error('Missão diária:', error?.message || error);
    }
    user.markModified('ninja');
    await saveNinjaWithAvatarRefresh(user, lookBefore, changes);

    res.json(buildPayload(user, changes, flags));
  } catch (error) {
    next(error);
  }
});

router.post('/story/advance', async (req, res, next) => {
  try {
    const date = isIsoDate(req.body?.date) ? req.body.date : todayISO();
    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' });
    const n = ensureNinja(user);
    const result = await startStoryBeat(n, { displayName: user.name, today: date });
    if (!result.ok) return res.status(400).json({ error: result.error });
    user.markModified('ninja');
    await user.save();
    res.json(buildPayload(user, [{
      type: 'story-advance',
      reused: Boolean(result.reused),
      fromCache: Boolean(result.fromCache),
    }]));
  } catch (error) {
    next(error);
  }
});

router.post('/story/choose', async (req, res, next) => {
  try {
    const choiceId = String(req.body?.choiceId || '').trim();
    if (!choiceId) return res.status(400).json({ error: 'Informe a escolha.' });
    const date = isIsoDate(req.body?.date) ? req.body.date : todayISO();

    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' });
    const n = ensureNinja(user);
    const lookBefore = avatarLookKeyFromNinja(n);
    const result = chooseStoryOption(n, choiceId, { today: date });
    if (result.error) return res.status(400).json({ error: result.error });

    user.markModified('ninja');
    const changes = [{ type: 'story-choose', outcome: result.outcome }];
    await saveNinjaWithAvatarRefresh(user, lookBefore, changes);
    res.json(buildPayload(user, changes));
  } catch (error) {
    next(error);
  }
});

router.post('/daily-mission/choose', async (req, res, next) => {
  try {
    const choiceId = String(req.body?.choiceId || '').trim();
    if (!choiceId) return res.status(400).json({ error: 'Informe a escolha.' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' });
    const n = ensureNinja(user);
    const result = chooseDailyMission(n, choiceId);
    if (result.error) return res.status(400).json({ error: result.error });

    user.markModified('ninja');
    await user.save();
    res.json(buildPayload(user, [{
      type: 'daily-mission',
      success: result.success,
      rewards: result.rewards,
    }]));
  } catch (error) {
    next(error);
  }
});

router.post('/pick-stat', async (req, res, next) => {
  try {
    const date = req.body?.date;
    const stat = req.body?.stat;
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Data inválida.' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' });

    const n = ensureNinja(user);
    // garante que o treino do dia ainda conta
    const flags = await dayFlagsForUser(user._id, date);
    const lookBefore = avatarLookKeyFromNinja(n);
    syncDayAwards(n, date, flags);

    const result = pickStat(n, date, stat);
    if (result.error) return res.status(400).json({ error: result.error });

    user.markModified('ninja');
    const changes = [{ type: 'stat', stat, delta: +1, date }];
    await saveNinjaWithAvatarRefresh(user, lookBefore, changes);
    res.json(buildPayload(user, changes));
  } catch (error) {
    next(error);
  }
});

router.post('/convert-points', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' });

    const n = ensureNinja(user);
    const lookBefore = avatarLookKeyFromNinja(n);
    const result = convertPointsToChakra(n);
    if (result.error) return res.status(400).json({ error: result.error });

    user.markModified('ninja');
    const changes = [{
      type: 'convert-points',
      spent: result.spent,
      gained: result.gained,
    }];
    await saveNinjaWithAvatarRefresh(user, lookBefore, changes);
    res.json(buildPayload(user, changes));
  } catch (error) {
    next(error);
  }
});

router.post('/unlock', async (req, res, next) => {
  try {
    const catalogId = String(req.body?.catalogId || '').trim();
    if (!catalogId) return res.status(400).json({ error: 'Informe o item.' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' });

    const n = ensureNinja(user);
    const lookBefore = avatarLookKeyFromNinja(n);
    const result = tryUnlock(n, catalogId);
    if (result.error) return res.status(400).json({ error: result.error });

    user.markModified('ninja');
    const changes = [{ type: 'unlock', catalogId }];
    await saveNinjaWithAvatarRefresh(user, lookBefore, changes);
    res.json(buildPayload(user, changes));
  } catch (error) {
    next(error);
  }
});

router.post('/affinity-roll', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' });

    const n = ensureNinja(user);
    const lookBefore = avatarLookKeyFromNinja(n);
    const result = rollFirstAffinity(n);
    if (result.error) return res.status(400).json({ error: result.error });

    user.markModified('ninja');
    const changes = [{ type: 'affinity-roll', result: result.result }];
    await saveNinjaWithAvatarRefresh(user, lookBefore, changes);
    res.json(buildPayload(user, changes));
  } catch (error) {
    next(error);
  }
});

router.post('/jinchuuriki-roll', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' });

    const n = ensureNinja(user);
    const lookBefore = avatarLookKeyFromNinja(n);
    const result = rollJinchuuriki(n);
    if (result.error) return res.status(400).json({ error: result.error });

    user.markModified('ninja');
    const changes = [{ type: 'jinchuuriki-roll', jinchuuriki: result.jinchuuriki }];
    await saveNinjaWithAvatarRefresh(user, lookBefore, changes);
    res.json(buildPayload(user, changes));
  } catch (error) {
    next(error);
  }
});

router.patch('/clan', async (req, res, next) => {
  try {
    const clanName = String(req.body?.clanName || '').trim();
    if (clanName.length < 2 || clanName.length > 40) {
      return res.status(400).json({ error: 'O sobrenome/clã precisa ter entre 2 e 40 caracteres.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' });

    const n = ensureNinja(user);
    n.clanName = clanName;
    n.clanNameSyncedFromName = false;
    user.markModified('ninja');
    await user.save();
    res.json(buildPayload(user));
  } catch (error) {
    next(error);
  }
});

router.get('/avatar', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+ninjaAvatarData +ninjaAvatarMime');
    if (!user?.ninjaAvatarData?.length) {
      return res.status(404).json({ error: 'Avatar ainda não gerado.' });
    }
    res.setHeader('Content-Type', user.ninjaAvatarMime || 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(user.ninjaAvatarData);
  } catch (error) {
    next(error);
  }
});

router.get('/crest', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+ninjaCrestData +ninjaCrestMime');
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' });

    ensureNinja(user);
    const crest = await ensureClanCrest(user);
    if (!crest.cached && crest.ensured) {
      await user.save();
    }
    if (!user.ninjaCrestData?.length) {
      return res.status(404).json({ error: 'Brasão ainda não gerado.' });
    }
    res.setHeader('Content-Type', user.ninjaCrestMime || 'image/svg+xml');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(user.ninjaCrestData);
  } catch (error) {
    next(error);
  }
});

router.post('/avatar', async (req, res, next) => {
  try {
    const photoBase64 = String(req.body?.photoBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
    const photoMime = String(req.body?.photoMime || 'image/jpeg').toLowerCase();
    if (!photoBase64 || photoBase64.length < 64) {
      return res.status(400).json({ error: 'Envie uma foto sua.' });
    }
    if (!ALLOWED_PHOTO_MIME.has(photoMime)) {
      return res.status(400).json({ error: 'Use foto JPEG, PNG ou WebP.' });
    }
    const approxBytes = Math.floor((photoBase64.length * 3) / 4);
    if (approxBytes > MAX_PHOTO_BYTES) {
      return res.status(400).json({ error: 'Foto grande demais. Tire outra mais próxima ou comprima.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' });

    const n = ensureNinja(user);
    const recreating = Boolean(n.avatarReady);

    if (!user.age || !user.heightCm || !user.gender) {
      return res.status(400).json({
        error: 'Complete idade, altura e gênero no Perfil antes de gerar o personagem.',
      });
    }

    const latestWeight = await WeightEntry.findOne({ userId: user._id }).sort({ date: -1, createdAt: -1 }).lean();
    const look = avatarLookFromNinja(n);

    const generated = await generateNinjaAvatarImage({
      photoBase64,
      photoMime,
      age: user.age,
      heightCm: user.heightCm,
      weightKg: latestWeight?.kg ?? null,
      gender: user.gender,
      clanName: n.clanName || '',
      displayName: user.name || '',
      rank: look.rank,
      eye: look.eye,
    });

    user.ninjaSelfieData = Buffer.from(photoBase64, 'base64');
    user.ninjaSelfieMime = photoMime;
    user.ninjaAvatarData = generated.buffer;
    user.ninjaAvatarMime = generated.mime;
    n.avatarReady = true;
    n.avatarUpdatedAt = new Date();
    n.avatarLookKey = avatarLookKey(look);
    user.markModified('ninja');
    try {
      await ensureClanCrest(user);
    } catch (crestError) {
      console.error('Brasão após avatar:', crestError?.message || crestError);
    }
    await user.save();

    res.json(buildPayload(user, [{ type: recreating ? 'avatar-refresh' : 'avatar' }]));
  } catch (error) {
    if (error.publicMessage) {
      return res.status(error.status || 500).json({ error: error.publicMessage });
    }
    next(error);
  }
});

router.get('/lore/:collection', async (req, res, next) => {
  try {
    const data = await fetchDattebayo(req.params.collection, '');
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/lore/:collection/:id', async (req, res, next) => {
  try {
    const data = await fetchDattebayo(req.params.collection, req.params.id);
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
});

function buildPayload(user, changes = [], flags = null) {
  const n = ensureNinja(user);
  return {
    ninja: publicNinja(user),
    catalog: catalogForUser(n),
    changes,
    flags,
  };
}

async function saveNinjaWithAvatarRefresh(user, lookBefore, changes) {
  const lookAfter = avatarLookKeyFromNinja(ensureNinja(user));
  if (lookBefore !== lookAfter) {
    try {
      const refresh = await maybeRefreshNinjaAvatar(user, { force: true });
      if (refresh.refreshed) {
        changes.push({ type: 'avatar-refresh', lookKey: refresh.lookKey });
      }
    } catch (error) {
      console.error('Falha ao regenerar avatar ninja:', error?.publicMessage || error?.message || error);
      changes.push({ type: 'avatar-refresh-failed' });
    }
  }
  try {
    const crest = await ensureClanCrest(user);
    if (crest.ensured && !crest.cached) {
      changes.push({ type: 'clan-crest' });
    }
  } catch (error) {
    console.error('Falha ao gerar brasão do clã:', error?.message || error);
    changes.push({ type: 'clan-crest-failed' });
  }
  await user.save();
}

async function saveNinjaWithCrest(user) {
  try {
    const crest = await ensureClanCrest(user);
    if (crest.ensured && !crest.cached) {
      await user.save();
    }
  } catch (error) {
    console.error('Falha ao gerar brasão do clã:', error?.message || error);
  }
}

export default router;
