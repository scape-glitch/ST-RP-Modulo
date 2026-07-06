import { buildPrompt } from './prompt.js';
import { parse } from './parser.js';
import { localStore, setLocalStore } from '../../core/storage.js';
import { getCurrentChatIdSafe, getModuleState, setModuleState, KEEP_HISTORY } from '../../core/moduleState.js';

const PFX = 'wallet';
const POS_KEY = 'wallet_position';

function esc(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }

export { buildPrompt, parse };

export function init(ctx) {
  ensureWidget(ctx);
  const chatId = getCurrentChatIdSafe(ctx);
  render(getModuleState(chatId, 'wallet')?.current || null, { ...ctx, chatId });
}

export function destroy(ctx) {
  const $ = ctx.$ || window.jQuery;
  $(`.${PFX}-global-container`).remove();
  $(document).off('.rpsuiteWallet');
}

export function getDefaultState() {
  return {
    current: {
      currency: '',
      balance: 0,
      living_wage: 0,
      items: [],
      debts: [],
      expenses: [],
      income: [],
      notes: '',
      note: '',
    },
    transactions: [],
    history: [],
  };
}

function pickField(previous, parsed, key) {
  return Object.prototype.hasOwnProperty.call(parsed, key) ? parsed[key] : previous[key];
}

function pickCollection(previous, parsed, key) {
  if (!Object.prototype.hasOwnProperty.call(parsed, key)) return previous[key];
  const next = Array.isArray(parsed[key]) ? parsed[key] : [];
  const hadPrevious = Array.isArray(previous[key]) && previous[key].length > 0;
  const hasExplicitTransaction = Array.isArray(parsed.transactions) && parsed.transactions.length > 0;
  return hadPrevious && !next.length && !hasExplicitTransaction ? previous[key] : next;
}

export function updateState(previousState = getDefaultState(), parsedData = {}, ctx = {}) {
  const previous = previousState?.current || getDefaultState().current;
  const current = {
    currency: pickField(previous, parsedData, 'currency'),
    balance: pickField(previous, parsedData, 'balance'),
    living_wage: pickField(previous, parsedData, 'living_wage'),
    items: pickCollection(previous, parsedData, 'items'),
    debts: pickCollection(previous, parsedData, 'debts'),
    expenses: pickCollection(previous, parsedData, 'expenses'),
    income: pickCollection(previous, parsedData, 'income'),
    notes: pickField(previous, parsedData, 'notes'),
    note: pickField(previous, parsedData, 'note'),
  };
  const newTransactions = Array.isArray(parsedData.transactions) ? parsedData.transactions : (Array.isArray(parsedData.log) ? parsedData.log : []);
  return {
    current,
    transactions: [
      ...(Array.isArray(previousState?.transactions) ? previousState.transactions : []),
      ...newTransactions.map((tx) => (typeof tx === 'string' ? { ts: Date.now(), note: tx } : { ts: Date.now(), ...tx })),
    ].slice(-KEEP_HISTORY),
    history: [
      ...(Array.isArray(previousState?.history) ? previousState.history : []),
      { messageId: ctx.messageId, ts: Date.now(), ...current },
    ].slice(-KEEP_HISTORY),
  };
}

function ensureWidget(ctx) {
  const $ = ctx.$ || window.jQuery;
  let $w = $(`.${PFX}-global-container`).first();
  if ($w.length) return $w;
  $w = $(`<div class="${PFX}-global-container"></div>`).appendTo('body');
  const pos = localStore(POS_KEY, null);
  if (pos) $w.css({ top: pos.top, left: pos.left, right: 'auto', bottom: 'auto' });
  else $w.css({ right: '20px', bottom: '20px', left: 'auto', top: 'auto' });
  let dragging = false;
  let dx = 0;
  let dy = 0;
  $w.on('mousedown.rpsuiteWallet touchstart.rpsuiteWallet', `.${PFX}-header, .${PFX}-container`, (e) => {
    if ($(e.target).closest('[data-action], [data-wallet-flip], [data-wallet-toggle]').length) return;
    const oe = e.originalEvent;
    const point = oe?.touches?.[0] || e;
    dragging = true;
    dx = point.clientX - $w.offset().left;
    dy = point.clientY - $w.offset().top;
    $w.addClass('dragging');
    e.preventDefault();
  });
  $(document).on('mousemove.rpsuiteWallet touchmove.rpsuiteWallet', (e) => {
    if (!dragging) return;
    const oe = e.originalEvent;
    const point = oe?.touches?.[0] || e;
    const left = Math.max(0, Math.min(window.innerWidth - $w.outerWidth(), point.clientX - dx));
    const top = Math.max(0, Math.min(window.innerHeight - $w.outerHeight(), point.clientY - dy));
    $w.css({ left, top, right: 'auto', bottom: 'auto' });
    setLocalStore(POS_KEY, { top: `${top}px`, left: `${left}px` });
  });
  $(document).on('mouseup.rpsuiteWallet touchend.rpsuiteWallet', () => {
    if (!dragging) return;
    dragging = false;
    $w.removeClass('dragging');
    setLocalStore(POS_KEY, { top: $w.css('top'), left: $w.css('left') });
  });
  $w.on('click.rpsuiteWallet', `[data-${PFX}-toggle]`, (e) => {
    e.stopPropagation();
    const $container = $w.find(`.${PFX}-container`);
    $container.toggleClass('collapsed');
    if ($container.hasClass('collapsed')) $container.find(`.${PFX}-balance-flip-container`).removeClass('flipped');
  });
  $w.on('click.rpsuiteWallet', `[data-${PFX}-flip]`, (e) => {
    e.stopPropagation();
    $(e.currentTarget).closest(`.${PFX}-balance-flip-container`).toggleClass('flipped');
  });
  $w.on('click.rpsuiteWallet', '[data-action="togglePaid"]', (e) => handleExpenseToggle(e, ctx));
  $w.on('click.rpsuiteWallet', '[data-action="deleteExpense"]', (e) => handleExpenseDelete(e, ctx));
  $w.on('click.rpsuiteWallet', '[data-action="toggleReceived"]', (e) => handleIncomeToggle(e, ctx));
  return $w;
}

