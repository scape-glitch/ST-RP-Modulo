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
    .on('click.rpsuiteComments', '[data-rpsuite-comment-like]', (e) => handleLike(e, ctx))
    .on('click.rpsuiteComments', '[data-rpsuite-comment-send]', (e) => handleReply(e, ctx, 'user'))
    .on('click.rpsuiteComments', '[data-rpsuite-comment-author-send]', (e) => handleReply(e, ctx, 'author'));
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
  for (const [commentId, count] of Object.entries(section.likes || {})) {
    $card.find(`[data-rpsuite-comment-like][data-comment-id="${commentId}"] .rpsuite-comments-like-count`).text(count);
  }
  $card.find('[data-rpsuite-comment-id]').each((_, el) => {
    const $item = $(el);
    const commentId = $item.attr('data-rpsuite-comment-id');
    const replies = (section.replies || []).filter((r) => r.commentId === commentId);
    $item.find('.rpsuite-comments-replies').html(renderReplies(replies));
    const generated = section.generatedComments?.find((c) => c.id === commentId);
    $item.find('.rpsuite-comments-reply-count').text(Number(generated?.replies || replies.length || 0));
  });
}

function handleLike(event, ctx) {
  event.preventDefault();
  const $ = ctx.$ || window.jQuery;
  const $button = $(event.currentTarget);
  const $card = $button.closest('.rpsuite-comments');
  const messageId = String($card.attr('data-message-id') || '');
  const commentId = String($button.attr('data-comment-id') || '');
  if (!messageId || !commentId) return;
  const next = withCommentsState(ctx, messageId, (_, section) => {
    section.likes = section.likes || {};
    section.likes[commentId] = Number(section.likes[commentId] || 0) + 1;
    const generated = section.generatedComments?.find((c) => c.id === commentId);
    if (generated) generated.likes = section.likes[commentId];
  });
  updateCommentDom($card, next.sections[messageId]);
}

function handleReply(event, ctx, role) {
  event.preventDefault();
  const $ = ctx.$ || window.jQuery;
  const $button = $(event.currentTarget);
  const $item = $button.closest('[data-rpsuite-comment-id]');
  const $card = $button.closest('.rpsuite-comments');
  const $input = role === 'author' ? $item.find('[data-rpsuite-author-reply-input]').first() : $item.find('[data-rpsuite-comment-reply-input]').first();
  const text = String($input.val() || '').trim().slice(0, 1000);
  const messageId = String($card.attr('data-message-id') || '');
  const commentId = String($item.attr('data-rpsuite-comment-id') || '');
  if (!text || !messageId || !commentId) return;
  const next = withCommentsState(ctx, messageId, (state, section) => {
    section.replies = Array.isArray(section.replies) ? section.replies : [];
    const reply = { commentId, role, text, ts: Date.now() };
    section.replies.push(reply);
    section.replies = section.replies.slice(-30);
    const generated = section.generatedComments?.find((c) => c.id === commentId);
    if (generated) generated.replies = Number(generated.replies || 0) + 1;
    if (role === 'author') {
      state.recentAuthorReplies = [...(Array.isArray(state.recentAuthorReplies) ? state.recentAuthorReplies : []), reply].slice(-30);
    }
  });
  $input.val('');
  updateCommentDom($card, next.sections[messageId]);
}

function renderReplies(replies = []) {
  return replies.map((reply) => `<div class="rpsuite-comments-reply rpsuite-comments-reply-${esc(reply.role)}"><b>${reply.role === 'author' ? '&#128081;' : '↳'}</b> ${esc(reply.text)}</div>`).join('');
}

export function render(data, ctx = {}) {
  const lang = ctx.lang || 'ru';
  const labels = getLabels(lang);
  const messageId = String(ctx.messageId || '');
  const section = clone(getSectionForRender(data, ctx));
  if (!section.generatedComments?.length) return '';
  const comments = section.generatedComments.map((comment, index) => normalizeComment(comment, index, section));
  return `<div class="rpsuite-card rpsuite-comments" data-message-id="${esc(messageId)}"><div class="rpsuite-card-title">${esc(labels.title)}</div>${comments.map((c) => {
    const replies = (section.replies || []).filter((reply) => reply.commentId === c.id);
    return `<article class="rpsuite-comments-item" data-rpsuite-comment-id="${esc(c.id)}"><div class="rpsuite-comments-avatar">${esc(c.avatar_emoji)}</div><div class="rpsuite-comments-body"><div><b>${esc(c.display_name)}</b>${c.verified ? ' <span class="rpsuite-comments-verified">✓</span>' : ''} <span>@${esc(c.username)} · ${esc(c.time)}</span></div><p>${esc(c.comment)}</p><footer><button type="button" data-rpsuite-comment-like data-comment-id="${esc(c.id)}">♡ ${esc(labels.like)} <span class="rpsuite-comments-like-count">${esc(c.likes)}</span></button><span>↻ ${esc(c.retweets)}</span><span>💬 <span class="rpsuite-comments-reply-count">${esc(c.replies)}</span></span></footer><div class="rpsuite-comments-replies">${renderReplies(replies)}</div><div class="rpsuite-comments-reply-box"><input data-rpsuite-comment-reply-input type="text" placeholder="${esc(labels.placeholder)}"><button type="button" data-rpsuite-comment-send>${esc(labels.send)}</button></div><div class="rpsuite-comments-reply-box rpsuite-comments-author-box"><input data-rpsuite-author-reply-input type="text" placeholder="${esc(labels.authorReply)}"><button type="button" data-rpsuite-comment-author-send>${esc(labels.author)}</button></div></div></article>`;
  }).join('')}</div>`;
}