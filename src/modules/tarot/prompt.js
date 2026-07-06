import { CARD_NAMES, getDeck } from './decks.js';

export function buildPrompt({ lang = 'ru', moduleSettings = {} }) {
  const languageRule = lang === 'ru' ? 'The interpretation must be Russian.' : 'The interpretation must be English.';
  const deck = getDeck(moduleSettings.deckStyle);
  return `[System Note: You are a tarot reader in this roleplay. At the very end of your message, draw exactly three truly random tarot cards for the current situation. Use deck style hint: ${deck.label}. Output ONLY this XML/HTML block with valid JSON inside an HTML comment: <tarot_reading><!-- {"cards":["Card 1","Card 2","Card 3"],"interpretation":"text"} --></tarot_reading>. Pick exactly THREE different cards from this list: ${CARD_NAMES.join(', ')}. Do not bias toward famous cards. ${languageRule}]`;
}