import { buildPrompt } from './prompt.js';
import { parse } from './parser.js';
import {
  getCurrentChatIdSafe,
  getModuleState,
  setModuleState,
  trimCommentSectionsForSave,
} from '../../core/moduleState.js';

function esc(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }
function clone(value) { try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; } }
const PFX = 'soc-tw';
const REPLY_LIMIT = 280;
const AVATAR_PALETTE = ['👑','⭐','🔥','💎','🌙','🦋','😎','🖤','🌟','👁️','🎭','🩸'];
const ICONS_SVG = {
  comment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="${PFX}-icon"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`,
  retweet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="${PFX}-icon"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="${PFX}-icon"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="${PFX}-icon"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>`,
  verified: `<svg viewBox="0 0 24 24" fill="#1d9bf0" class="${PFX}-verified-icon"><path d="M22.5 12l-2.4 2.7.3 3.6-3.6.8-1.9 3-3.1-1.5-3.1 1.5-1.9-3-3.6-.8.3-3.6L1 12l2.4-2.7-.3-3.6 3.6-.8 1.9-3 3.1 1.5 3.1-1.5 1.9 3 3.6.8-.3 3.6L22.5 12z"/><path d="M10.5 15.5L7.5 12.5l1.4-1.4 1.6 1.6 4.6-4.6 1.4 1.4z" fill="#fff"/></svg>`,
  xtwitter: `<svg viewBox="0 0 24 24" fill="currentColor" class="${PFX}-x-logo"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-7.4L6.4 22H3.3l7.3-8.4L2.8 2h6.4l4.4 6.8L18.9 2zm-1.1 17.9h1.7L8.3 4H6.4l11.4 15.9z"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="${PFX}-chevron-icon"><polyline points="6 9 12 15 18 9"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="${PFX}-icon"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1A1.7 1.7 0 0 0 10 3.2V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1z"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="${PFX}-icon"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
};

function defaultAuthor() {
  return { name: '', emoji: '\u{1F451}' };
}

export function getDefaultState() {
  return {
    author: null,
    sections: {},
    recentAuthorReplies: [],
  };
}

function normalizeComment(comment, index, section = {}) {
  const baseId = comment.id || `${comment.username || 'user'}-${index}`;
  const id = String(baseId).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80) || `comment-${index}`;
  const previousLikes = section.likes?.[id];
  const previousReplies = Array.isArray(section.replies) ? section.replies.filter((r) => r.commentId === id) : [];
  return {
    ...comment,
    id,
    likes: Number(previousLikes ?? comment.likes ?? 0),
    replies: Number(comment.replies || 0) + previousReplies.length,
  };
}

export function updateState(previousState = getDefaultState(), parsedData = [], ctx = {}) {
  const messageId = String(ctx.messageId || Date.now());
  const previous = previousState || getDefaultState();
  const oldSection = previous.sections?.[messageId] || {};
  const generatedComments = (Array.isArray(parsedData) ? parsedData : [])
    .map((comment, index) => normalizeComment(comment, index, oldSection));
  const section = {
    likes: { ...(oldSection.likes || {}) },
    replies: Array.isArray(oldSection.replies) ? oldSection.replies : [],
    generatedComments,
    ts: oldSection.ts || Date.now(),
    prompted: true,
  };
  for (const comment of generatedComments) {
    if (section.likes[comment.id] === undefined) section.likes[comment.id] = Number(comment.likes || 0);
  }
  return {
    author: previous.author || defaultAuthor(),
    sections: trimCommentSectionsForSave({ ...(previous.sections || {}), [messageId]: section }),
    recentAuthorReplies: Array.isArray(previous.recentAuthorReplies) ? previous.recentAuthorReplies.slice(-30) : [],
  };
}

function getSectionForRender(data, ctx = {}) {
  const messageId = String(ctx.messageId || '');
  const state = ctx.currentState || ctx.moduleState || null;
  const section = state?.sections?.[messageId];
  if (section) return section;
  return {
    likes: {},
    replies: [],
    generatedComments: Array.isArray(data) ? data.map((comment, index) => normalizeComment(comment, index)) : [],
    ts: Date.now(),
  };
}

function getLabels(lang) {
  return lang === 'ru'
    ? { title: '💬 Комментарии', like: 'Нравится', authorReply: 'Ответ автора', placeholder: 'Ваш ответ...', send: 'Отправить', author: 'Автор' }
    : { title: '💬 Comments', like: 'Like', authorReply: 'Author reply', placeholder: 'Your reply...', send: 'Send', author: 'Author' };
}

export function init(ctx) {
  const $ = ctx.$ || window.jQuery;
  $(document).off('.rpsuiteComments')
    .on('click.rpsuiteComments', `.${PFX}-action-like`, (e) => handleLike(e, ctx))
    .on('click.rpsuiteComments', `.${PFX}-action-replybtn`, (e) => openReplyBox(e, ctx))
    .on('click.rpsuiteComments', `.${PFX}-del-reply`, (e) => deleteReply(e, ctx))
    .on('click.rpsuiteComments', `[data-${PFX}-toggle]`, function (e) { if (!$(e.target).closest(`[data-${PFX}-profile]`).length) $(this).closest(`.${PFX}-container`).toggleClass('collapsed'); })
    .on('click.rpsuiteComments', `[data-${PFX}-profile]`, () => openProfileModal(ctx));
}

export function destroy(ctx) {
  const $ = ctx.$ || window.jQuery;
  $(document).off('.rpsuiteComments');
}
export { buildPrompt, parse };

function withCommentsState(ctx, messageId, mutator) {
  const chatId = getCurrentChatIdSafe(ctx);
  const state = getModuleState(chatId, 'comments') || getDefaultState();
  state.author = state.author || defaultAuthor();
  state.sections = state.sections || {};
  state.sections[messageId] = state.sections[messageId] || { likes: {}, replies: [], generatedComments: [], ts: Date.now() };
  mutator(state, state.sections[messageId]);
  state.sections = trimCommentSectionsForSave(state.sections);
  setModuleState(chatId, 'comments', state);
  return state;
}

function updateCommentDom($card, section) {
  const $ = window.jQuery;
  for (const [idx, count] of Object.entries(section.likes || {})) {
    $card.find(`.${PFX}-action-like[data-comment-idx="${idx}"] .${PFX}-likes-count`).text(formatNumber(count));
  }
  $card.find(`.${PFX}-feed`).html(renderFeed(section.generatedComments || [], section, $card.attr('data-section')));
}

function formatNumber(n) {
  const num = Number(n) || 0;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return String(num);
}

function gradientFor(seed) {
  const palette = [['#1d9bf0','#7c3aed'],['#f91880','#ff7a00'],['#00ba7c','#1d9bf0'],['#7856ff','#ff6bcb'],['#536471','#0f1419']];
  const idx = Math.abs([...String(seed || '')].reduce((a, c) => a + c.charCodeAt(0), 0)) % palette.length;
  return palette[idx];
}

function getUserName(ctx = {}) {
  const st = ctx.stContext || window.SillyTavern?.getContext?.() || {};
  return st.name1 || st.user?.name || 'User';
}

function getAuthorFromState(ctx = {}) {
  const chatId = getCurrentChatIdSafe(ctx);
  const state = getModuleState(chatId, 'comments') || getDefaultState();
  return state.author || { name: getUserName(ctx), emoji: '👑' };
}

function buildCommentTree(comments) {
  const tree = [];
  const map = new Map();
  comments.forEach((c, idx) => map.set(idx, { ...c, _idx: idx, _children: [] }));
  comments.forEach((c, idx) => {
    const node = map.get(idx);
    const parent = Number(c.is_reply_to);
    if (Number.isFinite(parent) && parent >= 0 && parent !== idx && map.has(parent)) map.get(parent)._children.push(node);
    else tree.push(node);
  });
  return tree;
}

function renderAuthorReply(reply, depth, author) {
  const d = Math.min(depth, 3);
  return `<div class="${PFX}-tweet ${PFX}-reply ${PFX}-author-tweet" data-depth="${d}" data-author-reply-id="${esc(reply.id)}" style="margin-left:${d * 24}px;">${reply.parentUser ? `<div class="${PFX}-reply-line">↳ @${esc(reply.parentUser)}</div>` : ''}<div class="${PFX}-tweet-body"><div class="${PFX}-avatar ${PFX}-author-avatar"><span class="${PFX}-avatar-emoji">${esc(author.emoji)}</span></div><div class="${PFX}-content"><div class="${PFX}-user"><span class="${PFX}-display-name">${esc(author.name)}</span><span class="${PFX}-verified">${ICONS_SVG.verified}</span><span class="${PFX}-author-badge">Автор</span><span class="${PFX}-time">· ${esc(reply.time || 'now')}</span><span class="${PFX}-del-reply" data-del-reply="${esc(reply.id)}" title="Удалить">${ICONS_SVG.close}</span></div><div class="${PFX}-text">${esc(reply.text)}</div></div></div></div>`;
}

function renderComment(c, comments, depth, repliesByParent, section, author) {
  const d = Math.min(depth, 3);
  const isReply = depth > 0;
  const replyTo = isReply && c.is_reply_to !== null && comments[c.is_reply_to] ? `@${esc(comments[c.is_reply_to].username)}` : '';
  const [c1, c2] = gradientFor(c.username || c.display_name);
  const likes = section.likes?.[c._idx] ?? section.likes?.[c.id] ?? c.likes ?? 0;
  let html = `<div class="${PFX}-tweet ${isReply ? `${PFX}-reply` : ''}" data-depth="${d}" style="${isReply ? `margin-left:${d * 24}px;` : ''}">`;
  if (replyTo) html += `<div class="${PFX}-reply-line">↳ ${replyTo}</div>`;
  html += `<div class="${PFX}-tweet-body"><div class="${PFX}-avatar" style="background:linear-gradient(135deg, ${c1}, ${c2});"><span class="${PFX}-avatar-emoji">${esc(c.avatar_emoji || '👤')}</span></div><div class="${PFX}-content"><div class="${PFX}-user"><span class="${PFX}-display-name">${esc(c.display_name)}</span>${c.verified ? `<span class="${PFX}-verified">${ICONS_SVG.verified}</span>` : ''}<span class="${PFX}-username">@${esc(c.username)}</span><span class="${PFX}-time">· ${esc(c.time)}</span></div><div class="${PFX}-text">${esc(c.comment)}</div><div class="${PFX}-actions"><span class="${PFX}-action ${PFX}-action-replybtn" data-reply-to="${c._idx}" title="Ответить">${ICONS_SVG.comment} ${formatNumber(c.replies)}</span><span class="${PFX}-action ${PFX}-action-rt">${ICONS_SVG.retweet} ${formatNumber(c.retweets)}</span><span class="${PFX}-action ${PFX}-action-like" data-action="like" data-comment-idx="${c._idx}" data-likes="${likes}">${ICONS_SVG.heart} <span class="${PFX}-likes-count">${formatNumber(likes)}</span></span><span class="${PFX}-action">${ICONS_SVG.share}</span></div><div class="${PFX}-reply-box-slot" data-slot-for="${c._idx}"></div></div></div>`;
  if (c._children?.length) html += `<div class="${PFX}-thread">${c._children.map((child) => renderComment(child, comments, depth + 1, repliesByParent, section, author)).join('')}</div>`;
  const own = repliesByParent[c._idx] || [];
  if (own.length) html += `<div class="${PFX}-thread">${own.map((r) => renderAuthorReply(r, depth + 1, author)).join('')}</div>`;
  return `${html}</div>`;
}

function renderFeed(comments, section, messageId, ctx = {}) {
  const author = getAuthorFromState(ctx);
  const repliesByParent = {};
  (section.replies || []).forEach((r) => {
    const key = r.parentIdx ?? r.commentId ?? 'root';
    repliesByParent[key] = repliesByParent[key] || [];
    repliesByParent[key].push(r);
  });
  const tree = buildCommentTree(comments);
  let html = tree.map((node) => renderComment(node, comments, 0, repliesByParent, section, author)).join('');
  const rootReplies = repliesByParent.root || [];
  if (rootReplies.length) html += `<div class="${PFX}-thread">${rootReplies.map((r) => renderAuthorReply(r, 1, author)).join('')}</div>`;
  return html;
}

function handleLike(event, ctx) {
  event.preventDefault();
  const $ = ctx.$ || window.jQuery;
  const $button = $(event.currentTarget);
  const $card = $button.closest(`.${PFX}-container`);
  const messageId = String($card.attr('data-section') || '');
  const commentIdx = String($button.attr('data-comment-idx') || '');
  if (!messageId || commentIdx === '') return;
  const next = withCommentsState(ctx, messageId, (_, section) => {
    section.likes = section.likes || {};
    section.likes[commentIdx] = Number(section.likes[commentIdx] ?? $button.attr('data-likes') ?? 0) + 1;
    const generated = section.generatedComments?.[Number(commentIdx)];
    if (generated) generated.likes = section.likes[commentIdx];
  });
  updateCommentDom($card, next.sections[messageId]);
}

function openReplyBox(event, ctx) {
  event.preventDefault();
  const $ = ctx.$ || window.jQuery;
  const $btn = $(event.currentTarget);
  const idx = Number($btn.attr('data-reply-to'));
  const $card = $btn.closest(`.${PFX}-container`);
  const messageId = String($card.attr('data-section') || '');
  const section = getModuleState(getCurrentChatIdSafe(ctx), 'comments')?.sections?.[messageId] || {};
  const parent = section.generatedComments?.[idx];
  if (!parent) return;
  $card.find(`.${PFX}-reply-box`).remove();
  const $slot = $card.find(`.${PFX}-reply-box-slot[data-slot-for="${idx}"]`);
  const $box = $(`<div class="${PFX}-reply-box"><textarea maxlength="${REPLY_LIMIT + 50}" placeholder="Ответить @${esc(parent.username)}..."></textarea><div class="${PFX}-reply-box-foot"><span class="${PFX}-char-count">0/${REPLY_LIMIT}</span><button class="${PFX}-btn ${PFX}-btn-cancel" data-act="cancel">Отмена</button><button class="${PFX}-btn ${PFX}-btn-send" data-act="send" disabled>Ответить</button></div></div>`);
  $slot.append($box);
  const $ta = $box.find('textarea').trigger('focus');
  $ta.on('input', function () { const len = this.value.length; $box.find(`.${PFX}-char-count`).text(`${len}/${REPLY_LIMIT}`).toggleClass('over', len > REPLY_LIMIT); $box.find('[data-act=send]').prop('disabled', len === 0 || len > REPLY_LIMIT); });
  $box.on('click', '[data-act=cancel]', () => $box.remove());
  $box.on('click', '[data-act=send]', () => {
    const text = String($ta.val() || '').trim();
    if (!text || text.length > REPLY_LIMIT) return;
    const next = withCommentsState(ctx, messageId, (state, sec) => {
      sec.replies = Array.isArray(sec.replies) ? sec.replies : [];
      const reply = { id: `ar_${Date.now()}_${Math.random().toString(16).slice(2)}`, parentIdx: idx, parentUser: parent.username, parentText: parent.comment, text, time: 'now', ts: Date.now() };
      sec.replies.push(reply);
      sec.replies = sec.replies.slice(-30);
      if (sec.generatedComments?.[idx]) sec.generatedComments[idx].replies = Number(sec.generatedComments[idx].replies || 0) + 1;
      state.recentAuthorReplies = [...(Array.isArray(state.recentAuthorReplies) ? state.recentAuthorReplies : []), reply].slice(-30);
    });
    updateCommentDom($card, next.sections[messageId]);
  });
}

function deleteReply(event, ctx) {
  event.preventDefault();
  const $ = ctx.$ || window.jQuery;
  const $card = $(event.currentTarget).closest(`.${PFX}-container`);
  const messageId = String($card.attr('data-section') || '');
  const rid = String($(event.currentTarget).attr('data-del-reply') || '');
  const next = withCommentsState(ctx, messageId, (state, section) => {
    section.replies = (section.replies || []).filter((r) => r.id !== rid);
    state.recentAuthorReplies = (state.recentAuthorReplies || []).filter((r) => r.id !== rid);
  });
  updateCommentDom($card, next.sections[messageId]);
}

function openProfileModal(ctx = {}) {
  const $ = ctx.$ || window.jQuery;
  $(`.${PFX}-modal`).remove();
  const author = getAuthorFromState(ctx);
  let chosen = author.emoji || '👑';
  const palette = AVATAR_PALETTE.map((e) => `<div class="${PFX}-palette-emoji ${e === chosen ? 'selected' : ''}" data-emoji="${esc(e)}">${esc(e)}</div>`).join('');
  const $modal = $(`<div class="${PFX}-modal"><div class="${PFX}-modal-card"><div class="${PFX}-modal-title">${ICONS_SVG.verified} Профиль автора</div><div class="${PFX}-modal-sub">Официальный аккаунт автора в комментариях этого чата.</div><div class="${PFX}-field-label">Ник</div><input type="text" class="${PFX}-inp-name" maxlength="40" value="${esc(author.name)}"><div class="${PFX}-field-label">Аватар</div><div class="${PFX}-palette">${palette}</div><div class="${PFX}-field-label">Или свой эмодзи</div><input type="text" class="${PFX}-inp-emoji" maxlength="4" value=""><div class="${PFX}-modal-foot"><button class="${PFX}-btn ${PFX}-btn-cancel" data-act="cancel">Отмена</button><button class="${PFX}-btn ${PFX}-btn-send" data-act="save">Сохранить</button></div></div></div>`);
  $('body').append($modal);
  $modal.on('click', `.${PFX}-palette-emoji`, function () { chosen = $(this).attr('data-emoji'); $modal.find(`.${PFX}-palette-emoji`).removeClass('selected'); $(this).addClass('selected'); });
  $modal.on('click', '[data-act=cancel]', () => $modal.remove());
  $modal.on('click', (e) => { if (e.target === $modal[0]) $modal.remove(); });
  $modal.on('click', '[data-act=save]', () => {
    const chatId = getCurrentChatIdSafe(ctx);
    const state = getModuleState(chatId, 'comments') || getDefaultState();
    state.author = { name: String($modal.find(`.${PFX}-inp-name`).val() || '').trim() || getUserName(ctx), emoji: String($modal.find(`.${PFX}-inp-emoji`).val() || '').trim() || chosen || '👑' };
    setModuleState(chatId, 'comments', state);
    $modal.remove();
  });
}

export function render(data, ctx = {}) {
  const messageId = String(ctx.messageId || '');
  const section = clone(getSectionForRender(data, ctx));
  if (!section.generatedComments?.length) return '';
  const comments = section.generatedComments.map((comment, index) => normalizeComment(comment, index, section));
  section.generatedComments = comments;
  return `<div class="${PFX}-container" data-section="${esc(messageId)}"><div class="${PFX}-header" data-${PFX}-toggle="true"><div class="${PFX}-header-side">${ICONS_SVG.chevronDown}</div><div class="${PFX}-header-center">${ICONS_SVG.xtwitter}<span class="${PFX}-header-text">Комментарии</span></div><div class="${PFX}-header-gear" data-${PFX}-profile title="Профиль автора">${ICONS_SVG.gear}</div></div><div class="${PFX}-feed">${renderFeed(comments, section, messageId, ctx)}</div></div>`;
}