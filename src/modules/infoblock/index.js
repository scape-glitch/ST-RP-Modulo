import { buildPrompt } from './prompt.js';
import { parse } from './parser.js';

function esc(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }
const LABELS = { ru: ['🕒 Дата и время','🏢 Локация','🌐 Конфликт','👥 Персонажи','🔍 Деталь','📖 Сюжет','🎯 Дальше'], en: ['🕒 Date & Time','🏢 Location','🌐 Conflict','👥 Characters','🔍 Key Detail','📖 Current Plot','🎯 Future Direction'] };

export function init() {}
export function destroy() {}
export { buildPrompt, parse };

export function render(data, { lang = 'ru' }) {
  const l = LABELS[lang] || LABELS.en;
  const rows = [[l[0],data.dateTime],[l[1],data.location],[l[2],data.globalConflict],[l[3],data.characters.join(', ')],[l[4],data.keyDetail],[l[5],data.plotSummary],[l[6],data.futurePlot]].filter((r) => r[1]);
  if (!rows.length) return '';
  return `<div class="rpsuite-card rpsuite-infoblock"><div class="rpsuite-card-title">${lang === 'ru' ? '📋 Инфоблок' : '📋 Info Block'}</div>${rows.map(([k,v]) => `<div class="rpsuite-infoblock-row"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div>`;
}