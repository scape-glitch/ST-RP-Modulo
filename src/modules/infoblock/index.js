import { buildPrompt } from './prompt.js';
import { parse } from './parser.js';
import { KEEP_HISTORY } from '../../core/moduleState.js';

function esc(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }
const LABELS = { ru: ['🕒 Дата и время','🏢 Локация','🌐 Конфликт','👥 Персонажи','🔍 Деталь','📖 Сюжет','🎯 Дальше'], en: ['🕒 Date & Time','🏢 Location','🌐 Conflict','👥 Characters','🔍 Key Detail','📖 Current Plot','🎯 Future Direction'] };

export function init() {}
export function destroy() {}
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

export function render(data, { lang = 'ru', currentState = null } = {}) {
  data = currentState?.current || data;
  const l = LABELS[lang] || LABELS.en;
  const rows = [[l[0],data.dateTime],[l[1],data.location],[l[2],data.globalConflict],[l[3],(data.characters || []).join(', ')],[l[4],data.keyDetail],[l[5],data.plotSummary],[l[6],data.futurePlot]].filter((r) => r[1]);
  if (!rows.length) return '';
  return `<div class="rpsuite-card rpsuite-infoblock"><div class="rpsuite-card-title">${lang === 'ru' ? '📋 Инфоблок' : '📋 Info Block'}</div>${rows.map(([k,v]) => `<div class="rpsuite-infoblock-row"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div>`;
}