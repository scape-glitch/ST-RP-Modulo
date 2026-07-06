import { buildPrompt } from './prompt.js';
import { parse } from './parser.js';

const LABELS = {
  ru: { title: '📊 Метрики', arousal: 'Возбуждение', grudge: 'Обида/Злость', respect: 'Уважение', relationship: 'Отношение', intention: 'Намерение', insight: 'Инсайт' },
  en: { title: '📊 Metrics', arousal: 'Arousal', grudge: 'Grudge/Anger', respect: 'Respect', relationship: 'Relationship', intention: 'Intention', insight: 'Insight' },
};

function esc(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }
function clamp(value) { return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)); }
function bar(label, value) { const v = clamp(value); return `<div class="rpsuite-metrics-row"><span>${esc(label)}</span><b>${v}%</b><i><em style="width:${v}%"></em></i></div>`; }

export function init() {}
export function destroy() {}
export { buildPrompt, parse };

export function render(data, { lang = 'ru' }) {
  const l = LABELS[lang] || LABELS.en;
  return `<div class="rpsuite-card rpsuite-metrics"><div class="rpsuite-card-title">${esc(l.title)}</div>${bar(l.arousal, data.arousal)}${bar(l.grudge, data.grudge)}${bar(l.respect, data.respect)}<div class="rpsuite-metrics-text"><b>${esc(l.relationship)}:</b> ${esc(data.relationship)}</div><div class="rpsuite-metrics-text"><b>${esc(l.intention)}:</b> ${esc(data.intention)}</div>${data.insight ? `<div class="rpsuite-metrics-insight"><b>💎 ${esc(l.insight)}:</b> ${esc(data.insight)}</div>` : ''}</div>`;
}