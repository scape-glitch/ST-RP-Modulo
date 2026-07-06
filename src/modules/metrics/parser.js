import { parseTaggedJSON } from '../../core/jsonRepair.js';

export function parse(messageText) {
  const data = parseTaggedJSON(messageText, 'rs_metrics', null);
  if (!data) return null;
  return {
    arousal: Number(data.arousal ?? 0),
    grudge: Number(data.grudge ?? data.anger ?? 0),
    respect: Number(data.respect ?? 0),
    relationship: data.relationship || '',
    intention: data.intention || '',
    insight: data.insight || '',
  };
}