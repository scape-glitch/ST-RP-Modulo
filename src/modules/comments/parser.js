import { parseTaggedJSON } from '../../core/jsonRepair.js';

export function parse(messageText) {
  const data = parseTaggedJSON(messageText, 'social_comments', null);
  if (!data?.comments || !Array.isArray(data.comments)) return null;
  return data.comments.slice(0, 12).map((c, i) => ({
    username: String(c.username || `user${i + 1}`).replace(/^@/, ''),
    display_name: String(c.display_name || c.name || c.username || 'User'),
    avatar_emoji: String(c.avatar_emoji || '👤'),
    verified: !!c.verified,
    comment: String(c.comment || c.text || ''),
    likes: Number(c.likes || 0),
    retweets: Number(c.retweets || 0),
    replies: Number(c.replies || 0),
    time: String(c.time || 'now'),
  })).filter((c) => c.comment);
}