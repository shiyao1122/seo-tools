import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { getSettings, saveSettings } from '../services/settingsService.js';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/', (req, res) => {
  res.json(getSettings());
});

router.post('/', (req, res) => {
  const settings = saveSettings(req.body || {});
  res.json(settings);
});

export default router;
