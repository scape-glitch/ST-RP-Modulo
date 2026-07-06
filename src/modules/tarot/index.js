import { buildPrompt } from './prompt.js';
import { parse } from './parser.js';
import { getCardImage, getDeck } from './decks.js';
import { KEEP_HISTORY } from '../../core/moduleState.js';
import { renderMarkdownSafe } from '../../core/markdown.js';

function esc(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }

export function init(ctx = {}) {
  const $ = ctx.$ || window.jQuery;
  $(document).off('.rpsuiteTarot')
    .on('click.rpsuiteTarot', '.tarot-card', function (e) {
      e.preventDefault();
      $(this).toggleClass('flipped');
    })
    .on('click.rpsuiteTarot', '[data-tarot-toggle-reading]', function (e) {
      e.preventDefault();
      const $reading = $(this).closest('.tarot-reading');
      $reading.toggleClass('open');
      $reading.find('.tarot-reading-body').stop(true, true).slideToggle(180);
    });
}
export function destroy(ctx = {}) { (ctx.$ || window.jQuery)(document).off('.rpsuiteTarot'); }
export { buildPrompt, parse };

export function getDefaultState() {
  return { current: { cards: [], interpretation: '' }, history: [] };
}

export function updateState(previousState = getDefaultState(), parsedData = {}, ctx = {}) {
  const current = {
    cards: Array.isArray(parsedData.cards) ? parsedData.cards : [],
    interpretation: parsedData.interpretation || '',
  };
  return {
    current,
    history: [
      ...(Array.isArray(previousState?.history) ? previousState.history : []),
      { messageId: ctx.messageId, ts: Date.now(), ...current },
    ].slice(-KEEP_HISTORY),
  };
}

export function render(data, { lang = 'ru', moduleSettings = {}, currentState = null } = {}) {
  data = currentState?.current || data;
  const deckStyle = moduleSettings.deckStyle || 'classic';
  const deck = getDeck(deckStyle);
  if (!Array.isArray(data?.cards) || !data.cards.length) return '';
  console.log('[RP Suite][Tarot] deckStyle:', deckStyle, data.cards);
  const cards = data.cards.map((name) => {
    const img = getCardImage(name, deckStyle);
    return `<div class="tarot-card"><div class="tarot-card-inner"><div class="tarot-card-front"><img src="${esc(img)}" alt="${esc(name)}" loading="lazy"></div><div class="tarot-card-back"><img src="${esc(deck.back)}" alt="Card back" loading="lazy"></div></div></div>`;
  }).join('');
  const label = lang === 'ru' ? 'Раскрыть расклад' : 'Reveal Reading';
  return `<div class="${deck.className}"><div class="tarot-container"><div class="tarot-cards">${cards}</div><div class="tarot-reading"><div class="tarot-reading-header" data-tarot-toggle-reading><span class="tarot-header-icon">🔮</span><span class="tarot-header-label">${esc(label)}</span><span class="tarot-chevron">▼</span></div><div class="tarot-reading-body" style="display:none;"><div class="tarot-reading-text">${renderMarkdownSafe(data.interpretation, { compact: true })}</div></div></div></div></div>`;
}