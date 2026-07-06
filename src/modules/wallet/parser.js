import { parseTaggedJSON } from '../../core/jsonRepair.js';

export function parse(messageText) {
  const data = parseTaggedJSON(messageText, 'wallet_state', null);
  if (!data) return null;
  return {
    balance: data.balance ?? '',
    currency: data.currency || '',
    items: Array.isArray(data.items) ? data.items : [],
    debts: Array.isArray(data.debts) ? data.debts : [],
    notes: data.notes || '',
    log: Array.isArray(data.log) ? data.log : [],
  };
}