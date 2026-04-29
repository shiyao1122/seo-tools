import { readDb, updateDb } from '../db.js';

export function getSettings() {
  const settings = readDb().settings;
  return {
    ...settings,
    geminiApiKey: settings.geminiApiKey || ''
  };
}

export function saveSettings(payload) {
  const nextSettings = {
    serviceAccountJson: payload.serviceAccountJson || '',
    siteUrl: payload.siteUrl || '',
    geminiApiKey: payload.geminiApiKey || '',
    queryDelayMs: Number(payload.queryDelayMs || 300),
    submitDelayMs: Number(payload.submitDelayMs || 200)
  };

  updateDb((db) => ({
    ...db,
    settings: nextSettings
  }));

  return nextSettings;
}
