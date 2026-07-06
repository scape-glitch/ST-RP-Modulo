import { parseTaggedJSON } from '../../core/jsonRepair.js';

export function parse(messageText) {
  const data = parseTaggedJSON(messageText, 'social_comments', null);
  if (!data?.comments || !Array.isArray(data.comments)) return null;
  return data.comments.slice(0, 12).map((c, i) => ({
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
    is_reply_to: c.is_reply_to === null || c.is_reply_to === undefined ? null : Number(c.is_reply_to),
  })).filter((c) => c.comment);
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