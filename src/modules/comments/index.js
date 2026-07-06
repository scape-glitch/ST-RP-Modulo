import { buildPrompt } from './prompt.js';
import { parse } from './parser.js';

function esc(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }

export function init() {}
export function destroy() {}
export { buildPrompt, parse };

export function render(comments, { lang = 'ru' }) {
  if (!comments?.length) return '';
  const title = lang === 'ru' ? '💬 Комментарии' : '💬 Comments';
  return `<div class="rpsuite-card rpsuite-comments"><div class="rpsuite-card-title">${title}</div>${comments.map((c) => `<article class="rpsuite-comments-item"><div class="rpsuite-comments-avatar">${esc(c.avatar_emoji)}</div><div class="rpsuite-comments-body"><div><b>${esc(c.display_name)}</b>${c.verified ? ' <span class="rpsuite-comments-verified">✓</span>' : ''} <span>@${esc(c.username)} · ${esc(c.time)}</span></div><p>${esc(c.comment)}</p><footer>♡ ${esc(c.likes)} · ↻ ${esc(c.retweets)} · 💬 ${esc(c.replies)}</footer></div></article>`).join('')}</div>`;
}