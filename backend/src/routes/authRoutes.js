import { Router } from 'express';
import { login } from '../services/authService.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const result = login(username, password);

  if (!result) {
    return res.status(401).json({ message: '用户名或密码错误' });
  }

  return res.json(result);
});

export default router;
