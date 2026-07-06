import { parseTaggedJSON } from '../../core/jsonRepair.js';

export function parse(messageText) {
  const data = parseTaggedJSON(messageText, 'wallet_state', null);
  if (!data) return null;
  return {
    balance: data.balance || '',
    currency: data.currency || '',
    items: Array.isArray(data.items) ? data.items : [],
    log: Array.isArray(data.log) ? data.log : [],
  };
}