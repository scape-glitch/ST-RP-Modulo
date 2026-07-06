import { buildPrompt } from './prompt.js';
import { parse } from './parser.js';
import { localStore, setLocalStore } from '../../core/storage.js';
import { getCurrentChatIdSafe, getModuleState, KEEP_HISTORY } from '../../core/moduleState.js';

const POS_KEY = 'rpsuite_wallet_position';

function esc(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }

export { buildPrompt, parse };

export function init(ctx) {
  ensureWidget(ctx);
  const chatId = getCurrentChatIdSafe(ctx);
  render(getModuleState(chatId, 'wallet')?.current || null, { ...ctx, chatId });
}

export function destroy(ctx) {
  const $ = ctx.$ || window.jQuery;
  $('#rpsuite-wallet-widget').remove();
  $(document).off('.rpsuiteWallet');
}

export function getDefaultState() {
  return {
    current: {
      currency: '',
      balance: 0,
      items: [],
      debts: [],
      notes: '',
    },
    transactions: [],
    history: [],
  };
}

function pickField(previous, parsed, key) {
  return Object.prototype.hasOwnProperty.call(parsed, key) ? parsed[key] : previous[key];
}

function pickCollection(previous, parsed, key) {
  if (!Object.prototype.hasOwnProperty.call(parsed, key)) return previous[key];
  const next = Array.isArray(parsed[key]) ? parsed[key] : [];
  const hadPrevious = Array.isArray(previous[key]) && previous[key].length > 0;
  const hasExplicitTransaction = Array.isArray(parsed.transactions) && parsed.transactions.length > 0;
  return hadPrevious && !next.length && !hasExplicitTransaction ? previous[key] : next;
}

export function updateState(previousState = getDefaultState(), parsedData = {}, ctx = {}) {
  const previous = previousState?.current || getDefaultState().current;
  const current = {
    currency: pickField(previous, parsedData, 'currency'),
    balance: pickField(previous, parsedData, 'balance'),
    items: pickCollection(previous, parsedData, 'items'),
    debts: pickCollection(previous, parsedData, 'debts'),
    notes: pickField(previous, parsedData, 'notes'),
  };
  const newTransactions = Array.isArray(parsedData.transactions) ? parsedData.transactions : (Array.isArray(parsedData.log) ? parsedData.log : []);
  return {
    current,
    transactions: [
      ...(Array.isArray(previousState?.transactions) ? previousState.transactions : []),
      ...newTransactions.map((tx) => (typeof tx === 'string' ? { ts: Date.now(), note: tx } : { ts: Date.now(), ...tx })),
    ].slice(-KEEP_HISTORY),
    history: [
      ...(Array.isArray(previousState?.history) ? previousState.history : []),
      { messageId: ctx.messageId, ts: Date.now(), ...current },
    ].slice(-KEEP_HISTORY),
  };
}

function ensureWidget(ctx) {
  const $ = ctx.$ || window.jQuery;
  let $w = $('#rpsuite-wallet-widget');
  if ($w.length) return $w;
  $w = $('<div id="rpsuite-wallet-widget" class="rpsuite-wallet"></div>').appendTo('body');
  const pos = localStore(POS_KEY, null);
  if (pos) $w.css({ top: pos.top, left: pos.left, right: 'auto', bottom: 'auto' });
  let dragging = false;
  let dx = 0;
  let dy = 0;
  $w.on('mousedown.rpsuiteWallet', '.rpsuite-wallet-head', (e) => {
    dragging = true;
    dx = e.clientX - $w.offset().left;
    dy = e.clientY - $w.offset().top;
    e.preventDefault();
  });
  $(document).on('mousemove.rpsuiteWallet', (e) => {
    if (!dragging) return;
    $w.css({ left: e.clientX - dx, top: e.clientY - dy, right: 'auto', bottom: 'auto' });
  });
  $(document).on('mouseup.rpsuiteWallet', () => {
    if (!dragging) return;
    dragging = false;
    setLocalStore(POS_KEY, { top: $w.css('top'), left: $w.css('left') });
  });
  return $w;
}

export function render(data, ctx) {
  const state = ctx?.currentState?.current || data || null;
  const $w = ensureWidget(ctx);
  const lang = ctx.lang || 'ru';
  if (!state) {
    $w.html(`<div class="rpsuite-wallet-head">💰 ${lang === 'ru' ? 'Кошелек' : 'Wallet'}</div><div class="rpsuite-wallet-empty">${lang === 'ru' ? 'Нет данных' : 'No data'}</div>`);
    return $w;
  }
  const items = (state.items || []).slice(0, 12).map((it) => `<li><b>${esc(it.qty ?? 1)}× ${esc(it.name)}</b>${it.note ? `<span>${esc(it.note)}</span>` : ''}</li>`).join('');
  const debts = (state.debts || []).slice(0, 8).map((debt) => `<li>${esc(typeof debt === 'string' ? debt : `${debt.name || ''} ${debt.amount || ''} ${debt.note || ''}`)}</li>`).join('');
  const notes = state.notes ? `<div class="rpsuite-wallet-log">${esc(state.notes)}</div>` : '';
  const lastTx = ctx?.currentState?.transactions?.length ? ctx.currentState.transactions[ctx.currentState.transactions.length - 1]?.note : '';
  $w.html(`<div class="rpsuite-wallet-head">💰 ${lang === 'ru' ? 'Кошелек' : 'Wallet'}</div><div class="rpsuite-wallet-balance">${esc(state.balance)} ${esc(state.currency)}</div><ul>${items}</ul>${debts ? `<div class="rpsuite-wallet-log"><b>${lang === 'ru' ? 'Долги' : 'Debts'}:</b><ul>${debts}</ul></div>` : ''}${notes}${lastTx ? `<div class="rpsuite-wallet-log">${esc(lastTx)}</div>` : ''}`);
  return $w;
}