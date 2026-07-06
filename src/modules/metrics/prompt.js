function formatState(state) {
  try { return JSON.stringify(state ?? null, null, 2); } catch (_) { return 'null'; }
}

export function buildPrompt({ lang = 'ru', previousState = null }) {
  const languageRule = lang === 'ru' ? 'All visible labels and insight text must be Russian.' : 'All visible labels and insight text must be English.';
  return `[System Note: Track the emotional/relationship metrics for the current roleplay scene.

Previous metrics state:
${formatState(previousState)}

Instruction:
Update these metrics gradually based on the latest scene. Do not reset values unless the previous state is invalid or the story clearly resets.

At the very end of your response output ONLY this XML/HTML block with valid JSON inside an HTML comment: <rs_metrics><!-- {"arousal":0,"grudge":0,"respect":0,"relationship":"","intention":"","insight":""} --></rs_metrics>. Values arousal/grudge/respect are integers 0-100. Do not mention the hidden block in normal prose. ${languageRule}]`;
}