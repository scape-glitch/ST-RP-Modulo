import { parseTaggedJSON } from '../../core/jsonRepair.js';

export function parse(messageText) {
  const data = parseTaggedJSON(messageText, 'rs_metrics', null);
  if (!data) return null;
  const defaults = (c = {}) => ({
    name: c.name || c.character || 'Unknown',
    color: c.color || '#888888',
    mood: c.mood || 'neutral',
    mood_hex: c.mood_hex || c.color || '#888888',
    thoughts: c.thoughts || c.insight || '',
    thoughts_hex: c.thoughts_hex || '#aaaaaa',
    relationship: typeof c.relationship === 'number' ? c.relationship : (Number(c.relationship) || 0),
    relationship_hex: c.relationship_hex || '#ff99cc',
    feeling: c.feeling || '',
    intention: c.intention || '',
    arousal: Number(c.arousal) || 0,
    arousal_hex: c.arousal_hex || '#ff6666',
    grudge: Number(c.grudge ?? c.anger) || 0,
    grudge_hex: c.grudge_hex || '#cc5555',
    respect: c.respect === 'MAX' ? 'MAX' : (Number(c.respect) || 0),
    respect_hex: c.respect_hex || '#99ccff',
    secret: c.secret || '',
    insight: c.insight || '',
  });
  if (Array.isArray(data.characters)) return { characters: data.characters.map(defaults).filter((c) => c.name) };
  return { characters: [defaults(data)] };
}