import { parseTaggedJSON } from '../../core/jsonRepair.js';

export function parse(messageText) {
  const data = parseTaggedJSON(messageText, 'social_comments', null);
  return normalizeCommentsData(data);
}

export function normalizeCommentsData(data) {
  const commentsSource = Array.isArray(data) ? data : data?.comments;
  if (!Array.isArray(commentsSource)) return null;
  const raw = commentsSource.slice(0, 12);
  const idToIndex = new Map();
  raw.forEach((c, i) => {
    const id = String(c?.id || c?.comment_id || `${String(c?.username || `user${i + 1}`).replace(/^@/, '')}-${i}`);
    idToIndex.set(id, i);
    idToIndex.set(id.replace(/^@/, ''), i);
  });
  const normalized = raw.map((c, i) => ({
    id: String(c.id || c.comment_id || `${String(c.username || `user${i + 1}`).replace(/^@/, '')}-${i}`),
    username: String(c.username || `user${i + 1}`).replace(/^@/, ''),
    display_name: String(c.display_name || c.name || c.username || 'User'),
    avatar_emoji: String(c.avatar_emoji || '👤'),
    verified: !!c.verified,
    comment: String(c.comment || c.text || ''),
    likes: parseCount(c.likes),
    retweets: parseCount(c.retweets),
    replies: parseCount(c.replies),
    time: String(c.time || 'now'),
    is_reply_to: normalizeReplyTarget(c.is_reply_to ?? c.reply_to ?? c.parent_id ?? c.parent, idToIndex),
  })).filter((c) => c.comment);
  return normalized.length ? normalized : null;
}

function normalizeReplyTarget(value, idToIndex) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim().replace(/^@/, '');
  if (/^-?\d+$/.test(text)) return Number(text);
  return idToIndex.has(text) ? idToIndex.get(text) : null;
}

function parseCount(value) {
  if (typeof value === 'number') return value;
  const cleaned = String(value ?? '').replace(/,/g, '').trim();
  const match = cleaned.match(/^([\d.]+)\s*([KMB]?)$/i);
  if (!match) return parseInt(cleaned, 10) || 0;
  const num = parseFloat(match[1]);
  const suffix = match[2].toUpperCase();
  if (suffix === 'K') return Math.round(num * 1e3);
  if (suffix === 'M') return Math.round(num * 1e6);
  if (suffix === 'B') return Math.round(num * 1e9);
  return Math.round(num);
}