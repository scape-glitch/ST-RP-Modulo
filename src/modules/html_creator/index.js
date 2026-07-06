import { buildPrompt } from './prompt.js';
import { sanitizeMessage } from './sanitizer.js';
import { wireActions } from './actions.js';
import { KEEP_HISTORY } from '../../core/moduleState.js';

let active = false;

export { buildPrompt, sanitizeMessage };

export function parse(messageText) {
  const raw = String(messageText || '').match(/<rs_art\b[^>]*>[\s\S]*?<\/rs_art>/i)?.[0] || '';
  return raw ? { raw } : null;
}

export function getDefaultState() {
  return { history: [] };
}

export function updateState(previousState = getDefaultState(), parsedData = {}, ctx = {}) {
  const raw = parsedData?.raw || parsedData?.html || '';
  if (!raw) return previousState || getDefaultState();
  return {
    history: [
      ...(Array.isArray(previousState?.history) ? previousState.history : []),
      { messageId: ctx.messageId, ts: Date.now(), raw },
    ].slice(-KEEP_HISTORY),
  };
}

export function init(ctx) {
  active = true;
  wireAll(ctx);
}

export function destroy() {
  active = false;
}

function markRsArt($text) {
  $text.find('rs_art').each(function () { this.classList.add('rpsuite-html-creator'); });
}

export function wireMessage($mes, ctx = {}) {
  if (!active) return;
  const $ = ctx.$ || window.jQuery;
  const $text = $mes.find?.('.mes_text').length ? $mes.find('.mes_text') : $($mes);
  sanitizeMessage($text);
  markRsArt($text);
  wireActions($text);
}

export function wireMessageById(messageId, ctx = {}) {
  const $ = ctx.$ || window.jQuery;
  const $mes = $(`.mes[mesid="${messageId}"], .mes#${messageId}`).first();
  if ($mes.length) wireMessage($mes, ctx);
}

export function wireAll(ctx = {}) {
  if (!active) return;
  const $ = ctx.$ || window.jQuery;
  $('.mes').each((_, mes) => wireMessage($(mes), ctx));
}