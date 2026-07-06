import { buildPrompt } from './prompt.js';
import { parse } from './parser.js';
import { getCardImage, getDeck } from './decks.js';
import { KEEP_HISTORY } from '../../core/moduleState.js';

function esc(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }

export function init() {}
export function destroy() {}
export { buildPrompt, parse };

export function getDefaultState() {
  return { current: { cards: [], interpretation: '' }, history: [] };
}

export function updateState(previousState = getDefaultState(), parsedData = {}, ctx = {}) {
  const current = {
    cards: Array.isArray(parsedData.cards) ? parsedData.cards : [],
    interpretation: parsedData.interpretation || '',
  };
  return {
    current,
    history: [
      ...(Array.isArray(previousState?.history) ? previousState.history : []),
      { messageId: ctx.messageId, ts: Date.now(), ...current },
    ].slice(-KEEP_HISTORY),
  };
}

export function render(data, { lang = 'ru', moduleSettings = {}, currentState = null } = {}) {
  data = currentState?.current || data;
  const deck = getDeck(moduleSettings.deckStyle);
  const title = lang === 'ru' ? '🃏 Таро' : '🃏 Tarot';
  const cards = (data.cards || []).map((name) => `<div class="rpsuite-tarot-card"><img src="${esc(getCardImage(name, moduleSettings.deckStyle))}" alt=""><span>${esc(name)}</span></div>`).join('');
  return `<div class="rpsuite-card rpsuite-tarot ${deck.className}" style="--rpsuite-tarot-accent:${deck.accent}"><div class="rpsuite-card-title">${title}</div><div class="rpsuite-tarot-spread">${cards}</div><div class="rpsuite-tarot-interpretation">${esc(data.interpretation)}</div></div>`;
}