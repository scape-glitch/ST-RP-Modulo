import { buildPrompt } from './prompt.js';
import { parse } from './parser.js';
import { KEEP_HISTORY } from '../../core/moduleState.js';
import { renderInlineMarkdownSafe } from '../../core/markdown.js';

const PFX = 'rs-mtrx';
const THEME_KEY = 'rs_mtrx_theme';
const THEMES = ['default', 'glass', 'neon', 'paper', 'minimal'];
const LABELS = {
  ru: { arousal: 'Возбуждение', grudge: 'Обида', respect: 'Уважение', relationship: 'Отношение', intention: 'Намерение', insight: 'Инсайт', flip: 'нажмите, чтобы открыть инсайт', back: 'назад', overload: 'OVERLOAD', noData: 'нет данных' },
  en: { arousal: 'Arousal', grudge: 'Grudge', respect: 'Respect', relationship: 'Relationship', intention: 'Intention', insight: 'Insight', flip: 'tap to reveal insight', back: 'back', overload: 'OVERLOAD', noData: 'no data' },
};

function esc(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }
function mdInline(value) { return renderInlineMarkdownSafe(value); }
function clamp(value, min = 0, max = 100) { return Math.max(min, Math.min(max, Number(value) || 0)); }
function formatStatValue(value) { return `${Math.round(clamp(value))}%`; }
function getLabel(key, lang) { return (LABELS[lang] || LABELS.en)[key] || key; }
function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'default'; } catch (_) { return 'default'; } }
function setTheme(theme) { try { localStorage.setItem(THEME_KEY, theme); } catch (_) {} }

const ICONS_SVG = {
  arousal: (level) => `<svg viewBox="0 0 24 24" fill="${level < 50 ? '#ffaa66' : '#ff5555'}" class="${PFX}-icon ${PFX}-icon-arousal"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
  grudge: (level) => `<svg viewBox="0 0 24 24" fill="${level < 40 ? '#ccaa55' : '#cc5555'}" class="${PFX}-icon ${PFX}-icon-grudge"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
  respect: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="${PFX}-icon"><circle cx="12" cy="8" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>`,
  relationship: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="${PFX}-icon"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  intention: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${PFX}-icon"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  theme: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${PFX}-theme-icon"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2a10 10 0 0 0 0 20 2.5 2.5 0 0 0 2-4 2.5 2.5 0 0 1 2-4h2a4 4 0 0 0 4-4 10 10 0 0 0-10-8z"/></svg>`,
};

export function init(ctx = {}) {
  const $ = ctx.$ || window.jQuery;
  $(document).off('.rpsuiteMetrics')
    .on('click.rpsuiteMetrics', `[data-${PFX}-flip-trigger], .${PFX}-flip-hint, .${PFX}-back-hint`, function (e) {
      if ($(e.target).closest(`[data-${PFX}-theme-toggle], [data-${PFX}-secret-toggle]`).length) return;
      $(this).closest(`.${PFX}-char-card`).toggleClass('flipped');
    })
    .on('click.rpsuiteMetrics', `[data-${PFX}-secret-toggle]`, function (e) {
      e.stopPropagation();
      const $wrap = $(this);
      const $secret = $wrap.find(`.${PFX}-secret-text`);
      const visible = $secret.is(':visible');
      $secret.toggle(!visible);
      $wrap.find(`.${PFX}-secret-lock`).text(visible ? '🔒' : '🔓');
    })
    .on('click.rpsuiteMetrics', `[data-${PFX}-theme-toggle]`, function (e) {
      e.stopPropagation();
      const cur = getTheme();
      const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
      setTheme(next);
      $(`.${PFX}-container`).attr(`data-${PFX}-theme`, next);
    });
}
export function destroy(ctx = {}) { (ctx.$ || window.jQuery)(document).off('.rpsuiteMetrics'); }
export { buildPrompt, parse };

export function getDefaultState() {
  return {
    current: {
      arousal: 0,
      grudge: 0,
      respect: 0,
      relationship: '',
      intention: '',
      insight: '',
    },
    history: [],
  };
}

export function updateState(previousState = getDefaultState(), parsedData = {}, ctx = {}) {
  const previous = previousState?.current || getDefaultState().current;
  const current = Array.isArray(parsedData?.characters) ? { characters: parsedData.characters } : { ...previous, ...parsedData };
  return {
    current,
    history: [
      ...(Array.isArray(previousState?.history) ? previousState.history : []),
      { messageId: ctx.messageId, ts: Date.now(), ...current },
    ].slice(-KEEP_HISTORY),
  };
}

function colorFor(value, type) {
  const v = Number(value) || 0;
  if (type === 'relationship') return v >= 0 ? '#7ec8a0' : '#d47a7a';
  if (type === 'grudge') return v > 70 ? '#ff5555' : '#ccaa55';
  if (type === 'arousal') return v > 70 ? '#ff5555' : '#ffaa66';
  return '#61afef';
}

