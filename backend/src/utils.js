import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function fileNameWithoutExt(fileName) {
  return path.parse(fileName).name;
}

export function formatBeijingTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date).reduce((result, part) => {
    if (part.type !== 'literal') {
      result[part.type] = part.value;
    }
    return result;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
