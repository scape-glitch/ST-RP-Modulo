import { buildPrompt } from './prompt.js';
import { sanitizeMessage } from './sanitizer.js';
import { wireActions } from './actions.js';

let active = false;

export { buildPrompt, sanitizeMessage };

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