function normalizeMetricsData(data = {}, ctx = {}) {
  const source = ctx.currentState?.current || data || {};
  const chars = Array.isArray(source.characters) ? source.characters : null;
  if (chars?.length) return chars.map((c) => ({
    name: c.name || c.character || 'Character',
    mood: c.mood || c.relationship || '',
    mood_hex: c.mood_hex || c.color || '#61afef',
    thoughts: c.thoughts || c.insight || '',
    thoughts_hex: c.thoughts_hex || '#abb2bf',
    intention: c.intention || '',
    relationship: Number(c.relationship ?? 0),
    relationship_hex: c.relationship_hex || colorFor(c.relationship, 'relationship'),
    feeling: c.feeling || '',
    arousal: Number(c.arousal ?? 0),
    arousal_hex: c.arousal_hex || colorFor(c.arousal, 'arousal'),
    grudge: Number(c.grudge ?? c.anger ?? 0),
    grudge_hex: c.grudge_hex || colorFor(c.grudge ?? c.anger, 'grudge'),
    respect: c.respect ?? 0,
    respect_hex: c.respect_hex || '#61afef',
    secret: c.secret || c.insight || '',
    insight: c.insight || '',
    color: c.color || c.mood_hex || '#888888',
  }));
  return [{
    name: source.name || ctx.stContext?.name2 || 'Character',
    mood: source.mood || source.relationship || '',
    mood_hex: '#61afef',
    thoughts: source.thoughts || source.insight || '',
    thoughts_hex: '#abb2bf',
    intention: source.intention || '',
    relationship: Number(source.relationship_value ?? 0),
    relationship_hex: colorFor(source.relationship_value ?? 0, 'relationship'),
    feeling: source.relationship || '',
    arousal: Number(source.arousal || 0),
    arousal_hex: colorFor(source.arousal, 'arousal'),
    grudge: Number(source.grudge || 0),
    grudge_hex: colorFor(source.grudge, 'grudge'),
    respect: Number(source.respect || 0),
    respect_hex: '#61afef',
    secret: source.insight || '',
    insight: source.insight || '',
    color: '#888888',
  }];
}

function namePlate(name, color, moodHex) {
  const words = String(name || 'Character').trim().split(/\s+/);
  const base = color || '#888888';
  let html = `<div class="${PFX}-name-plate" style="background:linear-gradient(150deg, ${base}66, ${base}22 55%, rgba(255,255,255,0.06)); border:1px solid ${base}55; box-shadow:0 2px 10px ${(moodHex || base)}33, inset 0 1px 0 rgba(255,255,255,0.15); --${PFX}-char-color:${base};" data-${PFX}-flip-trigger>`;
  words.forEach((word, idx) => {
    if (idx > 0) html += `<div class="${PFX}-name-separator"></div>`;
    html += `<div class="${PFX}-name-col">${[...word].map((l) => `<span class="${PFX}-name-letter">${esc(l)}</span>`).join('')}</div>`;
  });
  return `${html}</div>`;
}

function zones() { return `<span class="${PFX}-zone" style="left:25%"></span><span class="${PFX}-zone" style="left:50%"></span><span class="${PFX}-zone" style="left:75%"></span>`; }
function bidir(value, hex) { const v = clamp(value, -100, 100); const half = Math.abs(v) / 2; const style = v >= 0 ? `left:50%; width:${half}%; background:${hex};` : `right:50%; width:${half}%; background:${hex};`; return `<div class="${PFX}-bidir-track"><div class="${PFX}-bidir-center"></div><div class="${PFX}-bidir-fill" style="${style}"></div></div>`; }

