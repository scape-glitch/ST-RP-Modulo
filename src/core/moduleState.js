import { localStore, setLocalStore } from './storage.js';

export const SUITE_STATE_KEY = 'rpsuite_state_v1';
export const KEEP_HISTORY = 30;
export const KEEP_COMMENT_SECTIONS = 20;
export const KEEP_HTML_HISTORY = 20;
export const RAW_LIMIT = 20000;

const MODULE_DEFAULTS = Object.freeze({
  metrics: { current: {}, byMessage: {}, history: [] },
  tarot: { current: {}, byMessage: {}, history: [] },
  comments: { author: null, sections: {}, recentAuthorReplies: [] },
  infoblock: { current: {}, byMessage: {}, history: [] },
  wallet: { current: {}, byMessage: {}, transactions: [], history: [], ui: { position: {}, collapsed: true, userToggled: false } },
  html_creator: { byMessage: {}, history: [] },
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

function hashString(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function getVisibleMessageText($mes) {
  try {
    const $ = window.jQuery;
    const $text = $mes.find?.('.mes_text').first();
    const $source = ($text?.length ? $text : $mes).clone();
    $source.find('.rpsuite-message-blocks, .rpsuite-html-creator-generated, .rpsuite-hidden-source').remove();
    return $source.text().replace(/\s+/g, ' ').trim();
  } catch (_) {
    return '';
  }
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

export function getMessageRenderKey($mes, ctx = {}) {
  const chatId = getCurrentChatIdSafe(ctx);
  const mesId = sanitizeId($mes?.attr?.('mesid') || $mes?.data?.('mesid') || $mes?.attr?.('id') || $mes?.index?.() || 'message');
  const text = ctx.messageText || getVisibleMessageText($mes);
  let swipe = $mes?.attr?.('swipe_id') ?? $mes?.data?.('swipe_id') ?? $mes?.data?.('swipeId') ?? null;
  try {
    const st = getContext(ctx);
    const message = Array.isArray(st.chat) ? st.chat[Number(mesId)] : null;
    swipe = message?.swipe_id ?? message?.swipeId ?? message?.swipeIndex ?? swipe;
  } catch (_) {}
  const hash = hashString(text).slice(0, 12);
  return `${chatId}:${mesId}:${swipe ?? 'no-swipe'}:${hash}`;
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

function trimByMessage(byMessage = {}, limit = KEEP_HISTORY) {
  if (!isPlainObject(byMessage)) return {};
  const entries = Object.entries(byMessage)
    .map(([key, entry]) => [key, isPlainObject(entry) ? entry : {}])
    .sort((a, b) => Number(a[1]?.ts || 0) - Number(b[1]?.ts || 0))
    .slice(-limit);
  return Object.fromEntries(entries);
}

function limitRawFields(entry = {}) {
  if (!isPlainObject(entry)) return entry;
  const next = { ...entry };
  for (const key of ['raw', 'rawHtml', 'sanitizedHtml']) {
    if (typeof next[key] === 'string' && next[key].length > RAW_LIMIT) next[key] = next[key].slice(0, RAW_LIMIT);
  }
  return next;
}

function normalizeModuleState(moduleId, state) {
  const next = { ...getDefaultModuleState(moduleId), ...(isPlainObject(state) ? clone(state) : {}) };
  if (Array.isArray(next.history)) next.history = trimArray(next.history, moduleId === 'html_creator' ? KEEP_COMMENT_SECTIONS : KEEP_HISTORY);
  if (isPlainObject(next.byMessage)) {
    next.byMessage = Object.fromEntries(Object.entries(trimByMessage(next.byMessage, moduleId === 'html_creator' ? KEEP_HTML_HISTORY : KEEP_HISTORY)).map(([key, entry]) => [key, limitRawFields(entry)]));
  }
  if (moduleId === 'comments') {
    next.author = next.author || null;
    next.sections = trimCommentSections(next.sections);
    next.recentAuthorReplies = trimArray(next.recentAuthorReplies, KEEP_HISTORY);
  }
  if (moduleId === 'wallet') {
    next.transactions = trimArray(next.transactions, KEEP_HISTORY);
    if (!isPlainObject(next.ui)) next.ui = { position: {}, collapsed: true, userToggled: false };
    // Migration: legacy auto-open state without a user interaction marker must not
    // keep force-opening the wallet. Only trust collapsed:false if the user set it.
    if (next.ui.userToggled !== true && next.ui.collapsed === false) next.ui.collapsed = true;
    if (typeof next.ui.userToggled !== 'boolean') next.ui.userToggled = false;
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

export function getModuleMessageData(chatId, moduleId, messageKey) {
  const state = getModuleState(chatId, moduleId) || getDefaultModuleState(moduleId);
  if (moduleId === 'comments') return clone(state.sections?.[messageKey] || null);
  return clone(state.byMessage?.[messageKey] || null);
}

export function setModuleMessageData(chatId, moduleId, messageKey, data) {
  return updateModuleState(chatId, moduleId, (previous) => {
    if (moduleId === 'comments') {
      previous.sections = trimCommentSections({ ...(previous.sections || {}), [messageKey]: { ...(data || {}), ts: data?.ts || Date.now() } });
    } else {
      previous.byMessage = trimByMessage({ ...(previous.byMessage || {}), [messageKey]: limitRawFields({ ...(data || {}), ts: data?.ts || Date.now() }) }, moduleId === 'html_creator' ? KEEP_HTML_HISTORY : KEEP_HISTORY);
    }
    return previous;
  });
}

export function clearModuleMessageData(chatId, moduleId, messageKey) {
  return updateModuleState(chatId, moduleId, (previous) => {
    if (moduleId === 'comments') delete previous.sections?.[messageKey];
    else delete previous.byMessage?.[messageKey];
    return previous;
  });
}

export function pruneState() {
  return saveSuiteState(getSuiteState());
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