import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || '';
  const [, token] = authorization.split(' ');

  if (!token) {
    return res.status(401).json({ message: '未登录或登录已失效' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: '未登录或登录已失效' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: '未登录或登录已失效' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '无权访问该资源' });
  }

  next();
}
