function formatState(state) {
  try { return JSON.stringify(state ?? null, null, 2); } catch (_) { return 'null'; }
}

export function buildPrompt({ lang = 'ru', previousState = null }) {
  const languageRule = lang === 'ru' ? 'Use Russian names/descriptions.' : 'Use English names/descriptions.';
  return `[System Note: If money, inventory, debts, rewards, purchases, or valuables change in the scene, update a compact wallet state.

Previous wallet state:
${formatState(previousState)}

Instruction:
Preserve existing balance, items and debts unless the latest scene explicitly changes them. Update the wallet from the latest scene.

At the end output ONLY this XML/HTML block with valid JSON inside an HTML comment: <wallet_state><!-- {"currency":"","balance":0,"items":[],"debts":[],"notes":"","transactions":[]} --></wallet_state>. If nothing changed, keep previous state or omit the block. ${languageRule}]`;
}