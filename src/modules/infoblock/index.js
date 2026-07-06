import { buildPrompt } from './prompt.js';
import { parse } from './parser.js';
import { KEEP_HISTORY } from '../../core/moduleState.js';

function esc(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }
const PFX = 'scn-inf';
const LABELS = {
  ru: { header: 'Состояние сцены', dateTime: 'Дата / время', location: 'Локация', globalConflict: 'Глобальный конфликт', characters: 'Персонажи', keyDetail: 'Ключевая деталь', plotSummary: 'Текущий сюжет', futurePlot: 'Будущий сюжет', notSpecified: 'не указано', noData: 'нет данных' },
  en: { header: 'Scene state', dateTime: 'Date / time', location: 'Location', globalConflict: 'Global conflict', characters: 'Characters', keyDetail: 'Key detail', plotSummary: 'Plot summary', futurePlot: 'Future plot', notSpecified: 'not specified', noData: 'no data' },
};
function getLabel(key, lang) { return (LABELS[lang] || LABELS.en)[key] || key; }

export function init(ctx = {}) {
  const $ = ctx.$ || window.jQuery;
  $(document).off('.rpsuiteInfoblock').on('click.rpsuiteInfoblock', `[data-${PFX}-toggle]`, function (e) {
    e.preventDefault();
    $(this).closest(`.${PFX}-container`).toggleClass('collapsed');
  });
}
export function destroy(ctx = {}) { (ctx.$ || window.jQuery)(document).off('.rpsuiteInfoblock'); }
export { buildPrompt, parse };

export function getDefaultState() {
  return {
    current: {
      dateTime: '',
      location: '',
      globalConflict: '',
      characters: [],
      keyDetail: '',
      plotSummary: '',
      futurePlot: '',
    },
    history: [],
  };
}

export function updateState(previousState = getDefaultState(), parsedData = {}, ctx = {}) {
  const previous = previousState?.current || getDefaultState().current;
  const current = { ...previous, ...parsedData };
  return {
    current,
    history: [
      ...(Array.isArray(previousState?.history) ? previousState.history : []),
      { messageId: ctx.messageId, ts: Date.now(), ...current },
    ].slice(-KEEP_HISTORY),
  };
}

function normalizeScene(data = {}) {
  const source = data || {};
  let date = source.date || '';
  let time = source.time || '';
  if (!date && source.dateTime) {
    const parts = String(source.dateTime).split('|');
    date = parts[0]?.trim() || source.dateTime;
    time = parts[1]?.trim() || '';
  }
  return {
    date,
    time,
    location: source.location || '',
    global_conflict: source.global_conflict || source.globalConflict || '',
    characters: Array.isArray(source.characters) ? source.characters : [],
    key_detail: source.key_detail || source.keyDetail || '',
    plot_summary: source.plot_summary || source.plotSummary || '',
    future_plot: source.future_plot || source.futurePlot || '',
  };
}

function renderCharacters(characters, lang) {
  const na = getLabel('notSpecified', lang);
  if (!characters.length) return `<span style="opacity:0.5;">${getLabel('noData', lang)}</span>`;
  return characters.map((c) => {
    if (typeof c === 'string') return `<div class="${PFX}-char-entry"><span class="${PFX}-char-name">${esc(c)}</span></div>`;
    return `<div class="${PFX}-char-entry"><span class="${PFX}-char-name">${esc(c.name)}</span><div class="${PFX}-char-details"><span>👕 ${esc(c.outfit || na)}</span><span>🧘 ${esc(c.position || na)}</span><span>❤️ ${esc(c.condition || na)}</span></div></div>`;
  }).join('');
}

export function render(data, { lang = 'ru', currentState = null } = {}) {
  const state = normalizeScene(currentState?.current || data);
  const dateTime = `${esc(state.date)} | ${esc(state.time)}`;
  return `<div class="${PFX}-container collapsed"><div class="${PFX}-header" data-${PFX}-toggle><span class="${PFX}-chevron">▼</span><span class="${PFX}-header-text">${getLabel('header', lang)}</span></div><div class="${PFX}-body"><div class="${PFX}-block time"><span class="${PFX}-label">${getLabel('dateTime', lang)}</span><span class="${PFX}-value">${dateTime}</span></div><div class="${PFX}-block location"><span class="${PFX}-label">${getLabel('location', lang)}</span><span class="${PFX}-value">${esc(state.location)}</span></div><div class="${PFX}-block global"><span class="${PFX}-label">${getLabel('globalConflict', lang)}</span><span class="${PFX}-value">${esc(state.global_conflict) || '—'}</span></div><div class="${PFX}-block characters"><span class="${PFX}-label">${getLabel('characters', lang)}</span><div class="${PFX}-char-list">${renderCharacters(state.characters, lang)}</div></div><div class="${PFX}-block detail"><span class="${PFX}-label">${getLabel('keyDetail', lang)}</span><span class="${PFX}-value">${esc(state.key_detail) || '—'}</span></div><div class="${PFX}-block summary"><span class="${PFX}-label">${getLabel('plotSummary', lang)}</span><span class="${PFX}-value">${esc(state.plot_summary) || '—'}</span></div><div class="${PFX}-block future"><span class="${PFX}-label">${getLabel('futurePlot', lang)}</span><span class="${PFX}-value">${esc(state.future_plot) || '—'}</span></div></div></div>`;
}