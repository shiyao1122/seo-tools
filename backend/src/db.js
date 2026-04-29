import fs from 'fs';
import path from 'path';
import { config } from './config.js';

const defaultState = {
  users: [],
  settings: {
    serviceAccountJson: '',
    siteUrl: '',
    geminiApiKey: '',
    queryDelayMs: 300,
    submitDelayMs: 200
  },
  tasks: []
};

function ensureDbFile() {
  const dir = path.dirname(config.dataFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(config.dataFile)) {
    fs.writeFileSync(config.dataFile, JSON.stringify(defaultState, null, 2), 'utf-8');
  }
}

export function readDb() {
  ensureDbFile();
  const raw = fs.readFileSync(config.dataFile, 'utf-8');
  const parsed = JSON.parse(raw || '{}');
  return {
    ...defaultState,
    ...parsed,
    settings: {
      ...defaultState.settings,
      ...(parsed.settings || {})
    },
    users: Array.isArray(parsed.users) ? parsed.users : [],
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : []
  };
}

export function writeDb(nextState) {
  ensureDbFile();
  fs.writeFileSync(config.dataFile, JSON.stringify(nextState, null, 2), 'utf-8');
}

export function updateDb(updater) {
  const current = readDb();
  const next = updater(current);
  writeDb(next);
  return next;
}
