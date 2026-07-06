export const VIBES = [
  'glassmorphism with frosted blur and soft glowing borders',
  'retro green terminal with scanlines',
  'torn handwritten paper note',
  'neon cyberpunk HUD',
  'aged parchment with wax seal',
  'premium app card',
  'bold magazine spread',
  'sci-fi hologram',
  'cozy chat messenger',
  'vintage computer OS window',
  'mystic tarot panel',
  'detective evidence board',
];

export const DETAIL_BOOSTS = [
  'Add tiny believable details: timestamps, labels, seals, scratches, icons.',
  'Make it feel like a polished live app screen, not a static card.',
  'Use layered depth, subtle shadows and responsive layout.',
  'Include CSS-only motion and micro-interactions.',
];

function pick(arr, count) { return [...arr].sort(() => Math.random() - 0.5).slice(0, count); }
function formatState(state) { try { return JSON.stringify(state ?? null, null, 2); } catch (_) { return 'null'; } }

export function buildPrompt({ lang = 'ru', previousState = null }) {
  const visibleRule = lang === 'ru'
    ? 'Visible text inside <rs_art> must be Russian. data-rs-action text must be Russian.'
    : 'Visible text inside <rs_art> must be English. data-rs-action text must be English.';
  return `[System Note: Whenever the scene contains ANY visual object - a screen, a letter, a note, a document, a UI, a sign, a chat, an app interface, a poster, a card, a map, a HUD or a display - you MUST render it as a rich, LIVE, interactive HTML block. If the scene is pure dialogue with no visual object, you may skip it. But if there is any hint of something visual, rendering it is MANDATORY.

Previous html_creator state:
${formatState(previousState)}

Wrap it EXACTLY like this - RAW HTML directly inside the tag. NO HTML comment wrapper, NO <!-- -->, NO markdown code fences:
<rs_art>
RAW_HTML_HERE
</rs_art>

Do not wrap <rs_art> in markdown fences.

Output AT MOST ONE <rs_art> block per message.

MAKE IT ALIVE (core requirement - never a static box):
- ALWAYS include continuous CSS animation via a <style> block: pulsing dots, shimmering text, moving scanlines, floating particles, rotating rings, glowing borders, breathing gradients, progress fills, etc. The animated elements MUST actually exist in the markup.
- ADD CSS-ONLY INTERACTIVITY (no JS). Use :hover/:active and toggles/switches/tabs/accordions via hidden inputs + labels + :checked selectors.
- Use unique ids with prefix rsa_ so multiple widgets never collide.
- For actions that should AFFECT THE ROLEPLAY, use data-rs-action. The host wires the click and sends the text as the user's action.
- NEVER use <script>, onclick, or any on* handler - they are stripped and will NOT work.

QUALITY BAR:
- Portfolio-grade: multi-layered background, convincing depth, coordinated palette, strong typography, decorative details, at least one animation and one interactive element, generous spacing.
- Use only CSS/HTML, no scripts. All generated classes must use rsa- or rs-art- prefixes.
- Allowed interaction attributes: data-rs-action, data-rs-reply, data-rs-send, data-rs-flip, data-rs-face.

FORBIDDEN:
- HTML comments <!-- --> anywhere.
- Empty placeholders where graphics were promised.
- Visible labels like "Header Section" or "Dossier Body".
- <script>, canvas with JS, on* handlers, javascript: links.
- Reusing the same theme as last time - vary it.

${visibleRule} Vibe hints: ${pick(VIBES, 3).join('; ')}. ${pick(DETAIL_BOOSTS, 1)[0]}]`;
}