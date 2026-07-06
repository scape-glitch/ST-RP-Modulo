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

export function buildPrompt({ lang = 'ru' }) {
  const visibleRule = lang === 'ru'
    ? 'Visible text inside <rs_art> must be Russian. data-rs-action text must be Russian.'
    : 'Visible text inside <rs_art> must be English. data-rs-action text must be English.';
  return `[System Note: Whenever the scene contains a visual object (screen, letter, note, document, UI, sign, chat, app interface, poster, card, map, HUD, display), render it as a rich live CSS-only HTML block. If the scene is pure dialogue with no visual object, you may skip. Output at most one raw HTML block per message using exactly this wrapper:
<rs_art>
RAW_HTML_HERE
</rs_art>
Do not use markdown fences. Do not wrap this module in an HTML comment. Include continuous CSS animation via a <style> block. Use only CSS/HTML, no scripts. All generated classes must use rsa- or rs-art- prefixes. Use unique ids with prefix rsa_. Allowed interaction attributes: data-rs-action, data-rs-reply, data-rs-send, data-rs-flip, data-rs-face. ${visibleRule} Vibe hints: ${pick(VIBES, 3).join('; ')}. ${pick(DETAIL_BOOSTS, 1)[0]}]`;
}