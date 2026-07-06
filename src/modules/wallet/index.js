import { buildPrompt } from './prompt.js';
import { parse } from './parser.js';
import { localStore, setLocalStore } from '../../core/storage.js';

const STORE_KEY = 'rpsuite_wallet_state';
const POS_KEY = 'rpsuite_wallet_position';

function esc(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }

export { buildPrompt, parse };

export function init(ctx) {
  ensureWidget(ctx);
  render(localStore(STORE_KEY, null), ctx);
}

export function destroy(ctx) {
  const $ = ctx.$ || window.jQuery;
  $('#rpsuite-wallet-widget').remove();
  $(document).off('.rpsuiteWallet');
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
  if (data) setLocalStore(STORE_KEY, data);
  const state = data || localStore(STORE_KEY, null);
  const $w = ensureWidget(ctx);
  const lang = ctx.lang || 'ru';
  if (!state) {
    $w.html(`<div class="rpsuite-wallet-head">💰 ${lang === 'ru' ? 'Кошелек' : 'Wallet'}</div><div class="rpsuite-wallet-empty">${lang === 'ru' ? 'Нет данных' : 'No data'}</div>`);
    return $w;
  }
  const items = (state.items || []).slice(0, 12).map((it) => `<li><b>${esc(it.qty ?? 1)}× ${esc(it.name)}</b>${it.note ? `<span>${esc(it.note)}</span>` : ''}</li>`).join('');
  $w.html(`<div class="rpsuite-wallet-head">💰 ${lang === 'ru' ? 'Кошелек' : 'Wallet'}</div><div class="rpsuite-wallet-balance">${esc(state.balance)} ${esc(state.currency)}</div><ul>${items}</ul>${state.log?.length ? `<div class="rpsuite-wallet-log">${esc(state.log[state.log.length - 1])}</div>` : ''}`);
  return $w;
}