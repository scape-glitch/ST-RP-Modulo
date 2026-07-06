import { localStore, setLocalStore } from './storage.js';

export const SUITE_STATE_KEY = 'rpsuite_state_v1';
export const KEEP_HISTORY = 30;
export const KEEP_COMMENT_SECTIONS = 20;

const MODULE_DEFAULTS = Object.freeze({
  metrics: { current: {}, history: [] },
  tarot: { current: {}, history: [] },
  comments: { author: null, sections: {}, recentAuthorReplies: [] },
  infoblock: { current: {}, history: [] },
  wallet: { current: {}, transactions: [], history: [] },
  html_creator: { history: [] },
});

function clone(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    if (Array.isArray(value)) return [...value];
    if (value && typeof value === 'object') return { ...value };
    return value;
  }
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeId(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.replace(/\s+/g, '_').slice(0, 180);
}

function getContext(ctx = {}) {
  try {
    return ctx.stContext || window.SillyTavern?.getContext?.() || {};
  } catch (_) {
    return ctx.stContext || {};
  }
}

export function getCurrentChatIdSafe(ctx = {}) {
  const st = getContext(ctx);
  const direct = st.chatId
    || st.chat_id
    || st.currentChatId
    || st.chat_metadata?.chatId
    || st.chat_metadata?.chat_id
    || st.chat_metadata?.file_name
    || st.chat_metadata?.name;
  if (sanitizeId(direct)) return sanitizeId(direct);

  const character = st.characterId ?? st.this_chid ?? st.name2 ?? st.characterName ?? 'character';
  const chatName = st.chat_metadata?.name ?? st.chat?.name ?? st.chat?.[0]?.chat ?? st.chat?.[0]?.name ?? 'chat';
  const fallback = sanitizeId(`${character}:${chatName}`);
  return fallback || 'default_chat';
}

function createSuiteState() {
  return { version: 1, chats: {} };
}

function getDefaultModuleState(moduleId) {
  return clone(MODULE_DEFAULTS[moduleId] || { current: {}, history: [] });
}

function trimArray(value, limit = KEEP_HISTORY) {
  return Array.isArray(value) ? value.slice(-Math.max(0, limit)) : [];
}

function trimCommentSections(sections = {}) {
  if (!isPlainObject(sections)) return {};
  const entries = Object.entries(sections)
    .map(([id, section]) => [id, isPlainObject(section) ? section : {}])
    .sort((a, b) => Number(a[1]?.ts || 0) - Number(b[1]?.ts || 0))
    .slice(-KEEP_COMMENT_SECTIONS);
  return Object.fromEntries(entries);
}

function normalizeModuleState(moduleId, state) {
  const next = { ...getDefaultModuleState(moduleId), ...(isPlainObject(state) ? clone(state) : {}) };
  if (Array.isArray(next.history)) next.history = trimArray(next.history, moduleId === 'html_creator' ? KEEP_COMMENT_SECTIONS : KEEP_HISTORY);
  if (moduleId === 'comments') {
    next.author = next.author || null;
    next.sections = trimCommentSections(next.sections);
    next.recentAuthorReplies = trimArray(next.recentAuthorReplies, KEEP_HISTORY);
  }
  if (moduleId === 'wallet') {
    next.transactions = trimArray(next.transactions, KEEP_HISTORY);
  }
  return next;
}

function normalizeSuiteState(state) {
  const normalized = createSuiteState();
  if (!isPlainObject(state)) return normalized;
  normalized.version = 1;
  const chats = isPlainObject(state.chats) ? state.chats : {};
  for (const [chatId, chatState] of Object.entries(chats)) {
    if (!sanitizeId(chatId) || !isPlainObject(chatState)) continue;
    const modules = isPlainObject(chatState.modules) ? chatState.modules : {};
    normalized.chats[chatId] = { modules: {} };
    for (const [moduleId, moduleState] of Object.entries(modules)) {
      normalized.chats[chatId].modules[moduleId] = normalizeModuleState(moduleId, moduleState);
    }
  }
  return normalized;
}

export function getSuiteState() {
  return normalizeSuiteState(localStore(SUITE_STATE_KEY, createSuiteState()));
}

export function saveSuiteState(state) {
  return setLocalStore(SUITE_STATE_KEY, normalizeSuiteState(state));
}

export function getChatState(chatId) {
  const id = sanitizeId(chatId) || 'default_chat';
  const state = getSuiteState();
  return clone(state.chats[id] || { modules: {} });
}

export function getModuleState(chatId, moduleId) {
  const id = sanitizeId(chatId) || 'default_chat';
  const state = getSuiteState();
  return clone(state.chats[id]?.modules?.[moduleId] || null);
}

export function setModuleState(chatId, moduleId, nextState) {
  const id = sanitizeId(chatId) || 'default_chat';
  const state = getSuiteState();
  if (!state.chats[id]) state.chats[id] = { modules: {} };
  if (!state.chats[id].modules) state.chats[id].modules = {};
  state.chats[id].modules[moduleId] = normalizeModuleState(moduleId, nextState);
  return saveSuiteState(state);
}

export function updateModuleState(chatId, moduleId, updater) {
  const previous = getModuleState(chatId, moduleId) || getDefaultModuleState(moduleId);
  const next = typeof updater === 'function' ? updater(clone(previous)) : updater;
  setModuleState(chatId, moduleId, next);
  return getModuleState(chatId, moduleId);
}

export function appendModuleHistory(chatId, moduleId, entry, limit = KEEP_HISTORY) {
  return updateModuleState(chatId, moduleId, (previous) => {
    const next = { ...previous };
    next.history = trimArray([...(Array.isArray(previous.history) ? previous.history : []), entry], limit);
    return next;
  });
}

export function clearChatModuleState(chatId, moduleId) {
  const id = sanitizeId(chatId) || 'default_chat';
  const state = getSuiteState();
  if (state.chats[id]?.modules) delete state.chats[id].modules[moduleId];
  return saveSuiteState(state);
}

export function clearChatState(chatId) {
  const id = sanitizeId(chatId) || 'default_chat';
  const state = getSuiteState();
  delete state.chats[id];
  return saveSuiteState(state);
}

export function trimCommentSectionsForSave(sections = {}) {
  return trimCommentSections(sections);
}