function normalizeWallet(state = {}) {
  const expenses = Array.isArray(state.expenses) && state.expenses.length ? state.expenses : (Array.isArray(state.debts) ? state.debts.map((d) => (typeof d === 'string' ? { name: d, amount: 0, icon: '💸', paid: false, recurring: false, penalty: 0, overdue_days: 0 } : { icon: '💸', paid: false, recurring: false, penalty: 0, overdue_days: 0, ...d })) : []);
  const income = Array.isArray(state.income) ? state.income : [];
  return {
    currency: state.currency || '',
    balance: Number(state.balance || 0),
    living_wage: Number(state.living_wage || state.livingWage || 0),
    expenses,
    income,
    note: state.note || state.notes || '',
  };
}

function getStatusInfo(wallet) {
  const ratio = wallet.balance / (wallet.living_wage || 1);
  if (ratio >= 1.5) return { statusClass: 'good', statusEffect: '' };
  if (ratio >= 0.8) return { statusClass: 'medium', statusEffect: '' };
  if (ratio >= 0.3) return { statusClass: 'bad', statusEffect: '' };
  return { statusClass: 'critical', statusEffect: `${PFX}-pulse` };
}

function buildExpensesHTML(wallet, lang) {
  const currency = esc(wallet.currency);
  if (!wallet.expenses.length) return `<div class="${PFX}-empty">${lang === 'ru' ? 'Расходов нет' : 'No expenses'}</div>`;
  return wallet.expenses.map((e, idx) => {
    const paidClass = e.paid ? 'paid' : 'unpaid';
    const penaltyText = Number(e.penalty) > 0 ? ` (+${esc(e.penalty)} ${currency})` : '';
    const deleteBtn = e.recurring ? '' : `<span class="${PFX}-delete-expense" data-action="deleteExpense" data-idx="${idx}">✕</span>`;
    const statusText = e.paid ? (lang === 'ru' ? 'Оплачено' : 'Paid') : (lang === 'ru' ? 'Не оплачено' : 'Unpaid');
    return `<div class="${PFX}-expense-item ${paidClass}"><span class="${PFX}-expense-toggle" data-action="togglePaid" data-idx="${idx}"><span class="${PFX}-expense-icon">${esc(e.icon || '💸')}</span><span class="${PFX}-expense-name">${esc(e.name)}</span><span class="${PFX}-expense-amount">${esc(e.amount || 0)} ${currency}${penaltyText}<span class="${PFX}-status-text">${statusText}</span></span></span>${deleteBtn}${!e.paid && e.recurring && (e.overdue_days > 0 || e.penalty > 0) ? `<span class="${PFX}-overdue">${lang === 'ru' ? 'Просрочено' : 'Overdue'} ${esc(e.overdue_days || 0)} ${lang === 'ru' ? 'дн.' : 'd'}</span>` : ''}</div>`;
  }).join('');
}

function buildIncomeHTML(wallet, lang) {
  const currency = esc(wallet.currency);
  if (!wallet.income.length) return `<div class="${PFX}-empty">${lang === 'ru' ? 'Нет доходов' : 'No income'}</div>`;
  return wallet.income.map((i, idx) => `<div class="${PFX}-income-item ${i.received ? 'received' : 'not-received'}"><span class="${PFX}-income-toggle" data-action="toggleReceived" data-idx="${idx}"><span class="${PFX}-income-icon">${esc(i.icon || '💵')}</span><span class="${PFX}-income-name">${esc(i.name)}</span><span class="${PFX}-income-amount">+${esc(i.amount || 0)} ${currency}<span class="${PFX}-status-text">${i.received ? (lang === 'ru' ? 'Получено' : 'Received') : (lang === 'ru' ? 'Ожидается' : 'Pending')}</span></span></span></div>`).join('');
}

