import { CARD_NAMES, getDeck } from './decks.js';

function formatState(state) {
  try { return JSON.stringify(state ?? null, null, 2); } catch (_) { return 'null'; }
}

export function buildPrompt({ lang = 'ru', moduleSettings = {}, previousState = null }) {
  const languageRule = lang === 'ru' ? 'The interpretation must be Russian.' : 'The interpretation must be English.';
  const deck = getDeck(moduleSettings.deckStyle);
  return `[System Note: You are a tarot reader in this roleplay. At the very end of the module output, you MUST draw exactly three tarot cards for the current situation.
The cards MUST be chosen TRULY RANDOMLY from the full list provided below. Do NOT pick cards that perfectly match the message, do NOT fall back to the most famous archetypes (like Death, The Lovers, The Fool) unless randomness dictates it. Use a mental dice roll or shuffle to ensure unpredictable selection.
After picking, interpret the three cards together in the context of the RP.

Previous tarot state for reference only (do not regenerate because of visual deck changes):
${formatState(previousState)}

Visual deck hint for rendering only: ${deck.label}. This must NOT affect card choice or interpretation.

Output ONLY a valid JSON object inside a <tarot_reading> XML tag at the VERY END of your response.
Place the JSON inside an HTML comment: <tarot_reading><!-- { ... } --></tarot_reading>

CRITICAL: Output the JSON as a single line, without any line breaks or newlines inside the comment.

Example: <tarot_reading><!-- {"cards": ["The Fool", "Death", "The Star"], "interpretation": "..."} --></tarot_reading>

JSON structure:
{
  "cards": ["string", "string", "string"],
  "interpretation": "string"
}

ABSOLUTE RULES:
- Pick exactly THREE different cards.
- Choose cards RANDOMLY from this exact list: ${CARD_NAMES.join(', ')}.
- DO NOT bias towards famous cards. A spread like "Four of Rings, Eight of Swords, Page of Cups" is equally valid and expected.
- Interpretation must connect the actual random cards to the current RP events, characters, or mood. If the cards seem contradictory, explain the tension creatively.
- ${languageRule}
</tarot_reading>]`;
}