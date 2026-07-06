import { parseTaggedJSON } from '../../core/jsonRepair.js';

export function parse(messageText) {
  const data = parseTaggedJSON(messageText, 'wallet_state', null);
  if (!data) return null;
  const parsed = {};
  if (Object.prototype.hasOwnProperty.call(data, 'balance')) parsed.balance = data.balance;
  if (Object.prototype.hasOwnProperty.call(data, 'currency')) parsed.currency = data.currency || '';
  if (Object.prototype.hasOwnProperty.call(data, 'items')) parsed.items = Array.isArray(data.items) ? data.items : [];
  if (Object.prototype.hasOwnProperty.call(data, 'debts')) parsed.debts = Array.isArray(data.debts) ? data.debts : [];
  if (Object.prototype.hasOwnProperty.call(data, 'notes')) parsed.notes = data.notes || '';
  if (Object.prototype.hasOwnProperty.call(data, 'transactions')) parsed.transactions = Array.isArray(data.transactions) ? data.transactions : [];
  if (Object.prototype.hasOwnProperty.call(data, 'log')) parsed.log = Array.isArray(data.log) ? data.log : [];
  return parsed;
}