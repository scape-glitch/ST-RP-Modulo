export function buildPrompt({ lang = 'ru' }) {
  const languageRule = lang === 'ru' ? 'Use Russian names/descriptions.' : 'Use English names/descriptions.';
  return `[System Note: If money, inventory, debts, rewards, purchases, or valuables change in the scene, update a compact wallet state. At the end output valid JSON inside <wallet_state> tags, JSON in an HTML comment: <wallet_state><!-- {"balance":"...","currency":"...","items":[{"name":"...","qty":1,"note":"..."}],"log":["..."]} --></wallet_state>. If nothing changed, keep previous state or omit. ${languageRule}]`;
}