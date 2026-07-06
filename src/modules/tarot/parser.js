import { parseTaggedJSON } from '../../core/jsonRepair.js';

export function parse(messageText) {
  const data = parseTaggedJSON(messageText, 'tarot_reading', null);
  if (!data) return null;
  const cards = Array.isArray(data.cards) ? data.cards.slice(0, 3).map(String) : [];
  if (!cards.length && !data.interpretation) return null;
  return { cards, interpretation: String(data.interpretation || '') };
}