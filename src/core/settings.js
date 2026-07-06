import { saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';

export const EXTENSION_NAME = 'sillytavern-rp-suite';

export const DEFAULT_MODULE_SETTINGS = Object.freeze({
  metrics: { enabled: true, lang: 'ru', connectionProfile: '' },
  tarot: { enabled: true, lang: 'ru', connectionProfile: '', deckStyle: 'classic' },
  comments: { enabled: true, lang: 'ru', connectionProfile: '' },
  infoblock: { enabled: true, lang: 'ru', connectionProfile: '' },
  wallet: { enabled: true, lang: 'ru', connectionProfile: '' },
  html_creator: { enabled: true, lang: 'ru', connectionProfile: '' },
});

export const MODULE_MAX_TOKENS = Object.freeze({
  metrics: 1200,
  tarot: 900,
  comments: 3500,
  infoblock: 1500,
  wallet: 1600,
  html_creator: 3500,
});

const clone = (value) => JSON.parse(JSON.stringify(value));

export function getProfilesFromContext() {
  try {
    return window.SillyTavern?.getContext?.().extensionSettings?.connectionManager?.profiles || [];
  } catch (_) {
    return [];
  }
}

export function initSettings() {
  if (!extension_settings[EXTENSION_NAME]) extension_settings[EXTENSION_NAME] = {};
  const settings = extension_settings[EXTENSION_NAME];
  if (!settings.modules) settings.modules = {};

  for (const [id, defaults] of Object.entries(DEFAULT_MODULE_SETTINGS)) {
    settings.modules[id] = { ...clone(defaults), ...(settings.modules[id] || {}) };
    if (!['ru', 'en'].includes(settings.modules[id].lang)) settings.modules[id].lang = defaults.lang;
    if (id === 'tarot' && !['classic', 'alternate'].includes(settings.modules[id].deckStyle)) {
      settings.modules[id].deckStyle = 'classic';
    }
  }

  normalizeConnectionProfiles(settings);
  return settings;
}

export function getSettings() {
  return initSettings();
}

export function getModuleSettings(id) {
  return getSettings().modules[id] || null;
}

export function updateModuleSettings(id, patch = {}) {
  const settings = getSettings();
  settings.modules[id] = { ...(settings.modules[id] || {}), ...patch };
  normalizeConnectionProfiles(settings);
  saveSettingsDebounced();
  return settings.modules[id];
}

export function isModuleEnabled(id) {
  return !!getModuleSettings(id)?.enabled;
}

export function normalizeConnectionProfiles(settings = getSettings()) {
  const profiles = getProfilesFromContext();
  const firstName = profiles[0]?.name || '';
  const names = new Set(profiles.map((p) => p.name));
  for (const moduleSettings of Object.values(settings.modules || {})) {
    if (!moduleSettings.connectionProfile || (profiles.length && !names.has(moduleSettings.connectionProfile))) {
      moduleSettings.connectionProfile = firstName;
    }
  }
  return settings;
}

export function buildModuleContext(moduleId, extra = {}) {
  const moduleSettings = getModuleSettings(moduleId) || {};
  const profile = extra.ApiService?.getConnectionProfile(moduleSettings.connectionProfile) || null;
  return {
    ...extra,
    moduleId,
    settings: getSettings(),
    moduleSettings,
    lang: moduleSettings.lang || 'ru',
    connectionProfile: profile,
    model: profile?.model || '',
  };
}