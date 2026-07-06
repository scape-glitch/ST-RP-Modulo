export function buildPrompt({ lang = 'ru' }) {
  const languageRule = lang === 'ru' ? 'Use Russian names/descriptions.' : 'Use English names/descriptions.';
  return `[System Note: If money, inventory, debts, rewards, purchases, or valuables change in the scene, update a compact wallet state. At the end output ONLY this XML/HTML block with valid JSON inside an HTML comment: <wallet_state><!-- {"currency":"","balance":0,"items":[],"debts":[],"notes":""} --></wallet_state>. If nothing changed, keep previous state or omit the block. ${languageRule}]`;
}