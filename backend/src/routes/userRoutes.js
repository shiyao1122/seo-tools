import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { createUser, deleteUser, listUsers } from '../services/authService.js';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/', (req, res) => {
  res.json(listUsers());
});

router.post('/', (req, res, next) => {
  try {
    res.json(createUser(req.body || {}));
  } catch (error) {
    next(error);
  }
});

router.delete('/:userId', (req, res, next) => {
  try {
    res.json(deleteUser(req.params.userId, req.user));
  } catch (error) {
    next(error);
  }
});

export default router;