function buildBalanceFront(wallet, lang, statusClass, statusEffect) {
  return `<div class="${PFX}-balance-front ${statusClass} ${statusEffect}"><div class="${PFX}-balance-label">${lang === 'ru' ? 'Текущий баланс' : 'Current Balance'}</div><div class="${PFX}-balance-value">${esc(wallet.balance)} ${esc(wallet.currency)}</div><div class="${PFX}-living-wage">${lang === 'ru' ? 'Прожиточный минимум' : 'Living Wage'}: ${esc(wallet.living_wage)} ${esc(wallet.currency)}</div><div class="${PFX}-flip-hint" data-${PFX}-flip>↻</div></div>`;
}

function buildBalanceBack(wallet) {
  const note = esc(wallet.note || 'Пустота...');
  const len = note.length;
  const fontSize = len > 60 ? 10 : len > 40 ? 11 : len > 25 ? 12 : 13;
  return `<div class="${PFX}-balance-back"><div class="${PFX}-back-content" style="font-size:${fontSize}px;"><span class="${PFX}-back-icon">💸</span><span class="${PFX}-back-note" style="font-size:${fontSize}px;">${note}</span></div><div class="${PFX}-flip-hint" data-${PFX}-flip>↻</div></div>`;
}

function buildFullWidget(wallet, lang) {
  const { statusClass, statusEffect } = getStatusInfo(wallet);
  return `<div class="${PFX}-container collapsed"><div class="${PFX}-header" data-${PFX}-toggle><span class="${PFX}-header-icon">💳</span></div><div class="${PFX}-body"><div class="${PFX}-card"><div class="${PFX}-card-front"><div class="${PFX}-balance-flip-container"><div class="${PFX}-balance-flip-inner">${buildBalanceFront(wallet, lang, statusClass, statusEffect)}${buildBalanceBack(wallet, lang)}</div></div><div class="${PFX}-section"><div class="${PFX}-section-title">📉 ${lang === 'ru' ? 'Расходы' : 'Expenses'}</div><div class="${PFX}-expenses-list">${buildExpensesHTML(wallet, lang)}</div></div><div class="${PFX}-section"><div class="${PFX}-section-title">📈 ${lang === 'ru' ? 'Доходы' : 'Income'}</div><div class="${PFX}-income-list">${buildIncomeHTML(wallet, lang)}</div></div></div></div></div></div>`;
}

function mutateWallet(ctx, mutator) {
  const chatId = getCurrentChatIdSafe(ctx);
  const state = getModuleState(chatId, 'wallet') || getDefaultState();
  state.current = normalizeWallet(state.current || {});
  mutator(state.current);
  setModuleState(chatId, 'wallet', state);
  render(state.current, ctx);
}

function handleExpenseToggle(event, ctx) {
  event.stopPropagation();
  const idx = Number((ctx.$ || window.jQuery)(event.currentTarget).attr('data-idx'));
  mutateWallet(ctx, (wallet) => {
    const e = wallet.expenses[idx];
    if (!e) return;
    const amount = Number(e.amount || 0) + Number(e.penalty || 0);
    if (e.paid) { wallet.balance += amount; e.paid = false; }
    else if (wallet.balance >= amount) { wallet.balance -= amount; e.paid = true; e.overdue_days = 0; e.penalty = 0; }
  });
}

function handleExpenseDelete(event, ctx) {
  event.stopPropagation();
  const idx = Number((ctx.$ || window.jQuery)(event.currentTarget).attr('data-idx'));
  mutateWallet(ctx, (wallet) => { if (wallet.expenses[idx] && !wallet.expenses[idx].recurring) wallet.expenses.splice(idx, 1); });
}

function handleIncomeToggle(event, ctx) {
  event.stopPropagation();
  const idx = Number((ctx.$ || window.jQuery)(event.currentTarget).attr('data-idx'));
  mutateWallet(ctx, (wallet) => { const i = wallet.income[idx]; if (!i) return; const amount = Number(i.amount || 0); if (i.received) { wallet.balance -= amount; i.received = false; } else { wallet.balance += amount; i.received = true; } });
}

export function render(data, ctx) {
  const state = normalizeWallet(ctx?.currentState?.current || data || {});
  const $w = ensureWidget(ctx);
  const lang = ctx.lang || 'ru';
  $w.html(buildFullWidget(state, lang));
  return $w;
}