function characterCard(c, lang, first) {
  const arousalPercent = clamp(c.arousal);
  const grudgePercent = clamp(c.grudge);
  const respectPercent = c.respect === 'MAX' ? 100 : clamp(c.respect);
  const themeBtn = first ? `<div class="${PFX}-theme-btn" data-${PFX}-theme-toggle title="Theme">${ICONS_SVG.theme}</div>` : '';
  return `<div class="${PFX}-card-scene"><div class="${PFX}-char-card"><div class="${PFX}-card-inner">
    <div class="${PFX}-card-front" style="background-image:linear-gradient(135deg, ${c.mood_hex}22, transparent 70%); --${PFX}-char-color:${c.color || '#888'};">
      ${namePlate(c.name, c.color, c.mood_hex)}
      <div class="${PFX}-stats">
        <div class="${PFX}-stat mood" style="background:${c.mood_hex}22; border-left:3px solid ${c.mood_hex};"><span class="${PFX}-mood-text" style="color:${c.mood_hex}">${mdInline(c.mood)}</span>${themeBtn}</div>
        <div class="${PFX}-stat thoughts" style="background:${c.thoughts_hex}22; border-left:3px solid ${c.thoughts_hex};"><span class="${PFX}-thoughts-text" style="color:${c.thoughts_hex}">${mdInline(c.thoughts)}</span></div>
        ${c.intention ? `<div class="${PFX}-stat intention" style="background:#ffffff10; border-left:3px solid #c9b8ff;"><span class="${PFX}-stat-icon" style="color:#c9b8ff">${ICONS_SVG.intention}</span><span class="${PFX}-intention-text">${mdInline(c.intention)}</span></div>` : ''}
        <div class="${PFX}-stat relationship" style="background:${c.relationship_hex}22; border-left:3px solid ${c.relationship_hex};"><span class="${PFX}-stat-icon" style="color:${c.relationship_hex}">${ICONS_SVG.relationship}</span><span class="${PFX}-stat-label">${getLabel('relationship', lang)}</span><span class="${PFX}-stat-value">${Math.round(Number(c.relationship) || 0)}</span>${c.feeling ? `<span class="${PFX}-feeling-tag" style="color:${c.relationship_hex}; border-color:${c.relationship_hex}66;">${mdInline(c.feeling)}</span>` : ''}${bidir(c.relationship, c.relationship_hex)}</div>
        <div class="${PFX}-stat arousal ${c.arousal > 80 ? `${PFX}-pulse` : ''}" style="background:${c.arousal_hex}22; border-left:3px solid ${c.arousal_hex};"><span class="${PFX}-stat-icon">${ICONS_SVG.arousal(c.arousal)}</span><span class="${PFX}-stat-label">${getLabel('arousal', lang)}</span><span class="${PFX}-stat-value">${formatStatValue(c.arousal)}${c.arousal > 100 ? `<span class="${PFX}-overload">${getLabel('overload', lang)}</span>` : ''}</span><div class="${PFX}-progress-bar">${zones()}<div class="${PFX}-progress-fill" style="width:${arousalPercent}%; background:${c.arousal_hex};"></div></div></div>
        <div class="${PFX}-stat grudge ${c.grudge > 80 ? `${PFX}-shake` : ''}" style="background:${c.grudge_hex}22; border-left:3px solid ${c.grudge_hex};"><span class="${PFX}-stat-icon">${ICONS_SVG.grudge(c.grudge)}</span><span class="${PFX}-stat-label">${getLabel('grudge', lang)}</span><span class="${PFX}-stat-value">${formatStatValue(c.grudge)}</span><div class="${PFX}-progress-bar">${zones()}<div class="${PFX}-progress-fill" style="width:${grudgePercent}%; background:${c.grudge_hex};"></div></div></div>
        <div class="${PFX}-stat respect" style="background:${c.respect_hex}22; border-left:3px solid ${c.respect_hex};"><span class="${PFX}-stat-icon">${ICONS_SVG.respect}</span><span class="${PFX}-stat-label">${getLabel('respect', lang)}</span><span class="${PFX}-stat-value">${c.respect === 'MAX' ? 'MAX' : formatStatValue(c.respect)}</span><div class="${PFX}-progress-bar">${zones()}<div class="${PFX}-progress-fill" style="width:${respectPercent}%; background:${c.respect_hex};"></div></div></div>
        <div class="${PFX}-secret-wrapper" data-${PFX}-secret-toggle><span class="${PFX}-secret-lock ${PFX}-lock-anim">🔒</span><span class="${PFX}-secret-text" style="display:none;">${mdInline(c.secret || '...')}</span></div>
        <div class="${PFX}-flip-hint">${getLabel('flip', lang)}</div>
      </div>
      ${c.arousal > 80 || c.grudge > 80 ? `<div class="${PFX}-particles ${c.grudge > c.arousal ? 'snowflakes' : 'hearts'}"></div>` : ''}
    </div>
    <div class="${PFX}-card-back" data-${PFX}-flip-trigger style="--${PFX}-char-color:${c.color || '#888'};"><div class="${PFX}-back-content"><div class="${PFX}-back-insight"><span class="${PFX}-insight-label">${getLabel('insight', lang)}</span><span class="${PFX}-insight-text">${mdInline(c.insight || getLabel('noData', lang))}</span></div><div class="${PFX}-back-hint">${getLabel('back', lang)}</div></div></div>
  </div></div></div>`;
}

export function render(data, { lang = 'ru', currentState = null } = {}) {
  const metrics = normalizeMetricsData(data, { currentState });
  if (!metrics.length) return '';
  return `<div class="${PFX}-container" data-${PFX}-theme="${esc(getTheme())}">${metrics.map((c, i) => characterCard(c, lang, i === 0)).join('')}</div>`;
}