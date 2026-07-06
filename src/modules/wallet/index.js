import { buildPrompt } from './prompt.js';
import { parse } from './parser.js';
import { localStore, setLocalStore } from '../../core/storage.js';
import { getCurrentChatIdSafe, getModuleState, setModuleState, KEEP_HISTORY } from '../../core/moduleState.js';

const PFX = 'wallet';
const POS_KEY = 'rpsuite_wallet_position_v1';
const LEGACY_POS_KEY = 'wallet_position';
const DRAG_THRESHOLD = 6;
const VIEWPORT_MARGIN = 4;

function esc(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }

function numberFromCss(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clampPosition(left, top, width, height) {
  const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);
  return {
    left: Math.max(VIEWPORT_MARGIN, Math.min(left, maxX)),
    top: Math.max(VIEWPORT_MARGIN, Math.min(top, maxY)),
  };
}

function readStoredPosition() {
  const stored = localStore(POS_KEY, null) || localStore(LEGACY_POS_KEY, null);
  if (!stored) return null;
  const left = numberFromCss(stored.left);
  const top = numberFromCss(stored.top);
  if (left === null || top === null) return null;
  return { left, top };
}

function applyStoredPosition($w) {
  const stored = readStoredPosition();
  if (!stored) {
    $w.css({ right: '20px', bottom: '20px', left: 'auto', top: 'auto' });
    return;
  }
  const width = $w.outerWidth() || 40;
  const height = $w.outerHeight() || 40;
  const clamped = clampPosition(stored.left, stored.top, width, height);
  $w.css({ left: `${Math.round(clamped.left)}px`, top: `${Math.round(clamped.top)}px`, right: 'auto', bottom: 'auto' });
  setLocalStore(POS_KEY, { left: Math.round(clamped.left), top: Math.round(clamped.top) });
  console.log('[RP Suite][Wallet] restored position', { left: Math.round(clamped.left), top: Math.round(clamped.top) });
}

function saveWidgetPosition($w) {
  const rect = $w[0]?.getBoundingClientRect();
  if (!rect) return null;
  const position = { left: Math.round(rect.left), top: Math.round(rect.top) };
  setLocalStore(POS_KEY, position);
  return position;
}

function clampCurrentPosition($w) {
  const rect = $w[0]?.getBoundingClientRect();
  if (!rect) return;
  const clamped = clampPosition(rect.left, rect.top, rect.width || $w.outerWidth() || 40, rect.height || $w.outerHeight() || 40);
  $w.css({ left: `${Math.round(clamped.left)}px`, top: `${Math.round(clamped.top)}px`, right: 'auto', bottom: 'auto' });
  setLocalStore(POS_KEY, { left: Math.round(clamped.left), top: Math.round(clamped.top) });
}

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
  $(window).off('.rpsuiteWallet');
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
  applyStoredPosition($w);

  let pointerDown = false;
  let moved = false;
  let activePointerId = null;
  let startX = 0;
  let startY = 0;
  let baseLeft = 0;
  let baseTop = 0;
  let baseWidth = 0;
  let baseHeight = 0;
  let suppressClickUntil = 0;

  const root = $w[0];
  const isInteractive = (target) => !!target.closest('[data-action], [data-wallet-flip], input, textarea, select, button, a');

  function onPointerDown(e) {
    if (e.button === 2) return;
    const target = e.target;
    const container = target.closest(`.${PFX}-container`);
    if (!container || !root.contains(container)) return;
    if (isInteractive(target)) return;

    const collapsed = container.classList.contains('collapsed');
    const handle = target.closest(`.${PFX}-header`) || (collapsed ? container : null);
    if (!handle) return;

    const rect = root.getBoundingClientRect();
    pointerDown = true;
    moved = false;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    baseLeft = rect.left;
    baseTop = rect.top;
    baseWidth = rect.width || $w.outerWidth() || 40;
    baseHeight = rect.height || $w.outerHeight() || 40;

    try { handle.setPointerCapture(e.pointerId); } catch (_) {}
  }

  function onPointerMove(e) {
    if (!pointerDown) return;
    if (activePointerId !== null && e.pointerId !== activePointerId) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (e.cancelable) e.preventDefault();

    if (!moved) {
      moved = true;
      $w.addClass('dragging');
      const position = { left: Math.round(baseLeft), top: Math.round(baseTop) };
      console.log('[RP Suite][Wallet] drag start', position);
    }

    const next = clampPosition(baseLeft + dx, baseTop + dy, baseWidth, baseHeight);
    $w.css({ left: `${Math.round(next.left)}px`, top: `${Math.round(next.top)}px`, right: 'auto', bottom: 'auto' });
  }

  function onPointerUp(e) {
    if (!pointerDown) return;
    if (activePointerId !== null && e.pointerId !== activePointerId) return;

    pointerDown = false;
    activePointerId = null;
    $w.removeClass('dragging');

    if (moved) {
      moved = false;
      suppressClickUntil = Date.now() + 350;
      const position = saveWidgetPosition($w);
      console.log('[RP Suite][Wallet] drag end', position);
      if (e.cancelable) e.preventDefault();
    }
  }

  function onPointerCancel() {
    pointerDown = false;
    moved = false;
    activePointerId = null;
    $w.removeClass('dragging');
  }

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', onPointerCancel);
  $(window).on('resize.rpsuiteWallet', () => clampCurrentPosition($w));

  $w.on('click.rpsuiteWallet', `[data-${PFX}-toggle]`, (e) => {
    e.stopPropagation();
    if (Date.now() < suppressClickUntil) {
      e.preventDefault();
      return;
    }
    const $container = $w.find(`.${PFX}-container`);
    $container.toggleClass('collapsed');
    if ($container.hasClass('collapsed')) $container.find(`.${PFX}-balance-flip-container`).removeClass('flipped');
    console.log('[RP Suite][Wallet] collapsed:', $container.hasClass('collapsed'));
    requestAnimationFrame(() => clampCurrentPosition($w));
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
  const wasCollapsed = !$w.find(`.${PFX}-container`).length || $w.find(`.${PFX}-container`).hasClass('collapsed');
  $w.html(buildFullWidget(state, lang));
  if (!wasCollapsed) $w.find(`.${PFX}-container`).removeClass('collapsed');
  applyStoredPosition($w);
  return $w;
}