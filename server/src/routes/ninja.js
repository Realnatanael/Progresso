import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { isIsoDate } from '../lib/dates.js';
import { dayFlagsForUser } from '../lib/ninjaDayFlags.js';
import {
  catalogForUser,
  ensureNinja,
  pickStat,
  publicNinja,
  syncDayAwards,
  tryUnlock,
} from '../lib/ninjaProgress.js';
import { fetchDattebayo } from '../lib/dattebayo.js';

const router = Router();
router.use(requireAuth);

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
      changes = syncDayAwards(n, date, flags);
      user.markModified('ninja');
      await user.save();
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
    const changes = syncDayAwards(n, date, flags);
    user.markModified('ninja');
    await user.save();

    res.json(buildPayload(user, changes, flags));
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
    syncDayAwards(n, date, flags);

    const result = pickStat(n, date, stat);
    if (result.error) return res.status(400).json({ error: result.error });

    user.markModified('ninja');
    await user.save();
    res.json(buildPayload(user, [{ type: 'stat', stat, delta: +1, date }]));
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
    const result = tryUnlock(n, catalogId);
    if (result.error) return res.status(400).json({ error: result.error });

    user.markModified('ninja');
    await user.save();
    res.json(buildPayload(user, [{ type: 'unlock', catalogId }]));
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

export default router;
