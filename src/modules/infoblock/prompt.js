export function buildPrompt({ lang = 'ru' }) {
  const languageRule = lang === 'ru' ? 'All field values must be Russian.' : 'All field values must be English.';
  return `[System Note: Update the fictional world state for the current scene. At the end output ONLY this XML/HTML block with valid JSON inside an HTML comment: <scene_state><!-- {"dateTime":"","location":"","globalConflict":"","characters":[],"keyDetail":"","plotSummary":"","futurePlot":""} --></scene_state>. Keep it concise and useful for continuity. ${languageRule}]`;
}