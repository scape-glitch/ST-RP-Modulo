import { parseTaggedJSON } from '../../core/jsonRepair.js';

export function parse(messageText) {
  const data = parseTaggedJSON(messageText, 'wallet_state', null);
  if (!data) return null;
  const parsed = {};
  if (Object.prototype.hasOwnProperty.call(data, 'balance')) parsed.balance = data.balance;
  if (Object.prototype.hasOwnProperty.call(data, 'currency')) parsed.currency = data.currency || '';
  if (Object.prototype.hasOwnProperty.call(data, 'living_wage')) parsed.living_wage = data.living_wage || 0;
  if (Object.prototype.hasOwnProperty.call(data, 'livingWage')) parsed.living_wage = data.livingWage || 0;
  if (Object.prototype.hasOwnProperty.call(data, 'items')) parsed.items = Array.isArray(data.items) ? data.items : [];
  if (Object.prototype.hasOwnProperty.call(data, 'debts')) parsed.debts = Array.isArray(data.debts) ? data.debts : [];
  if (Object.prototype.hasOwnProperty.call(data, 'expenses')) parsed.expenses = Array.isArray(data.expenses) ? data.expenses : [];
  if (Object.prototype.hasOwnProperty.call(data, 'income')) parsed.income = Array.isArray(data.income) ? data.income : [];
  if (Object.prototype.hasOwnProperty.call(data, 'notes')) parsed.notes = data.notes || '';
  if (Object.prototype.hasOwnProperty.call(data, 'note')) parsed.note = data.note || '';
  if (Object.prototype.hasOwnProperty.call(data, 'transactions')) parsed.transactions = Array.isArray(data.transactions) ? data.transactions : [];
  if (Object.prototype.hasOwnProperty.call(data, 'log')) parsed.log = Array.isArray(data.log) ? data.log : [];
  return parsed;
}