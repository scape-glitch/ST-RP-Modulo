function formatState(state) {
  try { return JSON.stringify(state ?? null, null, 2); } catch (_) { return 'null'; }
}

export function buildPrompt({ lang = 'ru', previousState = null }) {
  const languageRule = lang === 'ru' ? 'All field values must be Russian.' : 'All field values must be English.';
  return `[System Note: Update the fictional world state for the current scene.

Previous scene state:
${formatState(previousState)}

Instruction:
Update from previous scene state. Preserve continuity unless time, location, characters or plot clearly changed.

At the end output ONLY this XML/HTML block with valid JSON inside an HTML comment: <scene_state><!-- {"dateTime":"","location":"","globalConflict":"","characters":[],"keyDetail":"","plotSummary":"","futurePlot":""} --></scene_state>. Keep it concise and useful for continuity. ${languageRule}]`;
}