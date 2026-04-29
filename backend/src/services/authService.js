import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { readDb, updateDb } from '../db.js';
import { formatBeijingTime } from '../utils.js';

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  if (!passwordHash || !passwordHash.includes(':')) {
    return false;
  }

  const [salt, storedHash] = passwordHash.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

function toSafeUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt
  };
}

function createAuthToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

function findUserByUsername(username) {
  return readDb().users.find((user) => user.username === username) || null;
}

export function ensureAdminUser() {
  const existingAdmin = readDb().users.find((user) => user.username === config.adminUsername);
  if (existingAdmin) {
    return existingAdmin;
  }

  const adminUser = {
    id: `user_admin_${Date.now()}`,
    username: config.adminUsername,
    role: 'admin',
    passwordHash: createPasswordHash(config.adminPassword),
    createdAt: formatBeijingTime()
  };

  updateDb((db) => ({
    ...db,
    users: [adminUser, ...db.users]
  }));

  return adminUser;
}

export function login(username, password) {
  ensureAdminUser();

  const user = findUserByUsername(String(username || '').trim());
  if (!user || !verifyPassword(String(password || ''), user.passwordHash)) {
    return null;
  }

  return {
    token: createAuthToken(user),
    user: toSafeUser(user)
  };
}

export function listUsers() {
  ensureAdminUser();
  return readDb().users.map(toSafeUser);
}

export function createUser(payload) {
  ensureAdminUser();

  const username = String(payload.username || '').trim();
  const password = String(payload.password || '');
  const role = payload.role === 'admin' ? 'admin' : 'user';

  if (!username) {
    throw new Error('用户名不能为空');
  }

  if (password.length < 6) {
    throw new Error('密码至少 6 位');
  }

  if (findUserByUsername(username)) {
    throw new Error('用户名已存在');
  }

  const user = {
    id: `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    username,
    role,
    passwordHash: createPasswordHash(password),
    createdAt: formatBeijingTime()
  };

  updateDb((db) => ({
    ...db,
    users: [user, ...db.users]
  }));

  return toSafeUser(user);
}

export function deleteUser(userId, currentUser) {
  ensureAdminUser();

  const db = readDb();
  const user = db.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error('用户不存在');
  }

  if (user.username === config.adminUsername) {
    throw new Error('默认管理员不允许删除');
  }

  if (currentUser?.id === userId) {
    throw new Error('不能删除当前登录用户');
  }

  updateDb((current) => ({
    ...current,
    users: current.users.filter((item) => item.id !== userId)
  }));

  return { success: true };
}
